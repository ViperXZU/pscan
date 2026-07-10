import { simplifyPolyline, snapPolylineToEdges, type EdgeBitmap } from '../edgeSnap';
import type { Point } from '../types';

/** Crea un bitmap vacío w×h. */
const emptyBitmap = (w: number, h: number): EdgeBitmap => ({
  data: new Uint8Array(w * h),
  w,
  h,
});

/** Marca un píxel como borde (con un pequeño grosor vertical para realismo). */
function drawEdge(bmp: EdgeBitmap, x: number, y: number) {
  for (const dy of [-1, 0, 1]) {
    const yi = Math.round(y) + dy;
    const xi = Math.round(x);
    if (xi >= 0 && yi >= 0 && xi < bmp.w && yi < bmp.h) bmp.data[yi * bmp.w + xi] = 255;
  }
}

/** y de la parábola sintética usada en varios tests (en coords de imagen). */
const parabolaY = (x: number) => 0.005 * (x - 100) ** 2 + 20;

/** Bitmap 200×120 con la parábola dibujada como borde. */
function parabolaBitmap(): EdgeBitmap {
  const bmp = emptyBitmap(200, 120);
  for (let x = 10; x <= 190; x++) drawEdge(bmp, x, parabolaY(x));
  return bmp;
}

describe('snapPolylineToEdges', () => {
  it('imanta una guía recta a la curva real', () => {
    const bmp = parabolaBitmap();
    // Guía: 3 puntos aproximados (a ≤15 px de la parábola, dentro del radio).
    const guide: Point[] = [
      { x: 20, y: parabolaY(20) - 12 },
      { x: 100, y: parabolaY(100) + 14 },
      { x: 180, y: parabolaY(180) - 10 },
    ];
    const snapped = snapPolylineToEdges(bmp, guide)!;
    expect(snapped).not.toBeNull();
    expect(snapped.length).toBeGreaterThanOrEqual(3);

    // Cada punto imantado debe caer sobre la parábola (±3 px por el grosor).
    for (const p of snapped) {
      expect(Math.abs(p.y - parabolaY(p.x))).toBeLessThanOrEqual(3);
    }

    // Y debe capturar la curvatura: el punto medio baja respecto a los extremos.
    const midX = snapped.reduce((best, p) => (Math.abs(p.x - 100) < Math.abs(best.x - 100) ? p : best));
    expect(Math.abs(midX.y - parabolaY(100))).toBeLessThanOrEqual(4);
  });

  it('devuelve null cuando no hay borde cerca (bitmap vacío)', () => {
    const bmp = emptyBitmap(200, 120);
    const guide: Point[] = [
      { x: 20, y: 30 },
      { x: 180, y: 90 },
    ];
    expect(snapPolylineToEdges(bmp, guide)).toBeNull();
  });

  it('devuelve null si la guía queda lejos del borde (fuera de radio)', () => {
    const bmp = parabolaBitmap();
    const guide: Point[] = [
      { x: 20, y: 110 },
      { x: 180, y: 115 },
    ]; // la parábola está ~70+ px por encima
    expect(snapPolylineToEdges(bmp, guide)).toBeNull();
  });

  it('guías degeneradas devuelven null', () => {
    const bmp = parabolaBitmap();
    expect(snapPolylineToEdges(bmp, [{ x: 10, y: 10 }])).toBeNull();
    expect(
      snapPolylineToEdges(bmp, [
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ]),
    ).toBeNull();
  });
});

describe('simplifyPolyline (RDP)', () => {
  it('colapsa puntos colineales a los dos extremos', () => {
    const pts: Point[] = Array.from({ length: 20 }, (_, i) => ({ x: i * 10, y: 5 }));
    expect(simplifyPolyline(pts, 2)).toEqual([
      { x: 0, y: 5 },
      { x: 190, y: 5 },
    ]);
  });

  it('conserva la forma dentro de la tolerancia', () => {
    const pts: Point[] = Array.from({ length: 41 }, (_, i) => {
      const x = i * 5;
      return { x, y: parabolaY(x) };
    });
    const eps = 2.5;
    const simplified = simplifyPolyline(pts, eps);
    expect(simplified.length).toBeLessThan(pts.length);
    expect(simplified.length).toBeGreaterThanOrEqual(3); // una curva no puede ser 2 puntos

    // Ningún punto original queda a más de eps del trazo simplificado.
    const distToSegment = (p: Point, a: Point, b: Point) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };
    for (const p of pts) {
      let min = Infinity;
      for (let i = 0; i + 1 < simplified.length; i++) {
        min = Math.min(min, distToSegment(p, simplified[i], simplified[i + 1]));
      }
      expect(min).toBeLessThanOrEqual(eps + 0.01);
    }
  });

  it('mantiene extremos intactos', () => {
    const pts: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 8 },
      { x: 20, y: 0 },
    ];
    const simplified = simplifyPolyline(pts, 1);
    expect(simplified[0]).toEqual({ x: 0, y: 0 });
    expect(simplified[simplified.length - 1]).toEqual({ x: 20, y: 0 });
    expect(simplified).toHaveLength(3); // el pico no se puede eliminar
  });
});
