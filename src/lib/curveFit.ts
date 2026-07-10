/**
 * Ajuste polinómico por mínimos cuadrados para expresar el trazo marcado como
 * una función NO lineal (y = a·x² + b·x + c, etc.). Todo matemática pura y
 * offline. Coordenadas en el marco matemático (x a la derecha, y hacia arriba).
 */

/** Un punto en el marco matemático. */
export interface MathPoint {
  X: number;
  Y: number;
}

export interface PolyFit {
  /** Grado elegido (1 = recta, 2 = parábola, 3 = cúbica). */
  degree: 1 | 2 | 3;
  /** Coeficientes ascendentes: y = coeffs[0] + coeffs[1]·x + coeffs[2]·x² + ... */
  coeffs: number[];
  /** Bondad del ajuste en [0, 1] (1 = pasa exactamente por los puntos). */
  r2: number;
}

/** Si un grado menor alcanza este R², se prefiere (parsimonia). */
const GOOD_ENOUGH_R2 = 0.995;
/** Coeficientes menores (en valor absoluto) se omiten al formatear. */
const FORMAT_EPS = 0.005;

/** Resuelve A·x = b por eliminación gaussiana con pivoteo parcial (n ≤ 4). */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  // Matriz aumentada (copias para no mutar la entrada).
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null; // singular
    [M[col], M[pivot]] = [M[pivot], M[col]];

    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c++) sum -= M[r][c] * x[c];
    x[r] = sum / M[r][r];
  }
  return x;
}

/** C(k, j) para k ≤ 3 (suficiente para des-normalizar la cúbica). */
function binomial(k: number, j: number): number {
  const table = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]];
  return table[k][j];
}

/**
 * Reexpresa y = Σ c_k·((x − mu)/s)^k como y = Σ a_j·x^j (coeficientes en la
 * coordenada original). Necesario porque ajustar directamente con x en píxeles
 * (0..4000) hace las ecuaciones normales numéricamente inestables (x³ ~ 6e10).
 */
export function denormalizePoly(coeffs: number[], mu: number, s: number): number[] {
  const out = new Array<number>(coeffs.length).fill(0);
  for (let k = 0; k < coeffs.length; k++) {
    const bk = coeffs[k] / Math.pow(s, k); // coeficiente en u = x − mu
    for (let j = 0; j <= k; j++) {
      out[j] += bk * binomial(k, j) * Math.pow(-mu, k - j);
    }
  }
  return out;
}

/** Evalúa un polinomio de coeficientes ascendentes (esquema de Horner). */
export function evalPoly(coeffs: number[], x: number): number {
  let y = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) y = y * x + coeffs[i];
  return y;
}

/**
 * Ajusta un polinomio del grado pedido por mínimos cuadrados.
 * Devuelve coeficientes ascendentes en la coordenada ORIGINAL, o null si el
 * sistema es singular (p. ej. todos los x iguales).
 */
export function fitPolynomial(points: MathPoint[], degree: number): number[] | null {
  const distinctX = new Set(points.map((p) => p.X)).size;
  if (points.length < degree + 1 || distinctX < degree + 1) return null;

  // Normalización de x para estabilidad numérica.
  const xs = points.map((p) => p.X);
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
  const span = Math.max(...xs) - Math.min(...xs);
  const s = span > 0 ? span / 2 : 1;

  const n = degree + 1;
  // Ecuaciones normales: (Vᵀ·V)·c = Vᵀ·y con V de Vandermonde en t = (x−mu)/s.
  const ATA: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const ATy = new Array<number>(n).fill(0);
  for (const p of points) {
    const t = (p.X - mu) / s;
    const powers: number[] = [1];
    for (let k = 1; k < n; k++) powers.push(powers[k - 1] * t);
    for (let r = 0; r < n; r++) {
      ATy[r] += powers[r] * p.Y;
      for (let c = 0; c < n; c++) ATA[r][c] += powers[r] * powers[c];
    }
  }

  const normCoeffs = solveLinearSystem(ATA, ATy);
  if (!normCoeffs) return null;
  return denormalizePoly(normCoeffs, mu, s);
}

/** R² clásico: 1 − SSres/SStot. Si los y son constantes, 1 si el ajuste es exacto. */
export function rSquared(points: MathPoint[], coeffs: number[]): number {
  const meanY = points.reduce((a, p) => a + p.Y, 0) / points.length;
  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    ssRes += (p.Y - evalPoly(coeffs, p.X)) ** 2;
    ssTot += (p.Y - meanY) ** 2;
  }
  if (ssTot < 1e-12) return ssRes < 1e-9 ? 1 : 0;
  return Math.max(0, 1 - ssRes / ssTot);
}

/**
 * Ajusta grados 1→3 y elige el MENOR grado cuyo R² ya sea excelente
 * (parsimonia): puntos colineales → recta, parábola → grado 2, forma en S →
 * grado 3. Devuelve null si ni siquiera la recta se puede ajustar.
 */
export function fitBestPolynomial(points: MathPoint[]): PolyFit | null {
  const distinctX = new Set(points.map((p) => p.X)).size;
  const maxDegree = Math.min(3, distinctX - 1);
  if (maxDegree < 1) return null;

  let best: PolyFit | null = null;
  for (let degree = 1 as 1 | 2 | 3; degree <= maxDegree; degree++) {
    const coeffs = fitPolynomial(points, degree);
    if (!coeffs) continue;
    const r2 = rSquared(points, coeffs);
    if (!best || r2 > best.r2 + 1e-9) best = { degree: degree as 1 | 2 | 3, coeffs, r2 };
    if (r2 >= GOOD_ENOUGH_R2) return { degree: degree as 1 | 2 | 3, coeffs, r2 };
  }
  return best;
}

/** Formatea un número con hasta 2 decimales, sin ceros de cola: 1.2, 0.33, 2. */
function fmtNum(v: number): string {
  const s = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

const POWER_SUFFIX = ['', '·x', '·x²', '·x³'];

/** Ej.: [2, 1.2] → "y = 1.2·x + 2" · [12, -0.8, 0.02] → "y = 0.02·x² − 0.8·x + 12". */
export function formatPolynomial(coeffs: number[]): string {
  const terms: { text: string; negative: boolean }[] = [];
  for (let p = coeffs.length - 1; p >= 0; p--) {
    const a = coeffs[p] ?? 0;
    if (Math.abs(a) < FORMAT_EPS) continue;
    terms.push({ text: `${fmtNum(Math.abs(a))}${POWER_SUFFIX[p]}`, negative: a < 0 });
  }
  if (terms.length === 0) return 'y = 0';

  let out = `y = ${terms[0].negative ? '−' : ''}${terms[0].text}`;
  for (let i = 1; i < terms.length; i++) {
    out += ` ${terms[i].negative ? '−' : '+'} ${terms[i].text}`;
  }
  return out;
}
