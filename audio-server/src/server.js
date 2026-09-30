const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;
const pttSessions = new Map();
const pttClients = new Set();
const httpServer = http.createServer(app);
const wsServer = new WebSocketServer({ server: httpServer, path: "/ptt" });

const browserSources = new Set();
const esp32Sinks = new Set();

// [PTT SERVER TIMING] read-only audit (hrtime.bigint ns, output ms)
function newPttTimingStats() {
  return { count: 0, last: 0n, min: 0n, max: 0n, sum: 0n, g25: 0, g40: 0, g100: 0 };
}
function recordPttInterval(st, ts) {
  if (0n < st.last) {
    const dt = ts - st.last;
    if (0n < dt) {
      st.count++;
      st.sum += dt;
      if (st.min === 0n || dt < st.min) st.min = dt;
      if (st.max < dt) st.max = dt;
      if (100000000n < dt) st.g100++;
      else if (40000000n < dt) st.g40++;
      else if (25000000n < dt) st.g25++;
    }
  }
  st.last = ts;
}
function fmtPttTs(st) {
  const n = st.count;
  const avg = 0 < n ? Number(st.sum) / n / 1e6 : null;
  const minMs = 0n < st.min ? Number(st.min) / 1e6 : null;
  const maxMs = 0n < st.max ? Number(st.max) / 1e6 : null;
  return (minMs === null ? "N/A" : minMs.toFixed(1)) + "/" +
         (avg === null ? "N/A" : avg.toFixed(1)) + "/" +
         (maxMs === null ? "N/A" : maxMs.toFixed(1));
}
function fmtPttGaps(st) {
  return (st.g25 || 0) + "/" + (st.g40 || 0) + "/" + (st.g100 || 0);
}
function logPttServerTiming(socket) {
  console.log("[PTT SERVER TIMING] RX=" + socket.framesForwarded +
    " RXInt(min/avg/max)=" + fmtPttTs(socket.rxStats) +
    " RXGaps\u003e25/40/100=" + fmtPttGaps(socket.rxStats) +
    " TX=" + (socket.txStats ? socket.txStats.count : 0) +
    " TXInt(min/avg/max)=" + (socket.txStats ? fmtPttTs(socket.txStats) : "N/A/N/A/N/A") +
    " TXGaps\u003e25/40/100=" + (socket.txStats ? fmtPttGaps(socket.txStats) : "0/0/0"));
}
function logPttServerStop(socket) {
  console.log("[PTT SERVER TIMING] STOP" +
    " RXFrames=" + socket.framesForwarded +
    " RXInterval(min/avg/max)=" + fmtPttTs(socket.rxStats) +
    " RXGaps\u003e25/40/100=" + fmtPttGaps(socket.rxStats) +
    " TXFrames=" + (socket.txStats ? socket.txStats.count : 0) +
    " TXInterval(min/avg/max)=" + (socket.txStats ? fmtPttTs(socket.txStats) : "N/A/N/A/N/A") +
    " TXGaps\u003e25/40/100=" + (socket.txStats ? fmtPttGaps(socket.txStats) : "0/0/0"));
}

wsServer.on("connection", (socket) => {
  pttClients.add(socket);
  console.log("[PTT WS] ESP32 connected (clients=" + pttClients.size + ")");
  socket.on("message", (message, isBinary) => {
    if (isBinary) {
      // Raw PCM frame from a browser source -> forward to ESP32 sinks only.
      if (!socket.isBrowserSource || !Buffer.isBuffer(message) || message.length !== 640) return;
      const rxTs = process.hrtime.bigint(); // [PTT SERVER TIMING] RX: frame diterima dari browser
      if (!socket.rxStats) socket.rxStats = newPttTimingStats();
      recordPttInterval(socket.rxStats, rxTs);
      const sinks = [...esp32Sinks].filter((s) => s.readyState === 1);
      if (sinks.length === 0) return;
      socket.framesForwarded = (socket.framesForwarded || 0) + 1;
      if (socket.framesForwarded === 1) console.log("[PTT SOURCE] PCM streaming started");
      const txTs = process.hrtime.bigint(); // [PTT SERVER TIMING] TX: frame dikirim ke sink ESP32
      if (!socket.txStats) socket.txStats = newPttTimingStats();
      recordPttInterval(socket.txStats, txTs);
      for (const s of sinks) s.send(message, { binary: true });
      if (socket.framesForwarded % 25 === 0) {
        console.log("[PTT SOURCE] Frame forwarded: " + socket.framesForwarded + " (sinks=" + sinks.length + ")");
        logPttServerTiming(socket);
      }
      return;
    }
    const text = message.toString();
    if (text === "PTT_SOURCE") {
      socket.isBrowserSource = true;
      browserSources.add(socket);
      console.log("[PTT SOURCE] Browser connected (sources=" + browserSources.size + ", sinks=" + esp32Sinks.size + ")");
      socket.send("SOURCE_ACK");
      return;
    }
    if (text !== "PTT_TEST") return;
    esp32Sinks.add(socket);
    console.log("[PTT WS] Test message received");
    socket.send("PTT_ACK");
    console.log("[PTT WS] ACK sent");
  });
  socket.on("close", () => {
    pttClients.delete(socket);
    esp32Sinks.delete(socket);
    if (socket.isBrowserSource) {
      browserSources.delete(socket);
      if (socket.rxStats) {
        logPttServerStop(socket);
      }
      if (socket.framesForwarded > 0) {
        console.log("[PTT SOURCE] PCM streaming stopped (frames=" + socket.framesForwarded + ")");
      }
      console.log("[PTT SOURCE] Browser disconnected");
    } else {
      console.log("[PTT WS] ESP32 disconnected (clients=" + pttClients.size + ")");
    }
  });
});

// ============================================================
// Smart School Bell - Audio Server
// ============================================================
// Audio Plane untuk Voice Note & PTT.
// Phase berikutnya: streaming, WebRTC, tunnel Cloudflare.
// ============================================================

// Folder tempat file audio disimpan
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- MIME type yang didukung ---
const ALLOWED_MIME_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "application/ogg",
];

// --- Multer: simpan file ke {UPLOAD_DIR} ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = "voice_" + Date.now() + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // maks 20 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error("UNSUPPORTED_AUDIO_FORMAT"));
    }
    cb(null, true);
  },
});

// --- Helper: sanitasi nama file agar aman dari path traversal ---
function sanitizeAndCheck(filename) {
  const name = path.basename(String(filename || "").replace(/\\/g, "/"));
  if (!name || name === "." || name === ".." || name.includes("/")) return null;
  return name;
}

// --- Error handler untuk Multer ---
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ ok: false, error: "File size exceeds 20 MB limit" });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ ok: false, error: "Field upload must be 'audio'" });
    }
    return res.status(400).json({ ok: false, error: "Upload error: " + err.code });
  }
  if (err && err.message === "UNSUPPORTED_AUDIO_FORMAT") {
    return res.status(400).json({ ok: false, error: "Unsupported audio format" });
  }
  next(err);
}

// --- GET / : status dasar ---
app.get("/", (req, res) => {
  res.json({
    status: "running",
    service: "audio-server",
    timestamp: new Date().toISOString(),
  });
});

// --- GET /health : kesehatan + uptime ---
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// --- POST /api/voice-note : upload file audio (field: audio) ---
app.post("/api/voice-note", upload.single("audio"), handleMulterError, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "No audio file provided" });
  }
  res.status(201).json({
    ok: true,
    filename: req.file.filename,
    size: req.file.size,
    url: "/audio/" + req.file.filename,
  });
});

// --- PTT realtime diagnostic transport (raw MediaRecorder chunks, not stored) ---
app.post("/api/ptt/connect", (req, res) => {
  const sessionId = "ptt_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  pttSessions.set(sessionId, { startedAt: Date.now(), chunks: 0, bytes: 0 });
  console.log("[PTT] Client connected (active=" + pttSessions.size + ")");
  res.status(201).json({ ok: true, sessionId });
});

app.post("/api/ptt/chunk", express.raw({ type: ["audio/webm", "audio/ogg", "audio/mp4", "application/octet-stream"], limit: "512 KB" }), (req, res) => {
  const sessionId = String(req.get("x-ptt-session") || "");
  const session = pttSessions.get(sessionId);
  if (!session) return res.status(404).json({ ok: false, error: "PTT session not found" });
  const bytes = Buffer.isBuffer(req.body) ? req.body.length : 0;
  if (!bytes) return res.status(400).json({ ok: false, error: "Empty audio chunk" });
  session.chunks += 1;
  session.bytes += bytes;
  if (session.chunks === 1 || session.chunks % 20 === 0) {
    console.log("[PTT] Audio received (chunks=" + session.chunks + ", bytes=" + session.bytes + ")");
  }
  res.json({ ok: true, bytes });
});

// --- PTT binary PCM transport test (ESP32 -> synthetic sine frames) ---
function makePcmFrame() {
  const frame = Buffer.alloc(640); // 320 samples x int16 LE, 16 kHz mono, 20 ms
  for (let i = 0; i < 320; i++) {
    const v = Math.round(8192 * Math.sin(2 * Math.PI * 440 * (i / 16000)));
    frame.writeInt16LE(v, i * 2);
  }
  return frame;
}

app.post("/api/ptt/test-pcm", (req, res) => {
  const frames = Math.min(parseInt(req.body && req.body.frames, 10) || 5, 1000);
  if (pttClients.size === 0) {
    return res.status(404).json({ ok: false, error: "No ESP32 connected" });
  }
  for (const socket of pttClients) {
    for (let i = 0; i < frames; i++) {
      socket.send(makePcmFrame(), { binary: true });
    }
  }
  console.log("[PTT PCM TEST] sent " + frames + " binary frame(s) to " + pttClients.size + " client(s)");
  res.json({ ok: true, frames, bytesPerFrame: 640, clients: pttClients.size });
});

// --- PTT continuous PCM stream test (deadline-based 20 ms real-time cadence) ---
// Windows setTimeout rounding (~15.6 ms tick) makes relative-delay pacing drift
// to ~32 ms/frame -> ESP32 consumer (20 ms tick) underflows. So schedule each
// frame against an absolute monotonic deadline: target = start + cumulativeMs.
const MS = 1000000n; // ns per ms
let pttStreamInProgress = false;
app.post("/api/ptt/test-pcm-stream", (req, res) => {
  const durationMs = Math.min(parseInt(req.body && req.body.durationMs, 10) || 10000, 30000);
  const jitter = !!(req.body && req.body.jitter);
  const frames = Math.max(1, Math.floor(durationMs / 20));
  const clients = [...pttClients].filter((s) => s.readyState === 1);
  if (clients.length === 0) {
    return res.status(404).json({ ok: false, error: "No ESP32 connected" });
  }
  if (pttStreamInProgress) {
    return res.status(409).json({ ok: false, error: "A PCM stream is already running" });
  }
  pttStreamInProgress = true;
  const delayPattern = jitter ? [15, 20, 25, 20, 18, 22] : [20];
  const startedAt = process.hrtime.bigint();
  console.log("[PTT PCM STREAM] start duration=" + durationMs + "ms frames=" + frames + " jitter=" + jitter);
  (async () => {
    let targetNs = startedAt; // cumulative absolute deadline per frame
    let sent = 0;
    while (sent < frames) {
      // waitUntil: sleep in coarse chunks, then busy-spin the tail so the send
      // lands within <1 ms of the absolute deadline regardless of timer granularity.
      for (;;) {
        const now = process.hrtime.bigint();
        if (now >= targetNs) break;
        const remainMs = Number(targetNs - now) / 1e6;
        if (remainMs > 16) {
          await new Promise((r) => setTimeout(r, remainMs - 16)); // yield, fire before deadline
        } else {
          while (process.hrtime.bigint() < targetNs) {} // ponytail: swap for a high-res timer when scheduling more than a test stream
        }
      }
      const alive = clients.filter((s) => s.readyState === 1);
      if (alive.length === 0) {
        console.log("[PTT PCM STREAM] aborted: no clients after " + sent + "/" + frames);
        break;
      }
      for (const s of alive) s.send(makePcmFrame(), { binary: true });
      sent++;
      if (sent % 25 === 0) {
        const elapsed = Number(process.hrtime.bigint() - startedAt) / 1e6;
        console.log("[PTT PCM STREAM] Frame " + sent + "/" + frames + " elapsed=" + elapsed.toFixed(1) + "ms");
      }
      targetNs += BigInt(delayPattern[sent % delayPattern.length] || 20) * MS;
    }
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const avgMs = frames > 1 ? elapsedMs / (frames - 1) : 0;
    console.log(
      "[PTT PCM STREAM] DONE Frames=" + sent +
      " Bytes=" + (sent * 640) +
      " Elapsed=" + elapsedMs.toFixed(1) + "ms" +
      " Target=~" + (frames * 20) + "ms" +
      " AvgInterval=" + avgMs.toFixed(2) + "ms"
    );
    pttStreamInProgress = false;
  })();
  res.json({ ok: true, frames, bytes: frames * 640, durationMs, jitter });
});

app.post("/api/ptt/disconnect", (req, res) => {
  const sessionId = String(req.get("x-ptt-session") || "");
  const session = pttSessions.get(sessionId);
  if (!session) return res.status(404).json({ ok: false, error: "PTT session not found" });
  pttSessions.delete(sessionId);
  console.log("[PTT] Client disconnected (duration=" + (Date.now() - session.startedAt) + " ms, chunks=" + session.chunks + ", active=" + pttSessions.size + ")");
  res.json({ ok: true });
});
// --- GET /audio/:filename : akses file audio ---
app.get("/audio/:filename", (req, res) => {
  const name = sanitizeAndCheck(req.params.filename);
  if (!name) return res.status(400).json({ ok: false, error: "Invalid filename" });
  const filePath = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "File not found" });
  res.sendFile(filePath);
});

// --- GET /api/audio : daftar file ---
app.get("/api/audio", (req, res) => {
  let files = [];
  try {
    files = fs.readdirSync(UPLOAD_DIR).map((f) => ({
      filename: f,
      size: fs.statSync(path.join(UPLOAD_DIR, f)).size,
      url: "/audio/" + f,
    }));
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Failed to read uploads folder" });
  }
  res.json({ ok: true, files });
});

// --- DELETE /api/audio/:filename : hapus file ---
app.delete("/api/audio/:filename", (req, res) => {
  const name = sanitizeAndCheck(req.params.filename);
  if (!name) return res.status(400).json({ ok: false, error: "Invalid filename" });
  const filePath = path.join(UPLOAD_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "File not found" });
  try {
    fs.unlinkSync(filePath);
    res.json({ ok: true, deleted: name });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Failed to delete file" });
  }
});

// --- Mulai server ---
httpServer.listen(PORT, () => {
  console.log("[AUDIO SERVER] http://localhost:" + PORT);
});
