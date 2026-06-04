# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: run\history.spec.ts >> Run History — /run/history (02C-03) >> history shows distance and duration columns
- Location: tests\e2e\run\history.spec.ts:48:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/run complete/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText(/run complete/i)

```

```yaml
- img
- heading "This page couldn’t load" [level=1]
- paragraph: A server error occurred. Reload to try again.
- button "Reload"
- paragraph: ERROR 3469960733
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { uniqueUser, signupUser } from '../helpers'
  3  | 
  4  | test.describe('Run History — /run/history (02C-03)', () => {
  5  |   test('unauthenticated visit redirects to /login', async ({ page }) => {
  6  |     await page.goto('/run/history')
  7  |     await expect(page).toHaveURL(/\/login/)
  8  |   })
  9  | 
  10 |   test('authenticated user with no workouts sees the empty state', async ({
  11 |     page,
  12 |   }) => {
  13 |     const user = uniqueUser()
  14 |     await signupUser(page, user.email, user.username, user.password)
  15 | 
  16 |     await page.goto('/run/history')
  17 |     await expect(page).toHaveURL(/\/run\/history/)
  18 |     await expect(page.getByTestId('history-empty')).toBeVisible()
  19 |     await expect(page.getByText(/no runs yet/i)).toBeVisible()
  20 |   })
  21 | 
  22 |   test('after completing a workout the history page lists it', async ({
  23 |     page,
  24 |   }) => {
  25 |     const user = uniqueUser()
  26 |     await signupUser(page, user.email, user.username, user.password)
  27 | 
  28 |     // Complete a workout via the /run page.
  29 |     await page.goto('/run')
  30 |     await page.getByRole('button', { name: /start run/i }).click()
  31 |     await expect(page.getByText(/recording/i)).toBeVisible()
  32 |     await page.getByRole('button', { name: /stop run/i }).click()
  33 |     await expect(page.getByText(/run complete/i)).toBeVisible()
  34 | 
  35 |     // Navigate to history.
  36 |     await page.goto('/run/history')
  37 |     await expect(page).toHaveURL(/\/run\/history/)
  38 | 
  39 |     // The list should contain at least one item with the completed status.
  40 |     const items = page.getByTestId('history-item')
  41 |     await expect(items).toHaveCount(1)
  42 |     await expect(items.first().getByText(/completed/i)).toBeVisible()
  43 | 
  44 |     // The empty state should NOT be visible.
  45 |     await expect(page.getByTestId('history-empty')).not.toBeVisible()
  46 |   })
  47 | 
  48 |   test('history shows distance and duration columns', async ({ page }) => {
  49 |     const user = uniqueUser()
  50 |     await signupUser(page, user.email, user.username, user.password)
  51 | 
  52 |     // Complete a workout.
  53 |     await page.goto('/run')
  54 |     await page.getByRole('button', { name: /start run/i }).click()
  55 |     await page.getByRole('button', { name: /stop run/i }).click()
> 56 |     await expect(page.getByText(/run complete/i)).toBeVisible()
     |                                                   ^ Error: expect(locator).toBeVisible() failed
  57 | 
  58 |     await page.goto('/run/history')
  59 |     const item = page.getByTestId('history-item').first()
  60 |     await expect(item.getByText(/distance/i)).toBeVisible()
  61 |     await expect(item.getByText(/duration/i)).toBeVisible()
  62 |     await expect(item.getByText(/pace/i)).toBeVisible()
  63 |   })
  64 | 
  65 |   test('discarded workouts do NOT appear in history', async ({ page }) => {
  66 |     const user = uniqueUser()
  67 |     await signupUser(page, user.email, user.username, user.password)
  68 | 
  69 |     // Start and discard a workout.
  70 |     await page.goto('/run')
  71 |     await page.getByRole('button', { name: /start run/i }).click()
  72 |     await page.getByRole('button', { name: /discard run/i }).click()
  73 |     await expect(page.getByText(/run discarded/i)).toBeVisible()
  74 | 
  75 |     // History should show the empty state.
  76 |     await page.goto('/run/history')
  77 |     await expect(page.getByTestId('history-empty')).toBeVisible()
  78 |   })
  79 | })
  80 | 
```