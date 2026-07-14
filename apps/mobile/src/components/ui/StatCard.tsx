import { View, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fonts, withAlpha } from '@/theme'

type StatCardProps = {
  label: string
  value: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  /** Primary-tinted background, border, icon, and value. */
  accent?: boolean
  /** Optional small line under the label (e.g. "5 captured · 2 stolen"). */
  footer?: string
}

/**
 * Canonical stat card: icon bubble, big value, uppercase label.
 * Flexes to fill its row — place inside a flexDirection: 'row' with gap.
 */
export function StatCard({ label, value, icon, accent = false, footer }: StatCardProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: accent ? withAlpha(colors.primary, 0.08) : colors.surface,
        borderRadius: 16,
        padding: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: accent ? withAlpha(colors.primary, 0.25) : withAlpha(colors.white, 0.06),
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          backgroundColor: accent ? withAlpha(colors.primary, 0.15) : withAlpha(colors.white, 0.06),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={15} color={accent ? colors.primary : colors.fgSecondary} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{
          fontSize: 24,
          fontFamily: fonts.displayHeavy,
          color: accent ? colors.primary : colors.white,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '600',
          color: colors.fgMuted,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      {footer !== undefined && (
        <Text style={{ fontSize: 10, color: colors.fgFaint, marginTop: -4 }}>{footer}</Text>
      )}
    </View>
  )
}
