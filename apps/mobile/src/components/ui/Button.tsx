import { Pressable, Text, ActivityIndicator } from 'react-native'
import { colors } from '@/theme'

type Props = {
  onPress: () => void
  label: string
  loading?: boolean
  disabled?: boolean
}

export function Button({ onPress, label, loading = false, disabled = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className="w-full items-center justify-center rounded-2xl bg-primary py-4 disabled:opacity-50"
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text className="text-base font-bold text-white">{label}</Text>
      )}
    </Pressable>
  )
}
