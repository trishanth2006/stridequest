/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { updateSession as middleware } from '../../infrastructure/supabase/middleware'

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

import { createServerClient } from '@supabase/ssr'

const mockCreateServerClient = createServerClient as jest.MockedFunction<
  typeof createServerClient
>

function mockUser(user: { id: string } | null) {
  mockCreateServerClient.mockImplementation(() => {
    return {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      },
    } as unknown as ReturnType<typeof createServerClient>
  })
}

function makeRequest(pathname: string) {
  return new NextRequest(new URL(`http://localhost:3000${pathname}`))
}

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects unauthenticated user from /dashboard to /login', async () => {
    mockUser(null)
    const response = await middleware(makeRequest('/dashboard'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows authenticated user to access /dashboard', async () => {
    mockUser({ id: 'user-123' })
    const response = await middleware(makeRequest('/dashboard'))
    expect(response.status).not.toBe(307)
  })

  it('redirects authenticated user from /login to /dashboard', async () => {
    mockUser({ id: 'user-123' })
    const response = await middleware(makeRequest('/login'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/dashboard')
  })

  it('redirects authenticated user from /signup to /dashboard', async () => {
    mockUser({ id: 'user-123' })
    const response = await middleware(makeRequest('/signup'))
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/dashboard')
  })
})
