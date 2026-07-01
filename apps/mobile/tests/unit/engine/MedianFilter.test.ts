import { MedianFilter } from '../../../src/features/running/engine/MedianFilter'

describe('MedianFilter', () => {
  it('returns 0 when empty', () => {
    expect(new MedianFilter(5).value).toBe(0)
  })

  it('returns the single value', () => {
    const f = new MedianFilter(5)
    f.push(7)
    expect(f.value).toBe(7)
  })

  it('returns median for odd count (partial fill)', () => {
    const f = new MedianFilter(7)
    f.push(3)
    f.push(1)
    f.push(5)
    expect(f.value).toBe(3)
  })

  it('returns average of two middle values for even count', () => {
    const f = new MedianFilter(7)
    f.push(1)
    f.push(2)
    f.push(3)
    f.push(4)
    expect(f.value).toBe(2.5)
  })

  it('evicts oldest value when buffer is full', () => {
    const f = new MedianFilter(3)
    f.push(1)
    f.push(2)
    f.push(3) // buffer: [1,2,3]
    f.push(10) // evicts 1, buffer: [2,3,10]
    expect(f.value).toBe(3) // median of [2,3,10]
  })

  it('tracks correct count', () => {
    const f = new MedianFilter(5)
    expect(f.count).toBe(0)
    f.push(1)
    f.push(2)
    expect(f.count).toBe(2)
    f.push(3)
    f.push(4)
    f.push(5)
    expect(f.count).toBe(5)
    f.push(6) // capacity already full
    expect(f.count).toBe(5)
  })

  it('handles wrap-around correctly (window=3, push 7 values)', () => {
    const f = new MedianFilter(3)
    // Push values 1..7; after 7 pushes window should hold [5,6,7]
    for (let i = 1; i <= 7; i++) f.push(i)
    expect(f.value).toBe(6) // median of [5,6,7]
  })

  it('resets cleanly', () => {
    const f = new MedianFilter(5)
    f.push(99)
    f.reset()
    expect(f.count).toBe(0)
    expect(f.value).toBe(0)
  })
})
