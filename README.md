# 🔔 Smart School Bell IoT - BEL Otomatis Sekolah

Sistem bel sekolah otomatis berbasis **ESP32** dengan integrasi **Supabase** (cloud database), **DFPlayer Mini** (pemutar audio), **RTC DS3231** (penyimpan waktu akurat), dan **Relay 2-Channel** untuk kontrol bel fisik.

---

## 📋 Fitur Utama

- ✅ **Jadwal Bel Otomatis** - Bel berbunyi otomatis sesuai jadwal yang ditentukan
- ✅ **Multi Audio** - Dukung file MP3/WAV berbeda untuk setiap jadwal (DFPlayer Mini)
- ✅ **Kontrol Bel Fisik** - Relay untuk bel sekolah konvensional
- ✅ **Real-Time Clock** - RTC DS3231 dengan sinkronisasi NTP
- ✅ **Manajemen via Web** - Atur jadwal dari browser (Web App SPA)
- ✅ **Cloud Database** - Semua data tersimpan di Supabase (PostgreSQL)
- ✅ **Multi Device** - Bisa monitor beberapa perangkat sekaligus
- ✅ **Log & Monitoring** - Catat semua aktivitas bel
- ✅ **Heartbeat & Status** - Pantau status perangkat secara real-time
- ✅ **Manual Override** - Tombol test bel fisik
- ✅ **Akses Terproteksi** - Login admin untuk manajemen jadwal

---

## 🧱 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                        ESP32 (Firmware)                      │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐  │
│  │ RTC      │  │ DFPlayer   │  │ Relay    │  │ Button   │  │
│  │ DS3231   │  │ Mini       │  │ 2-Ch     │  │ Test/Res │  │
│  └────┬─────┘  └─────┬──────┘  └────┬─────┘  └────┬─────┘  │
│       │               │              │              │       │
│  ┌────┴───────────────┴──────────────┴──────────────┴────┐  │
│  │                Scheduler (main.cpp)                    │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │              Supabase Client (REST API)                 │  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │ WiFi / Internet
┌───────────────────────────┼──────────────────────────────────┐
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │              Supabase (PostgreSQL + REST API)           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐ │  │
│  │  │ schedules│  │ audios   │  │ devices  │  │ logs  │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └───────┘ │  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│  ┌────────────────────────┴───────────────────────────────┐  │
│  │              Frontend Web App (Vercel)                  │  │
│  │  HTML + CSS + JS (Supabase JS Client)                  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Komponen Hardware

| Komponen | Fungsi | Pin ESP32 |
|----------|--------|-----------|
| **ESP32 Dev Kit** | Mikrokontroler utama | - |
| **RTC DS3231** | Penyimpan waktu akurat (baterai backup) | GPIO21 (SDA), GPIO22 (SCL) |
| **DFPlayer Mini** | Pemutar file MP3 dari microSD | GPIO16 (RX), GPIO17 (TX) |
| **Relay 2-Channel** | Kontrol bel fisik & speaker | GPIO26 (Relay1), GPIO27 (Relay2) |
| **Speaker Active** | Output audio DFPlayer | DFPlayer SPK+ / SPK- |
| **LED Indikator** | Status WiFi, Bell, System | GPIO2 (WiFi), GPIO4 (Bell), GPIO32 (Status) |
| **Push Button** | Test bell & reset | GPIO33 (Test), GPIO34 (Reset) |

### Skema Koneksi

```
ESP32                  RTC DS3231
─────                  ──────────
GPIO21 (SDA) ──────── SDA
GPIO22 (SCL) ──────── SCL
3.3V         ──────── VCC
GND          ──────── GND

ESP32                  DFPlayer Mini
─────                  ─────────────
GPIO16 (RX)  ──────── TX
GPIO17 (TX)  ──────── RX
VCC (5V)     ──────── VCC
GND          ──────── GND
GPIO18       ──────── BUSY (via resistor 1K)

DFPlayer Mini         Speaker
─────────────         ───────
SPK+          ──────── Speaker +
SPK-          ──────── Speaker -

ESP32                  Relay 2-Channel
─────                  ───────────────
GPIO26       ──────── IN1 (Bel)
GPIO27       ──────── IN2 (Speaker/Mixer)
VCC (5V)     ──────── VCC
GND          ──────── GND

*Relay: NO (Normally Open) ke perangkat bel/speaker*
*COMMON ke sumber listrik bel/speaker*
```

---

## 📁 Struktur Proyek (Part 4 - Final)

```
BEL_otomatis_sekolah/
├── firmware/                    # ESP32 Arduino Firmware (PlatformIO / Arduino IDE)
│   ├── main.cpp                 # Program utama ESP32 (FreeRTOS tasks)
│   ├── config.h                 # Konfigurasi pin, WiFi, Supabase, timing
│   ├── utils.h / utils.cpp      # LED indikator RGB + global status struct
│   ├── logger.h / logger.cpp    # Logging sistem level-info
│   ├── wifi.h / wifi.cpp        # WiFi Manager + Preferences NVS
│   ├── rtc.h / rtc.cpp          # RTC DS3231 + NTP sync
│   ├── relay.h / relay.cpp      # Relay 2-Channel + bell sequence
│   ├── dfplayer.h / dfplayer.cpp # DFPlayer Mini (Serial2 + BUSY)
│   ├── scheduler.h / scheduler.cpp # Penjadwalan bel tiap 1 detik
│   ├── supabase.h / supabase.cpp # REST client Supabase
│   └── heartbeat.h / heartbeat.cpp # Heartbeat tiap 10 detik
├── frontend/                    # Web App (Vercel SPA)
│   ├── index.html               # Halaman utama SPA
│   ├── css/style.css            # Custom styling
│   └── js/                      # JavaScript modules
│       ├── config.js            # Konfigurasi Supabase client
│       ├── auth.js              # Login/logout
│       ├── home.js              # Dashboard/Home page
│       ├── jadwal.js            # CRUD jadwal bel
│       ├── status.js            # Status monitoring
│       └── app.js               # App init & routing
├── database/
│   └── schema.sql               # SQL schema untuk Supabase (tabel + RLS + RPC)
├── vercel.json                  # Konfigurasi deploy Vercel
└── README.md                    # Dokumentasi (file ini)
```

---

## 💻 Frontend Web App

### Halaman:

1. **Login** - Autentikasi admin
2. **Dashboard** - Status perangkat & jadwal hari ini
3. **Jadwal** - CRUD jadwal bel (tambah, edit, hapus)
4. **Status** - Monitoring real-time perangkat

### Teknologi:
- HTML5 + CSS3 (Vanilla, SPA)
- JavaScript (Vanilla)
- Supabase JS Client (autentikasi & database)
- Sudah responsif (mobile-friendly)

### Deploy ke Vercel:

```bash
# 1. Clone atau upload project
# 2. Install Vercel CLI
npm install -g vercel

# 3. Deploy
vercel --prod

# 4. Set environment variables di Vercel:
#    - VITE_SUPABASE_URL
#    - VITE_SUPABASE_ANON_KEY
```

---

## 🗄️ Database (Supabase)

### Setup:

1. Buat project di [supabase.com](https://supabase.com)
2. Buka SQL Editor → copy paste `database/schema.sql` → Run
3. Catat `Project URL` dan `anon key` dari Dashboard → Settings → API

### Tabel:

- **schedules** - Jadwal bel
- **audios** - Daftar file audio
- **devices** - Perangkat ESP32
- **system_status** - Status real-time perangkat
- **logs** - Riwayat aktivitas

---

## 🔧 Firmware ESP32

### Requirements (Library Arduino):

| Library | Versi | Keterangan |
|---------|-------|------------|
| `RTClib` | by Adafruit | Driver RTC DS3231 |
| `DFRobotDFPlayerMini` | by DFRobot | Driver DFPlayer Mini |
| `ArduinoJson` | by Benoit Blanchon | Parsing JSON |
| `WiFi` | Built-in ESP32 | Koneksi WiFi |
| `HTTPClient` | Built-in ESP32 | HTTP requests |
| `WebServer` | Built-in ESP32 | Web server |
| `SoftwareSerial` | Built-in ESP32 | Serial DFPlayer |

### Konfigurasi Awal (`config.h`):

```cpp
// ===== WiFi =====
#define WIFI_SSID        "Nama WiFi"
#define WIFI_PASSWORD    "Password WiFi"

// ===== Supabase =====
#define SUPABASE_URL     "https://xxxxx.supabase.co"
#define SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIs..."
#define DEVICE_ID        "bel-smpn1-01"

// ===== Pin GPIO =====
#define RTC_SDA_PIN      21
#define RTC_SCL_PIN      22
#define RELAY_1_PIN      26
#define RELAY_2_PIN      27
#define DFPLAYER_RX_PIN  16
#define DFPLAYER_TX_PIN  17
```

### Upload Firmware:

#### PlatformIO (Rekomendasi):

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    adafruit/RTClib
    dfrobot/DFRobotDFPlayerMini
    bblanchon/ArduinoJson
    bblanchon/ArduinoJson
monitor_speed = 115200
```

#### Atau Arduino IDE:

1. Install ESP32 Board Support
2. Install libraries via Library Manager:
   - `RTClib by Adafruit`
   - `DFRobotDFPlayerMini by DFRobot`
   - `ArduinoJson by Benoit Blanchon`
3. Buka `firmware/main.cpp`
4. Setting Board: `ESP32 Dev Module`
5. Upload

---

## 🚀 Cara Penggunaan

### 1. Setup Hardware
- Rakit komponen sesuai skema koneksi
- Masukkan microSD berisi file MP3 ke DFPlayer
- Hubungkan bel ke Relay 1
- Hubungkan speaker ke Relay 2 (opsional, untuk audio pengumuman)

### 2. Setup Database
- Buat tabel di Supabase (jalankan `database/schema.sql`)
- Tambahkan data audio di tabel `audios`
- Tambahkan perangkat di tabel `devices`

### 3. Konfigurasi Firmware
- Edit `config.h`: isi WiFi SSID/password, Supabase URL/key, Device ID
- Upload ke ESP32 via USB

### 4. Deploy Web App
- Upload folder `frontend/` ke Vercel (atau hosting statis lainnya)
- Set environment variables

### 5. Atur Jadwal
- Buka web app, login sebagai admin
- Tambahkan jadwal bel (hari, jam, audio, status)

### 6. Selesai!
- ESP32 akan otomatis membunyikan bel sesuai jadwal
- Pantau status via web app

---

## 🔌 Wiring Detail Pin ESP32

| GPIO | Fungsi | Koneksi |
|------|--------|---------|
| GPIO2 | LED WiFi | Anoda LED → Resistor 220Ω → GPIO2, Katoda → GND |
| GPIO4 | LED Bell | Anoda LED → Resistor 220Ω → GPIO4, Katoda → GND |
| GPIO16 | DFPlayer TX | → DFPlayer RX |
| GPIO17 | DFPlayer RX | → DFPlayer TX (via voltage divider 5V→3.3V) |
| GPIO18 | DFPlayer BUSY | → DFPlayer BUSY (via pull-up 10K ke 3.3V) |
| GPIO21 | RTC SDA | → RTC SDA |
| GPIO22 | RTC SCL | → RTC SCL |
| GPIO26 | Relay 1 (Bell) | → Relay IN1 |
| GPIO27 | Relay 2 (Speaker) | → Relay IN2 |
| GPIO32 | LED Status | Anoda LED → Resistor 220Ω → GPIO32, Katoda → GND |
| GPIO33 | Button Test | → Push button → GND (INPUT_PULLUP) |
| GPIO34 | Button Reset | → Push button → GND (INPUT_PULLUP) |

### Catatan:
- **Voltage Divider DFPlayer**: DFPlayer TX pin output 5V, perlu stepdown ke 3.3V untuk ESP32 RX. Gunakan resistor 2.2KΩ (GND) + 4.7KΩ (TX → RX)
- **Relay**: Gunakan modul relay Active LOW. Jika relay Active HIGH, ubah logika di `relay_manager.h`
- **Power**: ESP32 bisa powered via USB 5V. Untuk produksi, gunakan power supply 5V/2A minimum

---

## 🔐 Keamanan

- **Supabase Row Level Security (RLS)**: Setiap tabel memiliki kebijakan akses
- **Autentikasi**: Login admin via Supabase Auth (email/password)
- **Anon Key**: Terbatas untuk operasi yang diizinkan (RLS)
- **Service Role Key**: Hanya untuk server-side (jika ada)
- **Device ID**: Setiap ESP32 punya ID unik

---

## 📊 Monitoring

### Real-time Status:
- **Online/Offline** perangkat
- **RTC** status & waktu
- **WiFi** signal strength (RSSI)
- **DFPlayer** connection
- **microSD** card status
- **Relay** states
- **Bell** status (ringing/standby)
- **Free heap** memory
- **Uptime** perangkat

### Log Activity:
- System startup
- WiFi connection
- NTP sync
- Bell ringing (otomatis & manual)
- Error events
- Factory reset

---

## 🔧 Troubleshooting

### ESP32 tidak connect WiFi:
- Periksa SSID & password di `config.h`
- Pastikan sinyal WiFi kuat di lokasi ESP32
- Cek indikator LED WiFi

### DFPlayer tidak terdeteksi:
- Periksa koneksi RX/TX
- Pastikan microSD terisi file MP3
- Format microSD: FAT32
- Cek power DFPlayer (5V, min 500mA)

### RTC tidak akurat:
- Periksa baterai CR2032
- Pastikan NTP sync berhasil (butuh internet)
- Cek koneksi SDA/SCL

### Bel tidak berbunyi:
- Periksa koneksi relay ke bel
- Cek power supply bel
- Pastikan jadwal aktif (status = active)
- Cek audio file di microSD

---

## 📝 Lisensi

MIT License - Silakan gunakan, modifikasi, dan distribusikan.

---

## 🤝 Kontribusi

Pull request dan saran sangat diterima! Untuk perubahan besar, buka issue dulu untuk diskusi.

---

## 📧 Kontak

Dibuat oleh tim pengembang.