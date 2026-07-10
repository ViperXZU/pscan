import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

/** Desviación máxima (en grados) para considerar el teléfono nivelado. */
const LEVEL_THRESHOLD_DEG = 3;

/**
 * Indicador de nivel para la pantalla de cámara: usa el acelerómetro para
 * mostrar cuánto está rotado el teléfono respecto a la horizontal (roll).
 * Se pone verde cuando está a ±3° de nivel. 100 % offline.
 */
export function LevelIndicator() {
  const [roll, setRoll] = useState<number | null>(null);
  const smoothed = useRef<number | null>(null);

  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y }) => {
      // En vertical (retrato) la gravedad apunta hacia -y → roll = 0 si está derecho.
      const raw = Math.atan2(x, -y) * (180 / Math.PI);
      // Filtro paso-bajo para que la lectura no tiemble.
      const prev = smoothed.current;
      const next = prev === null ? raw : prev + 0.25 * (raw - prev);
      smoothed.current = next;
      setRoll(next);
    });
    return () => sub.remove();
  }, []);

  if (roll === null) return <View className="h-9" />;

  const isLevel = Math.abs(roll) <= LEVEL_THRESHOLD_DEG;

  return (
    <View
      className={`flex-row items-center gap-2 rounded-full px-3 py-2 ${
        isLevel ? 'bg-emerald-500/90' : 'bg-black/50'
      }`}>
      <View
        className="h-0.5 w-8 rounded-full bg-white"
        style={{ transform: [{ rotate: `${roll}deg` }] }}
      />
      <Text className="text-xs font-semibold text-white">{Math.abs(roll).toFixed(1)}°</Text>
    </View>
  );
}
