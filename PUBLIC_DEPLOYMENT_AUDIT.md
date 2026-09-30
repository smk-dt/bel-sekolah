# PUBLIC DEPLOYMENT AUDIT

Audit date: 2026-09-30 · Phase: AUDIT + FREEZE ONLY · Read-only, no fix applied.

```text
Dashboard Public
        |
      HTTPS
        |
     Vercel (*.vercel.app)

Dashboard / Internet
        |
       WSS
        |
  Public Audio Server (Render, *.onrender.com)
        |
    Internet
        |
      ESP32 -> I2S -> PCM5102A -> TOA
```

## DASHBOARD

```text
Platform:               Vercel (static build, Vite preset) - *.vercel.app
Public URL:             https://<project>.vercel.app            (to be assigned)
Build:                  npm run build  ->  vite build
Output directory:       dist/        (vite.config.js sets no build.outDir)
Env source:             import.meta.env (Vite), all values via Vercel env vars

Environment variables:
  VITE_SUPABASE_URL       = https://zuspjabuphigtfuvzhye.supabase.co   (src/lib/supabase.js:17)
  VITE_SUPABASE_ANON_KEY  = sb_publishable_q_...                        (src/lib/supabase.js:18)
  VITE_AUDIO_SERVER_URL   = https://<audio-app>.onrender.com           (App.jsx:870)

Localhost dependency:   1 hardcoded fallback: App.jsx:870 'http://localhost:3000'
                         (inactive as long as VITE_AUDIO_SERVER_URL is set)
LAN IP dependency:      none (0 hits for 10.127. / 192.168. in dashboard/src)

PTT WebSocket URL source: App.jsx:930
  audioWsUrl() = audioServerUrl.replace(/^http/, 'ws') + '/ptt'
  => https://<audio-app>.onrender.com becomes wss://<audio-app>.onrender.com/ptt
  => no source change required for WSS

Worker URL:             App.jsx:1050  new Worker(new URL('./ptt-ws-worker.js', import.meta.url), { type: 'module' })
                        Vite emits dist/assets/ptt-ws-worker-<hash>.js
AudioWorklet URL:       App.jsx:1035  ctx.audioWorklet.addModule(new URL('./ptt-audio-worklet.js', import.meta.url))
                        Vite emits dist/assets/ptt-audio-worklet-<hash>.js
```

Audit result: **no code change required.** Deployment is env-var configuration only.

## AUDIO SERVER

```text
Platform:               Render Web Service (Node) - *.onrender.com
Public URL:             https://<audio-app>.onrender.com
Start command:          npm start -> node src/server.js   (package.json:7)
Deploy file:            none needed (no render.yaml / Procfile; Render auto-detects)
HTTP:                   https://<audio-app>.onrender.com
WebSocket:              wss://<audio-app>.onrender.com/ptt
WSS:                    yes - Render terminates TLS at the proxy, Node listens plain HTTP
Port:                   server.js:10  process.env.PORT || 3000
Bind:                   server.js:384 httpServer.listen(PORT)  (no host arg => 0.0.0.0, Render-ready)
Health:                 no /health endpoint; GET /api/audio (read-only) can serve as a check
CORS:                   server.js:118 app.use(cors())  (allow-all, accepts *.vercel.app origin)
Origin handling:        no allowlist (open CORS - security note, not a deployment blocker)
WS path:                server.js:14  new WebSocketServer({ server: httpServer, path: "/ptt" })
Binary handling:        server.js:71-74  binary accepted only from isBrowserSource,
                        Buffer.isBuffer && message.length === 640, forwarded to readyState===1 sinks
Role handshake:         PTT_SOURCE -> isBrowserSource + browserSources (server.js:194)
                        PTT_DEVICE -> isEsp32Device + esp32Sinks (server.js:186)
LAN IP dependency:      none (only a cosmetic log at server.js:385)
Render free-tier notes: ephemeral disk (voice notes lost on restart);
                        idle sleep ~15 min (WS drops, ESP32 auto-reconnects every 5 s)
```

Audit result: **no code change required.**

## ESP32

```text
Current PTT Host:        10.127.158.210        (config.h:56, hardcoded LAN IP)
Current PTT Port:        3000                  (config.h:57, hardcoded)
Current PTT Path:        /ptt                  (config.h:58)
Current TLS:             NONE - ws:// plain (smart_school_bell.ino:217
                         pttWebSocket.begin(PTT_WS_HOST, PTT_WS_PORT, PTT_WS_PATH))
Endpoint source:         hardcoded #define in config.h
                         (not NVS, not Supabase, not fetched from an API; config.ccp holds
                          only WiFi / Supabase / DEVICE_TOKEN)
Reconnect:               pttWebSocket.setReconnectInterval(5000)  (smart_school_bell.ino:219)

Production Host required:  yes - wss://<audio-app>.onrender.com
Production Port required:  yes - 443
Production TLS required:   yes - wss://
```

## DOMAIN

```text
Custom domain:          not required for this phase
Dashboard:              *.vercel.app     (HTTPS, sufficient for the browser)
Audio Server:           *.onrender.com   (HTTPS + WSS, sufficient for browser and ESP32)
Cloudflare tunnel:      not used in this phase
BLOCKER:                none
```

## FILES THAT MUST CHANGE

```text
1. firmware/smart_school_bell/config.h                    (DEPLOYMENT BLOCKER #1 - NOT APPLIED)
   #define PTT_WS_HOST  "10.127.158.210"  ->  "<audio-app>.onrender.com"
   #define PTT_WS_PORT  3000              ->  443

2. firmware/smart_school_bell/smart_school_bell.ino      (DEPLOYMENT BLOCKER #1 - NOT APPLIED)
   line 217:  pttWebSocket.begin(PTT_WS_HOST, PTT_WS_PORT, PTT_WS_PATH);
           ->  pttWebSocket.beginSSLWithTime(PTT_WS_HOST, PTT_WS_PORT, PTT_WS_PATH);
   (WebSocketsClient / links2004; no setFingerprint needed, BearSSL does not verify the
    certificate by default)
```

No dashboard file and no audio-server file must change. Vercel / Render configuration is done
through platform env vars, not through source.

## FILES THAT MUST NOT CHANGE

```text
dashboard/src/App.jsx
dashboard/src/ptt-audio-worklet.js
dashboard/src/ptt-ws-worker.js
audio-server/src/server.js
firmware/smart_school_bell/smart_school_bell.ino   (except the single begin() call in BLOCKER #1)
```

## DEPLOYMENT BLOCKER

```text
DEPLOYMENT BLOCKER #1
File:      firmware/smart_school_bell/config.h (line 56-57)
           firmware/smart_school_bell/smart_school_bell.ino (line 217)
Reason:    ESP32 connects with plain ws:// to LAN IP 10.127.158.210:3000. Render only terminates
           TLS, so the public endpoint exists solely as wss://<audio-app>.onrender.com:443.
Exact:     config.h:56   #define PTT_WS_HOST "10.127.158.210"
           config.h:57   #define PTT_WS_PORT 3000
           .ino:217       pttWebSocket.begin(PTT_WS_HOST, PTT_WS_PORT, PTT_WS_PATH);
Minimal required change: host -> <audio-app>.onrender.com, port -> 443,
           begin() -> beginSSLWithTime().
Functional impact: two functional edits, one of them in a LOCKED file (.ino). No workaround
           exists - a browser on https:// cannot open ws:// (mixed content blocked) and Render
           does not expose plain ws:// publicly.
Status:     REPORTED, NOT APPLIED (this phase is audit + freeze only).
```
