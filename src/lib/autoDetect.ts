import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { snapPolylineToEdges } from './edgeSnap';
import { pickBestSegment, type Segment } from './segmentPick';
import type { Point } from './types';

/** Ancho máximo al que se reescala la imagen antes de pasarla por OpenCV. */
const MAX_PROCESS_WIDTH = 1024;

/**
 * La detección automática usa react-native-fast-opencv (código nativo) y no
 * existe dentro de Expo Go: ahí este error permite explicarlo con un mensaje
 * amable en lugar de crashear. En un development build funciona normalmente.
 */
export class AutoDetectUnavailableError extends Error {
  constructor() {
    super('react-native-fast-opencv no está disponible en este runtime (¿Expo Go?)');
    this.name = 'AutoDetectUnavailableError';
  }
}

type CvModule = typeof import('react-native-fast-opencv');

/** Carga perezosa del módulo nativo (un import estático rompería Expo Go). */
function loadCv(): CvModule {
  try {
    return require('react-native-fast-opencv');
  } catch {
    throw new AutoDetectUnavailableError();
  }
}

/**
 * Pipeline compartido: reescala la foto, la convierte a gris, desenfoca y
 * calcula el mapa de bordes (Canny). El llamador DEBE ejecutar
 * OpenCV.clearBuffers() en un finally.
 */
async function prepareEdges(args: { uri: string; imgW: number }) {
  const cv = loadCv();
  const { OpenCV, ObjectType, DataTypes, ColorConversionCodes } = cv;

  const context = ImageManipulator.manipulate(args.uri);
  if (args.imgW > MAX_PROCESS_WIDTH) {
    context.resize({ width: MAX_PROCESS_WIDTH });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.85,
    base64: true,
  });
  if (!saved.base64 || saved.width <= 0) return null;

  const src = OpenCV.base64ToMat(saved.base64);

  const gray = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
  OpenCV.invoke('cvtColor', src, gray, ColorConversionCodes.COLOR_BGR2GRAY);

  const blurred = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
  const ksize = OpenCV.createObject(ObjectType.Size, 5, 5);
  OpenCV.invoke('GaussianBlur', gray, blurred, ksize, 1.5);

  const edges = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_8U);
  OpenCV.invoke('Canny', blurred, edges, 50, 150);

  return {
    cv,
    edges,
    scaledW: saved.width,
    scaledH: saved.height,
    // resize() mantiene la proporción → un único factor para x e y.
    toOriginal: args.imgW / saved.width,
  };
}

/**
 * Detecta el borde/línea RECTA dominante (HoughLinesP) y devuelve sus extremos
 * en píxeles de la imagen original. Para curvas, ver traceEdgeAlongGuide.
 */
export async function detectDominantEdge(args: {
  uri: string;
  imgW: number;
  imgH: number;
  /** Punto de referencia (px de imagen original), p. ej. el último punto marcado. */
  near?: Point | null;
}): Promise<Segment | null> {
  const prep = await prepareEdges(args);
  if (!prep) return null;
  const { cv, edges, scaledW, scaledH, toOriginal } = prep;
  const { OpenCV, ObjectType, DataTypes } = cv;

  try {
    const lines = OpenCV.createObject(ObjectType.Mat, 0, 0, DataTypes.CV_32S);
    OpenCV.invoke('HoughLinesP', edges, lines, 1, Math.PI / 180, 60);

    // Leer los segmentos (x1, y1, x2, y2 por línea, int32).
    const { buffer } = OpenCV.matToBuffer(lines, 'int32');
    const segments: Segment[] = [];
    for (let i = 0; i + 3 < buffer.length; i += 4) {
      segments.push({
        a: { x: buffer[i], y: buffer[i + 1] },
        b: { x: buffer[i + 2], y: buffer[i + 3] },
      });
    }

    const nearScaled = args.near
      ? { x: args.near.x / toOriginal, y: args.near.y / toOriginal }
      : null;
    const best = pickBestSegment(segments, { w: scaledW, h: scaledH }, nearScaled);
    if (!best) return null;
    return {
      a: { x: best.a.x * toOriginal, y: best.a.y * toOriginal },
      b: { x: best.b.x * toOriginal, y: best.b.y * toOriginal },
    };
  } finally {
    // Los Mats se gestionan a mano en fast-opencv: liberar SIEMPRE.
    OpenCV.clearBuffers();
  }
}

/**
 * "Imanta" la guía del usuario (unos pocos puntos aproximados) al borde real:
 * lee el mapa de Canny completo y busca, a lo largo de la guía, el píxel de
 * borde más cercano en perpendicular (ver edgeSnap.ts). Devuelve el trazo
 * denso simplificado en píxeles de la imagen ORIGINAL, o null si no hay un
 * borde claro cerca de la guía.
 */
export async function traceEdgeAlongGuide(args: {
  uri: string;
  imgW: number;
  imgH: number;
  /** Guía marcada por el usuario, en px de imagen original (≥2 puntos). */
  guide: Point[];
}): Promise<Point[] | null> {
  if (args.guide.length < 2) return null;

  const prep = await prepareEdges(args);
  if (!prep) return null;
  const { cv, edges, toOriginal } = prep;
  const { OpenCV } = cv;

  try {
    const { buffer, cols, rows } = OpenCV.matToBuffer(edges, 'uint8');
    const bitmap = { data: buffer, w: cols, h: rows };

    const guideScaled = args.guide.map((p) => ({
      x: p.x / toOriginal,
      y: p.y / toOriginal,
    }));

    const snapped = snapPolylineToEdges(bitmap, guideScaled);
    if (!snapped) return null;

    return snapped.map((p) => ({ x: p.x * toOriginal, y: p.y * toOriginal }));
  } finally {
    OpenCV.clearBuffers();
  }
}
