import {
  computeSlope,
  formatDegrees,
  formatGrade,
  formatRatio,
  formatSlopeM,
  interpretSlope,
  resultFromDeg,
} from '../slope';

describe('computeSlope', () => {
  it('mide 45° para una diagonal perfecta', () => {
    // y de imagen crece hacia abajo: B más arriba y a la derecha de A.
    const r = computeSlope({ x: 0, y: 0 }, { x: 100, y: -100 });
    expect(r.kind).toBe('normal');
    expect(r.slopeDeg).toBeCloseTo(45, 5);
    expect(r.gradePercent).toBeCloseTo(100, 5);
    expect(r.ratioRun).toBeCloseTo(1, 5);
  });

  it('mide una rampa 1:12 (accesibilidad)', () => {
    const r = computeSlope({ x: 0, y: 0 }, { x: 1200, y: -100 });
    expect(r.slopeDeg).toBeCloseTo(4.7636, 3);
    expect(r.gradePercent).toBeCloseTo(8.3333, 3);
    expect(r.ratioRun).toBeCloseTo(12, 5);
  });

  it('maneja la línea vertical sin NaN ni división por cero', () => {
    const r = computeSlope({ x: 50, y: 0 }, { x: 50, y: 200 });
    expect(r.kind).toBe('vertical');
    expect(r.slopeDeg).toBe(90);
    expect(r.gradePercent).toBe(Infinity);
    expect(Number.isNaN(r.slopeDeg)).toBe(false);
    expect(Number.isNaN(r.ratioRun)).toBe(false);
  });

  it('maneja la línea plana', () => {
    const r = computeSlope({ x: 0, y: 50 }, { x: 200, y: 50 });
    expect(r.kind).toBe('flat');
    expect(r.slopeDeg).toBe(0);
    expect(r.gradePercent).toBe(0);
    expect(r.ratioRun).toBe(Infinity);
  });

  it('es independiente de la dirección (intercambiar A y B)', () => {
    const a = { x: 10, y: 300 };
    const b = { x: 400, y: 120 };
    expect(computeSlope(a, b).slopeDeg).toBeCloseTo(computeSlope(b, a).slopeDeg, 10);
  });

  it('da el mismo ángulo cuesta abajo que cuesta arriba', () => {
    const up = computeSlope({ x: 0, y: 100 }, { x: 100, y: 0 });
    const down = computeSlope({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(up.slopeDeg).toBeCloseTo(45, 5);
    expect(down.slopeDeg).toBeCloseTo(45, 5);
  });

  it('marca como degenerado dos toques casi en el mismo punto', () => {
    const r = computeSlope({ x: 10, y: 10 }, { x: 11, y: 11 });
    expect(r.kind).toBe('degenerate');
  });

  it('un ángulo casi vertical (89.95°) se pliega a vertical', () => {
    // dx=1, dy=-1146 → atan ≈ 89.95°
    const r = computeSlope({ x: 0, y: 1146 }, { x: 1, y: 0 });
    expect(r.kind).toBe('vertical');
    expect(r.slopeDeg).toBe(90);
  });
});

describe('formatters', () => {
  it('formatea grados con un decimal', () => {
    const r = computeSlope({ x: 0, y: 0 }, { x: 100, y: -52 }); // ≈27.47°
    expect(formatDegrees(r)).toMatch(/^\d+\.\d°$/);
    expect(formatDegrees(r)).toBe('27.5°');
  });

  it('formatea el porcentaje', () => {
    const r = computeSlope({ x: 0, y: 0 }, { x: 100, y: -100 });
    expect(formatGrade(r)).toBe('100.0 %');
  });

  it('formatea la proporción 1:12 como entero', () => {
    const r = computeSlope({ x: 0, y: 0 }, { x: 1200, y: -100 });
    expect(formatRatio(r)).toBe('1 : 12');
  });

  it('formatea la proporción de 45° como 1 : 1', () => {
    const r = computeSlope({ x: 0, y: 0 }, { x: 100, y: -100 });
    expect(formatRatio(r)).toBe('1 : 1');
  });

  it('formatea la pendiente m (número) = %/100', () => {
    // 45° → m = 1.00
    expect(formatSlopeM(computeSlope({ x: 0, y: 0 }, { x: 100, y: -100 }))).toBe('1.00');
    // ~18.26° (33%) → m ≈ 0.33
    expect(formatSlopeM(computeSlope({ x: 0, y: 0 }, { x: 100, y: -33 }))).toBe('0.33');
    // vertical → ∞, plano → 0
    expect(formatSlopeM(computeSlope({ x: 50, y: 0 }, { x: 50, y: 200 }))).toBe('∞');
    expect(formatSlopeM(computeSlope({ x: 0, y: 50 }, { x: 200, y: 50 }))).toBe('0');
  });

  it('nunca imprime Infinity ni NaN', () => {
    const vertical = computeSlope({ x: 50, y: 0 }, { x: 50, y: 200 });
    const flat = computeSlope({ x: 0, y: 50 }, { x: 200, y: 50 });
    const degenerate = computeSlope({ x: 0, y: 0 }, { x: 1, y: 1 });
    for (const r of [vertical, flat, degenerate]) {
      for (const text of [formatDegrees(r), formatGrade(r), formatRatio(r)]) {
        expect(text).not.toMatch(/Infinity|NaN/);
      }
    }
    expect(formatGrade(vertical)).toBe('∞ % (vertical)');
    expect(formatRatio(flat)).toBe('1 : ∞ (plano)');
  });
});

describe('interpretSlope', () => {
  const titleAt = (deg: number) => interpretSlope(resultFromDeg(deg)).title;
  const levelAt = (deg: number) => interpretSlope(resultFromDeg(deg)).level;

  it('cubre cada banda con su categoría', () => {
    expect(titleAt(0)).toBe('Plano');
    expect(titleAt(2)).toBe('Casi plano');
    expect(titleAt(5)).toBe('Suave'); // rango de rampa accesible
    expect(titleAt(15)).toBe('Moderada');
    expect(titleAt(28)).toBe('Pronunciada');
    expect(titleAt(45)).toBe('Muy empinada');
    expect(titleAt(70)).toBe('Extrema');
  });

  it('maneja los casos especiales', () => {
    expect(interpretSlope(computeSlope({ x: 0, y: 0 }, { x: 1, y: 1 })).title).toBe('Sin medición');
    expect(interpretSlope(resultFromDeg(90)).title).toBe('Vertical');
    expect(interpretSlope(resultFromDeg(90)).level).toBe(6);
  });

  it('el nivel crece de forma monótona con el ángulo', () => {
    const degs = [0, 2, 5, 15, 28, 45, 70, 90];
    for (let i = 1; i < degs.length; i++) {
      expect(levelAt(degs[i])).toBeGreaterThanOrEqual(levelAt(degs[i - 1]));
    }
  });

  it('el nivel siempre está en [0, 6]', () => {
    for (let d = 0; d <= 90; d += 1) {
      const lvl = levelAt(d);
      expect(lvl).toBeGreaterThanOrEqual(0);
      expect(lvl).toBeLessThanOrEqual(6);
    }
  });
});
