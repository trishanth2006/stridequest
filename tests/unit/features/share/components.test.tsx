import { describe, it, expect, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ShareCardPreview } from '@/features/share/components/ShareCardPreview'
import { ShareEditorControls } from '@/features/share/components/ShareEditorControls'
import { ShareFormatPills } from '@/features/share/components/ShareFormatPills'
import type { AnyShareCard, ShareConfig } from '@/features/share/types'

// Mock matchMedia for Radix UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: unknown) => ({
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
    showPreviousRecord: true,
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

    it('renders level-up card with XP remaining', () => {
      const card: AnyShareCard = {
        type: 'level-up',
        headline: 'Reached Level 5!',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        previousLevel: 4,
        currentLevel: 5,
        totalXp: 875,
        xpToNextLevel: 125,
      }

      render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      expect(screen.getByText('LEVEL 5')).toBeTruthy()
      expect(screen.getByText('875 XP')).toBeTruthy()
      expect(screen.getByText('Next Level')).toBeTruthy()
      expect(screen.getByText('125 XP Remaining')).toBeTruthy()
    })
  })

  describe('ShareEditorControls', () => {
    it('workout shows Theme + Card Style, no per-metric or route toggles', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'workout', headline: 'Crushed another run!', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)

      expect(screen.getByText('Card Style')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Stats' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Route' })).toBeTruthy()
      // Removed controls:
      expect(screen.queryByLabelText('Distance')).toBeNull()
      expect(screen.queryByText('Route Color')).toBeNull()
      expect(screen.queryByText('Route Thickness')).toBeNull()
      expect(screen.queryByText('StrideQuest Branding')).toBeNull()
      expect(screen.queryByText('Transparent Background')).toBeNull()
    })

    it('Card Style "Route" selects hero-route layout', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'workout', headline: 'x', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Route' }))
      expect(onChange).toHaveBeenCalledWith({ layout: 'hero-route' })
    })

    it('territory preset shows Theme only (no Card Style)', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'workout', headline: 'x', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={{ ...defaultConfig, layout: 'territory' }} onChange={onChange} />)
      expect(screen.getByText('Theme')).toBeTruthy()
      expect(screen.queryByText('Card Style')).toBeNull()
    })

    it('achievement shows Theme only', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'achievement', achievementTitle: 'First Run', achievementDescription: '', achievementCategory: '', headline: '', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)

      expect(screen.getByText('Theme')).toBeTruthy()
      expect(screen.queryByText('Card Style')).toBeNull()
      expect(screen.queryByLabelText('Distance')).toBeNull()
      expect(screen.queryByText('Route & Map')).toBeNull()
      expect(screen.queryByText('Aspect Ratio')).toBeNull()
    })

    it('personal record shows Theme + Show Previous Record', () => {
      const onChange = jest.fn()
      const card: AnyShareCard = { type: 'personal-record', recordTitle: 'Fastest 5K', recordValue: '25:00', achievedAt: '', headline: '', metadata: { generatedAt: '', strideQuestVersion: '' } }
      render(<ShareEditorControls cardData={card} config={defaultConfig} onChange={onChange} />)

      expect(screen.getByText('Theme')).toBeTruthy()
      expect(screen.getByLabelText('Show Previous Record')).toBeTruthy()
      expect(screen.queryByText('Route & Map')).toBeNull()
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
      expect(screen.getByText('TERRITORY CONQUEST')).toBeTruthy()
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

  describe('ShareCardPreview', () => {
    it('wraps the export node in a sized container (no raw scale on a full-size node)', () => {
      const card: AnyShareCard = {
        type: 'workout',
        headline: 'Crushed another run!',
        metadata: { generatedAt: '', strideQuestVersion: '' },
        distance: 5000,
        duration: 1500,
      }
      const { container } = render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      expect(container.querySelector('[data-testid="share-card-sized-wrapper"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="share-card-export"]')).toBeTruthy()
    })

    it('renders an editable headline for every card type', () => {
      const card: AnyShareCard = {
        type: 'achievement',
        headline: 'Unlocked First Run',
        metadata: { generatedAt: '2026-06-04T00:00:00.000Z', strideQuestVersion: '' },
        achievementTitle: 'FIRST RUN',
        achievementDescription: 'Complete your first workout',
        achievementCategory: 'General',
      }
      const { container } = render(
        <ShareCardPreview cardData={card} config={defaultConfig} editable />
      )
      const headline = container.querySelector('[data-testid="share-headline"]') as HTMLElement
      expect(headline).toBeTruthy()
      expect(headline.getAttribute('contenteditable')).toBe('true')
      expect(headline.textContent).toBe('Unlocked First Run')
    })

    it('headline is not editable without the editable prop', () => {
      const card: AnyShareCard = {
        type: 'workout', headline: 'Crushed another run!',
        metadata: { generatedAt: '', strideQuestVersion: '' }, distance: 5000,
      }
      const { container } = render(<ShareCardPreview cardData={card} config={defaultConfig} />)
      const headline = container.querySelector('[data-testid="share-headline"]') as HTMLElement
      expect(headline.getAttribute('contenteditable')).toBe('false')
    })
  })

  describe('ShareFormatPills', () => {
    it('offers Story/Square/Landscape for workout', () => {
      const onChange = jest.fn()
      render(<ShareFormatPills cardType="workout" value="portrait" onChange={onChange} />)
      expect(screen.getByRole('button', { name: 'Story' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Square' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Landscape' })).toBeTruthy()
    })

    it('offers only Story/Square for achievement', () => {
      const onChange = jest.fn()
      render(<ShareFormatPills cardType="achievement" value="portrait" onChange={onChange} />)
      expect(screen.getByRole('button', { name: 'Story' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Square' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Landscape' })).toBeNull()
    })

    it('emits the selected aspect ratio', () => {
      const onChange = jest.fn()
      render(<ShareFormatPills cardType="workout" value="portrait" onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: 'Square' }))
      expect(onChange).toHaveBeenCalledWith('square')
    })
  })
})
