import {
  stopWorkoutSchema,
  discardWorkoutSchema,
  gpsSampleSchema,
  ingestBatchSchema,
} from '@/features/running/schemas'

const validId = '123e4567-e89b-12d3-a456-426614174000'
const validSample = { lat: 12.34, lng: 56.78, accuracy: 5, recordedAt: 1_000 }

describe('stopWorkoutSchema', () => {
  it('accepts a valid uuid workoutId', () => {
    expect(stopWorkoutSchema.safeParse({ workoutId: validId }).success).toBe(true)
  })

  it('rejects a non-uuid workoutId', () => {
    expect(stopWorkoutSchema.safeParse({ workoutId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects a missing workoutId', () => {
    expect(stopWorkoutSchema.safeParse({}).success).toBe(false)
  })

  it('rejects an empty workoutId', () => {
    expect(stopWorkoutSchema.safeParse({ workoutId: '' }).success).toBe(false)
  })
})

describe('discardWorkoutSchema', () => {
  it('accepts a valid uuid workoutId', () => {
    expect(discardWorkoutSchema.safeParse({ workoutId: validId }).success).toBe(true)
  })

  it('rejects a non-uuid workoutId', () => {
    expect(discardWorkoutSchema.safeParse({ workoutId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects a missing workoutId', () => {
    expect(discardWorkoutSchema.safeParse({}).success).toBe(false)
  })
})

describe('gpsSampleSchema', () => {
  it('accepts a minimal valid sample', () => {
    expect(gpsSampleSchema.safeParse(validSample).success).toBe(true)
  })

  it('accepts optional altitude/speed/heading', () => {
    const full = { ...validSample, altitude: 100, speed: 3, heading: 90 }
    expect(gpsSampleSchema.safeParse(full).success).toBe(true)
  })

  it('rejects lat outside [-90, 90]', () => {
    expect(gpsSampleSchema.safeParse({ ...validSample, lat: 91 }).success).toBe(false)
  })

  it('rejects lng outside [-180, 180]', () => {
    expect(gpsSampleSchema.safeParse({ ...validSample, lng: 181 }).success).toBe(false)
  })

  it('rejects negative accuracy', () => {
    expect(gpsSampleSchema.safeParse({ ...validSample, accuracy: -1 }).success).toBe(false)
  })

  it('rejects negative speed', () => {
    expect(gpsSampleSchema.safeParse({ ...validSample, speed: -1 }).success).toBe(false)
  })

  it('rejects a missing required field', () => {
    expect(gpsSampleSchema.safeParse({ lng: 56.78, accuracy: 5, recordedAt: 1_000 }).success).toBe(false)
  })

  it('rejects a non-integer recordedAt', () => {
    expect(gpsSampleSchema.safeParse({ ...validSample, recordedAt: 1.5 }).success).toBe(false)
  })
})

describe('ingestBatchSchema', () => {
  it('accepts a valid batch', () => {
    expect(ingestBatchSchema.safeParse({ batchSeq: 5, samples: [validSample] }).success).toBe(true)
  })

  it('accepts batchSeq at the zero boundary', () => {
    expect(ingestBatchSchema.safeParse({ batchSeq: 0, samples: [validSample] }).success).toBe(true)
  })

  it('rejects a negative batchSeq', () => {
    expect(ingestBatchSchema.safeParse({ batchSeq: -1, samples: [validSample] }).success).toBe(false)
  })

  it('rejects a non-integer batchSeq', () => {
    expect(ingestBatchSchema.safeParse({ batchSeq: 1.5, samples: [validSample] }).success).toBe(false)
  })

  it('rejects an empty samples array', () => {
    expect(ingestBatchSchema.safeParse({ batchSeq: 0, samples: [] }).success).toBe(false)
  })
})
