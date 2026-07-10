import {
  computeContainTransform,
  imageToLayout,
  layoutToImage,
} from '../imageMapping';

describe('computeContainTransform', () => {
  it('devuelve null con dimensiones inválidas', () => {
    expect(computeContainTransform({ imgW: 0, imgH: 100, boxW: 300, boxH: 300 })).toBeNull();
    expect(computeContainTransform({ imgW: 100, imgH: 100, boxW: 0, boxH: 300 })).toBeNull();
  });

  it('foto 4000×3000 (paisaje) en caja 300×300: letterbox arriba/abajo', () => {
    const t = computeContainTransform({ imgW: 4000, imgH: 3000, boxW: 300, boxH: 300 })!;
    expect(t.scale).toBeCloseTo(0.075, 10); // limita el ancho
    expect(t.offsetX).toBeCloseTo(0, 10);
    expect(t.offsetY).toBeCloseTo(37.5, 10); // (300 - 225) / 2
  });

  it('foto 3000×4000 (retrato) en caja 300×600: letterbox a los lados', () => {
    const t = computeContainTransform({ imgW: 3000, imgH: 4000, boxW: 300, boxH: 600 })!;
    expect(t.scale).toBeCloseTo(0.1, 10); // limita el ancho
    expect(t.offsetX).toBeCloseTo(0, 10);
    expect(t.offsetY).toBeCloseTo(100, 10); // (600 - 400) / 2
  });
});

describe('layoutToImage / imageToLayout', () => {
  const t = computeContainTransform({ imgW: 4000, imgH: 3000, boxW: 300, boxH: 300 })!;

  it('el centro de la caja es el centro de la imagen', () => {
    const img = layoutToImage({ x: 150, y: 150 }, t)!;
    expect(img.x).toBeCloseTo(2000, 6);
    expect(img.y).toBeCloseTo(1500, 6);
  });

  it('las esquinas de la imagen caen en los bordes del área visible', () => {
    expect(imageToLayout({ x: 0, y: 0 }, t)).toEqual({ x: 0, y: 37.5 });
    expect(imageToLayout({ x: 4000, y: 3000 }, t)).toEqual({ x: 300, y: 262.5 });
  });

  it('rechaza toques en las barras del letterbox', () => {
    expect(layoutToImage({ x: 150, y: 10 }, t)).toBeNull(); // barra superior
    expect(layoutToImage({ x: 150, y: 290 }, t)).toBeNull(); // barra inferior
  });

  it('en modo clamp encaja el punto dentro de la imagen (para arrastres)', () => {
    // Barra superior → se encaja a y=0.
    expect(layoutToImage({ x: 150, y: 10 }, t, 'clamp')).toEqual({ x: 2000, y: 0 });
    // Fuera por la derecha y por abajo → esquina inferior derecha.
    expect(layoutToImage({ x: 500, y: 500 }, t, 'clamp')).toEqual({ x: 4000, y: 3000 });
    // Dentro de la imagen: clamp no altera nada.
    const inside = layoutToImage({ x: 150, y: 150 }, t, 'clamp')!;
    expect(inside.x).toBeCloseTo(2000, 6);
    expect(inside.y).toBeCloseTo(1500, 6);
  });

  it('ida y vuelta: imageToLayout(layoutToImage(p)) ≈ p', () => {
    const points = [
      { x: 12.3, y: 45.6 },
      { x: 150, y: 150 },
      { x: 299, y: 260 },
      { x: 0.5, y: 38 },
    ];
    for (const p of points) {
      const img = layoutToImage(p, t);
      expect(img).not.toBeNull();
      const back = imageToLayout(img!, t);
      expect(back.x).toBeCloseTo(p.x, 8);
      expect(back.y).toBeCloseTo(p.y, 8);
    }
  });

  it('preserva el ángulo: la escala es uniforme en x e y', () => {
    // Dos puntos de imagen con pendiente conocida de 30°.
    const a = { x: 1000, y: 2000 };
    const dxImg = 1000;
    const dyImg = -Math.tan((30 * Math.PI) / 180) * dxImg;
    const b = { x: a.x + dxImg, y: a.y + dyImg };

    const la = imageToLayout(a, t);
    const lb = imageToLayout(b, t);
    const angleLayout = (Math.atan2(-(lb.y - la.y), lb.x - la.x) * 180) / Math.PI;
    expect(angleLayout).toBeCloseTo(30, 8);
  });

  it('el mismo par de puntos da el mismo ángulo en cajas retrato y paisaje', () => {
    const tPortrait = computeContainTransform({ imgW: 4000, imgH: 3000, boxW: 300, boxH: 600 })!;
    const tLandscape = computeContainTransform({ imgW: 4000, imgH: 3000, boxW: 600, boxH: 300 })!;
    const a = { x: 500, y: 2500 };
    const b = { x: 3500, y: 700 };

    const angleIn = (tt: NonNullable<typeof tPortrait>) => {
      const la = imageToLayout(a, tt);
      const lb = imageToLayout(b, tt);
      return (Math.atan2(-(lb.y - la.y), lb.x - la.x) * 180) / Math.PI;
    };
    expect(angleIn(tPortrait)).toBeCloseTo(angleIn(tLandscape), 8);
  });
});
