import { test, expect } from '@playwright/test'
import { uniqueUser, signupUser } from '../helpers'

test.describe('Workout lifecycle — /run', () => {
  test('unauthenticated visit to /run redirects to /login', async ({ page }) => {
    await page.goto('/run')
    await expect(page).toHaveURL(/\/login/)
  })

  test('start transitions the UI to a recording state', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    await page.goto('/run')
    await page.getByRole('button', { name: /start run/i }).click()
    await expect(page.getByText(/recording/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /stop run/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /discard run/i })).toBeVisible()
  })

  test('stop transitions a recording workout to completed', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    await page.goto('/run')
    await page.getByRole('button', { name: /start run/i }).click()
    await page.getByRole('button', { name: /stop run/i }).click()
    await expect(page.getByText(/run complete/i)).toBeVisible()
  })

  test('discard abandons a recording workout', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    await page.goto('/run')
    await page.getByRole('button', { name: /start run/i }).click()
    await page.getByRole('button', { name: /discard run/i }).click()
    await expect(page.getByText(/run discarded/i)).toBeVisible()
  })

  // 02B-08: the recorder streams a stubbed GPS feed; the live estimate ticks
  // (non-authoritative, FR-GPS-5) and batches reach the idempotent ingest route.
  test('live distance estimate ticks and a batch uploads while recording', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation'])
    const latitude = 37.0
    let longitude = -122.0
    // Steps of ~8.9 m once per second: > 5 m (clears jitter dedupe), ~8.9 m/s
    // (< the 12.5 m/s teleport gate), accuracy 5 m (< the 30 m accuracy gate).
    await context.setGeolocation({ latitude, longitude, accuracy: 5 })

    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    await page.goto('/run')
    await page.getByRole('button', { name: /start run/i }).click()
    await expect(page.getByText(/recording/i)).toBeVisible()
    await expect(page.getByTestId('live-distance')).toContainText(/live estimate/i)

    // The buffer cuts a batch on its ~10 s interval; assert the POST is accepted.
    const pointsPost = page.waitForResponse(
      (res) =>
        /\/api\/workouts\/.+\/points$/.test(res.url()) && res.request().method() === 'POST',
      { timeout: 25_000 }
    )

    for (let i = 0; i < 14; i++) {
      longitude += 0.0001
      await context.setGeolocation({ latitude, longitude, accuracy: 5 })
      await page.waitForTimeout(1000)
    }

    // Live estimate advanced past zero (auto-retries until the watch has fired).
    // The value cell holds just the magnitude (unit is a sibling node), so "0" is
    // the at-rest text; any accepted movement rounds it to a non-zero metres value.
    await expect(page.getByTestId('live-distance-value')).not.toHaveText('0', {
      timeout: 15_000,
    })

    const res = await pointsPost
    expect(res.status()).toBeGreaterThanOrEqual(200)
    expect(res.status()).toBeLessThan(300)
  })

  test('metrics are correctly captured and displayed in history upon completion (02C-02A)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['geolocation'])
    const latitude = 37.0
    let longitude = -122.0
    await context.setGeolocation({ latitude, longitude, accuracy: 5 })

    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    await page.goto('/run')
    await page.getByRole('button', { name: /start run/i }).click()
    await expect(page.getByText(/recording/i)).toBeVisible()

    // Simulate movement to accumulate > 0 distance
    for (let i = 0; i < 5; i++) {
      longitude += 0.0001
      await context.setGeolocation({ latitude, longitude, accuracy: 5 })
      await page.waitForTimeout(1000)
    }

    // Wait for the live estimate to tick so we know movement was accepted
    await expect(page.getByTestId('live-distance-value')).not.toHaveText('0', {
      timeout: 15_000,
    })

    // Stop run
    await page.getByRole('button', { name: /stop run/i }).click()
    await expect(page.getByText(/run complete/i)).toBeVisible()

    // Go to history
    await page.getByRole('link', { name: /view run history/i }).click()

    // History page displays the run with metrics
    const historyItem = page.getByTestId('history-item').first()
    await expect(historyItem).toBeVisible()
    
    // Distance should not be 0 m
    await expect(historyItem.getByText('0 m', { exact: true })).not.toBeVisible()
    
    // It should have some positive distance, duration and pace
    // A quick check that duration is not 0:00
    await expect(historyItem.getByText('0:00', { exact: true })).not.toBeVisible()
    // Pace should not be —
    await expect(historyItem.getByText('—', { exact: true })).not.toBeVisible()
  })
})
