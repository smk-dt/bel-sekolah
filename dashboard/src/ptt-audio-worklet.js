// PTT audio worklet: mic Float32 -> 16 kHz -> signed 16-bit LE mono -> 320-sample/640-byte frames.
// Read-only diagnostics only; no gain/compressor/limiter/filter. Raw pipeline identical to the old
// ScriptProcessor path, executed on the audio rendering thread instead of the React main thread.
const OUT_RATE = 16000
const FRAME = 320 // 320 samples = 20 ms @16 kHz = 640 bytes
const FRAME_BYTES = FRAME * 2

registerProcessor('ptt-audio-worklet', class extends AudioWorkletProcessor {
  constructor() {
    super()
    this._step = sampleRate / OUT_RATE // input samples per output sample (3.0 at 48 kHz)
    this._pos = 0 // resampler phase carry across process() calls
    this._acc = [] // resampled float accumulator
    this._frames = 0
    // [PTT MIC] cumulative read-only audit (snapshot posted with every frame)
    this._stat = {
      inPeak: 0, inSumSq: 0, inN: 0, inNonZero: 0, inMin: 1, inMax: -1,
      resPeak: 0, resSumSq: 0, resN: 0, resNonZero: 0,
      i16Peak: 0, i16Zeros: 0, zeroFrames: 0, constFrames: 0,
      zeroRun: 0, zeroRunMax: 0,
      clipPos: 0, clipNeg: 0,
      tGenLast: 0, tGenCount: 0, tGenMin: 0, tGenMax: 0, tGenSum: 0,
      gapGen25: 0, gapGen40: 0, gapGen100: 0
    }
    // [PTT MIC] per-25-frame window snapshot (reset here, logged on main thread)
    this._win = {
      winInPeak: 0, winInSumSq: 0, winInN: 0, winInNonZero: 0,
      winResPeak: 0, winResNonZero: 0, winI16Peak: 0
    }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    const a = this._stat
    const w = this._win
    // 1) mic audit (read-only), identical thresholds to the ScriptProcessor-era path
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i]
      if (0.999 <= v) a.clipPos++
      else if (v <= -0.999) a.clipNeg++
      if (v !== 0) { a.inNonZero++; w.winInNonZero++ }
      const abs = v < 0 ? -v : v
      if (a.inPeak < abs) a.inPeak = abs
      if (w.winInPeak < abs) w.winInPeak = abs
      if (v < a.inMin) a.inMin = v
      if (a.inMax < v) a.inMax = v
      a.inSumSq += v * v
      w.winInSumSq += v * v
    }
    a.inN += ch.length
    w.winInN += ch.length
    // 2) chunked linear-interpolation resample with phase carry (identical to old resampleAndSend)
    const out = new Float32Array(Math.ceil(ch.length / this._step) + 1)
    let j = 0
    let p = this._pos
    while (p < ch.length) {
      const i0 = Math.floor(p)
      const i1 = i0 + 1 < ch.length ? i0 + 1 : ch.length - 1
      const f = p - i0
      out[j++] = ch[i0] + f * (ch[i1] - ch[i0])
      p += this._step
    }
    this._pos = p - ch.length // fractional phase carry into the next chunk
    // 3) resampled audit + push into frame accumulator
    for (let i = 0; i < j; i++) {
      const v = out[i]
      if (v !== 0) { a.resNonZero++; w.winResNonZero++ }
      const abs = v < 0 ? -v : v
      if (a.resPeak < abs) a.resPeak = abs
      if (w.winResPeak < abs) w.winResPeak = abs
      a.resSumSq += v * v
      this._acc.push(v)
    }
    a.resN += j
    // 4) drain exactly 320-sample frames
    while (FRAME <= this._acc.length) {
      this._emit(this._acc.splice(0, FRAME))
    }
    return true
  }
  _emit(samples) {
    const a = this._stat
    this._frames++
    const dv = new DataView(new ArrayBuffer(FRAME_BYTES))
    let fMin = 32767
    let fMax = -32768
    for (let i = 0; i < FRAME; i++) {
      let v = samples[i]
      if (1 < v) v = 1
      else if (v < -1) v = -1
      const s = Math.round(v * 32767) // identical conversion as before
      dv.setInt16(i * 2, s, true) // signed 16-bit little-endian
      const sAbs = s < 0 ? -s : s
      if (a.i16Peak < sAbs) a.i16Peak = sAbs
      if (this._win.winI16Peak < sAbs) this._win.winI16Peak = sAbs
      if (s === 0) a.i16Zeros++
      if (fMax < s) fMax = s
      if (s < fMin) fMin = s
    }
    if (fMax === 0) {
      a.zeroFrames++
      a.zeroRun++
      if (a.zeroRunMax < a.zeroRun) a.zeroRunMax = a.zeroRun
    } else {
      a.zeroRun = 0
      if (fMax === fMin) a.constFrames++
    }
    // [PTT TIMING] generation cadence, measured on the audio rendering thread
    // AudioWorkletGlobalScope has no performance.now(); currentTime is the monotonic audio clock in seconds.
    const nowMs = currentTime * 1000
    if (0 < a.tGenLast) {
      const dt = nowMs - a.tGenLast
      if (0 < dt) {
        a.tGenCount++
        a.tGenSum += dt
        if (a.tGenMin === 0 || dt < a.tGenMin) a.tGenMin = dt
        if (a.tGenMax < dt) a.tGenMax = dt
        if (100 < dt) a.gapGen100++
        else if (40 < dt) a.gapGen40++
        else if (25 < dt) a.gapGen25++
      }
    }
    a.tGenLast = nowMs
    const isLogFrame = this._frames % 25 === 0
    this.port.postMessage({
      type: 'snap',
      frames: this._frames,
      bytes: dv.buffer, // transferable
      stat: {
        inPeak: a.inPeak, inSumSq: a.inSumSq, inN: a.inN, inNonZero: a.inNonZero, inMin: a.inMin, inMax: a.inMax,
        resPeak: a.resPeak, resSumSq: a.resSumSq, resN: a.resN, resNonZero: a.resNonZero,
        i16Peak: a.i16Peak, i16Zeros: a.i16Zeros, zeroFrames: a.zeroFrames, constFrames: a.constFrames,
        zeroRunMax: a.zeroRunMax, clipPos: a.clipPos, clipNeg: a.clipNeg,
        tGenMin: a.tGenMin, tGenCount: a.tGenCount, tGenMax: a.tGenMax, tGenSum: a.tGenSum,
        gapGen25: a.gapGen25, gapGen40: a.gapGen40, gapGen100: a.gapGen100
      },
      win: isLogFrame
        ? {
            winInPeak: this._win.winInPeak, winInSumSq: this._win.winInSumSq, winInN: this._win.winInN,
            winInNonZero: this._win.winInNonZero, winResPeak: this._win.winResPeak,
            winResNonZero: this._win.winResNonZero, winI16Peak: this._win.winI16Peak
          }
        : null
    }, [dv.buffer])
    if (isLogFrame) {
      this._win.winInPeak = 0; this._win.winInSumSq = 0; this._win.winInN = 0; this._win.winInNonZero = 0
      this._win.winResPeak = 0; this._win.winResNonZero = 0; this._win.winI16Peak = 0
    }
  }
})