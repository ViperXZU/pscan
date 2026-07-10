import { computeSlope } from './slope';
import type { Point, SlopeResult } from './types';

/** Debajo de esta diferencia en x (px de imagen) un tramo se considera vertical. */
const VERTICAL_DX_EPS = 1e-6;

export type SegmentDirection = 'up' | 'down' | 'flat' | 'vertical';

export interface PolylineSegment {
  index: number;
  a: Point; // px de imagen
  b: Point; // px de imagen
  /** Pendiente absoluta (ángulo/%/proporción) reutilizando la lógica de 2 puntos. */
  slope: SlopeResult;
  /**
   * Pendiente con signo en el marco matemático (y hacia arriba), leída de
   * izquierda a derecha. Infinity si el tramo es vertical. Igual a %/100.
   */
  mathSlope: number;
  direction: SegmentDirection;
}

/** Descompone una polilínea en sus tramos consecutivos (ignora los de longitud cero). */
export function buildSegments(points: Point[]): PolylineSegment[] {
  const segments: PolylineSegment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < VERTICAL_DX_EPS && Math.abs(dy) < VERTICAL_DX_EPS) continue;

    let mathSlope: number;
    let direction: SegmentDirection;
    if (Math.abs(dx) < VERTICAL_DX_EPS) {
      mathSlope = Infinity;
      direction = 'vertical';
    } else {
      mathSlope = -dy / dx; // y de imagen crece hacia abajo → invertir
      direction = Math.abs(mathSlope) < 1e-3 ? 'flat' : mathSlope > 0 ? 'up' : 'down';
    }

    segments.push({
      index: segments.length,
      a,
      b,
      slope: computeSlope(a, b),
      mathSlope,
      direction,
    });
  }
  return segments;
}

/** Un tramo de la función: y = m·x + b válido en x ∈ [x0, x1] (marco matemático). */
export interface PiecewisePiece {
  x0: number;
  x1: number;
  m: number;
  b: number;
}

export interface PiecewiseModel {
  /** true si la polilínea es una función de una sola variable (x estrictamente monótona). */
  isFunction: boolean;
  /** Motivo cuando isFunction es false. */
  reason?: string;
  /** Anclaje en px de imagen: esquina inferior-izquierda del marco matemático. */
  origin: { x: number; y: number };
  /** Tramos de la función (x creciente). Vacío si no es función. */
  pieces: PiecewisePiece[];
}

/**
 * Marco matemático común: origen en (min x, punto más bajo del trazo),
 * x hacia la derecha, y hacia arriba. Lo usan la función por tramos y el
 * ajuste de curvas para que sus ecuaciones hablen las mismas coordenadas.
 */
export function toMathFrame(points: Point[]): {
  origin: Point;
  pts: { X: number; Y: number }[];
} {
  const originX = points.length ? Math.min(...points.map((p) => p.x)) : 0;
  const baseY = points.length ? Math.max(...points.map((p) => p.y)) : 0;
  return {
    origin: { x: originX, y: baseY },
    pts: points.map((p) => ({ X: p.x - originX, Y: baseY - p.y })),
  };
}

/**
 * Intenta expresar la polilínea como función lineal por tramos f(x).
 * Marco matemático: origen en (min x, punto más bajo), x hacia la derecha,
 * y hacia arriba. Requiere que x sea estrictamente monótona (si no, el trazo
 * "se devuelve" y no es una función de una sola variable).
 */
export function buildPiecewise(points: Point[]): PiecewiseModel {
  const { origin, pts: m } = toMathFrame(points);

  if (points.length < 2) {
    return { isFunction: false, reason: 'Necesitas al menos 2 puntos.', origin, pieces: [] };
  }

  let hasVertical = false;
  let strictlyIncreasing = true;
  let strictlyDecreasing = true;
  for (let i = 1; i < m.length; i++) {
    const d = m[i].X - m[i - 1].X;
    if (Math.abs(d) < VERTICAL_DX_EPS) hasVertical = true;
    if (!(d > 0)) strictlyIncreasing = false;
    if (!(d < 0)) strictlyDecreasing = false;
  }

  if (hasVertical) {
    return {
      isFunction: false,
      reason: 'Hay un tramo vertical: para ese x habría infinitos valores de y.',
      origin,
      pieces: [],
    };
  }
  if (!strictlyIncreasing && !strictlyDecreasing) {
    return {
      isFunction: false,
      reason: 'El trazo se devuelve en x, así que no es una función de una sola variable.',
      origin,
      pieces: [],
    };
  }

  // Asegurar x creciente para escribir f(x) de izquierda a derecha.
  const ordered = strictlyIncreasing ? m : [...m].reverse();
  const pieces: PiecewisePiece[] = [];
  for (let i = 0; i + 1 < ordered.length; i++) {
    const p0 = ordered[i];
    const p1 = ordered[i + 1];
    const slope = (p1.Y - p0.Y) / (p1.X - p0.X);
    pieces.push({ x0: p0.X, x1: p1.X, m: slope, b: p0.Y - slope * p0.X });
  }
  return { isFunction: true, origin, pieces };
}

/** Ej.: "y = 1.00·x + 25". */
export function formatPiece(p: PiecewisePiece): string {
  const b = Math.round(p.b);
  const sign = b >= 0 ? '+' : '−';
  return `y = ${p.m.toFixed(2)}·x ${sign} ${Math.abs(b)}`;
}

/** Ej.: "x ∈ [0, 120]". */
export function formatDomain(p: PiecewisePiece): string {
  return `x ∈ [${Math.round(p.x0)}, ${Math.round(p.x1)}]`;
}
