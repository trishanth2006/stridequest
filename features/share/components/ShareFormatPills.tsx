"use client"

import { Button } from '@/components/ui/button'
import type { ShareAspectRatio, ShareCardType } from '../types'

interface ShareFormatPillsProps {
  cardType: ShareCardType
  value: ShareAspectRatio
  onChange: (value: ShareAspectRatio) => void
}

const ALL_FORMATS: { value: ShareAspectRatio; label: string }[] = [
  { value: 'portrait', label: 'Story' },
  { value: 'square', label: 'Square' },
  { value: 'landscape', label: 'Landscape' },
]

export function ShareFormatPills({ cardType, value, onChange }: ShareFormatPillsProps) {
  const formats = cardType === 'workout'
    ? ALL_FORMATS
    : ALL_FORMATS.filter((f) => f.value !== 'landscape')

  return (
    <div className="flex justify-center gap-2">
      {formats.map((f) => (
        <Button
          key={f.value}
          type="button"
          size="sm"
          variant={value === f.value ? 'default' : 'outline'}
          className="rounded-full px-4"
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  )
}
