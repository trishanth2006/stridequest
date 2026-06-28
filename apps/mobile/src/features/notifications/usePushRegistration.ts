import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { supabase } from '@/lib/supabase'

export function usePushRegistration(): void {
  useEffect(() => {
    void registerPushToken()
  }, [])
}

async function registerPushToken(): Promise<void> {
  try {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
      })
    }

    const projectId =
      Constants.easConfig?.projectId ??
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const platform = Platform.OS === 'ios' ? 'ios' : 'android'
    await supabase.from('push_tokens').upsert(
      {
        user_id: user.id,
        token: tokenData.data,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,platform' },
    )
  } catch {
    /* silently no-op — push is an enhancement, not required for the app to function */
  }
}
