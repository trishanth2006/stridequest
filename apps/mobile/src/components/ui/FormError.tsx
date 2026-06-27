import { Text } from 'react-native'

type Props = { message: string | null }

export function FormError({ message }: Props) {
  if (!message) return null
  return (
    <Text className="rounded-xl border border-danger/60 bg-danger/10 px-3 py-2.5 text-sm text-red-400">
      {message}
    </Text>
  )
}
