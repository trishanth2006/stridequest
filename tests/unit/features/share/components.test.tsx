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
      const card: AnyShareCard = { type: 'workout', headline: 'Crushed another run!', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)

      const distanceToggle = screen.getByLabelText('Distance')
      fireEvent.click(distanceToggle)

      expect(onChange).toHaveBeenCalledWith({ showDistance: false })
    })

    it('achievement shares hide workout controls', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'achievement', achievementTitle: 'First Run', achievementDescription: '', achievementCategory: '', headline: '', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)
      
      expect(screen.queryByLabelText('Distance')).toBeNull()
      expect(screen.queryByLabelText('Duration')).toBeNull()
      expect(screen.queryByText('Route & Map')).toBeNull()
    })

    it('record shares hide route controls', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'personal-record', recordTitle: 'Fastest 5K', recordValue: '25:00', achievedAt: '', headline: '', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)
      
      expect(screen.queryByText('Route & Map')).toBeNull()
      expect(screen.getByLabelText('Show Previous Record')).toBeTruthy()
    })

    it('workout shares show route controls', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'workout', headline: 'Crushed another run!', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)
      
      expect(screen.getByText('Route & Map')).toBeTruthy()
    })
  })

  describe('Card Rendering Tests', () => {
    it('renders achievement card', () => {
      const card: AnyShareCard = {
        type: 'achievement',
        headline: '',
        metadata: { generatedAt: '2026-06-04T00:00:00.000Z', strideQuestVersion: '' },
        achievementTitle: 'FIRST RUN',
        achievementDescription: 'Complete your first workout',
        achievementCategory: 'General'
      }

      render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      
      expect(screen.getByText('FIRST RUN')).toBeTruthy()
      expect(screen.getByText('Complete your first workout')).toBeTruthy()
      expect(screen.getByText('UNLOCKED')).toBeTruthy()
    })

    it('renders personal record card', () => {
      const card: AnyShareCard = {
        type: 'personal-record',
        headline: '',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        recordTitle: 'FASTEST 5K',
        recordValue: '24:18',
        previousRecordValue: '25:11',
        hasNewRecord: true,
        achievedAt: ''
      }

      render(<ShareCardPreview cardData={card} config={{...defaultConfig, showPreviousRecord: true}} />)
      
      expect(screen.getByText('FASTEST 5K')).toBeTruthy()
      expect(screen.getByText('24:18')).toBeTruthy()
      expect(screen.getByText('Previous Best')).toBeTruthy()
      expect(screen.getByText('25:11')).toBeTruthy()
    })

    it('renders territory conquest card', () => {
      const card: AnyShareCard = {
        type: 'workout',
        headline: '',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        territoriesCaptured: 7,
        territoriesStolen: 2,
        totalTerritory: 34
      }

      render(<ShareCardPreview cardData={card} config={{...defaultConfig, layout: 'territory'}} />)
      
      expect(screen.getByText('7')).toBeTruthy()
      expect(screen.getByText('2')).toBeTruthy()
      expect(screen.getByText('Total Territory')).toBeTruthy()
      expect(screen.getByText('34')).toBeTruthy()
    })

    it('renders hero route card', () => {
      const card: AnyShareCard = {
        type: 'workout',
        headline: 'Epic Route',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        distance: 5200,
        routeData: [{lat: 10, lng: 10}, {lat: 10.1, lng: 10.1}] // Valid route
      }

      render(<ShareCardPreview cardData={card} config={{...defaultConfig, layout: 'hero-route'}} />)
      
      expect(screen.getByText('5.20 km')).toBeTruthy()
    })
  })
})
