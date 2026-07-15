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
      className="flex-1 rounded-2xl p-4 gap-2 border"
      style={{
        backgroundColor: accent ? withAlpha(colors.primary, 0.08) : colors.surface,
        borderColor: accent ? withAlpha(colors.primary, 0.25) : withAlpha(colors.white, 0.06),
      }}
    >
      <View
        className="w-8 h-8 rounded-[10px] items-center justify-center"
        style={{ backgroundColor: accent ? withAlpha(colors.primary, 0.15) : withAlpha(colors.white, 0.06) }}
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
      <Text className="text-[10px] font-semibold uppercase tracking-[0.5px] text-fgMuted">
        {label}
      </Text>
      {footer !== undefined && (
        <Text className="text-[10px] text-fgFaint -mt-1">{footer}</Text>
      )}
    </View>
  )
}
