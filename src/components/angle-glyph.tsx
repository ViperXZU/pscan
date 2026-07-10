import Svg, { Line, Path } from 'react-native-svg';

type Props = {
  /** Ángulo a dibujar, en grados [0, 90]. */
  deg: number;
  size?: number;
  color?: string;
};

/** Dibuja la inclinación medida: base horizontal + línea al ángulo dado. */
export function AngleGlyph({ deg, size = 60, color = '#2563eb' }: Props) {
  const pad = 10;
  const ox = pad;
  const oy = size - pad;
  const len = size - pad * 2;
  const clamped = Math.min(Math.max(deg, 0), 90);
  const rad = (clamped * Math.PI) / 180;
  const ex = ox + len * Math.cos(rad);
  const ey = oy - len * Math.sin(rad);

  // Arco pequeño entre la base y la línea inclinada, para señalar el ángulo.
  const arcR = 16;
  const ax = ox + arcR;
  const ay = oy;
  const bx = ox + arcR * Math.cos(rad);
  const by = oy - arcR * Math.sin(rad);

  return (
    <Svg width={size} height={size}>
      <Line x1={ox} y1={oy} x2={ox + len} y2={oy} stroke="#d4d4d4" strokeWidth={2} />
      {clamped > 1 ? (
        <Path d={`M ${ax} ${ay} A ${arcR} ${arcR} 0 0 0 ${bx} ${by}`} stroke="#a3a3a3" strokeWidth={1.5} fill="none" />
      ) : null}
      <Line x1={ox} y1={oy} x2={ex} y2={ey} stroke={color} strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}
