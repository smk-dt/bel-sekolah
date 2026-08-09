# SMART BELL IoT - Project Requirements

## 1. Tujuan

Sistem bel sekolah berbasis IoT yang dapat dikontrol melalui dashboard web oleh guru.

Guru dapat menggunakan HP atau laptop untuk:

1. Login ke dashboard.
2. Melihat status ESP32.
3. Mengatur jadwal bel.
4. Mengirim voice announcement.
5. Melihat log aktivitas.
6. Melihat status perangkat.

## 2. Pembagian Dua Sistem Audio

| Sistem | Sumber Audio | Koneksi | Butuh Internet? |
|--------|--------------|---------|-----------------|
| Bel terjadwal | DFPlayer Mini + MicroSD | Lokal | TIDAK (offline) |
| Voice announcement | Server → ESP32 → PCM5102A | Internet | YA |

Alasan pemisahan:

- Bel terjadwal harus tetap berfungsi jika internet bermasalah.
- Voice announcement bersifat realtime dan membutuhkan server.

## 3. Jalur Audio

```
PCM5102A (I2S DAC)
    |
    v
AUX INPUT 1
    |
    v
Mixer TOA
    |
    v
Speaker

DFPlayer Mini
    |
    v
AUX INPUT 2
    |
    v
Mixer TOA
    |
    v
Speaker
```

Kedua sumber audio digabung di **input mixer**, bukan dengan jumper langsung.

## 4. Komponen Hardware (Rencana)

| Komponen | Fungsi |
|----------|--------|
| ESP32-WROOM-32 | Mikrokontroler utama |
| DS3231 | RTC untuk jadwal offline |
| DFPlayer Mini + MicroSD | Bel terjadwal |
| PCM5102A | DAC untuk voice announcement |
| Relay (2x) | Power control mixer (fase berikutnya) |
| Push button | Manual control (fase berikutnya) |

## 5. Teknologi

| Bagian | Teknologi |
|--------|-----------|
| Backend | Supabase (PostgreSQL + Auth + Realtime + REST) |
| Frontend | React, Vite, Tailwind CSS v4 |
| Firmware | ESP32, Arduino Framework |
| Audio bell | DFPlayer Mini + MicroSD |
| Audio streaming | PCM5102A + ESP32-AudioI2S (dipasang saat fase audio) |

## 6. Kebutuhan Non-Fungsional

- Dashboard responsive (HP, tablet, laptop, desktop).
- ESP32 auto-reconnect WiFi & server (tanpa reset manual).
- Password tersimpan sebagai hash (tidak pernah plaintext).
- Credential ESP32 tidak disimpan di source code publik.
- Setiap ESP32 memiliki Device ID unik (contoh: SB-001).

## 7. Roadmap Phase

Lihat [ROADMAP](./architecture.md) untuk fase lengkap.

Saat ini sedang berjalan: **Phase 2 - Project Folder & Environment Setup**.

## 8. Dokumentasi Terkait

- [System Architecture](./architecture.md)
- [Hardware](./hardware.md)
- [Pinout](./pinout.md)
- [Database](./database.md)
- [API Contract](./api.md)
- [Realtime](./realtime.md)
- [Firmware](./firmware-architecture.md)
- [Security](./security.md)
- [Deployment](./deployment.md)