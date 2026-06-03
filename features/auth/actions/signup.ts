'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/supabase/server'
import { signupSchema } from '@/lib/validations/auth'
import type { AuthActionResult } from '@/features/auth/types'

export async function signupAction(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const result = signupSchema.safeParse({
    email: (formData.get('email') ?? '') as string,
    password: (formData.get('password') ?? '') as string,
    username: (formData.get('username') ?? '') as string,
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { email, password, username } = result.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      return { error: 'An account with this email already exists' }
    }
    return { error: 'Signup failed. Please try again.' }
  }

  redirect('/dashboard')
}
