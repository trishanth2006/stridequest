import type { ReactNode } from 'react'
import { Text } from 'react-native'
import { colors } from '@/theme'

/** Canonical uppercase section heading used above every card group. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: '600',
        color: colors.fgSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
      }}
    >
      {children}
    </Text>
  )
}
