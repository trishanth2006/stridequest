# Mobile Authentication Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete Phase 1 authentication foundation for the StrideQuest Expo mobile app — login, signup, session persistence, protected routes, dashboard, and profile screens.

**Architecture:** Expo Router v4 file-based routing with `(auth)` and `(protected)` route groups mirrors the Next.js web app structure. Auth state is managed via a React Context (`SessionProvider`) that subscribes to `supabase.auth.onAuthStateChange`; screens read session via a `useSession` hook. All Supabase calls are direct client calls (no Server Actions — mobile-only concern).

**Tech Stack:** Expo SDK 52, Expo Router v4, NativeWind v4, @supabase/supabase-js v2, @stridequest/shared (XP/distance/formatters), TypeScript strict

---

## Current Mobile Architecture

### Verified Working Infrastructure (LOCKED — do not modify)
- Expo SDK 52, New Architecture (Hermes), Expo Router v4
- NativeWind v4 + Tailwind 3.4.x
- `apps/mobile` isolated from workspace root (`workspaces: ["packages/*"]` only)
- `apps/mobile` installs independently: `cd apps/mobile && npm install`
- `@stridequest/shared` linked via `file:../../packages/shared`
- `expo export -p android` → green (1102 modules, Hermes .hbc)
- `expo-doctor` → 18/18
- `npm run typecheck` → 0 errors

### Existing Files
```
apps/mobile/
├── app/
│   ├── _layout.tsx        # Root Stack, imports global.css
│   └── index.tsx          # Scaffold proof-of-concept (to be replaced)
└── src/
    └── lib/
        └── supabase.ts    # Supabase client (AsyncStorage, autoRefreshToken)
```

### Existing Supabase Client (`src/lib/supabase.ts`)
- `createClient(url, anonKey, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`
- Throws at module load if env vars missing

---

## Proposed Folder Tree (Approved)

```
apps/mobile/
├── app/
│   ├── _layout.tsx                        # Root layout — wraps SessionProvider, Stack
│   ├── index.tsx                          # Auth gate — redirects based on session state
│   ├── (auth)/
│   │   ├── _layout.tsx                    # Auth group — plain Stack, no tab bar
│   │   ├── login.tsx                      # Login screen
│   │   └── signup.tsx                     # Signup screen
│   └── (protected)/
│       ├── _layout.tsx                    # Protected layout — session guard + Stack
│       ├── dashboard.tsx                  # Dashboard screen
│       └── profile.tsx                    # Profile screen
└── src/
    ├── lib/
    │   └── supabase.ts                    # (exists — do not modify)
    ├── features/
    │   └── auth/
    │       ├── components/
    │       │   ├── LoginForm.tsx          # Controlled form → supabase.auth.signInWithPassword
    │       │   └── SignupForm.tsx         # Controlled form → supabase.auth.signUp
    │       ├── hooks/
    │       │   └── useSession.ts          # Reads SessionContext
    │       ├── providers/
    │       │   └── SessionProvider.tsx    # onAuthStateChange → Context
    │       └── types/
    │           └── index.ts              # AuthFormState type
    └── components/
        └── ui/
            ├── Button.tsx                 # NativeWind Pressable wrapper
            ├── Input.tsx                  # NativeWind TextInput wrapper
            └── FormError.tsx             # Inline error text
```

### File Ownership Rationale

| File | Owner | Why |
|------|-------|-----|
| `app/_layout.tsx` | routing | Root shell only; imports CSS, mounts provider |
| `app/index.tsx` | routing | Auth gate; reads session, redirects; no UI |
| `app/(auth)/_layout.tsx` | routing | Group shell; dark background, no tab bar |
| `app/(auth)/login.tsx` | routing | Thin screen; delegates to LoginForm |
| `app/(auth)/signup.tsx` | routing | Thin screen; delegates to SignupForm |
| `app/(protected)/_layout.tsx` | routing | Session guard; redirects if no session |
| `app/(protected)/dashboard.tsx` | routing | Fetches profile; renders stats |
| `app/(protected)/profile.tsx` | routing | Fetches profile; renders details + logout |
| `src/features/auth/providers/SessionProvider.tsx` | auth feature | Owns auth state machine; subscribes to Supabase |
| `src/features/auth/hooks/useSession.ts` | auth feature | Public API for session state |
| `src/features/auth/components/LoginForm.tsx` | auth feature | Form logic + Supabase call + navigation |
| `src/features/auth/components/SignupForm.tsx` | auth feature | Form logic + Supabase call + navigation |
| `src/features/auth/types/index.ts` | auth feature | Shared types between forms |
| `src/components/ui/Button.tsx` | shared UI | Reusable across all features |
| `src/components/ui/Input.tsx` | shared UI | Reusable across all features |
| `src/components/ui/FormError.tsx` | shared UI | Reusable across all features |
| `src/lib/supabase.ts` | infrastructure | (existing) |

---

## Authentication Flow

```
User opens app
    └─ app/index.tsx (auth gate)
           ├─ loading === true  →  render null (splash)
           ├─ session exists   →  router.replace('/(protected)/dashboard')
           └─ no session       →  router.replace('/(auth)/login')

Login flow:
    app/(auth)/login.tsx
        └─ <LoginForm />
               ├─ user submits email + password
               ├─ supabase.auth.signInWithPassword(...)
               ├─ error → show FormError
               └─ success → supabase fires onAuthStateChange(SIGNED_IN)
                              └─ SessionProvider updates context
                                     └─ app/index.tsx redirects to dashboard

Signup flow:
    app/(auth)/signup.tsx
        └─ <SignupForm />
               ├─ user submits email + password + username
               ├─ supabase.auth.signUp({ email, password, options: { data: { username } } })
               ├─ error → show FormError
               └─ success → same onAuthStateChange redirect as login
```

---

## Route Protection Flow

```
app/(protected)/_layout.tsx
    ├─ reads { session, loading } from useSession()
    ├─ loading → render null (avoid flash)
    ├─ no session → router.replace('/(auth)/login')
    └─ session → render <Stack />  (children mount)
```

---

## Session Persistence Flow

```
App cold start:
    supabase.ts → createClient with AsyncStorage
    SessionProvider mounts → sets loading = true
    supabase.auth.getSession() → reads from AsyncStorage
    onAuthStateChange fires with INITIAL_SESSION event
    SessionProvider sets session + loading = false
    app/index.tsx reads loading=false, session=X → redirects
```

---

## Dashboard Ownership

`app/(protected)/dashboard.tsx`:
- Fetches `profiles` row (`username`, `total_xp`, `total_distance_m`) using the mobile Supabase client
- Uses `getXpProgress(total_xp)` from `@stridequest/shared/xp`
- Uses `formatDistance(total_distance_m)` from `@stridequest/shared/running`
- Renders: greeting, XP card, distance card, streak card (static 0 for now), logout link

---

## Profile Ownership

`app/(protected)/profile.tsx`:
- Fetches same `profiles` row
- Renders: username, email, XP total, distance total
- Logout button calls `supabase.auth.signOut()` → triggers `onAuthStateChange(SIGNED_OUT)` → SessionProvider clears session → app/index.tsx redirects to login

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Session restore flash (login screen visible before AsyncStorage loads) | Medium | `loading === true` in auth gate renders null — no flash |
| Profile row missing (signup creates auth user; profile created by DB trigger) | Medium | Handle `profile === null` on dashboard — show email fallback |
| Expo Router redirect loop if auth state flickers on mount | Low | Guard all `router.replace` calls behind `loading === false` |
| Email confirmation enabled in Supabase project | Low | Check dashboard; if on, show "check your email" state |
| `profiles.total_xp` / `profiles.total_distance_m` denorm lag | Low | Known issue (see Cross-user reads memory) — acceptable for Phase 1 |

---

## Verification Strategy

After each task:
```bash
cd apps/mobile && npm run typecheck
```

Final verification:
```bash
cd apps/mobile && npm run typecheck
cd apps/mobile && npx expo-doctor
```

Expected: 0 TypeScript errors, 18/18 doctor checks.

---

## Implementation Tasks

### Task 1: Types

**Files:**
- Create: `apps/mobile/src/features/auth/types/index.ts`

- [ ] Create the file:

```typescript
export type AuthFormState = {
  error: string | null
  loading: boolean
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 2: UI Primitives

**Files:**
- Create: `apps/mobile/src/components/ui/Button.tsx`
- Create: `apps/mobile/src/components/ui/Input.tsx`
- Create: `apps/mobile/src/components/ui/FormError.tsx`

- [ ] Create `Button.tsx`:

```typescript
import { Pressable, Text, ActivityIndicator } from 'react-native'

type Props = {
  onPress: () => void
  label: string
  loading?: boolean
  disabled?: boolean
}

export function Button({ onPress, label, loading = false, disabled = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className="w-full items-center justify-center rounded-2xl bg-emerald-500 py-4 disabled:opacity-50"
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-base font-bold text-white">{label}</Text>
      )}
    </Pressable>
  )
}
```

- [ ] Create `Input.tsx`:

```typescript
import { TextInput } from 'react-native'
import type { TextInputProps } from 'react-native'

export function Input(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="#6b7280"
      className="w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-4 text-base text-white"
    />
  )
}
```

- [ ] Create `FormError.tsx`:

```typescript
import { Text } from 'react-native'

type Props = { message: string | null }

export function FormError({ message }: Props) {
  if (!message) return null
  return (
    <Text className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
      {message}
    </Text>
  )
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 3: SessionProvider

**Files:**
- Create: `apps/mobile/src/features/auth/providers/SessionProvider.tsx`

- [ ] Create the file:

```typescript
import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type SessionContextValue = {
  session: Session | null
  loading: boolean
}

const SessionContext = createContext<SessionContextValue>({ session: null, loading: true })

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <SessionContext.Provider value={{ session, loading }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 4: Root Layout (wire SessionProvider)

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] Replace content:

```typescript
import '../global.css'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SessionProvider } from '@/features/auth/providers/SessionProvider'

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SessionProvider>
  )
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 5: Auth Gate (index.tsx)

**Files:**
- Modify: `apps/mobile/app/index.tsx`

- [ ] Replace content:

```typescript
import { Redirect } from 'expo-router'
import { View } from 'react-native'
import { useSession } from '@/features/auth/providers/SessionProvider'

export default function Index() {
  const { session, loading } = useSession()

  if (loading) return <View className="flex-1 bg-[#0b0b0f]" />

  if (session) return <Redirect href="/(protected)/dashboard" />

  return <Redirect href="/(auth)/login" />
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 6: Auth Group Layout

**Files:**
- Create: `apps/mobile/app/(auth)/_layout.tsx`

- [ ] Create the file:

```typescript
import { Stack } from 'expo-router'

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b0b0f' } }} />
  )
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 7: LoginForm

**Files:**
- Create: `apps/mobile/src/features/auth/components/LoginForm.tsx`

- [ ] Create the file:

```typescript
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

    router.replace('/(protected)/dashboard')
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
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 8: SignupForm

**Files:**
- Create: `apps/mobile/src/features/auth/components/SignupForm.tsx`

- [ ] Create the file:

```typescript
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

    router.replace('/(protected)/dashboard')
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
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 9: Login Screen

**Files:**
- Create: `apps/mobile/app/(auth)/login.tsx`

- [ ] Create the file:

```typescript
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
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 10: Signup Screen

**Files:**
- Create: `apps/mobile/app/(auth)/signup.tsx`

- [ ] Create the file:

```typescript
import { View, Text, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { SignupForm } from '@/features/auth/components/SignupForm'

export default function SignupScreen() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <View className="flex-1 justify-center px-6 gap-8">
        <View className="gap-2">
          <Text className="text-4xl font-extrabold tracking-tight text-white">StrideQuest</Text>
          <Text className="text-base text-neutral-400">Create your account</Text>
        </View>

        <SignupForm />

        <View className="flex-row justify-center gap-1">
          <Text className="text-sm text-neutral-500">Already have an account?</Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text className="text-sm font-semibold text-emerald-500">Sign in</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 11: Protected Group Layout

**Files:**
- Create: `apps/mobile/app/(protected)/_layout.tsx`

- [ ] Create the file:

```typescript
import { useEffect } from 'react'
import { View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useSession } from '@/features/auth/providers/SessionProvider'

export default function ProtectedLayout() {
  const { session, loading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/(auth)/login')
    }
  }, [session, loading, router])

  if (loading || !session) {
    return <View className="flex-1 bg-[#0b0b0f]" />
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b0b0f' } }} />
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 12: Dashboard Screen

**Files:**
- Create: `apps/mobile/app/(protected)/dashboard.tsx`

- [ ] Create the file:

```typescript
import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { getXpProgress } from '@stridequest/shared/xp'
import { formatDistance } from '@stridequest/shared/running'

type Profile = {
  username: string
  total_xp: number
  total_distance_m: number
}

export default function DashboardScreen() {
  const { session } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!session?.user.id) return

    supabase
      .from('profiles')
      .select('username, total_xp, total_distance_m')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile)
      })
  }, [session?.user.id])

  const username = profile?.username ?? session?.user.email ?? 'Runner'
  const totalXp = profile?.total_xp ?? 0
  const totalDistanceM = profile?.total_distance_m ?? 0
  const progress = getXpProgress(totalXp)

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <ScrollView className="flex-1 px-5 pt-6" contentContainerClassName="gap-6 pb-12">

        {/* Header */}
        <View className="gap-1">
          <Text className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Ready to conquer today?
          </Text>
          <Text className="text-4xl font-extrabold tracking-tight text-white">{username}</Text>
        </View>

        {/* Stats row */}
        <View className="flex-row gap-3">
          <StatCard label="Total XP" value={totalXp.toLocaleString()} unit="xp" />
          <StatCard label="Distance" value={formatDistance(totalDistanceM)} unit="" />
        </View>

        {/* XP Progress */}
        <View className="rounded-2xl bg-neutral-900 p-5 gap-3">
          <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Level {progress.currentLevel}
          </Text>
          <View className="h-2 w-full rounded-full bg-white/10">
            <View
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${progress.progressPercent}%` }}
            />
          </View>
          <Text className="text-sm text-neutral-400">
            {progress.xpNeededToNextLevel} XP to level {progress.currentLevel + 1}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-neutral-900 p-4 gap-1">
      <Text className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">{label}</Text>
      <Text className="text-2xl font-bold text-white">
        {value}
        {unit ? <Text className="text-sm text-neutral-400"> {unit}</Text> : null}
      </Text>
    </View>
  )
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Task 13: Profile Screen + Logout

**Files:**
- Create: `apps/mobile/app/(protected)/profile.tsx`

- [ ] Create the file:

```typescript
import { useEffect, useState } from 'react'
import { View, Text, Pressable, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useSession } from '@/features/auth/providers/SessionProvider'
import { supabase } from '@/lib/supabase'
import { formatDistance } from '@stridequest/shared/running'

type Profile = {
  username: string
  total_xp: number
  total_distance_m: number
}

export default function ProfileScreen() {
  const { session } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    if (!session?.user.id) return

    supabase
      .from('profiles')
      .select('username, total_xp, total_distance_m')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile)
      })
  }, [session?.user.id])

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const username = profile?.username ?? session?.user.email ?? 'Runner'

  return (
    <SafeAreaView className="flex-1 bg-[#0b0b0f]">
      <View className="flex-1 px-5 pt-6 gap-6">

        {/* Header */}
        <Text className="text-3xl font-extrabold tracking-tight text-white">{username}</Text>
        <Text className="text-sm text-neutral-400">{session?.user.email}</Text>

        {/* Stats */}
        <View className="rounded-2xl bg-neutral-900 p-5 gap-4">
          <ProfileRow label="Total XP" value={(profile?.total_xp ?? 0).toLocaleString()} />
          <ProfileRow label="Total Distance" value={formatDistance(profile?.total_distance_m ?? 0)} />
        </View>

        {/* Logout */}
        <View className="mt-auto pb-4">
          <Pressable
            onPress={handleLogout}
            className="items-center rounded-2xl border border-red-500/40 py-4"
          >
            <Text className="text-base font-semibold text-red-400">Sign Out</Text>
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  )
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-neutral-400">{label}</Text>
      <Text className="text-sm font-semibold text-white">{value}</Text>
    </View>
  )
}
```

- [ ] Run typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

---

### Final Verification

- [ ] Run full typecheck:
```bash
cd apps/mobile && npm run typecheck
```
Expected: 0 errors

- [ ] Run expo-doctor:
```bash
cd apps/mobile && npx expo-doctor
```
Expected: 18/18 checks pass
