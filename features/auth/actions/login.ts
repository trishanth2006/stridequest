'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/supabase/server'
import { loginSchema } from '@/lib/validations/auth'
import type { AuthActionResult } from '@/features/auth/types'

export async function loginAction(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const result = loginSchema.safeParse({
    email: (formData.get('email') ?? '') as string,
    password: (formData.get('password') ?? '') as string,
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(result.data)

  if (error) {
    return { error: 'Invalid email or password' }
  }

  redirect('/dashboard')
}
