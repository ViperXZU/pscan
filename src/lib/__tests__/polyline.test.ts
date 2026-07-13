import {
  buildPiecewise,
  buildSegments,
  formatPiece,
  sanitizeFunctionTrace,
  segmentLine,
} from '../polyline';
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

describe('sanitizeFunctionTrace', () => {
  it('elimina un vértice que retrocede levemente en x (ruido del snap)', () => {
    const pts = [p(0, 100), p(50, 90), p(100, 60), p(96, 55), p(150, 40), p(200, 30)];
    const r = sanitizeFunctionTrace(pts);
    expect(r.repaired).toBe(true);
    expect(r.dropped).toBe(1);
    // Queda estrictamente creciente en x → buildPiecewise lo acepta como función.
    expect(buildPiecewise(r.points).isFunction).toBe(true);
  });

  it('varios retrocesos consecutivos pequeños también se reparan', () => {
    const pts = [p(0, 0), p(40, 10), p(80, 20), p(78, 22), p(76, 24), p(120, 30), p(160, 40)];
    const r = sanitizeFunctionTrace(pts);
    expect(r.repaired).toBe(true);
    expect(r.dropped).toBe(2);
    expect(buildPiecewise(r.points).isFunction).toBe(true);
  });

  it('NO toca un trazo que se devuelve de verdad (S tumbada)', () => {
    const pts = [p(0, 0), p(200, 50), p(80, 100), p(220, 150)];
    const r = sanitizeFunctionTrace(pts);
    expect(r.repaired).toBe(false);
    expect(r.points).toBe(pts);
  });

  it('por defecto respeta un tramo vertical manual (x idéntica)', () => {
    const pts = [p(0, 100), p(50, 100), p(50, 20), p(100, 20)];
    const r = sanitizeFunctionTrace(pts);
    expect(r.repaired).toBe(false);
    expect(r.points).toHaveLength(4);
  });

  it('con collapseEqualX funde los micro-verticales (modo snap)', () => {
    const pts = [p(0, 100), p(50, 100), p(50, 96), p(100, 20)];
    const r = sanitizeFunctionTrace(pts, { collapseEqualX: true });
    expect(r.repaired).toBe(true);
    expect(r.dropped).toBe(1);
    expect(buildPiecewise(r.points).isFunction).toBe(true);
  });

  it('conserva la orientación cuando se dibujó de derecha a izquierda', () => {
    const pts = [p(200, 30), p(150, 40), p(153, 42), p(100, 60), p(0, 100)];
    const r = sanitizeFunctionTrace(pts);
    expect(r.repaired).toBe(true);
    expect(r.points[0]).toEqual(p(200, 30)); // sigue empezando por la derecha
    expect(r.points[r.points.length - 1]).toEqual(p(0, 100));
    expect(buildPiecewise(r.points).isFunction).toBe(true);
  });

  it('no toca trazos de menos de 3 puntos', () => {
    const pts = [p(50, 0), p(50, 100)];
    expect(sanitizeFunctionTrace(pts).repaired).toBe(false);
  });
});

describe('segmentLine', () => {
  const origin = p(100, 500); // esquina inferior-izquierda del marco

  it('calcula la recta de un tramo a 45°', () => {
    const line = segmentLine(p(100, 500), p(200, 400), origin);
    expect(line.vertical).toBe(false);
    if (!line.vertical) {
      expect(line.m).toBeCloseTo(1, 10); // sube 1 por cada 1
      expect(line.b).toBeCloseTo(0, 10);
      expect(line.x0).toBe(0);
      expect(line.x1).toBe(100);
    }
  });

  it('ordena internamente aunque el tramo se dibuje de derecha a izquierda', () => {
    const a = segmentLine(p(200, 400), p(100, 500), origin);
    const b = segmentLine(p(100, 500), p(200, 400), origin);
    expect(a).toEqual(b);
  });

  it('detecta el tramo vertical y devuelve x = c', () => {
    const line = segmentLine(p(150, 500), p(150, 300), origin);
    expect(line.vertical).toBe(true);
    if (line.vertical) expect(line.x).toBe(50);
  });

  it('la ecuación evalúa bien en los extremos', () => {
    // a=(120,480) b=(180,420) con origin=(100,500) → A=(20,20), B=(80,80)
    const line = segmentLine(p(120, 480), p(180, 420), origin);
    if (!line.vertical) {
      expect(line.m * 20 + line.b).toBeCloseTo(20, 10);
      expect(line.m * 80 + line.b).toBeCloseTo(80, 10);
    }
  });
});
