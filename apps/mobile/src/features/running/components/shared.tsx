import { View, Text } from 'react-native'
import { colors } from '@/theme'

export function Card({ children, noPad = false }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: noPad ? 0 : 20,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.fgMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </Text>
  )
}

export function ChartAxis({ label }: { label: string }) {
  return (
    <Text style={{ fontSize: 9, color: colors.fgFaint, marginTop: 4, textAlign: 'center' }}>
      {label}
    </Text>
  )
}
