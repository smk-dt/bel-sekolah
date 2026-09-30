# SMART SCHOOL BELL — BASELINE LOCK

Frozen: 2026-09-30
Repository: `C:/Users/Lenovo/Documents/VSC/smart bell` (local only, no remote)
HEAD: `572b61be85bac485cdeee6e54594d3aecccb413f` (master)
Tag: `smart-school-bell-local-stable`

## Status

LOCAL PTT STABLE

## Verified

- Browser AudioWorklet
- PCM 16-bit signed LE
- 16 kHz
- mono
- 320 samples
- 640 bytes
- 20 ms/frame
- WebSocket Worker
- Audio Server
- ESP32 receiver
- I2S
- PCM5102A
- local same-network voice = clear

Evidence (live test, same network):

```text
browser: Frames generated = 276
         Frames sent      = 276
         Gen avg          = 20 ms
         Send avg         = 20 ms
         Send gaps >40 ms = 0
         Queue overflow   = 0
         Invalid          = 0
```

## Locked files

| File | Bytes | SHA-256 |
|---|---|---|
| `dashboard/src/App.jsx` | 54481 | `68385daf9dc010a12d8174caeac6aa28bdf5c2d4a0d6e5f7fdde664adf8c1fe1` |
| `dashboard/src/ptt-audio-worklet.js` | 6114 | `4c4764a964a2274758bba0f18e6e34277efeca6f5b9a45114fdf776a7d83b8a9` |
| `dashboard/src/ptt-ws-worker.js` | 5019 | `780f55a89ecc462f7077dce6c06da843086ad290b9d5232724481a1949dea8f6` |
| `audio-server/src/server.js` | 15576 | `d6c596551be550713591b7506bc270659cbf80744ecc5a4fb75029ceed65e747` |
| `firmware/smart_school_bell/smart_school_bell.ino` | 10888 | `3a833f6794bdb6a98bcf6d7ce5e4d740951e18e34dfeed713aec6651fc9a686d` |

Locked means: no refactor, no optimization, no rename, no file move, no algorithm change,
no PCM change, no WebSocket protocol change, no I2S change, no ring buffer change, no
resampler change, no AudioWorklet change, no Worker change, no schedule/relay/voice/DS1302/
DFPlayer/heartbeat/Supabase change. No changes for tidiness.

## PRE-EXISTING (uncommitted, do not delete, do not modify)

Tracked, modified:

```text
M dashboard/.env.example
M dashboard/src/App.jsx
M firmware/smart_school_bell/smart_school_bell.ino
M server/schema.sql
```

Untracked:

```text
?? audio-server/
?? dashboard/src/ptt-audio-worklet.js
?? dashboard/src/ptt-ws-worker.js
?? dashboard/src/App.jsx.bak
?? dashboard/src/components/
?? dashboard/src/lib/
?? firmware/README.md
?? firmware/smart_school_bell/.theia/
?? firmware/smart_school_bell/*.cpp, *.h        (32 module files)
?? relay-server/
?? supabase/
?? cloudflared.exe
?? run_tunnel.ps1
?? test_tunnel.wav
?? fix_script.py
?? package.json
?? package-lock.json
```

NOTE: the git tag points at the last commit, which does **not** include the untracked work
above. The authoritative baseline record is `BASELINE_SHA256.txt` (SHA-256 of the actual
file contents on disk). `dashboard/src/App.jsx.bak` is a partial backup only.

## Backup status

No full-project backup was created before this freeze. Only the pre-existing
`dashboard/src/App.jsx.bak` exists.

## Verification

```powershell
Get-FileHash -Algorithm SHA256 dashboard/src/App.jsx, dashboard/src/ptt-audio-worklet.js, `
  dashboard/src/ptt-ws-worker.js, audio-server/src/server.js, `
  firmware/smart_school_bell/smart_school_bell.ino
git --no-pager diff --name-only
```
