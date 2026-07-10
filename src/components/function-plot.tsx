import { useMemo } from 'react';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { Point } from '@/lib/types';

const ACCENT = '#2563eb';
const CURVE = '#dc2626';

type Props = {
  /** Vértices de la polilínea en px de imagen. */
  points: Point[];
  /** Curva ajustada (muestreada) en px de imagen, opcional. */
  curve?: Point[] | null;
  width: number;
  height: number;
};

/**
 * Dibuja la polilínea (y opcionalmente la curva ajustada) como una función en
 * un marco matemático limpio: x a la derecha, y hacia arriba, escala uniforme
 * para conservar la forma real. Estilo GeoGebra minimalista.
 */
export function FunctionPlot({ points, curve, width, height }: Props) {
  const geom = useMemo(() => {
    if (points.length < 2 || width <= 0 || height <= 0) return null;

    const all = curve && curve.length ? [...points, ...curve] : points;
    const originX = Math.min(...all.map((p) => p.x));
    const baseY = Math.max(...all.map((p) => p.y));
    // Marco matemático: X a la derecha, Y hacia arriba.
    const toMath = (p: Point) => ({ X: p.x - originX, Y: baseY - p.y });
    const m = all.map(toMath);

    const xs = m.map((q) => q.X);
    const ys = m.map((q) => q.Y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    const pad = 24;
    const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
    const drawW = spanX * scale;
    const drawH = spanY * scale;
    const offX = pad + (width - 2 * pad - drawW) / 2;
    const offY = pad + (height - 2 * pad - drawH) / 2;

    // px de imagen → pantalla del plot (y invertida para SVG).
    const toScreen = (p: Point) => {
      const q = toMath(p);
      return {
        x: offX + (q.X - minX) * scale,
        y: height - offY - (q.Y - minY) * scale,
      };
    };

    return {
      pointsScreen: points.map(toScreen),
      curveScreen: curve && curve.length ? curve.map(toScreen) : null,
      baselineY: height - offY,
      axisX: offX,
    };
  }, [points, curve, width, height]);

  if (!geom) return null;

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((s, i) => `${i === 0 ? 'M' : 'L'} ${s.x} ${s.y}`).join(' ');

  return (
    <Svg width={width} height={height}>
      {/* Ejes suaves */}
      <Line x1={geom.axisX} y1={12} x2={geom.axisX} y2={geom.baselineY} stroke="#e5e5e5" strokeWidth={1.5} />
      <Line
        x1={geom.axisX}
        y1={geom.baselineY}
        x2={width - 12}
        y2={geom.baselineY}
        stroke="#e5e5e5"
        strokeWidth={1.5}
      />
      <SvgText x={geom.axisX + 4} y={20} fill="#a3a3a3" fontSize={11} fontWeight="bold">
        y
      </SvgText>
      <SvgText x={width - 14} y={geom.baselineY - 6} fill="#a3a3a3" fontSize={11} fontWeight="bold" textAnchor="end">
        x
      </SvgText>

      {/* Los datos medidos: atenuados cuando hay curva ajustada encima. */}
      <Path
        d={toPath(geom.pointsScreen)}
        stroke={ACCENT}
        strokeWidth={geom.curveScreen ? 2 : 3}
        opacity={geom.curveScreen ? 0.45 : 1}
        fill="none"
        strokeLinejoin="round"
      />
      {geom.pointsScreen.length <= 24
        ? geom.pointsScreen.map((s, i) => (
            <Circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={geom.curveScreen ? 3 : 4.5}
              fill={ACCENT}
              opacity={geom.curveScreen ? 0.55 : 1}
            />
          ))
        : null}

      {/* La curva ajustada (la "función" no lineal). */}
      {geom.curveScreen ? (
        <Path d={toPath(geom.curveScreen)} stroke={CURVE} strokeWidth={3} fill="none" />
      ) : null}
    </Svg>
  );
}
