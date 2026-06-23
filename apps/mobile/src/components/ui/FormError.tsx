import { Text } from 'react-native'

type Props = { message: string | null }

export function FormError({ message }: Props) {
  if (!message) return null
  return (
    <Text className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
      {message}
    </Text>
  )
}
