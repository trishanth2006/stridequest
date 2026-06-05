"use client"

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import type { ShareConfig, ShareTheme, AnyShareCard } from '../types'

interface ShareEditorControlsProps {
  cardData: AnyShareCard
  config: ShareConfig
  onChange: (updates: Partial<ShareConfig>) => void
}

const THEMES: { value: ShareTheme; label: string }[] = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'territory', label: 'Territory' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'retro', label: 'Retro' },
]

export function ShareEditorControls({ cardData, config, onChange }: ShareEditorControlsProps) {
  const isWorkout = cardData.type === 'workout'
  const isRecord = cardData.type === 'personal-record'
  const isTerritory = isWorkout && config.layout === 'territory'

  return (
    <div className="flex flex-wrap items-end gap-6 p-4">
      <div className="space-y-2 min-w-[180px]">
        <Label>Theme</Label>
        <Select value={config.theme} onValueChange={(val: ShareTheme) => onChange({ theme: val })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {THEMES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isWorkout && !isTerritory && (
        <div className="space-y-2">
          <Label>Card Style</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={config.layout === 'classic' ? 'default' : 'outline'}
              className="h-9"
              onClick={() => onChange({ layout: 'classic' })}
            >
              Stats
            </Button>
            <Button
              type="button"
              variant={config.layout === 'hero-route' ? 'default' : 'outline'}
              className="h-9"
              onClick={() => onChange({ layout: 'hero-route' })}
            >
              Route
            </Button>
          </div>
        </div>
      )}

      {isRecord && (
        <div className="flex items-center gap-3 pb-2">
          <Label htmlFor="showPreviousRecord">Show Previous Record</Label>
          <Switch
            id="showPreviousRecord"
            checked={config.showPreviousRecord}
            onCheckedChange={(val) => onChange({ showPreviousRecord: val })}
          />
        </div>
      )}
    </div>
  )
}
