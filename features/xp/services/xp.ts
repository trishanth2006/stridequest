/**
 * Re-export shim — the XP rules now live in the shared workspace package so the
 * web and mobile apps compute XP from one source. Import sites under `@/` keep
 * working unchanged; new code should import from `@stridequest/shared/xp`.
 */
export * from '@stridequest/shared/xp'
