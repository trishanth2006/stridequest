/** Circular buffer median filter — O(n log n) for n ≤ window, zero heap waste. */
export class MedianFilter {
  private readonly buf: Float64Array
  private readonly scratchBuf: Float64Array
  private head = 0
  private size = 0

  constructor(private readonly capacity: number) {
    this.buf = new Float64Array(capacity)
    this.scratchBuf = new Float64Array(capacity)
  }

  push(value: number): void {
    this.buf[this.head] = value
    this.head = (this.head + 1) % this.capacity
    if (this.size < this.capacity) this.size++
  }

  get value(): number {
    if (this.size === 0) return 0
    
    const activeScratch = this.scratchBuf.subarray(0, this.size)
    activeScratch.set(this.buf.subarray(0, this.size))
    activeScratch.sort()
    
    const mid = Math.floor(this.size / 2)
    return this.size % 2 !== 0
      ? activeScratch[mid]!
      : (activeScratch[mid - 1]! + activeScratch[mid]!) / 2
  }

  get count(): number {
    return this.size
  }

  reset(): void {
    this.head = 0
    this.size = 0
  }
}
