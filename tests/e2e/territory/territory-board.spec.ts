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
  })
})
