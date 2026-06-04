# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: run\start-workout.spec.ts >> Workout lifecycle — /run >> metrics are correctly captured and displayed in history upon completion (02C-02A)
- Location: tests\e2e\run\start-workout.spec.ts:83:7

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
  12  |     await signupUser(page, user.email, user.username, user.password)
  13  |     await page.goto('/run')
  14  |     await page.getByRole('button', { name: /start run/i }).click()
  15  |     await expect(page.getByText(/recording/i)).toBeVisible()
  16  |     await expect(page.getByRole('button', { name: /stop run/i })).toBeVisible()
  17  |     await expect(page.getByRole('button', { name: /discard run/i })).toBeVisible()
  18  |   })
  19  | 
  20  |   test('stop transitions a recording workout to completed', async ({ page }) => {
  21  |     const user = uniqueUser()
  22  |     await signupUser(page, user.email, user.username, user.password)
  23  |     await page.goto('/run')
  24  |     await page.getByRole('button', { name: /start run/i }).click()
  25  |     await page.getByRole('button', { name: /stop run/i }).click()
  26  |     await expect(page.getByText(/run complete/i)).toBeVisible()
  27  |   })
  28  | 
  29  |   test('discard abandons a recording workout', async ({ page }) => {
  30  |     const user = uniqueUser()
  31  |     await signupUser(page, user.email, user.username, user.password)
  32  |     await page.goto('/run')
  33  |     await page.getByRole('button', { name: /start run/i }).click()
  34  |     await page.getByRole('button', { name: /discard run/i }).click()
  35  |     await expect(page.getByText(/run discarded/i)).toBeVisible()
  36  |   })
  37  | 
  38  |   // 02B-08: the recorder streams a stubbed GPS feed; the live estimate ticks
  39  |   // (non-authoritative, FR-GPS-5) and batches reach the idempotent ingest route.
  40  |   test('live distance estimate ticks and a batch uploads while recording', async ({
  41  |     page,
  42  |     context,
  43  |   }) => {
  44  |     await context.grantPermissions(['geolocation'])
  45  |     const latitude = 37.0
  46  |     let longitude = -122.0
  47  |     // Steps of ~8.9 m once per second: > 5 m (clears jitter dedupe), ~8.9 m/s
  48  |     // (< the 12.5 m/s teleport gate), accuracy 5 m (< the 30 m accuracy gate).
  49  |     await context.setGeolocation({ latitude, longitude, accuracy: 5 })
  50  | 
  51  |     const user = uniqueUser()
  52  |     await signupUser(page, user.email, user.username, user.password)
  53  |     await page.goto('/run')
  54  |     await page.getByRole('button', { name: /start run/i }).click()
  55  |     await expect(page.getByText(/recording/i)).toBeVisible()
  56  |     await expect(page.getByTestId('live-distance')).toContainText(/live estimate/i)
  57  | 
  58  |     // The buffer cuts a batch on its ~10 s interval; assert the POST is accepted.
  59  |     const pointsPost = page.waitForResponse(
  60  |       (res) =>
  61  |         /\/api\/workouts\/.+\/points$/.test(res.url()) && res.request().method() === 'POST',
  62  |       { timeout: 25_000 }
  63  |     )
  64  | 
  65  |     for (let i = 0; i < 14; i++) {
  66  |       longitude += 0.0001
  67  |       await context.setGeolocation({ latitude, longitude, accuracy: 5 })
  68  |       await page.waitForTimeout(1000)
  69  |     }
  70  | 
  71  |     // Live estimate advanced past zero (auto-retries until the watch has fired).
  72  |     // The value cell holds just the magnitude (unit is a sibling node), so "0" is
  73  |     // the at-rest text; any accepted movement rounds it to a non-zero metres value.
  74  |     await expect(page.getByTestId('live-distance-value')).not.toHaveText('0', {
  75  |       timeout: 15_000,
  76  |     })
  77  | 
  78  |     const res = await pointsPost
  79  |     expect(res.status()).toBeGreaterThanOrEqual(200)
  80  |     expect(res.status()).toBeLessThan(300)
  81  |   })
  82  | 
  83  |   test('metrics are correctly captured and displayed in history upon completion (02C-02A)', async ({
  84  |     page,
  85  |     context,
  86  |   }) => {
  87  |     await context.grantPermissions(['geolocation'])
  88  |     const latitude = 37.0
  89  |     let longitude = -122.0
  90  |     await context.setGeolocation({ latitude, longitude, accuracy: 5 })
  91  | 
  92  |     const user = uniqueUser()
  93  |     await signupUser(page, user.email, user.username, user.password)
  94  |     await page.goto('/run')
  95  |     await page.getByRole('button', { name: /start run/i }).click()
  96  |     await expect(page.getByText(/recording/i)).toBeVisible()
  97  | 
  98  |     // Simulate movement to accumulate > 0 distance
  99  |     for (let i = 0; i < 5; i++) {
  100 |       longitude += 0.0001
  101 |       await context.setGeolocation({ latitude, longitude, accuracy: 5 })
  102 |       await page.waitForTimeout(1000)
  103 |     }
  104 | 
  105 |     // Wait for the live estimate to tick so we know movement was accepted
  106 |     await expect(page.getByTestId('live-distance-value')).not.toHaveText('0', {
  107 |       timeout: 15_000,
  108 |     })
  109 | 
  110 |     // Stop run
  111 |     await page.getByRole('button', { name: /stop run/i }).click()
> 112 |     await expect(page.getByText(/run complete/i)).toBeVisible()
      |                                                   ^ Error: expect(locator).toBeVisible() failed
  113 | 
  114 |     // Go to history
  115 |     await page.getByRole('link', { name: /view run history/i }).click()
  116 | 
  117 |     // History page displays the run with metrics
  118 |     const historyItem = page.getByTestId('history-item').first()
  119 |     await expect(historyItem).toBeVisible()
  120 |     
  121 |     // Distance should not be 0 m
  122 |     await expect(historyItem.getByText('0 m', { exact: true })).not.toBeVisible()
  123 |     
  124 |     // It should have some positive distance, duration and pace
  125 |     // A quick check that duration is not 0:00
  126 |     await expect(historyItem.getByText('0:00', { exact: true })).not.toBeVisible()
  127 |     // Pace should not be —
  128 |     await expect(historyItem.getByText('—', { exact: true })).not.toBeVisible()
  129 |   })
  130 | })
  131 | 
```