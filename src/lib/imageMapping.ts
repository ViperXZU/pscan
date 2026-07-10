import type { ContainTransform, Point } from './types';

/**
 * Calcula la transformación que aplica contentFit="contain": una escala
 * UNIFORME (la misma en x e y, por eso el ángulo no se deforma) más un
 * letterbox centrado.
 *
 * Devuelve null si alguna dimensión aún no es válida (p. ej. antes del
 * primer onLayout).
 */
export function computeContainTransform(args: {
  imgW: number;
  imgH: number;
  boxW: number;
  boxH: number;
}): ContainTransform | null {
  const { imgW, imgH, boxW, boxH } = args;
  if (imgW <= 0 || imgH <= 0 || boxW <= 0 || boxH <= 0) return null;

  const scale = Math.min(boxW / imgW, boxH / imgH);
  return {
    scale,
    offsetX: (boxW - imgW * scale) / 2,
    offsetY: (boxH - imgH * scale) / 2,
    imgW,
    imgH,
    boxW,
    boxH,
  };
}

/**
 * Mapea un toque en coordenadas de layout (relativas a la caja) a píxeles
 * reales de la imagen.
 *
 * - modo 'reject' (por defecto): devuelve null si el toque cae en las barras
 *   del letterbox (fuera de la imagen) — para colocar puntos nuevos.
 * - modo 'clamp': encaja el punto dentro de los límites de la imagen — para
 *   arrastrar un punto existente sin que se escape.
 */
export function layoutToImage(
  pt: Point,
  t: ContainTransform,
  mode: 'reject' | 'clamp' = 'reject',
): Point | null {
  const x = (pt.x - t.offsetX) / t.scale;
  const y = (pt.y - t.offsetY) / t.scale;
  if (x < 0 || y < 0 || x > t.imgW || y > t.imgH) {
    if (mode === 'reject') return null;
    return {
      x: Math.min(Math.max(x, 0), t.imgW),
      y: Math.min(Math.max(y, 0), t.imgH),
    };
  }
  return { x, y };
}

/** Mapea un punto en píxeles de imagen a coordenadas de layout (para dibujar el SVG). */
export function imageToLayout(pt: Point, t: ContainTransform): Point {
  return {
    x: pt.x * t.scale + t.offsetX,
    y: pt.y * t.scale + t.offsetY,
  };
}
