import { test, expect } from '@playwright/test'
import { uniqueUser, signupUser } from '../helpers'

test.describe('Territory Board', () => {
  test('redirects to login if unauthenticated', async ({ page }) => {
    await page.goto('/territory')
    await expect(page).toHaveURL(/.*\/login/)
  })

  test('displays empty state for new user', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    
    // Navigate to territory board
    await page.goto('/territory')
    
    // Check for empty state
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByText("You don't own any territory yet.")).toBeVisible()
    
    // Check stats are 0
    await expect(page.getByTestId('territory-count')).toHaveText('0')
    
    // Check map does not exist
    await expect(page.getByTestId('territory-map')).not.toBeVisible()
  })

  // To fully test the populated state, we'd need to mock the ownership endpoint
  // or create a workout. For now, we only assert the initial state as per 02D-07.
})
