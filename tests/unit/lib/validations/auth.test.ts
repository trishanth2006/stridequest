import { signupSchema, loginSchema } from '@/lib/validations/auth'

describe('signupSchema', () => {
  const valid = { email: 'test@example.com', password: 'password123', username: 'testuser' }

  it('accepts valid input', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true)
  })

  it('normalizes username to lowercase and trimmed', () => {
    const result = signupSchema.safeParse({ ...valid, username: '  TestUser  ' })
    expect(result.success && result.data.username).toBe('testuser')
  })

  it('rejects invalid email', () => {
    const result = signupSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects password shorter than 8 characters', () => {
    const result = signupSchema.safeParse({ ...valid, password: 'short' })
    expect(result.success).toBe(false)
  })

  it('rejects username shorter than 3 characters', () => {
    const result = signupSchema.safeParse({ ...valid, username: 'ab' })
    expect(result.success).toBe(false)
  })

  it('rejects username longer than 30 characters', () => {
    const result = signupSchema.safeParse({ ...valid, username: 'a'.repeat(31) })
    expect(result.success).toBe(false)
  })

  it('rejects empty username', () => {
    const result = signupSchema.safeParse({ ...valid, username: '' })
    expect(result.success).toBe(false)
  })

  it('accepts username of exactly 3 characters', () => {
    const result = signupSchema.safeParse({ ...valid, username: 'abc' })
    expect(result.success).toBe(true)
  })

  it('accepts username of exactly 30 characters', () => {
    const result = signupSchema.safeParse({ ...valid, username: 'a'.repeat(30) })
    expect(result.success).toBe(true)
  })
})

describe('loginSchema', () => {
  const valid = { email: 'test@example.com', password: 'password123' }

  it('accepts valid input', () => {
    expect(loginSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ ...valid, password: '' })
    expect(result.success).toBe(false)
  })
})
