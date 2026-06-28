import React from 'react'
import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'

// ── Native module mocks ──────────────────────────────────────────────────────

const mockCaptureRef = jest.fn()
jest.mock('react-native-view-shot', () => {
  const React = require('react')
  return {
    __esModule: true,
    // <ViewShot> renders its children and attaches a (truthy) ref so the
    // component's null-ref guard passes; captureRef is what the test asserts.
    default: React.forwardRef((props: { children?: unknown }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ capture: jest.fn() }))
      return props.children ?? null
    }),
    captureRef: (...args: unknown[]) => mockCaptureRef(...args),
  }
})

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///doc/',
  copyAsync: jest.fn().mockResolvedValue(undefined),
}))

const mockShareSingle = jest.fn().mockResolvedValue({ success: true })
const mockShareOpen = jest.fn().mockResolvedValue({ success: true })
jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {
    shareSingle: (...args: unknown[]) => mockShareSingle(...args),
    open: (...args: unknown[]) => mockShareOpen(...args),
    Social: { INSTAGRAM: 'instagram', TWITTER: 'twitter' },
  },
}))

const mockRequestPerms = jest.fn().mockResolvedValue({ status: 'granted' })
const mockSaveToLibrary = jest.fn().mockResolvedValue(undefined)
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPerms(...args),
  saveToLibraryAsync: (...args: unknown[]) => mockSaveToLibrary(...args),
}))

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Path: 'Path',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
}))

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

jest.mock('@stridequest/shared/running', () => ({
  formatDistance: () => '5.00 km',
  formatDuration: () => '30:00',
  formatPace: () => '6:00 /km',
}))

import { WorkoutShareDialog, humanizeDuration } from '@/features/running/components/WorkoutShareDialog'

const workout = {
  distanceM: 5000,
  durationS: 1800,
  avgPaceSPerKm: 360,
  xpBreakdown: { baseXp: 100, captureXp: 0, stealXp: 0, totalXp: 100 },
  routePoints: [
    { lat: 0, lng: 0, altitudeM: 0 },
    { lat: 0.01, lng: 0.01, altitudeM: 0 },
  ],
  splits: [],
} as never

const renderDialog = () =>
  render(<WorkoutShareDialog workout={workout} visible onClose={jest.fn()} />)

describe('humanizeDuration', () => {
  it('reads minutes and seconds like an infographic', () => {
    expect(humanizeDuration(496)).toBe('8m 16s')
  })

  it('collapses to hours and minutes past an hour', () => {
    expect(humanizeDuration(3700)).toBe('1h 1m')
  })

  it('shows bare seconds under a minute', () => {
    expect(humanizeDuration(45)).toBe('45s')
  })

  it('guards against negative or non-finite input', () => {
    expect(humanizeDuration(-5)).toBe('0s')
    expect(humanizeDuration(NaN)).toBe('0s')
  })
})

describe('WorkoutShareDialog share flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCaptureRef.mockResolvedValue('file:///tmp/shot.png')
    mockShareSingle.mockResolvedValue({ success: true })
    mockShareOpen.mockResolvedValue({ success: true })
    mockRequestPerms.mockResolvedValue({ status: 'granted' })
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })

  // The action handlers toggle `sharing`, which swaps the button label for a
  // spinner and back. Waiting for the label to return means the handler's
  // trailing async (setSharing(false)) has settled — no state update leaks
  // into the next test.
  const settle = (label: string) =>
    waitFor(() => expect(screen.getByText(label)).toBeTruthy())

  it('captures a non-null view and saves to the library', async () => {
    await renderDialog()
    fireEvent.press(screen.getByText('Save'))

    await waitFor(() => expect(mockSaveToLibrary).toHaveBeenCalledWith('file:///tmp/shot.png'))

    // The capture target must be a real view, not null/undefined.
    expect(mockCaptureRef).toHaveBeenCalled()
    expect(mockCaptureRef.mock.calls[0][0]).toBeTruthy()
    expect(Alert.alert).toHaveBeenCalledWith('Success', expect.any(String))
    expect(Alert.alert).not.toHaveBeenCalledWith('Save Failed', expect.anything())
    await settle('Save')
  })

  it('shares the captured image to Instagram', async () => {
    await renderDialog()
    fireEvent.press(screen.getByText('Instagram Stories'))

    await waitFor(() => expect(mockShareSingle).toHaveBeenCalled())
    expect(mockShareSingle.mock.calls[0][0]).toMatchObject({
      url: 'file:///tmp/shot.png',
      social: 'instagram',
    })
    expect(Alert.alert).not.toHaveBeenCalledWith('Share Failed', expect.anything())
    await settle('Instagram Stories')
  })

  it('shares the captured image to Twitter', async () => {
    await renderDialog()
    fireEvent.press(screen.getByText('Twitter / X'))

    await waitFor(() => expect(mockShareSingle).toHaveBeenCalled())
    expect(mockShareSingle.mock.calls[0][0]).toMatchObject({
      url: 'file:///tmp/shot.png',
      social: 'twitter',
    })
    expect(Alert.alert).not.toHaveBeenCalledWith('Share Failed', expect.anything())
    await settle('Twitter / X')
  })

  it('surfaces the real capture error instead of a generic message', async () => {
    mockCaptureRef.mockRejectedValue(new Error('Failed to snapshot view tag 42'))
    await renderDialog()
    fireEvent.press(screen.getByText('Save'))

    await waitFor(
      () => expect(Alert.alert).toHaveBeenCalledWith('Save Failed', 'Failed to snapshot view tag 42'),
      { timeout: 4000 },
    )
    expect(mockSaveToLibrary).not.toHaveBeenCalled()
    await settle('Save')
  })
})
