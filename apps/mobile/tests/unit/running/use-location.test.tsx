import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import { Text, View } from 'react-native'
import { useLocation } from '@/features/running/hooks/useLocation'

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6 },
}))

import * as ExpoLocation from 'expo-location'
const mockExpoLocation = ExpoLocation as jest.Mocked<typeof ExpoLocation>

describe('useLocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('starts in prompt permission state', async () => {
    let capturedPermissionStatus: string | undefined

    function TestComponent() {
      const { permissionStatus, hasFix } = useLocation()
      capturedPermissionStatus = permissionStatus

      return (
        <View>
          <Text testID="permission-status">{permissionStatus}</Text>
          <Text testID="has-fix">{hasFix ? 'true' : 'false'}</Text>
        </View>
      )
    }

    render(<TestComponent />)

    await waitFor(() => {
      expect(capturedPermissionStatus).toBe('prompt')
    })
  })

  it('sets permissionStatus to denied when permission is refused', async () => {
    mockExpoLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
      expires: 'never',
    } as any)

    let capturedPermissionStatus: string | undefined

    function TestComponent() {
      const location = useLocation()
      capturedPermissionStatus = location.permissionStatus

      React.useEffect(() => {
        location.requestPermission()
      }, [location])

      return (
        <Text testID="permission-status">{location.permissionStatus}</Text>
      )
    }

    render(<TestComponent />)

    await waitFor(() => {
      expect(mockExpoLocation.requestForegroundPermissionsAsync).toHaveBeenCalled()
    })

    expect(capturedPermissionStatus).toBe('denied')
  })

  it('sets permissionStatus to granted when permission is granted', async () => {
    mockExpoLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    } as any)

    let capturedPermissionStatus: string | undefined

    function TestComponent() {
      const location = useLocation()
      capturedPermissionStatus = location.permissionStatus

      React.useEffect(() => {
        location.requestPermission()
      }, [location])

      return (
        <Text testID="permission-status">{location.permissionStatus}</Text>
      )
    }

    render(<TestComponent />)

    await waitFor(() => {
      expect(mockExpoLocation.requestForegroundPermissionsAsync).toHaveBeenCalled()
    })

    expect(capturedPermissionStatus).toBe('granted')
  })
})
