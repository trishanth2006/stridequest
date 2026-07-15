/**
 * Re-export shim — territory cell derivation now lives in the shared workspace
 * package, so web (stop action) and mobile (finalize edge function) derive the
 * same cell set. New code should import from `@stridequest/shared/territory`.
 */
export { captureCells } from '@stridequest/shared/territory'
export type { CaptureRoutePoint } from '@stridequest/shared/territory'
