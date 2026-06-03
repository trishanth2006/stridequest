import type { Page } from '@playwright/test'

export function uniqueUser() {
  const ts = Date.now()
  return {
    email: `e2e-${ts}@example.com`,
    password: 'TestPass1234!',
    username: `user${ts}`.slice(0, 20),
  }
}

export async function signupUser(
  page: Page,
  email: string,
  username: string,
  password: string
) {
  await page.goto('/signup')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/username/i).fill(username)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
  await page.waitForURL('**/dashboard')
}

export async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await page.waitForURL('**/dashboard')
}
