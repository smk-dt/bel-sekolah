# SMART BELL IoT - Firmware Architecture

## 1. Platform Pengembangan

| Item | Nilai |
|------|-------|
| Board | ESP32 DevKit V1 (ESP32-WROOM-32) |
| Framework | Arduino Framework |
| IDE | Arduino IDE (ARDUINO_ESP32_DEV) |
| Bahasa | C++ (Arduino) |
| Library utama | HardwareSerial, WiFi, HTTPClient, RTClib, DFPlayerMini (DFRobot), **ESP32-AudioI2S** (untuk Voice Note & PTT) |

> Firmware dikembangkan dengan **Arduino IDE**, bukan PlatformIO.
> Modul audio streaming (PCM5102A) dikerjakan pada fase audio (sesuai roadmap).

## 2. Struktur Sketch

Untuk Arduino IDE, file `.ino` dan file pendukung `.h`/`.cpp` berada dalam satu folder:

```
SmartSchoolBell/
│
├── SmartSchoolBell.ino          ← entry point + loop utama
├── config.h                     ← konfigurasi (pin, SSID, key, dll)
│
├── wifi_manager.h
├── wifi_manager.cpp             ← WiFi connect + auto reconnect
│
├── rtc_manager.h
├── rtc_manager.cpp              ← DS3231 + NTP sync + fallback
│
├── dfplayer_manager.h
├── dfplayer_manager.cpp         ← DFPlayer + status BUSY (untuk bel)
│
├── pcm_manager.h
├── pcm_manager.cpp              ← PCM5102A (I2S) + streaming Voice Note/PTT
│
├── relay_manager.h
├── relay_manager.cpp            ← relay 1 & 2
│
├── scheduler.h
├── scheduler.cpp                ← jadwal offline dari DB cache
│
├── supabase_client.h
├── supabase_client.cpp          ← REST API (GET/POST/PATCH) ke Supabase
│
├── heartbeat.h
├── heartbeat.cpp                ← kirim status tiap 10 detik
│
├── command_manager.h
├── command_manager.cpp          ← baca perintah (play_audio/relay/voice)
│
├── logger.h
├── logger.cpp                   ← log lokal + kirim ke Supabase
│
└── utils.h
└── utils.cpp                    ← helper (millis, string, parsing)
```

## 3. Diagram Alur Utama (Loop)

```
setup():
  inisialisasi Serial
  init WiFi (retry sampai dapat IP)
  init RTC (baca DS3231)
  sync NTP (jika internet OK)
  init DFPlayer
  init PCM5102A (I2S)
  init relay
  register device ke Supabase (upsert)
  muat jadwal dari database (poll)
  mulai loop

loop():
  wifiManager.update()        // auto reconnect
  rtcManager.update()         // NTP refresh jika perlu
  scheduler.update()          // cek jadwal
  commandManager.update()     // cek perintah (5 detik)
  heartbeat.update()          // kirim status (10 detik)
  dfplayerManager.update()    // baca BUSY / selesai main (bel)
  pcmManager.update()         // streaming Voice Note/PTT (I2S)
  relayManager.update()       // kontrol mixer
  logger.flush()
  delay kecil sesuai desain (misal 10-50ms)
```

Semua `update()` non-blocking menggunakan millis dan state machine.

## 4. Modul dan Tanggung Jawab

| Modul | Tanggung jawab |
|-------|----------------|
| `SmartSchoolBell.ino` | setup + loop utama, orchestrate semua module |
| `config.h` | SSID, password, API URL, MyDeviceID, pin assignment, interval |
| `wifi_manager` | koneksi WiFi, reconnect otomatis, simpan status |
| `rtc_manager` | baca DS3231, sinkron NTP, penentu waktu, status |
| `dfplayer_manager` | inisialisasi DFPlayer, play folder track, baca BUSY (untuk bel) |
| `pcm_manager` | inisialisasi PCM5102A (I2S), streaming audio dari server, MP3 decode → I2S output |
| `relay_manager` | kontrol relay 1 & 2 (aktivasi dan deaktivasi) |
| `scheduler` | baca jadwal lokal, cocokkan waktu RTC, panggil play + relay |
| `supabase_client` | REST: fetch schedules, update device status, post logs, baca command |
| `command_manager` | mendeteksi command, jalankan `play_audio`/`relay`/`voice`, clear command |
| `heartbeat` | kirim status periodic ke Supabase (`last_seen`, dll) |
| `logger` | buat pesan log, simpan ke serial, kirim ke tabel `logs` |
| `utils` | format waktu, parsing JSON (jika dipakai), fungsi helper |

## 5. Ketergantungan Library

| Library | Fungsi | Kenapa |
|---------|--------|--------|
| `ArduinoJson` | Parsing JSON dari Supabase | Dibutuhkan untuk membaca jadwal & status |
| `RTClib` (Adafruit) | DS3231 | RTC via I2C |
| `NTPClient` | NTP sync | Sinkronisasi jam internet |
| `DFRobotDFPlayerMini` | DFPlayer kontrol | Serial UART (bel) |
| `ESP32-AudioI2S` | MP3 decode + I2S output | Voice Note & PTT (audio streaming) |
| `WiFi` / `HTTPClient` | Koneksi + REST | Koneksi dan HTTP |
| `Timezone` (opsional) | Konversi UTC → WIB | Zona waktu |

> `ArduinoJson` menghindari parsing manual JSON. Perlu memori, tapi akurasi tinggi, cocok untuk ESP32.
> `ESP32-AudioI2S` dipilih karena mendukung MP3 decode **plus** output I2S untuk PCM5102A dalam satu library. Alternatif: `libhelix-mp3` + `driver/i2s` manual, tetapi lebih kompleks dan tidak direkomendasikan untuk pemula.

## 6. Machine State Audio

### 6.1 DFPlayer (Bel Otomatis)

```
IDLE
 │
 ▼  (perintah play_audio / jadwal)
INIT_PLAY  → DFPlayer play file X
 ▼
WAITING_PLAY  (tunggu BUSY LOW)
 ▼
PLAYING (MONITOR BUSY)
 ▼
BUSY = HIGH? ──► DONE (relay off, log success)
 ▼
(possible ERROR / RETRY)
```

### 6.2 PCM5102A (Voice Note / PTT)

```
IDLE
 │
 ▼  (command voice / PLAY_VOICE)
RELAY_ON → Relay 1 ON + Relay 2 ON
 │
 ▼
DELAY 3 detik (non-blocking)
 │
 ▼
STREAM_CONNECT → ESP32 stream URL dari server (Voice URL)
 ▼
STREAMING (buffer + decode MP3 → I2S → PCM5102A)
 ▼
SELESAI / ERROR
 ▼
RELAY_OFF → Relay 2 OFF → Relay 1 OFF
 ▼
IDLE
```

> PCM5102A adalah **decoder**: menerima I2S digital, menghasilkan sinyal analog → AUX 1 → mixer.
> Voice tidak disimpan permanen di ESP32 — langsung di-stream.
> Untuk Voice Note, relay ON saat audio akan diputar dan relay OFF setelah audio selesai.
> Untuk PTT, relay dikontrol manual oleh user lewat dashboard (terpisah dari tombol microphone).

## 7. Alur Main Bel (Scheduler)

```
setiap detik:
  waktu lokal = rtcManager.getLocalTime()
  hari = waktu.getDayOfWeek()  // monday..
  jamMenit = waktu.getTimeString()  // "07:00"

  untuk setiap schedule (di cache lokal):
    if (schedule.enabled && schedule.day == hari && schedule.time == jamMenit):
      jalankan(ringBell(schedule))
```

**ringBell:**
```
1. relay1 ON
2. tunggu 3 detik (non-blocking)
3. relay2 ON
4. DFPlayer.playFolderTrack(1, schedule.audio.file)
5. tunggu BUSY LOW
6. tunggu BUSY HIGH
7. relay2 OFF
8. tunggu 1 detik
9. relay1 OFF
10. tulis log "bell" success
```

> Bel terjadwal menggunakan **DFPlayer** (jalur 2 → AUX 2 → mixer) sehingga tetap berjalan walaupun internet bermasalah.
> Voice Note/PTT menggunakan **PCM5102A** (jalur 1 → AUX 1 → mixer) dan membutuhkan koneksi server.

## 8. Buffer & Reconnect Strategy

- WiFi: auto reconnect dengan backoff (5s, 10s, 30s cap) tanpa reset.
- Supabase: HTTP dengan timeout (5-10 detik). Gagal → retry pada interval berikutnya.
- NTP: jika gagal di boot, coba lagi nanti. RTC tetap jalan.
- RTC mati → status error di log, bel tidak diputar sampai waktu valid.
- Streaming Voice: buffer kecil (~10-20 KB) di RAM; jika tersedia PSRAM, buffer dapat diperbesar.

## 9. Perkiraan Memori

| Item | Ukuran perkiraan |
|------|------------------|
| Program (flash) | 400-600 KB (bel + DFPlayer) |
| Variabel global (RAM) | 30-80 KB |
| Free heap setelah init | 200-300 KB |

> Streaming Voice menambah pemakaian RAM untuk buffer; gunakan buffer kecil yang memadai tanpa membebani heap ESP32.

## 10. Prioritas Secara Fase

1. WiFi + reconnect ✅
2. RTC + NTP + fallback
3. DFPlayer + BUSY + test audio
4. PCM5102A + I2S + test tone (TES 1-2)
5. Relay + timing mix
6. Scheduler offline (cache jadwal)
7. Supabase REST: heartbeat + log
8. Command polling (play_audio / relay / voice)
9. Voice streaming server → PCM5102A (TES 3-5)

Fase ini akan dikerjakan bertahap satu per satu.

## 11. Kesimpulan

Perangkat lunak berdiri di atas 3 tujuan:
- **Andal** saat offline (RTC + scheduler + DFPlayer/audio SD).
- **Sederhana** — satu modul satu tanggung jawab, non-blocking.
- **Terpantau** — status selalu dikirim ke Supabase dan dapat dilihat dashboard.

## 12. Referensi

- [Pinout Documentation](./pinout.md)
- [API Contract](./api.md)
- [Realtime Architecture](./realtime.md)
- [System Architecture](./architecture.md)