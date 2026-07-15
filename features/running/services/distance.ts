/**
 * Re-export shim — haversine distance math now lives in the shared workspace
 * package. Import sites under `@/` keep working unchanged; new code should
 * import from `@stridequest/shared/running`.
 */
export { EARTH_RADIUS_M, haversineMeters, cumulativeDistanceMeters } from '@stridequest/shared/running'
