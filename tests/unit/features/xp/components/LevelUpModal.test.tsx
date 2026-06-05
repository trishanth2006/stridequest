import { render, screen, fireEvent } from '@testing-library/react'
import { LevelUpModal } from '@/features/xp/components/LevelUpModal'

describe('LevelUpModal', () => {
  it('renders correct levels', () => {
    render(
      <LevelUpModal 
        previousLevel={1} 
        currentLevel={2} 
        onClose={jest.fn()} 
      />
    )
    
    expect(screen.getByTestId('previous-level')).toHaveTextContent('Level 1')
    expect(screen.getByTestId('current-level')).toHaveTextContent('Level 2')
  })

  it('calls onClose when dismissed', () => {
    const handleClose = jest.fn()
    
    render(
      <LevelUpModal 
        previousLevel={2} 
        currentLevel={3} 
        onClose={handleClose} 
      />
    )
    
    const continueBtn = screen.getByTestId('close-modal')
    fireEvent.click(continueBtn)
    
    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
