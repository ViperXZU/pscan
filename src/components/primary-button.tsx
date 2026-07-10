import { Pressable, Text } from 'react-native';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function PrimaryButton({ title, onPress, disabled = false, variant = 'primary' }: Props) {
  const container =
    variant === 'primary'
      ? 'bg-blue-600 active:bg-blue-700'
      : 'bg-neutral-100 active:bg-neutral-200';
  const label = variant === 'primary' ? 'text-white' : 'text-neutral-900';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`w-full items-center justify-center rounded-2xl px-6 py-4 ${container} ${
        disabled ? 'opacity-40' : ''
      }`}>
      <Text className={`text-base font-semibold ${label}`}>{title}</Text>
    </Pressable>
  );
}
