import { View, Text } from 'react-native'

export function Card({ children, noPad = false }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: '#171717',
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
    <Text style={{ fontSize: 10, fontWeight: '700', color: '#71717a', textTransform: 'uppercase', letterSpacing: 1 }}>
      {children}
    </Text>
  )
}

export function ChartAxis({ label }: { label: string }) {
  return (
    <Text style={{ fontSize: 9, color: '#52525b', marginTop: 4, textAlign: 'center' }}>
      {label}
    </Text>
  )
}
