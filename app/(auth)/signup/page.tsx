import Link from 'next/link'
import { SignupForm } from '@/features/auth/components/SignupForm'

export const metadata = { title: 'Create Account — StrideQuest' }

export default function SignupPage() {
  return (
    <>
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Start your journey</h2>
        <p className="mt-1 text-sm text-muted-foreground">Create your StrideQuest account</p>
      </div>

      <SignupForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Sign in
        </Link>
      </p>
    </>
  )
}
