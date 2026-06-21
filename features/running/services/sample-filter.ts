/**
 * Re-export shim — sample filter now lives in @stridequest/shared/running
 * so web and mobile share one implementation. New code should import from
 * '@stridequest/shared/running'.
 */
export {
  filterSamples,
  DEFAULT_SAMPLE_FILTER_CONFIG,
} from '@stridequest/shared/running'
export type { SampleFilterConfig } from '@stridequest/shared/running'
