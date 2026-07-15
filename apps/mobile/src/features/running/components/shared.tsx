import { View, Text } from 'react-native'

export { SectionLabel } from '@/components/ui/SectionLabel'

export function Card({ children, noPad = false }: { children: React.ReactNode; noPad?: boolean }) {
  return (
    <View className={`bg-surface rounded-2xl overflow-hidden ${noPad ? '' : 'p-5'}`}>
      {children}
    </View>
  )
}

export function ChartAxis({ label }: { label: string }) {
  return (
    <Text className="text-[9px] text-fgFaint mt-1 text-center">
      {label}
    </Text>
  )
}
