# SMART BELL IoT

Sistem bel sekolah berbasis IoT yang dapat dikontrol melalui dashboard web.

## Deskripsi

Smart Bell IoT adalah sistem yang memungkinkan guru mengontrol bel sekolah melalui HP atau laptop dengan fitur:

- Login ke dashboard
- Melihat status ESP32 (online/offline, WiFi, audio)
- Mengatur jadwal bel
- Memutar audio test (MP3 dari MicroSD)
- Mengontrol relay
- Melihat log aktivitas

## Arsitektur

```
Guru (HP / Laptop)
        |
        v
   Web Dashboard (React + Vite + Tailwind)
        |
        v
   Supabase (PostgreSQL + Auth + Realtime + REST)
        ^
        |
        v
       ESP32
        |
        +--> DFPlayer Mini ---> AUX ---> Mixer TOA ---> Speaker
```

## Struktur Project

```
smart bell/
│
├── server/          # SQL schema untuk Supabase
│   └── schema.sql   # Tabel: profiles, devices, audios, schedules, logs + RLS + seed
│
├── dashboard/       # Web Dashboard (React + Vite + Tailwind CSS v4)
│   ├── src/         # Source code React
│   ├── .env.example # Template environment variable
│   └── vite.config.js
│
├── firmware/        # Firmware ESP32 (Arduino Framework)
│   └── smart_school_bell/
│       └── smart_school_bell.ino  # Placeholder (fase firmware belum dimulai)
│
├── docs/            # Dokumentasi lengkap (Phase 1)
├── hardware/        # Diagram / Referensi hardware (rencana)
├── sound-bell/      # File MP3 bel (tidak di-commit ke Git, disimpan di MicroSD)
├── .gitignore
└── README.md
```

## Teknologi

| Bagian | Teknologi |
|--------|-----------|
| Backend | Supabase (PostgreSQL + Auth + Realtime + REST API) |
| Frontend | React, Vite, Tailwind CSS v4 |
| Firmware | ESP32-WROOM-32, Arduino Framework, Arduino IDE / PlatformIO |
| RTC | DS3231 |
| Audio | DFPlayer Mini + MicroSD (bel otomatis) |
| Audio DAC | PCM5102A (voice announcement & streaming) |

## Status Project

**Phase 2 — Project Folder & Environment Setup** (sedang berlangsung)

## Dokumentasi

| Dokumen | Isi |
|---------|-----|
| [Project Requirements](./docs/requirements.md) | Kebutuhan & konsep sistem |
| [System Architecture](./docs/architecture.md) | Arsitektur sistem & pilihan teknologi |
| [Hardware](./docs/hardware.md) | Komponen hardware, wiring, audio path |
| [Pinout](./docs/pinout.md) | Pin ESP32 & DFPlayer |
| [Database Schema](./docs/database.md) | Skema tabel di Supabase (+ lihat `server/schema.sql`) |
| [API Contract](./docs/api.md) | REST API Supabase |
| [Realtime Architecture](./docs/realtime.md) | Alur realtime & polling |
| [Firmware Architecture](./docs/firmware-architecture.md) | Struktur & modul firmware ESP32 |
| [Security](./docs/security.md) | RLS, auth, secret |
| [Deployment](./docs/deployment.md) | Strategi deploy (Supabase + Vercel/Netlify) |

## Persiapan Development (Phase 2)

### Dashboard

1. Node.js (>= 18) — sudah diverifikasi: node v24.15.0
2. npm — sudah diverifikasi: npm 11.12.1
3. Git — sudah diverifikasi: git 2.55.0
4. Akun Supabase (free tier) — dibutuhkan saat Phase 2 (setup backend)

### Firmware ESP32 (phase firmware, belum dimulai)

1. Arduino IDE atau PlatformIO
2. ESP32 Board Package (espressif)
3. Library: ArduinoJson, RTClib, NTPClient, DFRobotDFPlayerMini
4. Library audio (voice announcement): ESP32-AudioI2S (dipasang saat fase audio)

## Menjalankan Dashboard (Lokal)

```bash
cd dashboard
npm install
npm run dev
```

Server dev akan berjalan di: http://localhost:5173

## Catatan Penting

- Tidak ada server Node.js lokal yang wajib berjalan untuk produksi.
- Semua fungsi backend (auth, API, database, realtime) ditangani Supabase di cloud.
- Internet mati → bel tetap dapat diputar oleh ESP32 secara offline (RTC + jadwal lokal + MicroSD).
- File MP3 bell (`sound-bell/`) TIDAK disimpan di Git; file fisik disimpan di MicroSD DFPlayer.

## Lisensi

Project pribadi untuk keperluan pengembangan.