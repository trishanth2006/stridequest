import Link from 'next/link'
import { LoginForm } from '@/features/auth/components/LoginForm'

export const metadata = { title: 'Sign In — StrideQuest' }

export default function LoginPage() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Welcome back</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to continue your journey</p>
      </div>

      <LoginForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to StrideQuest?{' '}
        <Link href="/signup" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Create an account
        </Link>
      </p>
    </>
  )
}
