# SMART BELL IoT - System Architecture

## 1. Arsitektur Final

Smart Bell IoT menggunakan arsitektur **cloud + audio gateway** dengan pembagian tanggung jawab:

| Komponen | Tanggung Jawab |
|----------|----------------|
| **SUPABASE** | Backend cloud: Auth, PostgreSQL, REST API, Realtime, Storage |
| **AUDIO SERVER** | Realtime PTT audio transport (komponen terpisah) |
| **CLOUDFLARE** | Public access / HTTPS / Tunnel / Security layer (TBD) |

> **PENTING:** Supabase BUKAN satu-satunya server untuk fitur PTT.
> Audio Server adalah komponen terpisah yang menangani audio realtime PTT.

```
┌─────────────┐
│   Guru      │
│ (HP/Laptop) │
└──────┬──────┘
       │ HTTPS
       v
┌─────────────────────────────────────────────────────┐
│                   INTERNET / CLOUDFLARE             │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────┐  │
│  │  Supabase   │  │ Audio Server  │  │ Cloudflare│  │
│  │             │  │ (PTT realtime)│  │ (TBD)    │  │
│  │ ├─ Auth     │  │               │  │          │  │
│  │ ├─ Postgres │  │ └─ audio rx/tx│  └──────────┘  │
│  │ ├─ REST API │  └───────────────┘               │
│  │ ├─ Realtime │                                   │
│  │ └─ Storage  │                                   │
│  └──────┬──────┘                                   │
│         │ HTTPS                                    │
└─────────┼───────────────────────────────────────────┘
          ▼
   ┌────────────────┐
   │     ESP32      │
   │ (WiFi / 24/7)  │
   └───┬────┬────┬──┘
       │    │    │
  ┌────┘    │    └─────────────┐
  ▼         ▼                  ▼
┌──────┐ ┌──────┐ ┌──────────────────────┐
│DS3231│ │Relay │ │  PCM5102A (I2S DAC)  │
│ RTC  │ │2-ch  │ │  BCK=32 LCK=33 DIN=23│
└──────┘ └──┬───┘ └──────────┬───────────┘
            │                │
            ▼                ▼
      ┌────────────┐  ┌─────────────┐
      │  DFPlayer  │  │  AUX 1      │
      │  + MicroSD │  │             │
      └─────┬──────┘  └─────────────┘
            │ AUX 2
            ▼          ▼
      ┌─────────────────────────┐
      │    Mixer Amplifier TOA  │
      └───────────┬─────────────┘
                  ▼
          ┌───────────────┐
          │ Speaker TOA   │
          └───────────────┘
```

## 2. Prinsip Arsitektur

### Aturan Wajib
- ESP32 **TIDAK** menjadi web server.
- Supabase = backend data/control/auth/storage.
- Audio Server = komponen terpisah untuk realtime PTT audio.
- Cloudflare = public access / HTTPS / tunnel / security layer (TBD — tidak mengunci deployment final).
- Komunikasi ESP32 ke Supabase via HTTPS + REST API.
- Tidak menggunakan MQTT sebagai arsitektur utama.
- Tidak menggunakan PlatformIO — firmware menggunakan **Arduino IDE** + ESP32 Arduino Framework.
- Tidak memaksa ESP32 menjadi full WebRTC endpoint tanpa analisis terlebih dahulu.

### Komponen Utama

| Komponen | Teknologi | Peran |
|----------|-----------|-------|
| **Frontend** | React + Vite + Tailwind CSS | Dashboard untuk guru (HP/laptop) |
| **Supabase** | Auth, PostgreSQL, REST, Realtime, Storage | Data, auth, control, log, voice note metadata/storage |
| **Audio Server** | Komponen terpisah (Node.js/dll — TARGET: TBD) | Menerima & meneruskan audio realtime PTT ke ESP32 |
| **Cloudflare** | Cloudflare Tunnel (TARGET: TBD) | Public access / HTTPS / security layer |
| **Firmware** | ESP32 + Arduino Framework | Eksekusi firmware: bel, voice, PTT, relay, RTC |

## 3. Tiga Mode Audio Utama

### MODE 1 — BELL OTOMATIS
```
DS3231 (RTC)
  → ESP32 (scheduler)
  → Relay 1 + Relay 2
  → DFPlayer Mini (MicroSD)
  → AUX 2 → Mixer TOA → Speaker
```

### MODE 2 — VOICE NOTE
```
HP Guru (record)
  → Dashboard → Server/Storage
  → ESP32
  → RAM/audio buffer → decoder → I2S
  → PCM5102A → AUX 1 → Mixer TOA
  → Speaker
Setelah selesai → file sementara dihapus otomatis.
```

### MODE 3 — TWO-WAY AUDIO / PUSH-TO-TALK / INTERNET INTERCOM
```
HP Guru (microphone)
  → realtime audio stream
  → Audio Server / Audio Gateway
  → ESP32
  → audio buffer/decoder → I2S
  → PCM5102A → AUX 1 → Mixer TOA
  → Speaker
```
PTT adalah **audio realtime**, BUKAN upload file MP3.

## 4. Diagram Komunikasi

### 4.1 Dashboard → Supabase
```
Guru membuka dashboard
   │
   v
Login (Supabase Auth)
   │
   v
Dashboard membaca dan menulis data lewat Supabase SDK
```

### 4.2 ESP32 → Supabase
```
ESP32 connect WiFi
   │
   v
ESP32 authenticate dengan Supabase (device token)
   │
   v
ESP32 mengirim HEARTBEAT setiap 10 detik (REST)
   │
   v
ESP32 menulis LOG jika event terjadi (REST)
```

### 4.3 Realtime
```
ESP32 mengirim status/heartbeat
   │
   ▼
Supabase Realtime (postgres_changes)
   │
   ▼
Dashboard subscribe dan UPDATE UI otomatis
```

## 5. Alur Data

### 5.1 Alur Jadwal Bel Otomatis
```
ESP32 membaca jam dari RTC DS3231 (setiap detik, non-blocking)
   │
   ▼
Scheduler membandingkan jadwal dengan waktu sekarang
   │
   ▼
Jadwal cocok → Relay 1 ON
   │
   ▼
Tunggu 3 detik (non-blocking)
   │
   ▼
Relay 2 ON
   │
   ▼
DFPlayer memutar audio (nomor file sesuai jadwal)
   │
   ▼
BUSY DFPlayer = 0 → audio sedang diputar
   │
   ▼
BUSY DFPlayer = 1 → audio selesai
   │
   ▼
Relay 2 OFF → Relay 1 OFF
   │
   ▼
Tulis log ke Supabase
```

### 5.2 Alur Sinkronisasi Waktu
```
ESP32 boot
   │
   ▼
1. Inisialisasi RTC DS3231
2. Baca waktu RTC
3. Konek WiFi
4. Cek internet
5. Ambil waktu dari NTP
6. Bandingkan NTP dengan RTC
7. Update RTC jika selisih > threshold
8. Lanjutkan RTC sebagai scheduler
```
Jika internet mati → bel tetap berjalan (RTC). Jika kembali → sync NTP + update status.

### 5.3 Alur Voice Note
```
Guru record / upload voice note → Server/Storage (Supabase Storage)
   │
   ▼
Supabase simpan metadata di tabel `audios`
   │
   ▼
ESP32 polling command (PLAY_VOICE) → stream voice URL
   │
   ▼
Relay 1 ON + Relay 2 ON
   │
   ▼
Tunggu 3 detik (non-blocking)
   │
   ▼
PCM5102A PLAY (stream → decode → I2S → PCM5102A → AUX 1 → Mixer)
   │
   ▼
Audio selesai
   │
   ▼
Relay 2 OFF → Relay 1 OFF
   │
   ▼
File audio sementara dihapus otomatis + tulis log
```
> Voice Note **bukan** PTT — Voice Note adalah audio yang di-record/diupload lalu diputar, bukan audio realtime.

### 5.4 Alur PTT (Two-Way Audio)
Dashboard PTT memiliki **dua kontrol terpisah**:
- **Kontrol A — Relay ON/OFF**: menyalakan/mematikan relay (power mixer) secara manual.
- **Kontrol B — Push-to-Talk (Microphone)**: memulai/menghentikan aliran audio realtime.

> **PENTING:** Tombol Relay dan tombol Microphone **TIDAK boleh digabung menjadi satu kontrol.**

```
Kontrol A: Relay ON (manual) — nyalakan relay sebelum bicara
   │
   ▼
Kontrol B: Guru tekan & tahan Push-to-Talk di dashboard
   │
   ▼
Microphone HP/laptop → realtime audio transport
   │
   ▼
Audio Server / Gateway (rx audio)
   │
   ▼
Streaming → ESP32 (protokol: TBD — dianalisa saat implementasi)
   │
   ▼
ESP32 → buffer/decoder → PCM5102A → AUX 1 → Mixer TOA → Speaker
   │
   ▼
User lepas tombol PTT → audio selesai
   │
   ▼
Audio Server kirim status selesai
   │
   ▼
Kontrol A: User matikan relay (manual)
```
Teknologi/protokol realtime audio (WebRTC, WebSocket, dll) **BELUM ditentukan** — akan dipilih setelah analisis arsitektur server dan ESP32.
PTT adalah **audio realtime** — BUKAN upload/download file MP3.

### 5.5 Dashboard Controls (Home / Bell & PTT)

#### 5.5.1 Home / Bell — Kontrol Manual Relay

Dashboard page **Home / Bell** menyediakan kontrol manual:
```
Relay 1 : ON / OFF (toggle tulisan)
Relay 2 : ON / OFF (toggle tulisan)
```

> Kontrol manual **tidak menggantikan** scheduler Bell otomatis.
> Bell otomatis tetap berjalan sesuai jadwal (lihat 5.1).
> Kontrol manual berguna untuk testing / panggilan darurat.

#### 5.5.2 PTT — Kontrol Terpisah

Dashboard page **PTT** menyediakan **dua kontrol terpisah**:
```
Kontrol A : Relay ON / OFF (manual toggle) — nyalakan relay mixer
Kontrol B : Push-to-Talk (tahan untuk bicara, lepas untuk stop)
```

> Tombol Relay dan tombol Microphone/PTT tidak boleh digabung menjadi satu kontrol.
> Alur lengkap PTT ada di section 5.4.


## 6. Komponen Sistem

### 6.1 Perangkat Keras (ESP32)

| Komponen | Fungsi |
|----------|--------|
| ESP32 DevKit V1 (WROOM-32) | Pengendali utama |
| DS3231 RTC | Sumber waktu lokal (backup) |
| DFPlayer Mini + MicroSD | Pemutar MP3 bel |
| Relay 2-channel | Kontrol power mixer |
| **PCM5102A (I2S DAC)** | Konverter digital → analog untuk Voice Note & PTT |
| Mixer Amplifier TOA | Penguat audio ke speaker |

### 6.2 Perangkat Lunak (Firmware ESP32)

| Modul | Fungsi |
|-------|--------|
| `SmartSchoolBell.ino` | Entry point, loop utama non-blocking |
| `config.h` | Konfigurasi SSID/API, pin, konstanta |
| `wifi_manager` | WiFi connect + auto reconnect |
| `rtc_manager` | DS3231 + NTP sync + fallback |
| `dfplayer_manager` | Kontrol DFPlayer + status BUSY |
| `relay_manager` | Kontrol relay 1 & 2 |
| `scheduler` | Jadwal offline |
| `supabase_client` | REST API ke Supabase |
| `heartbeat` | Kirim heartbeat |
| `logger` | Log lokal + Supabase |
| `command_manager` | Baca perintah (play_audio/relay) |
| `audio_manager` | Prioritas audio: Bell / Voice / PTT (satu aktif) |
| `voice_stream` | Modul Voice Note (stream+decode+I2S) |
| `i2s_output` | Output I2S ke PCM5102A |
| `ptt_stream` (konsep) | Menerima audio realtime PTT — **protokol: TBD** |
| `utils` | Fungsi helper millis, string, parsing |

### 6.3 Audio Server (Komponen Terpisah)

| Fungsi | Keterangan |
|--------|------------|
| Menerima audio microphone dari browser/HP | Realtime |
| Menangani audio PTT | Realtime |
| Transport/streaming audio | Protokol TBD |
| Kirim audio ke ESP32 | Latency rendah |

## 7. Audio Manager & Prioritas Audio

Sistem harus memastikan **hanya satu mode audio yang aktif** pada satu waktu.

| Prioritas | Mode | Output |
|-----------|------|--------|
| 1 (tertinggi) | **PTT** | PCM5102A → AUX 1 |
| 2 | **Voice Note** | PCM5102A → AUX 1 |
| 3 | **Bell** | DFPlayer → AUX 2 |

Aturan:
- Audio Manager tidak mengizinkan dua mode audio main bersamaan.
- Misal Voice Note sedang main, PTT harus preempt atau menunggu (detail saat implementasi).
- Bell Otomatis dapat tetap berjalan melalui DFPlayer (jalur independent dari jalur Voice/PTT).

## 8. Mode Operasi

| Skenario | Perilaku |
|----------|----------|
| WiFi + Internet OK | Bell aktif via jadwal; Voice Note & PTT dapat beroperasi; heartbeat + log OK |
| WiFi OK, Internet mati | Bell tetap jalan (RTC + DFPlayer); ESP32 retry koneksi; Voice/PTT tidak bisa |
| WiFi mati | ESP32 auto reconnect, bel tetap jalan; Voice/PTT tidak bisa |
| RTC rusak | ESP32 menunggu WiFi + NTP; bel tidak main sampai waktu valid |
| DFPlayer error | Bell gagal audio, relay tetap dimungkinkan; status ERROR |
| Voice Note / PTT sedang main | Audio Manager menentukan prioritas |

## 9. Batas dan Batasan

- Laptop/HP guru = **dashboard** — BUKAN gateway/audio server.
- Audio Server dapat berjalan di VPS/laptop khusus (keputusan saat implementasi).
- Supabase tidak menangani aliran audio PTT; ia menangani kontrol/manajemen data.
- Cloudflare Tunnel TBD — mungkin untuk public access ke Audio Server.
- Internet mati → bel tetap jalan.

## 10. Evolusi Arsitektur (Roadmap)

| Fase | Fokus |
|------|-------|
| Phase 1 | Dokumentasi & arsitektur (ini) |
| Phase 2+ | Setup Supabase + dashboard + firmware WiFi |
| Nanti | Voice Note streaming, PTT + Audio Server, Cloudflare |

## 11. Referensi

- [Hardware Documentation](./hardware.md)
- [Pinout Documentation](./pinout.md)
- [Database Schema](./database.md)
- [API Contract](./api.md)
- [Realtime Architecture](./realtime.md)
- [Firmware Architecture](./firmware-architecture.md)
- [Security Architecture](./security.md)
- [Deployment](./deployment.md)