import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import type { Point } from '@/lib/types';

const ACCENT = '#2563eb';

type Props = {
  width: number;
  height: number;
  /** Vértices de la polilínea en coordenadas de layout (ya mapeados desde px de imagen). */
  points: Point[];
  /** Etiqueta por tramo (p. ej. el ángulo). Longitud esperada: points.length - 1. */
  segmentLabels?: string[];
  /** Índice de tramo a resaltar (0 = entre los puntos 0 y 1). */
  highlightIndex?: number | null;
  color?: string;
};

/** Capa de dibujo pura: polilínea con vértices numerados y etiquetas por tramo. */
export function SlopeOverlay({
  width,
  height,
  points,
  segmentLabels,
  highlightIndex,
  color = ACCENT,
}: Props) {
  if (width <= 0 || height <= 0 || points.length === 0) return null;

  // Trazo denso (p. ej. ajustado a la curva): puntos pequeños y sin rótulos,
  // para que no tapen la propia curva.
  const dense = points.length > 12;

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <Svg width={width} height={height} pointerEvents="none">
      {points.length > 1 ? (
        <Path d={pathD} stroke={color} strokeWidth={3} fill="none" strokeLinejoin="round" />
      ) : null}

      {/* Tramo seleccionado: resaltado ámbar por encima de la polilínea. */}
      {highlightIndex != null && highlightIndex >= 0 && highlightIndex + 1 < points.length ? (
        <Line
          x1={points[highlightIndex].x}
          y1={points[highlightIndex].y}
          x2={points[highlightIndex + 1].x}
          y2={points[highlightIndex + 1].y}
          stroke="#f59e0b"
          strokeWidth={5}
          strokeLinecap="round"
        />
      ) : null}

      {segmentLabels && !dense
        ? points.slice(1).map((p, i) => {
            const a = points[i];
            const mx = (a.x + p.x) / 2;
            const my = (a.y + p.y) / 2;
            return (
              <SvgText
                key={`lbl-${i}`}
                x={mx}
                y={my - 10}
                fill="#ffffff"
                stroke="#00000066"
                strokeWidth={0.5}
                fontSize={15}
                fontWeight="bold"
                textAnchor="middle">
                {segmentLabels[i]}
              </SvgText>
            );
          })
        : null}

      {points.map((p, i) => (
        <Circle
          key={`dot-bg-${i}`}
          cx={p.x}
          cy={p.y}
          r={dense ? 5.5 : 10}
          fill="#ffffff"
          opacity={0.95}
        />
      ))}
      {points.map((p, i) => (
        <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={dense ? 3 : 6} fill={color} />
      ))}
      {!dense
        ? points.map((p, i) => (
            <SvgText
              key={`num-${i}`}
              x={p.x}
              y={p.y - 15}
              fill="#ffffff"
              stroke="#00000066"
              strokeWidth={0.5}
              fontSize={11}
              fontWeight="bold"
              textAnchor="middle">
              {String(i + 1)}
            </SvgText>
          ))
        : null}
    </Svg>
  );
}
