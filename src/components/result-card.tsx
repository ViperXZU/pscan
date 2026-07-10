import { Text, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  caption?: string;
};

export function ResultCard({ label, value, caption }: Props) {
  return (
    <View className="w-full rounded-2xl border border-neutral-200 bg-white px-5 py-4">
      <Text className="text-xs uppercase tracking-widest text-neutral-500">{label}</Text>
      <Text className="mt-1 text-3xl font-bold text-neutral-900">{value}</Text>
      {caption ? <Text className="mt-1 text-xs text-neutral-400">{caption}</Text> : null}
    </View>
  );
}
