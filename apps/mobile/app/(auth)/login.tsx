import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { LoginForm } from '@/features/auth/components/LoginForm'

export default function LoginScreen() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <View className="flex-1 justify-center px-6 gap-8">
        <View className="gap-2">
          <Text className="text-4xl font-extrabold tracking-tight text-white">StrideQuest</Text>
          <Text className="text-base text-neutral-400">Sign in to continue</Text>
        </View>

        <LoginForm />

        <View className="flex-row justify-center gap-1">
          <Text className="text-sm text-neutral-500">Don't have an account?</Text>
          <Pressable onPress={() => router.push('/(auth)/signup')}>
            <Text className="text-sm font-semibold text-emerald-500">Sign up</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
