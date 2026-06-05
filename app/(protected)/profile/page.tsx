import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/supabase/server'
import { getRunnerProfile, getRecentActivity, getProfileRank } from '@/features/profiles/services/profile-summary'
import { ProfileHeader } from '@/features/profiles/components/ProfileHeader'
import { ProfileStats } from '@/features/profiles/components/ProfileStats'
import { ProfileRecords } from '@/features/profiles/components/ProfileRecords'
import { RecentActivityFeed } from '@/features/profiles/components/RecentActivityFeed'

export const metadata = { title: 'My Profile - StrideQuest' }

export default async function MyProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const profile = await getRunnerProfile(user.id)
  if (!profile) redirect('/dashboard') // Fallback if no profile

  const activities = await getRecentActivity(user.id)
  const rank = await getProfileRank(user.id)
  profile.leaderboardRank = rank

  return (
    <div className="relative flex flex-col gap-8 pb-12 pt-12 md:pt-24 max-w-4xl mx-auto w-full px-4" data-testid="profile-page-root">
      <ProfileHeader profile={profile} />
      <div className="mx-auto w-full h-[1px] bg-white/[0.06] my-2" />
      <ProfileStats profile={profile} />
      <ProfileRecords profile={profile} />
      <RecentActivityFeed activities={activities} />
    </div>
  )
}
