/** Punto 2D genérico (en píxeles de imagen o en puntos de layout, según contexto). */
export interface Point {
  x: number;
  y: number;
}

/**
 * Transformación que describe cómo una imagen de imgW×imgH píxeles se dibuja
 * dentro de una caja de boxW×boxH puntos con contentFit="contain":
 * escala uniforme + letterbox centrado.
 */
export interface ContainTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  imgW: number;
  imgH: number;
  boxW: number;
  boxH: number;
}

export type SlopeKind = 'normal' | 'vertical' | 'flat' | 'degenerate';

/** Resultado del cálculo de pendiente entre dos puntos. */
export interface SlopeResult {
  kind: SlopeKind;
  /** Ángulo de inclinación respecto a la horizontal, en [0, 90]. */
  slopeDeg: number;
  /** Pendiente en % = tan(θ)·100. Infinity si es vertical. */
  gradePercent: number;
  /** Proporción "1 : ratioRun" (avance por unidad de subida). Infinity si es plano. */
  ratioRun: number;
}
