import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/supabase/server'
import { getOwnedCells, getOwnershipStats } from '@/features/territory/services/ownership'
import { TerritoryBoard } from '@/features/territory/components/TerritoryBoard'
import { MapPin } from 'lucide-react'

export const metadata = { title: 'Territory — StrideQuest' }

export default async function TerritoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [stats, ownedCells] = await Promise.all([
    getOwnershipStats(supabase, user.id),
    getOwnedCells(supabase, user.id)
  ])

  return (
    <div className="relative flex flex-col gap-6 pb-12 pt-12 md:pt-24">
      <section className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-widest text-primary uppercase flex items-center gap-2">
          <MapPin className="w-3 h-3" />
          Territory
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-foreground">
          Your Board
        </h1>
      </section>

      <TerritoryBoard ownedCells={ownedCells} stats={stats} />
    </div>
  )
}
