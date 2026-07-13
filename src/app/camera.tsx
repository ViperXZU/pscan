import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LevelIndicator } from '@/components/level-indicator';
import { PrimaryButton } from '@/components/primary-button';
import { normalizePhoto } from '@/lib/normalizeImage';

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View
        className="flex-1 bg-white"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-lg font-semibold text-neutral-900">
            Se necesita acceso a la cámara
          </Text>
          <Text className="mb-3 text-center text-sm text-neutral-500">
            Solo se usa para fotografiar el objeto cuya pendiente quieres medir. Nada sale de tu
            teléfono.
          </Text>
          <PrimaryButton title="Conceder permiso" onPress={requestPermission} />
          <PrimaryButton title="Volver" variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const takePhoto = async () => {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        // Aplica la rotación EXIF de forma física y obtiene las dimensiones
        // definitivas: evita que los puntos se corran al redibujar (ver
        // normalizeImage.ts). Si falla, se usa la foto original.
        let result = { uri: photo.uri, width: photo.width ?? 0, height: photo.height ?? 0 };
        try {
          result = await normalizePhoto(photo.uri);
        } catch {}
        router.replace({
          pathname: '/measure',
          params: {
            uri: result.uri,
            imgW: String(result.width),
            imgH: String(result.height),
          },
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />

      {/* Cruz guía centrada (ejes de plano cartesiano) para apuntar derecho. */}
      <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
        <View className="absolute h-px w-full bg-white/60" />
        <View className="absolute h-full w-px bg-white/60" />
        <View className="h-2.5 w-2.5 rounded-full border-2 border-white/90" />
      </View>

      <View
        className="absolute inset-0 justify-between"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        pointerEvents="box-none">
        <View className="flex-row items-center justify-between px-5 pt-2" pointerEvents="box-none">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full bg-black/50">
            <Text className="text-lg text-white">✕</Text>
          </Pressable>
          <LevelIndicator />
          <View className="h-10 w-10" />
        </View>

        <View className="items-center pb-6" pointerEvents="box-none">
          <Text className="mb-4 px-10 text-center text-xs text-white/80">
            Mantén el teléfono nivelado y fotografía la pendiente de frente
          </Text>
          <Pressable
            onPress={takePhoto}
            disabled={busy}
            className={`h-20 w-20 items-center justify-center rounded-full border-4 border-white ${
              busy ? 'opacity-50' : ''
            }`}>
            <View className="h-14 w-14 rounded-full bg-white" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
