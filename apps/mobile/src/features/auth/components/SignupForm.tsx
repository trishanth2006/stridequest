import { useState } from 'react'
import { View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import type { AuthFormState } from '@/features/auth/types'

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [state, setState] = useState<AuthFormState>({ error: null, loading: false })

  async function handleSubmit() {
    setState({ error: null, loading: true })

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })

    if (error) {
      const message = error.message.toLowerCase().includes('already registered')
        ? 'An account with this email already exists'
        : 'Signup failed. Please try again.'
      setState({ error: message, loading: false })
      return
    }

    router.replace('/(protected)/(tabs)')
  }

  return (
    <View className="gap-4">
      <FormError message={state.error} />

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-white">Username</Text>
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder="striderunner"
          autoCapitalize="none"
          autoComplete="username"
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-white">Email</Text>
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-white">Password</Text>
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          autoComplete="new-password"
        />
      </View>

      <Button
        onPress={handleSubmit}
        label="Create Account"
        loading={state.loading}
        disabled={state.loading}
      />
    </View>
  )
}
