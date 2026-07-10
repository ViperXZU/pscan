import {
  denormalizePoly,
  evalPoly,
  fitBestPolynomial,
  fitPolynomial,
  formatPolynomial,
  rSquared,
  type MathPoint,
} from '../curveFit';

const sample = (f: (x: number) => number, xs: number[]): MathPoint[] =>
  xs.map((X) => ({ X, Y: f(X) }));

describe('fitPolynomial', () => {
  it('recupera una recta exacta (el ejemplo 1.2·x + 2)', () => {
    const pts = sample((x) => 1.2 * x + 2, [0, 10, 20, 35]);
    const coeffs = fitPolynomial(pts, 1)!;
    expect(coeffs[0]).toBeCloseTo(2, 6);
    expect(coeffs[1]).toBeCloseTo(1.2, 6);
  });

  it('recupera una parábola exacta', () => {
    const pts = sample((x) => 0.5 * x * x - 3 * x + 7, [0, 5, 10, 15, 25]);
    const coeffs = fitPolynomial(pts, 2)!;
    expect(coeffs[0]).toBeCloseTo(7, 5);
    expect(coeffs[1]).toBeCloseTo(-3, 5);
    expect(coeffs[2]).toBeCloseTo(0.5, 6);
  });

  it('recupera una cúbica exacta', () => {
    const pts = sample((x) => x ** 3 - 6 * x * x + 9 * x, [0, 1, 2, 3, 4, 5]);
    const coeffs = fitPolynomial(pts, 3)!;
    expect(coeffs[0]).toBeCloseTo(0, 4);
    expect(coeffs[1]).toBeCloseTo(9, 4);
    expect(coeffs[2]).toBeCloseTo(-6, 4);
    expect(coeffs[3]).toBeCloseTo(1, 5);
  });

  it('es estable con coordenadas grandes tipo píxel (normalización)', () => {
    const f = (x: number) => 0.0004 * (x - 2000) ** 2 + 150;
    const xs = [800, 1200, 1700, 2300, 2800, 3200];
    const coeffs = fitPolynomial(sample(f, xs), 2)!;
    for (const x of [900, 1500, 2500, 3100]) {
      expect(evalPoly(coeffs, x)).toBeCloseTo(f(x), 3);
    }
  });

  it('devuelve null con x repetidos (sistema singular)', () => {
    const pts: MathPoint[] = [
      { X: 5, Y: 1 },
      { X: 5, Y: 9 },
      { X: 5, Y: 4 },
    ];
    expect(fitPolynomial(pts, 1)).toBeNull();
  });

  it('devuelve null si faltan puntos para el grado', () => {
    expect(fitPolynomial(sample((x) => x, [0, 1]), 2)).toBeNull();
  });
});

describe('fitBestPolynomial (elección de grado)', () => {
  it('puntos colineales → grado 1', () => {
    const fit = fitBestPolynomial(sample((x) => 2 * x + 1, [0, 10, 20, 30, 40]))!;
    expect(fit.degree).toBe(1);
    expect(fit.r2).toBeGreaterThan(0.999);
  });

  it('parábola → grado 2 (no 3, parsimonia)', () => {
    const fit = fitBestPolynomial(sample((x) => 0.1 * x * x - x + 3, [0, 10, 20, 30, 40]))!;
    expect(fit.degree).toBe(2);
    expect(fit.r2).toBeGreaterThan(0.999);
  });

  it('forma en S (sube-baja-sube) → grado 3', () => {
    const fit = fitBestPolynomial(
      sample((x) => x ** 3 - 15 * x * x + 60 * x, [0, 2, 4, 6, 8, 10]),
    )!;
    expect(fit.degree).toBe(3);
    expect(fit.r2).toBeGreaterThan(0.999);
  });

  it('parábola con algo de ruido → sigue siendo grado 2 y buen R²', () => {
    const noise = [0.4, -0.3, 0.2, -0.5, 0.3, -0.2, 0.1];
    const pts = sample((x) => 0.05 * x * x + 2, [0, 5, 10, 15, 20, 25, 30]).map((p, i) => ({
      X: p.X,
      Y: p.Y + noise[i],
    }));
    const fit = fitBestPolynomial(pts)!;
    expect(fit.degree).toBe(2);
    expect(fit.r2).toBeGreaterThan(0.99);
  });

  it('null cuando no hay ni dos x distintos', () => {
    expect(fitBestPolynomial([{ X: 3, Y: 1 }, { X: 3, Y: 5 }])).toBeNull();
  });
});

describe('denormalizePoly / rSquared', () => {
  it('la des-normalización reproduce el mismo polinomio', () => {
    // y = 2·t² − t + 3 con t = (x − 100)/50
    const norm = [3, -1, 2];
    const coeffs = denormalizePoly(norm, 100, 50);
    for (const x of [0, 50, 100, 150, 200]) {
      const t = (x - 100) / 50;
      expect(evalPoly(coeffs, x)).toBeCloseTo(2 * t * t - t + 3, 8);
    }
  });

  it('R² = 1 en ajuste exacto y menor con residuos', () => {
    const pts = sample((x) => x + 1, [0, 1, 2, 3]);
    expect(rSquared(pts, [1, 1])).toBeCloseTo(1, 10);
    expect(rSquared(pts, [0, 1])).toBeLessThan(1);
  });
});

describe('formatPolynomial', () => {
  it('formatea el ejemplo del usuario', () => {
    expect(formatPolynomial([2, 1.2])).toBe('y = 1.2·x + 2');
  });

  it('formatea una cuadrática con signos', () => {
    expect(formatPolynomial([12, -0.8, 0.02])).toBe('y = 0.02·x² − 0.8·x + 12');
  });

  it('omite términos ~cero y maneja el polinomio nulo', () => {
    expect(formatPolynomial([0, 0.001, 2])).toBe('y = 2·x²');
    expect(formatPolynomial([0, 0])).toBe('y = 0');
  });

  it('coeficiente líder negativo', () => {
    expect(formatPolynomial([1, 0, -0.5])).toBe('y = −0.5·x² + 1');
  });
});
