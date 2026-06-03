import * as React from 'react'
import ProtectedLayout from '@/app/(protected)/layout'
import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/supabase/server'

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

jest.mock('@/infrastructure/supabase/server', () => ({
  createClient: jest.fn(),
}))

const mockCreateClient = createClient as jest.Mock
const mockRedirect = redirect as unknown as jest.Mock

function mockUser(user: { id: string } | null) {
  mockCreateClient.mockResolvedValue({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  })
}

// The (protected) layout wraps every route in the group, including /run. Route
// protection for /run is therefore exercised by this guard.
describe('ProtectedLayout (route protection for the (protected) group, incl. /run)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects unauthenticated users to /login', async () => {
    mockUser(null)
    await ProtectedLayout({ children: React.createElement('div') })
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('does not redirect authenticated users', async () => {
    mockUser({ id: 'user-123' })
    await ProtectedLayout({ children: React.createElement('div') })
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
