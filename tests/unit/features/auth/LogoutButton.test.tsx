import { render, screen } from '@testing-library/react'
import { LogoutButton } from '@/features/auth/components/LogoutButton'

jest.mock('@/features/auth/actions', () => ({
  logoutAction: jest.fn(),
}))

describe('LogoutButton', () => {
  it('renders sign out button', () => {
    render(<LogoutButton />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
