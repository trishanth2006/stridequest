import { Pressable, Text, ActivityIndicator } from 'react-native'

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
      className="w-full items-center justify-center rounded-2xl bg-emerald-500 py-4 disabled:opacity-50"
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-base font-bold text-white">{label}</Text>
      )}
    </Pressable>
  )
}
