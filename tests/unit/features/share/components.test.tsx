/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ShareCardPreview } from '@/features/share/components/ShareCardPreview'
import { ShareEditorControls } from '@/features/share/components/ShareEditorControls'
import type { AnyShareCard, ShareConfig } from '@/features/share/types'

// Mock matchMedia for Radix UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: any) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('Share Components', () => {
  const defaultConfig: ShareConfig = {
    theme: 'midnight',
    layout: 'classic',
    aspectRatio: 'portrait',
    showDistance: true,
    showDuration: true,
    showPace: true,
    showXp: true,
    showLevel: true,
    showTerritories: true,
    showRoute: true,
    routeColor: '#3b82f6',
    routeThickness: 6,
    showTerritoryOverlay: true,
    showBranding: true,
    transparentBackground: false,
  }

  describe('ShareCardPreview', () => {
    it('renders workout card correctly', () => {
      const card: AnyShareCard = {
        type: 'workout',
        headline: 'Crushed another run!',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        distance: 5000,
        duration: 1500,
      }

      render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      
      expect(screen.getByText('Crushed another run!')).toBeTruthy()
      expect(screen.getByText('5.00 km')).toBeTruthy()
      expect(screen.getByText('25:00')).toBeTruthy()
    })

    it('respects visibility toggles', () => {
      const card: AnyShareCard = {
        type: 'workout',
        headline: 'Crushed another run!',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        distance: 5000,
        duration: 1500,
      }

      render(<ShareCardPreview cardData={card} config={{ ...defaultConfig, showDistance: false }} />)
      
      expect(screen.getByText('Crushed another run!')).toBeTruthy()
      expect(screen.queryByText('5.00 km')).toBeNull()
      expect(screen.getByText('25:00')).toBeTruthy()
    })

    it('renders level-up card correctly', () => {
      const card: AnyShareCard = {
        type: 'level-up',
        headline: 'Reached Level 5!',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        previousLevel: 4,
        currentLevel: 5,
        totalXp: 1200,
      }

      render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      expect(screen.getByText('Reached Level 5!')).toBeTruthy()
      expect(screen.getByText('5')).toBeTruthy()
      expect(screen.getByText('Total XP: 1200')).toBeTruthy()
    })
  })

  describe('ShareEditorControls', () => {
    it('calls onChange when switch is toggled', () => {
      const onChange = jest.fn()
      render(<ShareEditorControls config={defaultConfig} onChange={onChange} />)

      const distanceToggle = screen.getByLabelText('Distance')
      fireEvent.click(distanceToggle)

      expect(onChange).toHaveBeenCalledWith({ showDistance: false })
    })

    it('hides route options when route is hidden', () => {
      const onChange = jest.fn()
      render(<ShareEditorControls config={{ ...defaultConfig, showRoute: false }} onChange={onChange} />)
      
      expect(screen.queryByText('Route Color')).toBeNull()
    })
  })
})
