/**
 * Re-export shim — the H3 territory grid now lives in the shared workspace
 * package. Import sites under `@/` keep working unchanged; new code should
 * import from `@stridequest/shared/territory`.
 */
export { H3_RESOLUTION, pathToCells, dedupeCells, normalizeCellIds } from '@stridequest/shared/territory'
