import type { Point } from './types';

/** Segmento de línea detectado, en píxeles de imagen. */
export type Segment = { a: Point; b: Point };

/** Longitud mínima de un segmento útil, como fracción del lado mayor del frame. */
const MIN_LENGTH_FRACTION = 0.12;
/** Radio de búsqueda alrededor del punto de referencia, como fracción de la diagonal. */
const NEAR_RADIUS_FRACTION = 0.15;

export function segmentLength(s: Segment): number {
  return Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
}

/** Distancia de un punto a un segmento (proyección encajada al tramo). */
export function pointToSegmentDistance(p: Point, s: Segment): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - s.a.x, p.y - s.a.y);

  let t = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / lengthSq;
  t = Math.min(Math.max(t, 0), 1);
  return Math.hypot(p.x - (s.a.x + t * dx), p.y - (s.a.y + t * dy));
}

/**
 * Elige el mejor segmento devuelto por Hough:
 * - descarta los muy cortos (ruido) salvo que no quede ninguno;
 * - si hay un punto de referencia (el punto A del usuario), prefiere el
 *   segmento más largo cercano a él, o el más cercano si ninguno cae dentro
 *   del radio;
 * - sin referencia, simplemente el más largo.
 */
export function pickBestSegment(
  segments: Segment[],
  frame: { w: number; h: number },
  near?: Point | null,
): Segment | null {
  if (segments.length === 0) return null;

  const minLength = MIN_LENGTH_FRACTION * Math.max(frame.w, frame.h);
  let candidates = segments.filter((s) => segmentLength(s) >= minLength);
  if (candidates.length === 0) candidates = segments;

  if (near) {
    const radius = NEAR_RADIUS_FRACTION * Math.hypot(frame.w, frame.h);
    const nearby = candidates.filter((s) => pointToSegmentDistance(near, s) <= radius);
    if (nearby.length > 0) {
      return nearby.reduce((best, s) => (segmentLength(s) > segmentLength(best) ? s : best));
    }
    return candidates.reduce((best, s) =>
      pointToSegmentDistance(near, s) < pointToSegmentDistance(near, best) ? s : best,
    );
  }

  return candidates.reduce((best, s) => (segmentLength(s) > segmentLength(best) ? s : best));
}
