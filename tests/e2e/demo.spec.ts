import { test, expect } from '@playwright/test'
import path from 'path'

const artifactDir = process.env.ARTIFACT_DIR || '.'

test('Demo: Complete 1 workout and show territory capture', async ({ page, context }) => {
  test.setTimeout(60000)

  // Provide initial mock location
  await context.grantPermissions(['geolocation'])
  let longitude = -122.4
  const latitude = 37.8
  await context.setGeolocation({ latitude, longitude, accuracy: 5 })

  // 1. Log in
  await page.goto('/login')
  await page.fill('input[name="email"]', 'strishanthreddy@gmail.com')
  await page.fill('input[name="password"]', 'Shannu123@')
  await page.click('button[type="submit"]')

  // Wait for auth to redirect
  await page.waitForURL('**/dashboard', { timeout: 10000 })

  // 2. Start Workout
  await page.goto('/run')
  await page.getByRole('button', { name: /start run/i }).click()
  await expect(page.getByText(/recording/i)).toBeVisible()
  
  // 3. Move slowly to capture points and pass jitter/accuracy gates
  for (let i = 0; i < 15; i++) {
    longitude += 0.0001
    await context.setGeolocation({ latitude, longitude, accuracy: 5 })
    await page.waitForTimeout(1000)
  }

  // Ensure live distance ticks to confirm points were taken
  await expect(page.getByTestId('live-distance-value')).not.toHaveText('0', { timeout: 15_000 })

  // 4. Stop Workout
  await page.getByRole('button', { name: /stop run/i }).click()
  await expect(page.getByText(/run complete/i)).toBeVisible()

  // 5. Go to Territory Board
  await page.goto('/territory')
  
  // 6. Ensure map is visible and wait for it to render
  const mapLocator = page.getByTestId('territory-map')
  await expect(mapLocator).toBeVisible({ timeout: 15000 })
  await page.waitForTimeout(4000) // Give mapbox time to render the canvas layers
  
  // 7. Capture screenshot
  await page.screenshot({ path: path.join(artifactDir, 'territory-demo.png'), fullPage: true })

  // 8. Open details
  const details = page.locator('details.group')
  await details.click()
  await expect(page.getByTestId('owned-cells')).toBeVisible()
})
