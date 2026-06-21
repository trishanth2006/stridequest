import { useState } from 'react'
import { View, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormError } from '@/components/ui/FormError'
import type { AuthFormState } from '@/features/auth/types'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<AuthFormState>({ error: null, loading: false })

  async function handleSubmit() {
    setState({ error: null, loading: true })

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setState({ error: 'Invalid email or password', loading: false })
      return
    }

    router.replace('/(protected)/(tabs)/index')
  }

  return (
    <View className="gap-4">
      <FormError message={state.error} />

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
          autoComplete="current-password"
        />
      </View>

      <Button
        onPress={handleSubmit}
        label="Sign In"
        loading={state.loading}
        disabled={state.loading}
      />
    </View>
  )
}
