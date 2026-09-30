// PTT PCM WebSocket worker: owns BOTH the transferred AudioWorklet MessagePort and the PCM
// WebSocket, so frames go AudioWorklet -> this worker -> ws.send and never touch the React main
// thread. Relay-only: the worklet is the 20 ms clock, so there is no timer / deadline pacer.
let ws = null
let registered = false
let audioPort = null // transferred AudioWorkletNode.port (the PCM source)
let lastMic = null // latest cumulative worklet snapshot, forwarded to App at STOP
let queue = [] // safety buffer, used only while the socket is not ready to send
let sent = 0
let bytes = 0
let queuePeak = 0
let overflow = 0
let invalid = 0 // frames dropped by the 640-byte protocol check
// [PTT WORKER] send cadence audit (measured at the real ws.send)
let tSendLast = 0
let tSendCount = 0
let tSendMin = 0
let tSendMax = 0
let tSendSum = 0
let gapSend25 = 0
let gapSend40 = 0
let gapSend100 = 0

function fmtMs(v) { return 0 < v ? v.toFixed(1) : 'N/A' }
function fmtAvg() { return 0 < tSendCount ? (tSendSum / tSendCount).toFixed(1) : 'N/A' }

function relay(frame) {
  // [!] caller guarantees ws OPEN + registered; timing measured right before ws.send
  const t = performance.now()
  ws.send(frame) // the only PCM ws.send in the browser PTT path
  sent++
  bytes += 640
  if (0 < tSendLast) {
    const dt = t - tSendLast
    if (0 < dt) {
      tSendCount++
      tSendSum += dt
      if (tSendMin === 0 || dt < tSendMin) tSendMin = dt
      if (tSendMax < dt) tSendMax = dt
      if (100 < dt) gapSend100++
      else if (40 < dt) gapSend40++
      else if (25 < dt) gapSend25++
    }
  }
  tSendLast = t
  if (sent % 25 === 0) {
    console.log('[PTT WORKER] Sent=' + sent + ' Queue=' + queue.length + ' QueuePeak=' + queuePeak + ' Overflow=' + overflow)
    postMessage({ type: 'status', sent: sent, queue: queue.length, queuePeak: queuePeak, overflow: overflow })
  }
}

function ready() {
  return !!ws && ws.readyState === WebSocket.OPEN && registered
}

// drain at most ONE queued frame per call, oldest first — no burst catch-up.
function drainOne() {
  if (!ready()) return
  if (0 === queue.length) return
  relay(queue.shift())
}

function enqueue(frame) {
  if (queue.length >= 25) { overflow++; queue.shift() } // drop oldest, keep newest audio
  queue.push(frame)
  if (queuePeak < queue.length) queuePeak = queue.length
}

// [PTT PCM] direct AudioWorklet port: one message per 640-byte frame, at the worklet cadence,
// with no main-thread hop in between
function onAudioMessage(ev) {
  const m = ev.data
  if (!m || m.type !== 'snap') return
  lastMic = { frames: m.frames, stat: m.stat }
  if (m.win) postMessage({ type: 'mic-snap', frames: m.frames, stat: m.stat, win: m.win })
  const frame = m.bytes
  if (!(frame instanceof ArrayBuffer) || frame.byteLength !== 640) { invalid++; return } // protocol: 640-byte S16LE frame
  if (ready()) {
    if (0 < queue.length) { enqueue(frame); drainOne() } // backlog: keep order, one send per event
    else relay(frame) // immediate send, cadence inherited from the AudioWorklet
  } else {
    enqueue(frame) // not ready yet: buffer (max 25), never a timer-driven stream
  }
}

self.onmessage = (ev) => {
  const m = ev.data
  if (m.type === 'attach-audio-port') {
    if (audioPort) { try { audioPort.close() } catch { /* ignore */ } }
    audioPort = m.port
    audioPort.onmessage = onAudioMessage
    postMessage({ type: 'audio-port-ready' })
    return
  }
  if (m.type === 'start') {
    ws = new WebSocket(m.url)
    ws.onopen = () => ws.send('PTT_SOURCE')
    ws.onmessage = (e) => {
      if (e.data === 'SOURCE_ACK') {
        registered = true
        postMessage({ type: 'acked' })
        drainOne() // flush any backlog, one frame per event
      }
    }
    ws.onerror = () => postMessage({ type: 'error' })
    ws.onclose = () => { registered = false; queue = [] }
    return
  }
  if (m.type === 'stop') {
    if (audioPort) {
      try { audioPort.onmessage = null; audioPort.close() } catch { /* ignore */ }
      audioPort = null
    }
    console.log('[PTT WORKER] STOP Sent=' + sent +
      ' SendInterval(min/avg/max)=' + fmtMs(tSendMin) + '/' + fmtAvg() + '/' + fmtMs(tSendMax) + 'ms' +
      ' SendGaps\u003e25/40/100=' + gapSend25 + '/' + gapSend40 + '/' + gapSend100 +
      ' QueuePeak=' + queuePeak +
      ' Overflow=' + overflow +
      ' Invalid=' + invalid +
      ' QueueRemaining=' + queue.length)
    postMessage({
      type: 'summary',
      sent: sent, bytes: bytes,
      queuePeak: queuePeak, overflow: overflow, queueRemaining: queue.length, invalid: invalid,
      mic: lastMic, // last cumulative worklet snapshot, so App can still print [PTT MIC] STOP
      send: { min: tSendMin, sum: tSendSum, count: tSendCount, max: tSendMax, gap25: gapSend25, gap40: gapSend40, gap100: gapSend100 }
    })
    queue = []
    if (ws && ws.readyState === WebSocket.OPEN) ws.close()
  }
}