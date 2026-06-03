import { test, expect } from '@playwright/test'
import { uniqueUser, signupUser } from './helpers'

test.describe('Route protection — unauthenticated', () => {
  test('/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/ redirects to /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('/login is accessible without auth', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('/signup is accessible without auth', async ({ page }) => {
    await page.goto('/signup')
    await expect(page).toHaveURL(/\/signup/)
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })
})

test.describe('Route protection — authenticated', () => {
  test('/login redirects authenticated user to /dashboard', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('/signup redirects authenticated user to /dashboard', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    await page.goto('/signup')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('/dashboard is accessible and shows user data when authenticated', async ({ page }) => {
    const user = uniqueUser()
    await signupUser(page, user.email, user.username, user.password)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText(user.username)).toBeVisible()
  })
})
