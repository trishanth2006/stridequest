'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { signupAction } from '@/features/auth/actions'
import type { AuthActionResult } from '@/features/auth/types'

const initialState: AuthActionResult = { error: null }

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState)

  return (
    <form action={formAction} noValidate className="space-y-5">
      {state.error && (
        <div
          role="alert"
          data-testid="auth-error"
          className="rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-foreground">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          className="rounded-xl border-white/5 bg-black/50 px-4 py-6 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/50 transition-all duration-300"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-foreground">
          Username
        </Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          required
          placeholder="trailblazer"
          className="rounded-xl border-white/5 bg-black/50 px-4 py-6 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/50 transition-all duration-300"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-foreground">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          className="rounded-xl border-white/5 bg-black/50 px-4 py-6 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/50 transition-all duration-300"
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        size="lg"
        className="w-full rounded-xl bg-primary py-6 text-primary-foreground font-bold hover:bg-primary hover:scale-102 hover:-translate-y-0.5 focus-visible:ring-primary/40 disabled:opacity-50 transition-all duration-300 ease-out shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)]"
      >
        {isPending ? 'Creating account…' : 'Create Account'}
      </Button>
    </form>
  )
}
