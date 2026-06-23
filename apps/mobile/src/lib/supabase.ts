import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

/**
 * Mobile Supabase client (Phase 5 — reuse the EXISTING backend).
 *
 * Same project, same auth, same RLS as the web app. The mobile app only ever
 * holds the PUBLISHABLE key (RLS-enforced); the service-role key never ships to
 * a device — privileged finalize runs in a Supabase Edge Function instead.
 *
 * Sessions persist in AsyncStorage and refresh automatically. `detectSessionInUrl`
 * is off because there is no browser URL to parse on native.
 *
 * NOTE: the client is intentionally untyped for the scaffold. When the DI
 * services are extracted to `@stridequest/shared` (services phase), the generated
 * `Database` type moves to `@stridequest/shared/supabase` and this becomes
 * `createClient<Database>(...)`.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Copy .env.example to .env and fill in the values from the web app.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
