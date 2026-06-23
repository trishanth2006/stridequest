// h3-js WASM init calls new TextDecoder('utf-16le') at module load.
// Expo's TextDecoder polyfill throws for unknown encodings; this shim
// returns a noop decoder instead so module initialization doesn't crash.
if (typeof TextDecoder !== 'undefined') {
  const Original = TextDecoder

  class PatchedTextDecoder implements TextDecoder {
    readonly encoding: string
    readonly fatal: boolean
    readonly ignoreBOM: boolean
    private _impl: TextDecoder | null

    constructor(label = 'utf-8', options?: TextDecoderOptions) {
      try {
        this._impl = new Original(label, options)
        this.encoding = this._impl.encoding
        this.fatal = this._impl.fatal
        this.ignoreBOM = this._impl.ignoreBOM
      } catch {
        this._impl = null
        this.encoding = label
        this.fatal = options?.fatal ?? false
        this.ignoreBOM = options?.ignoreBOM ?? false
      }
    }

    decode(
      input?: Parameters<TextDecoder['decode']>[0],
      options?: Parameters<TextDecoder['decode']>[1],
    ): string {
      return this._impl?.decode(input, options) ?? ''
    }
  }

  globalThis.TextDecoder = PatchedTextDecoder as typeof TextDecoder
}
