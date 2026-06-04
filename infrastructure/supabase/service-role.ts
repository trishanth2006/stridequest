import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/infrastructure/supabase/database.types'

/**
 * Server-only Supabase client with service-role privileges.
 *
 * MUST NEVER be imported in any file under `app/(protected)/`, any component
 * file, or any barrel export that client components can reach. Only server
 * actions and server-only utilities may use this.
 *
 * The service-role key bypasses RLS entirely — treat it as a secret. It is
 * stored in `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix, so it is
 * never included in the browser bundle). Session persistence is disabled
 * because this client is used only for single-operation RPC calls from
 * Next.js server actions.
 *
 * Adopted in Phase 02D-05 (ADR Option A: lock entry point). See:
 * docs/phase-02/02D-05-trust-boundary-adr.md §5.3
 */
export function createServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
