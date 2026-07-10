import {
  pickBestSegment,
  pointToSegmentDistance,
  segmentLength,
  type Segment,
} from '../segmentPick';

const FRAME = { w: 1000, h: 800 };

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => ({
  a: { x: x1, y: y1 },
  b: { x: x2, y: y2 },
});

describe('segmentLength', () => {
  it('calcula la longitud euclídea', () => {
    expect(segmentLength(seg(0, 0, 300, 400))).toBeCloseTo(500, 10);
  });
});

describe('pointToSegmentDistance', () => {
  const s = seg(100, 100, 500, 100); // horizontal

  it('proyección dentro del tramo', () => {
    expect(pointToSegmentDistance({ x: 300, y: 160 }, s)).toBeCloseTo(60, 10);
  });

  it('proyección fuera del tramo: distancia al extremo', () => {
    expect(pointToSegmentDistance({ x: 600, y: 100 }, s)).toBeCloseTo(100, 10);
    expect(pointToSegmentDistance({ x: 0, y: 100 }, s)).toBeCloseTo(100, 10);
  });

  it('segmento degenerado (punto)', () => {
    expect(pointToSegmentDistance({ x: 3, y: 4 }, seg(0, 0, 0, 0))).toBeCloseTo(5, 10);
  });
});

describe('pickBestSegment', () => {
  it('devuelve null sin segmentos', () => {
    expect(pickBestSegment([], FRAME)).toBeNull();
  });

  it('sin referencia elige el más largo', () => {
    const short = seg(0, 0, 200, 0);
    const long = seg(0, 100, 900, 100);
    expect(pickBestSegment([short, long], FRAME)).toBe(long);
  });

  it('descarta segmentos cortos (ruido) cuando hay alternativas', () => {
    // minLength = 0.12 * 1000 = 120 → el de 50 px es ruido.
    const noise = seg(0, 0, 50, 0);
    const real = seg(0, 100, 400, 100);
    expect(pickBestSegment([noise, real], FRAME)).toBe(real);
  });

  it('si todos son cortos, aun así devuelve el mejor disponible', () => {
    const a = seg(0, 0, 40, 0);
    const b = seg(0, 10, 80, 10);
    expect(pickBestSegment([a, b], FRAME)).toBe(b);
  });

  it('con referencia prefiere el más largo CERCANO, no el más largo global', () => {
    // Diagonal = ~1280 → radio = ~192.
    const farButLong = seg(0, 700, 999, 700);
    const nearAndDecent = seg(100, 80, 500, 80);
    const near = { x: 300, y: 100 }; // a 20 px del segundo, a ~600 del primero
    expect(pickBestSegment([farButLong, nearAndDecent], FRAME, near)).toBe(nearAndDecent);
  });

  it('si nada cae dentro del radio, elige el más cercano a la referencia', () => {
    const s1 = seg(0, 700, 900, 700);
    const s2 = seg(0, 400, 900, 400);
    const near = { x: 450, y: 100 };
    expect(pickBestSegment([s1, s2], FRAME, near)).toBe(s2);
  });
});
