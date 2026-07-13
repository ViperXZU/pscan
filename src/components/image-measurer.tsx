import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { Alert, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  AutoDetectUnavailableError,
  detectDominantEdge,
  traceEdgeAlongGuide,
} from '@/lib/autoDetect';
import { computeContainTransform, imageToLayout, layoutToImage } from '@/lib/imageMapping';
import { buildSegments } from '@/lib/polyline';
import { formatDegrees } from '@/lib/slope';
import type { Point } from '@/lib/types';

import { PrimaryButton } from './primary-button';
import { SlopeOverlay } from './slope-overlay';

/** Radio (en pt de layout) dentro del cual un toque "agarra" un vértice existente. */
const GRAB_RADIUS_PT = 28;
/** Movimiento máximo (pt) para que un gesto siga contando como toque simple. */
const TAP_SLOP_PT = 8;
/** Zoom máximo de la foto (pellizco con 2 dedos). */
const MAX_ZOOM = 5;

type Props = {
  uri: string;
  initialImgW: number;
  initialImgH: number;
  onDone: (points: Point[]) => void;
};

/**
 * Caja de medición de polilínea: muestra la foto con contentFit="contain" y deja
 * marcar varios puntos sobre el/los borde(s) del objeto. Cada par consecutivo es
 * un tramo con su pendiente; juntos forman una función lineal por tramos.
 * Los vértices se guardan SIEMPRE en px de imagen (fuente de verdad) y solo se
 * convierten a layout para dibujar.
 */
export function ImageMeasurer({ uri, initialImgW, initialImgH, onDone }: Props) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(
    initialImgW > 0 && initialImgH > 0 ? { w: initialImgW, h: initialImgH } : null,
  );
  const [points, setPoints] = useState<Point[]>([]); // px de imagen
  const [detecting, setDetecting] = useState(false);

  const dragIndex = useRef<number | null>(null);
  const grantPos = useRef<Point | null>(null);
  const movedBeyondSlop = useRef(false);

  // --- Zoom por pellizco (2 dedos) + desplazamiento (2 dedos) ---------------
  // Un dedo sigue reservado para colocar/arrastrar puntos. Las coordenadas de
  // los toques (locationX/Y) son locales a la vista transformada, así que el
  // mapeo toque→píxel de imagen sigue siendo válido con cualquier zoom.
  const zoomScale = useSharedValue(1);
  const savedZoom = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(Math.max(savedZoom.value * e.scale, 1), MAX_ZOOM);
      zoomScale.value = next;
      if (box) {
        const maxX = (box.w * (next - 1)) / 2;
        const maxY = (box.h * (next - 1)) / 2;
        panX.value = Math.min(Math.max(panX.value, -maxX), maxX);
        panY.value = Math.min(Math.max(panY.value, -maxY), maxY);
      }
    })
    .onEnd(() => {
      savedZoom.value = zoomScale.value;
      savedPanX.value = panX.value;
      savedPanY.value = panY.value;
      if (zoomScale.value <= 1.02) {
        zoomScale.value = withTiming(1);
        panX.value = withTiming(0);
        panY.value = withTiming(0);
        savedZoom.value = 1;
        savedPanX.value = 0;
        savedPanY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onUpdate((e) => {
      if (!box) return;
      const maxX = (box.w * (zoomScale.value - 1)) / 2;
      const maxY = (box.h * (zoomScale.value - 1)) / 2;
      panX.value = Math.min(Math.max(savedPanX.value + e.translationX, -maxX), maxX);
      panY.value = Math.min(Math.max(savedPanY.value + e.translationY, -maxY), maxY);
    })
    .onEnd(() => {
      savedPanX.value = panX.value;
      savedPanY.value = panY.value;
    });

  const zoomGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  useAnimatedReaction(
    () => zoomScale.value > 1.02,
    (zoomed, prev) => {
      if (zoomed !== prev) runOnJS(setIsZoomed)(zoomed);
    },
  );

  const zoomStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: zoomScale.value },
    ],
  }));

  const resetZoom = () => {
    zoomScale.value = withTiming(1);
    panX.value = withTiming(0);
    panY.value = withTiming(0);
    savedZoom.value = 1;
    savedPanX.value = 0;
    savedPanY.value = 0;
  };
  // --------------------------------------------------------------------------

  const transform = useMemo(
    () =>
      box && imgSize
        ? computeContainTransform({ imgW: imgSize.w, imgH: imgSize.h, boxW: box.w, boxH: box.h })
        : null,
    [box, imgSize],
  );

  const layoutPoints = useMemo(
    () => (transform ? points.map((p) => imageToLayout(p, transform)) : []),
    [points, transform],
  );

  const segments = useMemo(() => buildSegments(points), [points]);
  const segmentLabels = useMemo(
    () => segments.map((s) => formatDegrees(s.slope)),
    [segments],
  );

  const onBoxLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  const findGrabIndex = (pt: Point): number | null => {
    let best: number | null = null;
    let bestDist = GRAB_RADIUS_PT;
    layoutPoints.forEach((lp, i) => {
      const d = Math.hypot(lp.x - pt.x, lp.y - pt.y);
      if (d <= bestDist) {
        best = i;
        bestDist = d;
      }
    });
    return best;
  };

  const onGrant = (e: GestureResponderEvent) => {
    const pt = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    grantPos.current = pt;
    movedBeyondSlop.current = false;
    dragIndex.current = transform ? findGrabIndex(pt) : null;
  };

  const onMove = (e: GestureResponderEvent) => {
    if (!transform) return;
    const pt = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    if (
      grantPos.current &&
      Math.hypot(pt.x - grantPos.current.x, pt.y - grantPos.current.y) > TAP_SLOP_PT
    ) {
      movedBeyondSlop.current = true;
    }
    if (dragIndex.current === null) return;
    const img = layoutToImage(pt, transform, 'clamp');
    if (!img) return;
    setPoints((prev) => prev.map((p, i) => (i === dragIndex.current ? img : p)));
  };

  const onRelease = (e: GestureResponderEvent) => {
    const wasDragging = dragIndex.current !== null;
    dragIndex.current = null;
    if (wasDragging || movedBeyondSlop.current || !transform) return;

    // Toque simple sin arrastre: añadir un vértice (se ignora el letterbox).
    const img = layoutToImage(
      { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY },
      transform,
    );
    if (!img) return;
    setPoints((prev) => [...prev, img]);
  };

  const undo = () => setPoints((prev) => prev.slice(0, -1));
  const clearPoints = () => setPoints([]);

  // Con ≥2 puntos el botón "imanta" la guía a la curva real; con menos, busca
  // la línea recta dominante de toda la foto.
  const guideMode = points.length >= 2;

  const autoDetect = async () => {
    if (!imgSize || detecting) return;
    setDetecting(true);
    try {
      if (guideMode) {
        const snapped = await traceEdgeAlongGuide({
          uri,
          imgW: imgSize.w,
          imgH: imgSize.h,
          guide: points,
        });
        if (snapped) {
          setPoints(snapped);
        } else {
          Alert.alert(
            'Sin resultado',
            'No se encontró un borde claro cerca de tu trazo. Acerca los puntos al borde del objeto y reintenta, o sigue marcando manualmente.',
          );
        }
        return;
      }

      const segment = await detectDominantEdge({
        uri,
        imgW: imgSize.w,
        imgH: imgSize.h,
        near: points[points.length - 1] ?? null,
      });
      if (segment) {
        setPoints([segment.a, segment.b]);
      } else {
        Alert.alert(
          'Sin resultado',
          'No se encontró un borde claro en la foto. Marca los puntos manualmente.',
        );
      }
    } catch (error) {
      if (error instanceof AutoDetectUnavailableError) {
        Alert.alert(
          'No disponible en Expo Go',
          'La detección automática usa OpenCV (código nativo) y necesita un development build. Mientras tanto puedes marcar los puntos manualmente.',
        );
      } else {
        Alert.alert('Error', 'No se pudo procesar la imagen. Marca los puntos manualmente.');
      }
    } finally {
      setDetecting(false);
    }
  };

  const canFinish = segments.length >= 1;
  const lastSeg = segments[segments.length - 1];
  const steepest = segments.length
    ? segments.reduce((a, b) => (b.slope.slopeDeg > a.slope.slopeDeg ? b : a))
    : null;
  const dense = segments.length > 6;

  const hint =
    points.length === 0
      ? 'Toca el primer punto sobre el borde · pellizca con 2 dedos para hacer zoom'
      : points.length === 1
        ? 'Toca el siguiente punto para cerrar el primer tramo'
        : dense
          ? 'Trazo ajustado a la curva · arrastra un punto para corregirlo'
          : 'Sigue tocando para añadir tramos · con 2+ puntos, "Ajustar a la curva" lo imanta al borde';

  return (
    <View className="flex-1 px-4">
      <View className="flex-row items-center justify-between py-3">
        <Text className="text-lg font-bold text-neutral-900">
          Marca el borde{segments.length > 1 ? ` · ${segments.length} tramos` : ''}
        </Text>
        <View className="flex-row gap-4">
          <Pressable onPress={undo} hitSlop={8} disabled={points.length === 0}>
            <Text
              className={`text-sm font-semibold ${points.length ? 'text-blue-600' : 'text-neutral-300'}`}>
              Deshacer
            </Text>
          </Pressable>
          <Pressable onPress={clearPoints} hitSlop={8} disabled={points.length === 0}>
            <Text
              className={`text-sm font-semibold ${points.length ? 'text-blue-600' : 'text-neutral-300'}`}>
              Limpiar
            </Text>
          </Pressable>
        </View>
      </View>

      <GestureDetector gesture={zoomGesture}>
        <View className="flex-1 overflow-hidden rounded-2xl bg-neutral-950" onLayout={onBoxLayout}>
          <Animated.View style={[{ flex: 1 }, zoomStyle]}>
            <Image
              source={{ uri }}
              style={{ flex: 1 }}
              contentFit="contain"
              onLoad={(e) => {
                // Solo como respaldo si no llegaron dimensiones: las fotos ya
                // vienen normalizadas (EXIF aplicado) desde cámara/galería.
                if (imgSize) return;
                const { width, height } = e.source;
                if (width > 0 && height > 0) setImgSize({ w: width, h: height });
              }}
            />
            {box ? (
              <View
                className="absolute inset-0"
                onStartShouldSetResponder={() => true}
                onResponderGrant={onGrant}
                onResponderMove={onMove}
                onResponderRelease={onRelease}
                onResponderTerminate={() => {
                  dragIndex.current = null;
                }}>
                <SlopeOverlay
                  width={box.w}
                  height={box.h}
                  points={layoutPoints}
                  segmentLabels={segmentLabels}
                />
              </View>
            ) : null}
          </Animated.View>

          {isZoomed ? (
            <Pressable
              onPress={resetZoom}
              hitSlop={8}
              className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5">
              <Text className="text-xs font-semibold text-white">1×</Text>
            </Pressable>
          ) : null}
        </View>
      </GestureDetector>

      <View className="py-3">
        <Text className="text-center text-sm text-neutral-500">{hint}</Text>
        <Text className="mt-1 text-center text-2xl font-bold text-neutral-900">
          {dense && steepest
            ? `${segments.length} tramos · máx ${formatDegrees(steepest.slope)}`
            : lastSeg
              ? `Último tramo: ${formatDegrees(lastSeg.slope)}`
              : '—'}
        </Text>
      </View>

      <View className="gap-3 pb-4">
        <PrimaryButton
          title={
            detecting
              ? 'Detectando…'
              : guideMode
                ? 'Ajustar a la curva (auto)'
                : 'Detectar borde automáticamente'
          }
          variant="secondary"
          onPress={autoDetect}
          disabled={detecting || !imgSize}
        />
        <PrimaryButton
          title={segments.length > 1 ? 'Ver función y resultados' : 'Ver resultados'}
          onPress={() => {
            if (canFinish) onDone(points);
          }}
          disabled={!canFinish}
        />
      </View>
    </View>
  );
}
