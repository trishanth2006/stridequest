import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { SignupForm } from '@/features/auth/components/SignupForm'

export default function SignupScreen() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 justify-center px-6 gap-8">
        <View className="gap-2">
          <Text className="text-4xl font-extrabold tracking-tight text-white">StrideQuest</Text>
          <Text className="text-base text-fgSecondary">Create your account</Text>
        </View>

        <SignupForm />

        <View className="flex-row justify-center gap-1">
          <Text className="text-sm text-neutral-500">Already have an account?</Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text className="text-sm font-semibold text-primary">Sign in</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
