import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@stridequest/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@stridequest/shared/(.*)$': '<rootDir>/packages/shared/src/$1/index.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/tests/e2e/', '/apps/'],
}

export default createJestConfig(config)
