import { test, expect } from '@playwright/test'
import { uniqueUser, signupUser } from '../helpers'

test.describe('Run History — /run/history (02C-03)', () => {
  test('unauthenticated visit redirects to /login', async ({ page }) => {
    await page.goto('/run/history')
    await expect(page).toHaveURL(/\/login/)
  })

  test('authenticated user with no workouts sees the empty state', async ({
    page,
  }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)

    await page.goto('/run/history')
    await expect(page).toHaveURL(/\/run\/history/)
    await expect(page.getByTestId('history-empty')).toBeVisible()
    await expect(page.getByText(/no runs yet/i)).toBeVisible()
  })

  test('after completing a workout the history page lists it', async ({
    page,
  }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)

    // Complete a workout via the /run page.
    await page.goto('/run')
    await page.getByRole('button', { name: /start run/i }).click()
    await expect(page.getByText(/recording/i)).toBeVisible()
    await page.getByRole('button', { name: /stop run/i }).click()
    await expect(page.getByText(/run complete/i)).toBeVisible()

    // Navigate to history.
    await page.goto('/run/history')
    await expect(page).toHaveURL(/\/run\/history/)

    // The list should contain at least one item with the completed status.
    const items = page.getByTestId('history-item')
    await expect(items).toHaveCount(1)
    await expect(items.first().getByText(/completed/i)).toBeVisible()

    // The empty state should NOT be visible.
    await expect(page.getByTestId('history-empty')).not.toBeVisible()
  })

  test('history shows distance and duration columns', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)

    // Complete a workout.
    await page.goto('/run')
    await page.getByRole('button', { name: /start run/i }).click()
    await page.getByRole('button', { name: /stop run/i }).click()
    await expect(page.getByText(/run complete/i)).toBeVisible()

    await page.goto('/run/history')
    const item = page.getByTestId('history-item').first()
    await expect(item.getByText(/distance/i)).toBeVisible()
    await expect(item.getByText(/duration/i)).toBeVisible()
    await expect(item.getByText(/pace/i)).toBeVisible()
  })

  test('discarded workouts do NOT appear in history', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)

    // Start and discard a workout.
    await page.goto('/run')
    await page.getByRole('button', { name: /start run/i }).click()
    await page.getByRole('button', { name: /discard run/i }).click()
    await expect(page.getByText(/run discarded/i)).toBeVisible()

    // History should show the empty state.
    await page.goto('/run/history')
    await expect(page.getByTestId('history-empty')).toBeVisible()
  })
})
