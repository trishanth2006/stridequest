import { render, screen } from '@testing-library/react'
import * as React from 'react'
import { SignupForm } from '@/features/auth/components/SignupForm'

jest.mock('@/features/auth/actions', () => ({
  signupAction: jest.fn(),
}))

jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  useActionState: jest.fn(),
}))

const mockUseActionState = React.useActionState as jest.Mock

describe('SignupForm', () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([{ error: null }, jest.fn(), false])
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders email field with label', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('renders username field with label', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
  })

  it('renders password field with label', () => {
    render(<SignupForm />)
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders create account submit button', () => {
    render(<SignupForm />)
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows error alert when error is present', () => {
    mockUseActionState.mockReturnValue([{ error: 'An account with this email already exists' }, jest.fn(), false])
    render(<SignupForm />)
    expect(screen.getByRole('alert')).toHaveTextContent('An account with this email already exists')
  })

  it('disables submit button while pending', () => {
    mockUseActionState.mockReturnValue([{ error: null }, jest.fn(), true])
    render(<SignupForm />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
