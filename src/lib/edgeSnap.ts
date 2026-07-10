import type { Point } from './types';

/**
 * "Imanta" una guía dibujada por el usuario al borde real de la foto:
 * recorre la polilínea guía y, en cada paso, busca el píxel de borde (mapa de
 * Canny) más cercano en la dirección perpendicular. Así 4 puntos aproximados
 * se convierten en un trazo denso que sigue la curva verdadera.
 *
 * Este módulo es puro (opera sobre un bitmap en memoria) para poder testearlo
 * sin OpenCV; el pipeline nativo vive en autoDetect.ts.
 */

/** Mapa de bordes binario: data[y*w + x] > 0 significa "hay borde". */
export interface EdgeBitmap {
  data: Uint8Array;
  w: number;
  h: number;
}

export interface SnapOptions {
  /** Paso de muestreo a lo largo de la guía, en px. */
  step?: number;
  /** Radio de búsqueda perpendicular a cada lado, en px. */
  radius?: number;
  /** Fracción mínima de muestras que deben encontrar borde para aceptar. */
  minCoverage?: number;
  /** Tolerancia de la simplificación (distancia máx. al trazo original), px. */
  simplifyEps?: number;
}

const DEFAULTS: Required<SnapOptions> = {
  step: 6,
  radius: 22,
  minCoverage: 0.35,
  simplifyEps: 2.5,
};

function isEdge(bmp: EdgeBitmap, x: number, y: number): boolean {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= bmp.w || yi >= bmp.h) return false;
  return bmp.data[yi * bmp.w + xi] > 0;
}

/**
 * Busca el borde más cercano a `base` a lo largo de la normal `n`, probando
 * offsets 0, ±1, ±2… hasta `radius`. Devuelve el punto encontrado o null.
 */
function snapToNearestEdge(
  bmp: EdgeBitmap,
  base: Point,
  n: { x: number; y: number },
  radius: number,
): Point | null {
  for (let s = 0; s <= radius; s++) {
    const candidates =
      s === 0
        ? [base]
        : [
            { x: base.x + n.x * s, y: base.y + n.y * s },
            { x: base.x - n.x * s, y: base.y - n.y * s },
          ];
    for (const c of candidates) {
      if (isEdge(bmp, c.x, c.y)) return { x: Math.round(c.x), y: Math.round(c.y) };
    }
  }
  return null;
}

/** Distancia perpendicular de `p` a la recta A-B (para RDP). */
function perpDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

/** Simplificación Ramer–Douglas–Peucker (conserva la forma con menos vértices). */
export function simplifyPolyline(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return [...points];

  let maxDist = 0;
  let maxIdx = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpDistance(points[i], points[0], points[last]);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist <= epsilon) return [points[0], points[last]];
  const left = simplifyPolyline(points.slice(0, maxIdx + 1), epsilon);
  const right = simplifyPolyline(points.slice(maxIdx), epsilon);
  return [...left.slice(0, -1), ...right];
}

/**
 * Recorre la guía y devuelve el trazo imantado al borde (simplificado), o
 * null si la cobertura de borde es insuficiente (no hay un borde claro cerca).
 */
export function snapPolylineToEdges(
  bmp: EdgeBitmap,
  guide: Point[],
  options?: SnapOptions,
): Point[] | null {
  const opts = { ...DEFAULTS, ...options };
  if (guide.length < 2) return null;

  const snapped: Point[] = [];
  let samples = 0;
  let hits = 0;

  for (let i = 0; i + 1 < guide.length; i++) {
    const a = guide[i];
    const b = guide[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-9) continue;
    const d = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const n = { x: -d.y, y: d.x }; // normal unitaria

    // Incluir el extremo final del último segmento para no perder el cierre.
    for (let t = 0; t <= len; t += opts.step) {
      const base = { x: a.x + d.x * t, y: a.y + d.y * t };
      samples++;
      const hit = snapToNearestEdge(bmp, base, n, opts.radius);
      if (!hit) continue;
      hits++;
      const prev = snapped[snapped.length - 1];
      if (!prev || Math.hypot(hit.x - prev.x, hit.y - prev.y) >= 2) snapped.push(hit);
    }
  }

  if (samples === 0 || hits / samples < opts.minCoverage || snapped.length < 2) return null;
  return simplifyPolyline(snapped, opts.simplifyEps);
}
