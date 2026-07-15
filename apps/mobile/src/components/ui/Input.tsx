import { TextInput } from 'react-native'
import type { TextInputProps } from 'react-native'
import { colors } from '@/theme'

export function Input(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.gray}
      className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-4 text-base text-white"
    />
  )
}
