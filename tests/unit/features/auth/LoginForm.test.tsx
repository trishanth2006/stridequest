import { render, screen } from '@testing-library/react'
import * as React from 'react'
import { LoginForm } from '@/features/auth/components/LoginForm'

jest.mock('@/features/auth/actions', () => ({
  loginAction: jest.fn(),
}))

jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  useActionState: jest.fn(),
}))

const mockUseActionState = React.useActionState as jest.Mock

describe('LoginForm', () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([{ error: null }, jest.fn(), false])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders email field with label', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('renders password field with label', () => {
    render(<LoginForm />)
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders sign in submit button', () => {
    render(<LoginForm />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows error alert when error is present', () => {
    mockUseActionState.mockReturnValue([{ error: 'Invalid email or password' }, jest.fn(), false])
    render(<LoginForm />)
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password')
  })

  it('disables submit button while pending', () => {
    mockUseActionState.mockReturnValue([{ error: null }, jest.fn(), true])
    render(<LoginForm />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
