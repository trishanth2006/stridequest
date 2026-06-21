/**
 * Re-export shim — sample buffer now lives in @stridequest/shared/running.
 * New code should import from '@stridequest/shared/running'.
 */
export {
  createSampleBuffer,
  DEFAULT_SAMPLE_BUFFER_CONFIG,
} from '@stridequest/shared/running'
export type {
  SampleBatch,
  SampleBufferConfig,
  UploadBatch,
  SampleBuffer,
} from '@stridequest/shared/running'
