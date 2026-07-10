import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AngleGlyph } from '@/components/angle-glyph';
import { FunctionPlot } from '@/components/function-plot';
import { PrimaryButton } from '@/components/primary-button';
import { ResultCard } from '@/components/result-card';
import { SlopeOverlay } from '@/components/slope-overlay';
import { evalPoly, fitBestPolynomial, formatPolynomial } from '@/lib/curveFit';
import { computeContainTransform, imageToLayout } from '@/lib/imageMapping';
import {
  buildPiecewise,
  buildSegments,
  formatDomain,
  formatPiece,
  toMathFrame,
  type PolylineSegment,
} from '@/lib/polyline';
import { formatDegrees, formatGrade, formatRatio, formatSlopeM, interpretSlope } from '@/lib/slope';
import type { Point } from '@/lib/types';

/** Color según la severidad (0 plano → 6 vertical). */
const LEVEL_STYLES: Record<number, { bg: string; text: string; glyph: string; dot: string }> = {
  0: { bg: 'bg-neutral-100', text: 'text-neutral-700', glyph: '#525252', dot: 'bg-neutral-400' },
  1: { bg: 'bg-emerald-50', text: 'text-emerald-700', glyph: '#059669', dot: 'bg-emerald-500' },
  2: { bg: 'bg-emerald-50', text: 'text-emerald-700', glyph: '#059669', dot: 'bg-emerald-500' },
  3: { bg: 'bg-amber-50', text: 'text-amber-700', glyph: '#d97706', dot: 'bg-amber-500' },
  4: { bg: 'bg-orange-50', text: 'text-orange-700', glyph: '#ea580c', dot: 'bg-orange-500' },
  5: { bg: 'bg-red-50', text: 'text-red-700', glyph: '#dc2626', dot: 'bg-red-500' },
  6: { bg: 'bg-red-100', text: 'text-red-800', glyph: '#b91c1c', dot: 'bg-red-600' },
};

const DIR_ARROW: Record<PolylineSegment['direction'], string> = {
  up: '↗',
  down: '↘',
  flat: '→',
  vertical: '↑',
};

/** Muestras de la curva ajustada, en px de imagen, para dibujarla en el plot. */
const CURVE_SAMPLES = 60;
/** Con más tramos que esto, las listas por tramo se sustituyen por un resumen. */
const MAX_LISTED_SEGMENTS = 8;

/** Miniatura de la foto con la polilínea medida superpuesta. */
function ThumbnailWithPolyline({ uri, points }: { uri: string; points: Point[] }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const transform =
    box && imgSize
      ? computeContainTransform({ imgW: imgSize.w, imgH: imgSize.h, boxW: box.w, boxH: box.h })
      : null;
  const layoutPoints = transform ? points.map((p) => imageToLayout(p, transform)) : [];

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  return (
    <View className="h-48 overflow-hidden rounded-2xl bg-neutral-950" onLayout={onLayout}>
      <Image
        source={{ uri }}
        style={{ flex: 1 }}
        contentFit="contain"
        onLoad={(e) => {
          const { width, height } = e.source;
          if (width > 0 && height > 0) setImgSize({ w: width, h: height });
        }}
      />
      {box ? (
        <View className="absolute inset-0" pointerEvents="none">
          <SlopeOverlay width={box.w} height={box.h} points={layoutPoints} />
        </View>
      ) : null}
    </View>
  );
}

function HelpRow({ term, children }: { term: string; children: string }) {
  return (
    <View className="mb-2">
      <Text className="text-sm font-semibold text-neutral-800">{term}</Text>
      <Text className="text-xs leading-5 text-neutral-500">{children}</Text>
    </View>
  );
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { points: pointsParam, uri } = useLocalSearchParams<{ points?: string; uri?: string }>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [plotW, setPlotW] = useState(0);

  const points = useMemo<Point[]>(() => {
    try {
      const parsed = JSON.parse(pointsParam ?? '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [pointsParam]);

  const segments = useMemo(() => buildSegments(points), [points]);
  const piecewise = useMemo(() => buildPiecewise(points), [points]);

  // Ajuste de curva (grado 1-3): la "función" no lineal del trazo.
  const fit = useMemo(() => {
    if (points.length < 3 || !piecewise.isFunction) return null;
    return fitBestPolynomial(toMathFrame(points).pts);
  }, [points, piecewise.isFunction]);

  // Curva muestreada de vuelta en px de imagen, para el plot.
  const curvePoints = useMemo<Point[] | null>(() => {
    if (!fit || fit.degree < 2) return null;
    const { origin, pts } = toMathFrame(points);
    const xs = pts.map((p) => p.X);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const out: Point[] = [];
    for (let i = 0; i <= CURVE_SAMPLES; i++) {
      const X = minX + ((maxX - minX) * i) / CURVE_SAMPLES;
      const Y = evalPoly(fit.coeffs, X);
      out.push({ x: origin.x + X, y: origin.y - Y });
    }
    return out;
  }, [fit, points]);

  if (segments.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center gap-4 bg-white px-8"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Text className="text-center text-neutral-500">No hay una medición válida.</Text>
        <PrimaryButton title="Volver" onPress={() => router.dismissAll()} />
      </View>
    );
  }

  const isMulti = segments.length > 1;
  const dense = segments.length > MAX_LISTED_SEGMENTS;
  // Tramo más empinado: resume la severidad de todo el trazo.
  const steepest = segments.reduce((a, b) => (b.slope.slopeDeg > a.slope.slopeDeg ? b : a));
  const interpretation = interpretSlope(steepest.slope);
  const tone = LEVEL_STYLES[interpretation.level];

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ScrollView className="flex-1 px-6 pt-4" contentContainerClassName="pb-4">
        <Text className="text-2xl font-bold text-neutral-900">Resultados</Text>

        {uri ? <View className="mt-4"><ThumbnailWithPolyline uri={uri} points={points} /></View> : null}

        {/* Interpretación (del tramo más empinado). */}
        <View className={`mt-4 flex-row items-center gap-3 rounded-2xl p-4 ${tone.bg}`}>
          <AngleGlyph deg={steepest.slope.slopeDeg} color={tone.glyph} />
          <View className="flex-1">
            <Text className={`text-lg font-bold ${tone.text}`}>
              {interpretation.title}
              {isMulti ? ' (tramo más empinado)' : ''}
            </Text>
            <Text className="mt-0.5 text-xs leading-5 text-neutral-600">
              {interpretation.description}
            </Text>
          </View>
        </View>

        {isMulti ? (
          <>
            {/* La función: plot con la curva ajustada encima si existe. */}
            <Text className="mt-6 text-lg font-bold text-neutral-900">La función del trazo</Text>
            <View
              className="mt-2 rounded-2xl border border-neutral-100 bg-neutral-50"
              style={{ height: 200 }}
              onLayout={(e) => setPlotW(e.nativeEvent.layout.width)}>
              {plotW > 0 ? (
                <FunctionPlot points={points} curve={curvePoints} width={plotW} height={200} />
              ) : null}
            </View>

            {/* Curva ajustada: la función NO lineal en una sola ecuación. */}
            {fit ? (
              <View className="mt-3 rounded-2xl border border-neutral-100 p-4">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs uppercase tracking-widest text-neutral-500">
                    Curva ajustada
                  </Text>
                  <Text className="text-xs text-neutral-400">
                    {fit.degree === 1 ? 'recta' : fit.degree === 2 ? 'parábola' : 'cúbica'} · R² ={' '}
                    {fit.r2.toFixed(3)}
                  </Text>
                </View>
                <Text className="mt-2 font-mono text-base text-neutral-900">
                  {formatPolynomial(fit.coeffs)}
                </Text>
                <Text className="mt-2 text-xs leading-5 text-neutral-400">
                  Una sola ecuación que resume todo el trazo (R² cercano a 1 = encaja muy bien).
                  x, y en píxeles desde la esquina inferior-izquierda del trazo.
                </Text>
              </View>
            ) : null}

            {piecewise.isFunction ? (
              !dense ? (
                <View className="mt-3 rounded-2xl border border-neutral-100 p-4">
                  <Text className="text-xs uppercase tracking-widest text-neutral-500">
                    Por tramos (exacta)
                  </Text>
                  <View className="mt-2">
                    {piecewise.pieces.map((pc, i) => (
                      <View key={i} className={i > 0 ? 'mt-2' : ''}>
                        <Text className="font-mono text-sm text-neutral-800">{formatPiece(pc)}</Text>
                        <Text className="font-mono text-xs text-neutral-400">{formatDomain(pc)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null
            ) : (
              <View className="mt-3 rounded-2xl bg-amber-50 p-4">
                <Text className="text-sm font-semibold text-amber-700">No es una función</Text>
                <Text className="mt-0.5 text-xs leading-5 text-amber-600">{piecewise.reason}</Text>
              </View>
            )}

            {/* Pendiente por tramo (o resumen si el trazo es denso). */}
            {!dense ? (
              <>
                <Text className="mt-6 text-lg font-bold text-neutral-900">Pendiente por tramo</Text>
                <View className="mt-2 gap-2">
                  {segments.map((s) => {
                    const dot = LEVEL_STYLES[interpretSlope(s.slope).level].dot;
                    return (
                      <View
                        key={s.index}
                        className="flex-row items-center gap-3 rounded-xl border border-neutral-100 px-4 py-3">
                        <View className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                        <Text className="w-16 text-sm font-semibold text-neutral-700">
                          Tramo {s.index + 1}
                        </Text>
                        <Text className="flex-1 text-sm text-neutral-900">
                          {DIR_ARROW[s.direction]} {formatDegrees(s.slope)}
                        </Text>
                        <Text className="w-16 text-right text-sm text-neutral-500">
                          {formatGrade(s.slope)}
                        </Text>
                        <Text className="w-20 text-right text-sm text-neutral-500">
                          m {formatSlopeM(s.slope)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View className="mt-3 rounded-xl border border-neutral-100 px-4 py-3">
                <Text className="text-sm text-neutral-700">
                  Trazo denso ({segments.length} tramos, ajustado a la curva): usa la curva de
                  arriba como resumen. Ángulo máximo {formatDegrees(steepest.slope)} (
                  {formatGrade(steepest.slope)}).
                </Text>
              </View>
            )}
          </>
        ) : (
          // Un solo tramo: las cifras grandes de siempre.
          <View className="mt-4 gap-3">
            <ResultCard
              label="Ángulo"
              value={formatDegrees(steepest.slope)}
              caption="Inclinación respecto al suelo (0° plano · 90° pared)"
            />
            <ResultCard
              label="Pendiente (%)"
              value={formatGrade(steepest.slope)}
              caption="Cuánto subes por cada 100 que avanzas en horizontal"
            />
            <ResultCard
              label="Pendiente (m)"
              value={formatSlopeM(steepest.slope)}
              caption="El número puro: subes m por cada 1 (m = tan θ = %/100). Es la m de y = m·x + b"
            />
            <ResultCard
              label="Proporción"
              value={formatRatio(steepest.slope)}
              caption="Avanzas N en horizontal por cada 1 que subes"
            />
          </View>
        )}

        {/* Ayuda: qué significa cada cifra. */}
        <Pressable
          onPress={() => setHelpOpen((v) => !v)}
          className="mt-4 flex-row items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
          <Text className="text-sm font-semibold text-neutral-700">¿Qué significa cada número?</Text>
          <Text className="text-neutral-400">{helpOpen ? '▲' : '▼'}</Text>
        </Pressable>
        {helpOpen ? (
          <View className="mt-2 rounded-xl border border-neutral-100 px-4 py-3">
            <HelpRow term="Grados (°)">
              La inclinación respecto al suelo. 0° es totalmente plano y 90° es una pared vertical.
            </HelpRow>
            <HelpRow term="Pendiente (%)">
              Cuánto subes por cada 100 que avanzas en horizontal. 100 % equivale a 45°. No tiene
              tope: cuanto más vertical, más crece.
            </HelpRow>
            <HelpRow term="Pendiente (m) — el número">
              Cuánto subes por cada 1 que avanzas (no por 100, como el %). Es m = tan(ángulo) = %/100
              y es la misma m de la ecuación y = m·x + b. Ej.: 33 % → m = 0.33 (subes 1 por cada 3).
            </HelpRow>
            <HelpRow term="Proporción (1 : N)">
              Por cada 1 que subes, avanzas N en horizontal. Una rampa accesible típica es 1 : 12.
            </HelpRow>
            <HelpRow term="Curva ajustada">
              Una sola ecuación (recta, parábola o cúbica) que mejor pasa por tus puntos, elegida
              por mínimos cuadrados. R² mide qué tan bien encaja (1 = pasa exacto por los puntos).
              Permite que la función suba y baje, no solo tramos rectos.
            </HelpRow>
            <HelpRow term="Función por tramos">
              La versión exacta: cada tramo recto con su propia ecuación y = m·x + b en su dominio.
            </HelpRow>
          </View>
        ) : null}

        <Text className="mt-4 text-xs leading-5 text-neutral-400">
          Medido sobre la foto. Coincide con la realidad cuando la foto se toma nivelada y de frente;
          los ángulos oblicuos introducen error de perspectiva.
        </Text>
      </ScrollView>

      <View className="px-6 pb-8 pt-2">
        <PrimaryButton title="Reintentar" onPress={() => router.dismissAll()} />
      </View>
    </View>
  );
}
