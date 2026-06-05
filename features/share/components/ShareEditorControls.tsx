"use client"

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import type { ShareConfig, ShareTheme, ShareLayout, ShareAspectRatio, AnyShareCard } from '../types'

interface ShareEditorControlsProps {
  cardData: AnyShareCard
  config: ShareConfig
  onChange: (updates: Partial<ShareConfig>) => void
}

export function ShareEditorControls({ cardData, config, onChange }: ShareEditorControlsProps) {
  const isWorkout = cardData.type === 'workout'
  const isAchievement = cardData.type === 'achievement'
  const isRecord = cardData.type === 'personal-record'
  const isLevelUp = cardData.type === 'level-up'

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4">
      
      {/* Format Settings */}
      <div className="space-y-4 flex-1">
        <h3 className="font-semibold text-lg">Format</h3>
        
        <div className="space-y-2">
          <Label>Aspect Ratio</Label>
          <Select 
            value={config.aspectRatio} 
            onValueChange={(val: ShareAspectRatio) => onChange({ aspectRatio: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portrait">Instagram Story</SelectItem>
              <SelectItem value="square">Square</SelectItem>
              <SelectItem value="landscape">Twitter/X</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Theme</Label>
          <Select 
            value={config.theme} 
            onValueChange={(val: ShareTheme) => onChange({ theme: val })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="midnight">Midnight</SelectItem>
              <SelectItem value="territory">Territory</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="retro">Retro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isWorkout && (
          <div className="space-y-2">
            <Label>Layout</Label>
            <Select 
              value={config.layout} 
              onValueChange={(val: ShareLayout) => onChange({ layout: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="hero-route">Hero Route</SelectItem>
                <SelectItem value="territory">Territory Focus</SelectItem>
                <SelectItem value="achievement">Achievement Focus</SelectItem>
                <SelectItem value="record">Record Focus</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Visibility Toggles */}
      <div className="space-y-4 flex-1">
        <h3 className="font-semibold text-lg">Visibility</h3>
        
        {isWorkout && [
          { id: 'showDistance', label: 'Distance' },
          { id: 'showDuration', label: 'Duration' },
          { id: 'showPace', label: 'Pace' },
          { id: 'showXp', label: 'XP Earned' },
          { id: 'showLevel', label: 'Level' },
          { id: 'showTerritories', label: 'Territories Captured' },
        ].map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <Label htmlFor={item.id}>{item.label}</Label>
            <Switch 
              id={item.id}
              checked={config[item.id as keyof ShareConfig] as boolean}
              onCheckedChange={(val) => onChange({ [item.id]: val })}
            />
          </div>
        ))}

        {isRecord && (
          <div className="flex items-center justify-between">
            <Label htmlFor="showPreviousRecord">Show Previous Record</Label>
            <Switch 
              id="showPreviousRecord"
              checked={config.showPreviousRecord as boolean}
              onCheckedChange={(val) => onChange({ showPreviousRecord: val })}
            />
          </div>
        )}

        {[
          { id: 'showBranding', label: 'StrideQuest Branding' },
          { id: 'transparentBackground', label: 'Transparent Background' },
        ].map((item) => (
          <div key={item.id} className="flex items-center justify-between">
            <Label htmlFor={item.id}>{item.label}</Label>
            <Switch 
              id={item.id}
              checked={config[item.id as keyof ShareConfig] as boolean}
              onCheckedChange={(val) => onChange({ [item.id]: val })}
            />
          </div>
        ))}
      </div>

      {/* Route Controls */}
      {isWorkout && (
        <div className="space-y-4 flex-1">
          <h3 className="font-semibold text-lg flex items-center justify-between">
            <span>Route & Map</span>
            <Switch 
              checked={config.showRoute}
              onCheckedChange={(val) => onChange({ showRoute: val })}
            />
          </h3>
          
          {config.showRoute && (
            <>
              <div className="space-y-2">
                <Label>Route Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ffffff', '#000000'].map(color => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${config.routeColor === color ? 'border-primary' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => onChange({ routeColor: color })}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Route Thickness</Label>
                <Slider
                  value={[config.routeThickness]}
                  min={2}
                  max={20}
                  step={1}
                  onValueChange={([val]) => onChange({ routeThickness: val })}
                />
              </div>

              <div className="flex items-center justify-between mt-4">
                <Label>Show Territory Overlay</Label>
                <Switch 
                  checked={config.showTerritoryOverlay}
                  onCheckedChange={(val) => onChange({ showTerritoryOverlay: val })}
                />
              </div>
            </>
          )}
        </div>
      )}

    </div>
  )
}
