import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageMeasurer } from '@/components/image-measurer';

export default function MeasureScreen() {
  const insets = useSafeAreaInsets();
  const { uri, imgW, imgH } = useLocalSearchParams<{
    uri?: string;
    imgW?: string;
    imgH?: string;
  }>();

  useEffect(() => {
    if (!uri) router.replace('/');
  }, [uri]);

  if (!uri) return null;

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ImageMeasurer
        uri={uri}
        initialImgW={Number(imgW) || 0}
        initialImgH={Number(imgH) || 0}
        onDone={(points) =>
          router.push({
            pathname: '/results',
            params: { points: JSON.stringify(points), uri },
          })
        }
      />
    </View>
  );
}
