import { test, expect } from '@playwright/test'
import { uniqueUser, loginUser } from './helpers'

test.describe.serial('Authentication flows', () => {
  const user = uniqueUser()

  test('signup creates account and redirects to dashboard', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel(/email/i).fill(user.email)
    await page.getByLabel(/username/i).fill(user.username)
    await page.getByLabel(/password/i).fill(user.password)
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('dashboard shows username, XP, distance and logout button', async ({ page }) => {
    await loginUser(page, user.email, user.password)
    await expect(page.getByText(user.username)).toBeVisible()
    await expect(page.getByText(/total xp/i)).toBeVisible()
    await expect(page.getByText('Distance', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  })

  test('logout clears session and redirects to /login', async ({ page }) => {
    await loginUser(page, user.email, user.password)
    await page.getByRole('button', { name: /sign out/i }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test('login with valid credentials lands on dashboard', async ({ page }) => {
    await loginUser(page, user.email, user.password)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText(user.username)).toBeVisible()
  })
})

test.describe('Auth error states', () => {
  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel(/email/i).fill('nobody@test.example')
    await page.getByLabel(/password/i).fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByTestId('auth-error')).toContainText('Invalid email or password')
  })

  test('signup with invalid email shows validation error', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel(/email/i).fill('not-an-email')
    await page.getByLabel(/username/i).fill('someuser')
    await page.getByLabel(/password/i).fill('password123')
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByTestId('auth-error')).toContainText('Invalid email address')
  })

  test('signup with short password shows validation error', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel(/email/i).fill('valid@test.example')
    await page.getByLabel(/username/i).fill('validuser')
    await page.getByLabel(/password/i).fill('short')
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(page.getByTestId('auth-error')).toContainText('Password must be at least 8 characters')
  })
})
