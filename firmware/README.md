# SMART BELL IoT - Firmware ESP32 (Phase 7)

Firmware dasar ESP32 DevKit V1: WiFi, DS3231 RTC, Relay 2-ch, dan
komunikasi HTTPS/REST ke Supabase (registration + heartbeat).

## Kebutuhan

| Item | Keterangan |
|------|------------|
| Board | ESP32 DevKit V1 (ESP32-WROOM-32) - board **"ESP32 Dev Module"** |
| Arduino IDE | 2.x |
| Board package | `esp32` by Espressif Systems (Boards Manager) |
| Library | `RTClib` (Adafruit) via Library Manager |

## Setup Arduino IDE

1. **Boards Manager URL** (File -> Preferences -> Additional boards manager URLs):
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
2. **Tools -> Board -> Boards Manager** - install `esp32 by Espressif Systems`.
3. **Sketch -> Include Library -> Manage Libraries** - install `RTClib` (Adafruit).
4. Pilih board **ESP32 Dev Module**, pilih port COM yang benar.
5. Buka `smart_school_bell.ino`, isi konfigurasi, **Verify** (compile), lalu **Upload**.
6. Serial Monitor: **115200 baud**.

## Konfigurasi (di dalam `.ino`)

| Konstanta | Keterangan |
|-----------|------------|
| `WIFI_SSID` / `WIFI_PASSWORD` | Placeholder - isi credential milik user |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key Supabase (bukan service_role) |
| `DEVICE_ID_STR` | Contoh `SB-001` (UNIQUE di `devices.device_id`) |
| `DEVICE_NAME` | Nama perangkat (`devices.device_name`) |
| `RELAY_ACTIVE_LOW` | `true` utk modul relay aktif-LOW, `false` utk aktif-HIGH |
| `RTC_UTC_OFFSET_HOURS` | Offset RTC terhadap UTC (WIB = 7) |

> JANGAN commit credential asli ke Git. Jangan gunakan service_role key.

## Wiring (sesuai `docs/pinout.md`)

| GPIO | Ke | Keterangan |
|------|----|-----------|
| 21 (SDA) | DS3231 SDA | I2C |
| 22 (SCL) | DS3231 SCL | I2C |
| 25 | Relay 1 IN | |
| 26 | Relay 2 IN | |
| 2 | LED onboard | Indikator WiFi |

Relay modul umumnya aktif-LOW; pastikan input relay tidak mengambang saat
ESP32 boot (resistor pull tersedia di modul) agar relay aman OFF.

## Perintah Serial (115200)

| Perintah | Fungsi |
|----------|--------|
| `R1 ON` / `R1 OFF` | Relay 1 |
| `R2 ON` / `R2 OFF` | Relay 2 |
| `ALL ON` / `ALL OFF` | Semua relay |
| `STATUS` | Status lengkap (WiFi, RTC, relay, supabase) |
| `HELP` | Daftar perintah |

## Alur Supabase

1. **Boot** -> `POST /rest/v1/devices` upsert dengan header
   `Prefer: resolution=merge-duplicates` (INSERT, atau UPDATE saat `device_id`
   sudah terdaftar). Nama kolom mengikuti `server/schema.sql`.
2. **Heartbeat** tiap 30 detik -> `PATCH /rest/v1/devices?device_id=eq.SB-001`
   (status, ip, rssi, rtc_time, relay1/2, last_seen).
3. Credential: **anon key** - kebijakan RLS saat ini mengizinkan INSERT/UPDATE
   `devices` (tanpa pembatasan role). Tidak memakai service_role.
4. TLS: `setInsecure()` (tanpa cert pinning) untuk dev; untuk produksi, pin CA
   cert Supabase.

## Limitasi / Catatan Phase 7

- **Insert log ke tabel `logs` BELUM dikirim** - kolom `logs.device_id` adalah
  FK UUID ke `devices.id`, sedangkan RLS saat ini melarang anon role melakukan
  `SELECT devices` (policy `devices_select_authenticated` hanya untuk
  `authenticated`). Diperlukan service role / edge function / RLS baru pada
  fase security-backend.
- Kolom `command` / `command_payload` belum ada di `schema.sql` - command
  polling menyusul fase berikutnya.
- Belum ada DFPlayer, PCM5102A, scheduler bel offline, maupun NTP sync.
- `internet_status` merefleksikan keberhasilan request terakhir ke Supabase.

## Testing

1. Upload -> periksa log boot lengkap (RELAY -> RTC -> WIFI -> SUPABASE).
2. Serial `STATUS` -> cek WiFi/RTC/relay.
3. `R1 ON`, `R1 OFF`, `R2 ON`, `R2 OFF` -> dengar klik relay.
4. Dashboard / tabel `devices`: baris `SB-001` terisi, `last_seen` ter-update
   tiap ±30 detik.