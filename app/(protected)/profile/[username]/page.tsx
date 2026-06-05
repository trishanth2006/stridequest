import { notFound } from 'next/navigation'
import { getRunnerProfile, getRecentActivity, getProfileRank, getUserIdByUsername } from '@/features/profiles/services/profile-summary'
import { ProfileHeader } from '@/features/profiles/components/ProfileHeader'
import { ProfileStats } from '@/features/profiles/components/ProfileStats'
import { ProfileRecords } from '@/features/profiles/components/ProfileRecords'
import { RecentActivityFeed } from '@/features/profiles/components/RecentActivityFeed'

interface PublicProfilePageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata(props: PublicProfilePageProps) {
  const params = await props.params;
  return { title: `${params.username}'s Profile - StrideQuest` }
}

export default async function PublicProfilePage(props: PublicProfilePageProps) {
  const params = await props.params;
  const userId = await getUserIdByUsername(params.username)
  
  if (!userId) {
    notFound()
  }

  const profile = await getRunnerProfile(userId)
  if (!profile) {
    notFound()
  }

  const activities = await getRecentActivity(userId)
  const rank = await getProfileRank(userId)
  profile.leaderboardRank = rank

  return (
    <div className="relative flex flex-col gap-8 pb-12 pt-12 md:pt-24 max-w-4xl mx-auto w-full px-4" data-testid="public-profile-page-root">
      <ProfileHeader profile={profile} />
      <div className="mx-auto w-full h-[1px] bg-white/[0.06] my-2" />
      <ProfileStats profile={profile} />
      <ProfileRecords profile={profile} />
      <RecentActivityFeed activities={activities} />
    </div>
  )
}
