import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface NormalizedPhoto {
  uri: string;
  width: number;
  height: number;
}

/**
 * Decodifica la foto, aplica FÍSICAMENTE la rotación EXIF y la re-guarda,
 * devolviendo la uri normalizada y sus dimensiones definitivas.
 *
 * Por qué: las fotos de cámara suelen guardarse con los píxeles del sensor
 * (apaisados) más una etiqueta EXIF de rotación. Los visores las muestran
 * rotadas, pero el width/height reportado puede venir SIN rotar. Con ello los
 * puntos marcados quedan guardados contra unas dimensiones equivocadas: en la
 * pantalla de medición no se nota (el error es autoconsistente), pero al
 * redibujar en una caja de otra proporción (miniatura de resultados) los
 * puntos se corren. Normalizar una sola vez al capturar/elegir elimina la
 * ambigüedad en toda la cadena (medición, resultados y OpenCV).
 */
export async function normalizePhoto(uri: string): Promise<NormalizedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.9 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
