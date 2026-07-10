import { buildPiecewise, buildSegments, formatPiece } from '../polyline';
import type { Point } from '../types';

const p = (x: number, y: number): Point => ({ x, y });

describe('buildSegments', () => {
  it('genera un tramo por cada par consecutivo', () => {
    const segs = buildSegments([p(0, 300), p(100, 200), p(200, 250)]);
    expect(segs).toHaveLength(2);
    expect(segs[0].index).toBe(0);
    expect(segs[1].index).toBe(1);
  });

  it('calcula la pendiente absoluta de cada tramo', () => {
    const segs = buildSegments([p(0, 100), p(100, 0)]); // sube 45°
    expect(segs[0].slope.slopeDeg).toBeCloseTo(45, 5);
    expect(segs[0].slope.gradePercent).toBeCloseTo(100, 5);
  });

  it('asigna dirección según el signo de la pendiente (izq→der)', () => {
    // sube a la derecha (y de imagen baja) → 'up'
    expect(buildSegments([p(0, 100), p(100, 0)])[0].direction).toBe('up');
    // baja a la derecha → 'down'
    expect(buildSegments([p(0, 0), p(100, 100)])[0].direction).toBe('down');
    // horizontal → 'flat'
    expect(buildSegments([p(0, 50), p(100, 50)])[0].direction).toBe('flat');
    // vertical → 'vertical'
    expect(buildSegments([p(50, 0), p(50, 100)])[0].direction).toBe('vertical');
  });

  it('mathSlope coincide con %/100 y con la dirección', () => {
    const seg = buildSegments([p(0, 0), p(100, 100)])[0]; // baja a la derecha
    expect(seg.mathSlope).toBeCloseTo(-1, 5);
    expect(seg.slope.gradePercent).toBeCloseTo(100, 5);
  });

  it('ignora tramos de longitud cero', () => {
    expect(buildSegments([p(10, 10), p(10, 10), p(50, 10)])).toHaveLength(1);
  });

  it('lista vacía o de un punto no da tramos', () => {
    expect(buildSegments([])).toHaveLength(0);
    expect(buildSegments([p(1, 1)])).toHaveLength(0);
  });
});

describe('buildPiecewise', () => {
  it('construye f(x) por tramos cuando x es creciente', () => {
    // P0(0,300) P1(100,200) P2(200,250): marco y-arriba con baseY=300
    // Y: 0, 100, 50
    const model = buildPiecewise([p(0, 300), p(100, 200), p(200, 250)]);
    expect(model.isFunction).toBe(true);
    expect(model.pieces).toHaveLength(2);
    expect(model.pieces[0]).toMatchObject({ x0: 0, x1: 100 });
    expect(model.pieces[0].m).toBeCloseTo(1, 5); // y = x
    expect(model.pieces[0].b).toBeCloseTo(0, 5);
    expect(model.pieces[1].m).toBeCloseTo(-0.5, 5); // y = -0.5x + 150
    expect(model.pieces[1].b).toBeCloseTo(150, 5);
  });

  it('las ecuaciones evalúan correctamente en los nudos', () => {
    const { pieces } = buildPiecewise([p(0, 300), p(100, 200), p(200, 250)]);
    const evalAt = (pc: (typeof pieces)[number], x: number) => pc.m * x + pc.b;
    expect(evalAt(pieces[0], 100)).toBeCloseTo(100, 5);
    expect(evalAt(pieces[1], 100)).toBeCloseTo(100, 5); // continuidad en el nudo
    expect(evalAt(pieces[1], 200)).toBeCloseTo(50, 5);
  });

  it('reordena a x creciente cuando se dibujó de derecha a izquierda', () => {
    const rightToLeft = buildPiecewise([p(200, 250), p(100, 200), p(0, 300)]);
    const leftToRight = buildPiecewise([p(0, 300), p(100, 200), p(200, 250)]);
    expect(rightToLeft.isFunction).toBe(true);
    expect(rightToLeft.pieces).toEqual(leftToRight.pieces);
  });

  it('detecta que un tramo vertical no es función', () => {
    const model = buildPiecewise([p(0, 0), p(50, 100), p(50, 200)]);
    expect(model.isFunction).toBe(false);
    expect(model.reason).toMatch(/vertical/i);
  });

  it('detecta un trazo que se devuelve en x', () => {
    const model = buildPiecewise([p(0, 0), p(100, 100), p(50, 50)]);
    expect(model.isFunction).toBe(false);
    expect(model.reason).toMatch(/devuelve/i);
  });

  it('con menos de 2 puntos no es función', () => {
    expect(buildPiecewise([p(0, 0)]).isFunction).toBe(false);
  });
});

describe('formatPiece', () => {
  it('formatea con signo correcto', () => {
    expect(formatPiece({ x0: 0, x1: 100, m: 1, b: 25 })).toBe('y = 1.00·x + 25');
    expect(formatPiece({ x0: 0, x1: 100, m: -0.5, b: -10 })).toBe('y = -0.50·x − 10');
  });
});
