import type { ReactNode } from 'react'
import { Text } from 'react-native'

/** Canonical uppercase section heading used above every card group. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-[1.5px] text-fgSecondary">
      {children}
    </Text>
  )
}
