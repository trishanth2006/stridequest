import { test, expect } from '@playwright/test'
import { uniqueUser, signupUser } from '../helpers'

test.describe('Territory Board', () => {
  test('redirects to login if unauthenticated', async ({ page }) => {
    await page.goto('/territory')
    await expect(page).toHaveURL(/.*\/login/)
  })

  test('displays empty state for new user (map + toggle hidden)', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)

    // Navigate to territory board
    await page.goto('/territory')

    // Check for empty state
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByText("You don't own any territory yet.")).toBeVisible()

    // Check stats are 0
    await expect(page.getByTestId('territory-count')).toHaveText('0')

    // The map AND the Territory/Heatmap toggle only exist once the user owns
    // cells — neither should appear in the empty state (02D-07B regression).
    await expect(page.getByTestId('territory-map')).not.toBeVisible()
    await expect(page.getByTestId('territory-mode-controls')).not.toBeVisible()
  })

  // Populated-state coverage (02D-07B): the map renders, the toggle switches
  // Territory <-> Heatmap with no reload, and ownership mode still functions.
  //
  // This needs a user who OWNS cells, i.e. seeded `cell_ownership` +
  // `territory_captures` rows (via the service-role key) AND a valid
  // NEXT_PUBLIC_MAPBOX_TOKEN for the map to mount. Skipped by default so CI
  // stays green without those prerequisites; run locally after seeding — see
  // docs/phase-02/phase-02D-07B-verification-report.md for the steps.
  test.skip('toggles between Territory and Heatmap on a populated board', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    // TODO(manual/seed): seed owned cells + captures for `user` before this point.
    await page.goto('/territory')

    // Map renders in the default Territory mode.
    const map = page.getByTestId('territory-map')
    await expect(map).toBeVisible()
    await expect(map).toHaveAttribute('data-mode', 'territory')

    // Switch to Heatmap — instant, no reload.
    await page.getByTestId('mode-heatmap').click()
    await expect(map).toHaveAttribute('data-mode', 'heatmap')

    // Switch back to Territory (ownership mode still functions, no regression).
    await page.getByTestId('mode-territory').click()
    await expect(map).toHaveAttribute('data-mode', 'territory')
  })
})
