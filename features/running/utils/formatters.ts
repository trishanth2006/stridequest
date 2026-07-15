/**
 * Re-export shim — formatters now live in the shared workspace package so the
 * web and mobile apps format distance/duration/pace identically. New code
 * should import from `@stridequest/shared/running`.
 */
export { formatDistance, formatDuration, formatPace } from '@stridequest/shared/running'
