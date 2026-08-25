import { getHistory, getProfile } from '@/server/api-client'
import { ProfileScreen } from '@/features/profile/ProfileScreen'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const [profile, history] = await Promise.all([getProfile(), getHistory()])
  return <ProfileScreen profile={profile} history={history} />
}
