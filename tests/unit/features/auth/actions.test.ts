/**
 * @jest-environment node
 */
import { signupAction, loginAction, logoutAction } from '@/features/auth/actions'

jest.mock('@/infrastructure/supabase/server', () => ({
  createClient: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

import { createClient } from '@/infrastructure/supabase/server'
import { redirect } from 'next/navigation'

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockRedirect = redirect as jest.MockedFunction<typeof redirect>

const initialState = { error: null }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
  return fd
}

describe('signupAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns error for invalid email', async () => {
    const result = await signupAction(
      initialState,
      makeFormData({ email: 'bad', password: 'password123', username: 'testuser' })
    )
    expect(result.error).toBe('Invalid email address')
  })

  it('returns error for password shorter than 8 characters', async () => {
    const result = await signupAction(
      initialState,
      makeFormData({ email: 'test@example.com', password: 'short', username: 'testuser' })
    )
    expect(result.error).toBe('Password must be at least 8 characters')
  })

  it('returns error for username shorter than 3 characters', async () => {
    const result = await signupAction(
      initialState,
      makeFormData({ email: 'test@example.com', password: 'password123', username: 'ab' })
    )
    expect(result.error).toBeTruthy()
  })

  it('returns sanitized error when email already exists', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signUp: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User already registered' },
        }),
      },
    } as never)

    const result = await signupAction(
      initialState,
      makeFormData({ email: 'existing@example.com', password: 'password123', username: 'testuser' })
    )
    expect(result.error).toBe('An account with this email already exists')
  })

  it('calls redirect to /dashboard on success', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signUp: jest.fn().mockResolvedValue({ data: { user: { id: '123' } }, error: null }),
      },
    } as never)

    await signupAction(
      initialState,
      makeFormData({ email: 'new@example.com', password: 'password123', username: 'newuser' })
    )
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
  })
})

describe('loginAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns error for invalid email', async () => {
    const result = await loginAction(
      initialState,
      makeFormData({ email: 'bad', password: 'password123' })
    )
    expect(result.error).toBe('Invalid email address')
  })

  it('returns sanitized error for wrong credentials', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Invalid login credentials' },
        }),
      },
    } as never)

    const result = await loginAction(
      initialState,
      makeFormData({ email: 'test@example.com', password: 'wrongpass' })
    )
    expect(result.error).toBe('Invalid email or password')
  })

  it('calls redirect to /dashboard on success', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: { id: '123' } },
          error: null,
        }),
      },
    } as never)

    await loginAction(
      initialState,
      makeFormData({ email: 'test@example.com', password: 'password123' })
    )
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard')
  })
})

describe('logoutAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls signOut and redirects to /login', async () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null })
    mockCreateClient.mockResolvedValue({
      auth: { signOut: mockSignOut },
    } as never)

    await logoutAction()
    expect(mockSignOut).toHaveBeenCalled()
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })
})
