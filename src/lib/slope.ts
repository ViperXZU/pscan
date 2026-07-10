import type { Point, SlopeResult } from './types';

/** Distancia mínima (px de imagen) entre A y B para considerar la medición válida. */
export const DEGENERATE_EPSILON_PX = 4;
/** A partir de este ángulo se trata como vertical (evita Infinity/NaN en pantalla). */
export const VERTICAL_DEG = 89.9;
/** Por debajo de este ángulo se trata como plano. */
export const FLAT_DEG = 0.05;

const DEG_PER_RAD = 180 / Math.PI;

/**
 * Construye el resultado a partir de un ángulo ya plegado a [0, 90],
 * aplicando las guardas de vertical/plano. Útil también para reconstruir
 * el resultado en la pantalla de resultados a partir de slopeDeg.
 */
export function resultFromDeg(slopeDeg: number): SlopeResult {
  if (!Number.isFinite(slopeDeg)) {
    return { kind: 'degenerate', slopeDeg: 0, gradePercent: 0, ratioRun: 0 };
  }
  if (slopeDeg >= VERTICAL_DEG) {
    return { kind: 'vertical', slopeDeg: 90, gradePercent: Infinity, ratioRun: 0 };
  }
  if (slopeDeg <= FLAT_DEG) {
    return { kind: 'flat', slopeDeg: 0, gradePercent: 0, ratioRun: Infinity };
  }
  const tan = Math.tan(slopeDeg / DEG_PER_RAD);
  return {
    kind: 'normal',
    slopeDeg,
    gradePercent: tan * 100,
    ratioRun: 1 / tan,
  };
}

/**
 * Calcula la pendiente entre dos puntos en espacio de píxeles de imagen
 * (origen arriba-izquierda, y hacia abajo).
 *
 * Usa atan2 (nunca división) para que dx = 0 sea seguro, y pliega el resultado
 * a [0, 90] para que sea independiente de la dirección en que se marcaron
 * los puntos.
 */
export function computeSlope(a: Point, b: Point): SlopeResult {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  // Toque degenerado: A y B casi en el mismo sitio → no hay medición.
  if (dx * dx + dy * dy < DEGENERATE_EPSILON_PX * DEGENERATE_EPSILON_PX) {
    return { kind: 'degenerate', slopeDeg: 0, gradePercent: 0, ratioRun: 0 };
  }

  // y de pantalla crece hacia abajo → se invierte para que "subir" sea positivo.
  const angleDeg = Math.atan2(-dy, dx) * DEG_PER_RAD; // (-180, 180]
  let slopeDeg = Math.abs(angleDeg);
  if (slopeDeg > 90) slopeDeg = 180 - slopeDeg; // plegar a [0, 90]

  return resultFromDeg(slopeDeg);
}

/** Ej.: "27.4°" · vertical → "90°" · plano → "0°" · degenerado → "—". */
export function formatDegrees(r: SlopeResult): string {
  if (r.kind === 'degenerate') return '—';
  return `${r.slopeDeg.toFixed(1)}°`;
}

/** Ej.: "51.8 %" · vertical → "∞ % (vertical)" · degenerado → "—". */
export function formatGrade(r: SlopeResult): string {
  switch (r.kind) {
    case 'degenerate':
      return '—';
    case 'vertical':
      return '∞ % (vertical)';
    case 'flat':
      return '0 %';
    default:
      return `${r.gradePercent.toFixed(1)} %`;
  }
}

/** Ej.: "1 : 12" · vertical → "1 : 0 (vertical)" · plano → "1 : ∞ (plano)". */
export function formatRatio(r: SlopeResult): string {
  switch (r.kind) {
    case 'degenerate':
      return '—';
    case 'vertical':
      return '1 : 0 (vertical)';
    case 'flat':
      return '1 : ∞ (plano)';
    default: {
      // 1:12 se lee mejor entero; pendientes fuertes (run pequeño) con 1 decimal.
      const run = r.ratioRun >= 9.5 ? Math.round(r.ratioRun) : Number(r.ratioRun.toFixed(1));
      return `1 : ${run}`;
    }
  }
}

/**
 * Pendiente como número puro m = subida/avance = tan(θ) = %/100.
 * Es la misma m de la ecuación y = m·x + b. Ej.: 33 % → "0.33"; 45° → "1.00".
 */
export function formatSlopeM(r: SlopeResult): string {
  switch (r.kind) {
    case 'degenerate':
      return '—';
    case 'vertical':
      return '∞';
    case 'flat':
      return '0';
    default: {
      const m = r.gradePercent / 100;
      return m < 10 ? m.toFixed(2) : m.toFixed(1);
    }
  }
}

export interface SlopeInterpretation {
  /** Nivel de severidad 0 (plano) → 6 (vertical). Útil para colorear la UI. */
  level: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Categoría corta, ej. "Suave". */
  title: string;
  /** Referencia del mundo real, ej. "Como una rampa accesible". */
  description: string;
}

/**
 * Traduce el ángulo medido a una categoría en lenguaje llano, con una
 * referencia del mundo real. Las bandas están ancladas a normas conocidas
 * (rampas accesibles ≈ 8 %, carreteras, tejados) para que el número tenga
 * sentido intuitivo. Definidas por grados porque slopeDeg vive en [0, 90].
 */
export function interpretSlope(r: SlopeResult): SlopeInterpretation {
  if (r.kind === 'degenerate') {
    return {
      level: 0,
      title: 'Sin medición',
      description: 'Marca dos puntos separados sobre el borde del objeto.',
    };
  }
  if (r.kind === 'vertical') {
    return {
      level: 6,
      title: 'Vertical',
      description: 'Superficie a plomo, como un muro o un acantilado.',
    };
  }
  if (r.kind === 'flat' || r.slopeDeg < 1) {
    return {
      level: 0,
      title: 'Plano',
      description: 'Prácticamente horizontal, sin inclinación apreciable.',
    };
  }

  const d = r.slopeDeg;
  if (d < 3) {
    return {
      level: 1,
      title: 'Casi plano',
      description: 'Inclinación mínima, la justa para que escurra el agua (terrazas, desagües).',
    };
  }
  if (d < 9) {
    return {
      level: 2,
      title: 'Suave',
      description: 'Como una rampa accesible o una carretera normal. Cómodo de subir a pie.',
    };
  }
  if (d < 20) {
    return {
      level: 3,
      title: 'Moderada',
      description: 'Como una carretera de montaña o una cuesta marcada. Se nota el esfuerzo.',
    };
  }
  if (d < 35) {
    return {
      level: 4,
      title: 'Pronunciada',
      description: 'Como una escalera o un tejado inclinado. Difícil de subir caminando.',
    };
  }
  if (d < 55) {
    return {
      level: 5,
      title: 'Muy empinada',
      description: 'Como un tejado empinado o una ladera de montaña. Casi hay que trepar.',
    };
  }
  return {
    level: 6,
    title: 'Extrema',
    description: 'Terreno de escalada o un talud casi vertical.',
  };
}
