# SMART BELL IoT

Sistem bel sekolah berbasis IoT yang dapat dikontrol melalui dashboard web.

## Deskripsi

Smart Bell IoT adalah sistem yang memungkinkan guru mengontrol bel sekolah melalui HP atau laptop dengan fitur:

- Login ke dashboard
- Melihat status ESP32
- Mengatur jadwal bel
- Mengirim voice announcement
- Melihat log aktivitas

## Arsitektur

```
Guru (HP/Laptop)
        |
        v
   Web Dashboard
        |
        v
      Server
        |
        v
      ESP32
        |
        +--> PCM5102A ---> AUX ---> Mixer TOA ---> Speaker
        |
        +--> DFPlayer Mini ---> AUX ---> Mixer TOA ---> Speaker
```

## Struktur Project

```
smart-bell/
│
├── server/          # Node.js + Express + Socket.IO
├── dashboard/       # React + Vite + Tailwind CSS
├── firmware/        # ESP32 (Arduino IDE)
├── docs/            # Dokumentasi
├── hardware/        # Diagram / Referensi hardware
├── api/             # Definisi API
├── .gitignore
└── README.md
```

## Teknologi

| Bagian | Teknologi |
|--------|-----------|
| Backend | Node.js, Express.js, Socket.IO |
| Database | SQLite (development) |
| Frontend | React, Vite, Tailwind CSS |
| Firmware | ESP32, Arduino Framework, Arduino IDE |
| Audio | PCM5102A (DAC), DFPlayer Mini (MP3 Player) |

## Status Project

Phase 0 - Project Preparation

## Persiapan Development

### Backend & Dashboard

1. Node.js (>= 18)
2. Git

### Firmware ESP32

1. Arduino IDE
2. ESP32 Board Package (espressif)
3. Library audio ESP32 (dipilih saat Phase 7+)

## Dokumentasi

Dokumentasi lengkap tersedia di folder [docs](./docs).

## Lisensi

Project pribadi untuk keperluan pengembangan.

## Catatan Penting

Project ini sedang dalam tahap development awal. Belum ada fitur aplikasi yang dibuat.