import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.uri) return;
    router.push({
      pathname: '/measure',
      params: {
        uri: asset.uri,
        imgW: String(asset.width ?? 0),
        imgH: String(asset.height ?? 0),
      },
    });
  };

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-7xl font-bold text-blue-600">∠</Text>
        <Text className="mt-4 text-3xl font-bold tracking-tight text-neutral-900">PScan</Text>
        <Text className="mt-2 text-center text-base leading-6 text-neutral-500">
          Mide la pendiente de un objeto{'\n'}a partir de una foto
        </Text>
      </View>
      <View className="gap-3 px-8 pb-8">
        <PrimaryButton title="Tomar foto" onPress={() => router.push('/camera')} />
        <PrimaryButton title="Elegir de galería" variant="secondary" onPress={pickFromGallery} />
        <Text className="mt-2 text-center text-xs text-neutral-400">
          100 % sin conexión · el cálculo se hace en tu teléfono
        </Text>
      </View>
    </View>
  );
}
