/**
 * Minimal Expo config plugin for @notifee/react-native.
 * Adds the Notifee ForegroundService declaration to AndroidManifest.xml
 * and the required permissions that the library's own plugin is missing.
 */
const { withAndroidManifest } = require('@expo/config-plugins')

/** @param {import('@expo/config-plugins').ExpoConfig} config */
module.exports = function withNotifee(config) {
  return withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest
    const app = manifest.application?.[0]
    if (!app) return c

    if (!app.service) app.service = []

    const hasService = app.service.some(
      (s) => s.$?.['android:name'] === 'app.notifee.core.ForegroundService'
    )

    if (!hasService) {
      app.service.push({
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:foregroundServiceType': 'location',
          'android:exported': 'false',
          'android:stopWithTask': 'true',
        },
      })
    }

    return c
  })
}
