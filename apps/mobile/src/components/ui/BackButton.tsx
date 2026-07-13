import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '@/theme'

/** Standard header back button with an accessible 44px+ tap target. */
export function BackButton() {
  const router = useRouter()
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={22} color={colors.primary} />
    </Pressable>
  )
}
