# SMART BELL IoT - Database Schema

## 1. Teknologi Database

- **Platform**: Supabase (PostgreSQL)
- **Alasan**: Managed PostgreSQL + REST API + Realtime + Auth terintegrasi
- **Format waktu**: TIMESTAMPTZ (UTC), ditampilkan di dashboard dalam Asia/Jakarta (WIB)

## 2. Konvensi

| Aturan | Nilai |
|--------|-------|
| Primary Key | UUID (`gen_random_uuid()`) |
| Timestamps | `created_at`, `updated_at` (TIMESTAMPTZ DEFAULT now()) |
| Nama tabel | lowercase jamak (profiles, devices, audios, schedules, logs) |
| Soft delete | Tidak digunakan untuk v1 manajemen data umum; `DELETE` untuk schedule akan hard delete |
| Format jam | `TIME` PostgreSQL (contoh `07:00:00`) |
| Hari | string lowercase: `monday` ... `sunday` |

## 2. Tabel

### 2.1 `profiles`

Berisi informasi user tambahan, terhubung ke `auth.users` Supabase.

| Kolom | Tipe | Aturan | Keterangan |
|-------|------|--------|------------|
| id | UUID | PK, FK → auth.users.id ON DELETE CASCADE | ID user |
| username | TEXT | UNIQUE, NOT NULL | Nama user login (contoh: adminsmkdt) |
| role | TEXT | NOT NULL, DEFAULT 'admin' | Hanya 'admin' untuk saat ini |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

### 2.2 `devices`

Menyimpan informasi dan status terbaru setiap ESP32.

| Kolom | Tipe | Nullable | Default | Keterangan |
|-------|------|----------|---------|------------|
| id | UUID | NO | gen_random_uuid() | PK |
| device_id | TEXT | NO | - | UNIQUE, contoh: "SB-001" |
| device_name | TEXT | NO | 'Smart Bell' | Nama perangkat |
| firmware_version | TEXT | YES | NULL | Versi firmware |
| status | TEXT | NO | 'offline' | 'online' / 'offline' |
| ip_address | TEXT | YES | NULL | IP terakhir |
| wifi_ssid | TEXT | YES | NULL | SSID terakhir |
| wifi_rssi | INTEGER | YES | NULL | RSSI dBm |
| internet_status | TEXT | NO | 'disconnected' | 'connected' / 'disconnected' |
| rtc_time | TIMESTAMPTZ | YES | NULL | Waktu RTC terakhir |
| rtc_status | TEXT | NO | 'error' | 'ok' / 'error' |
| ntp_status | TEXT | NO | 'not_synced' | 'synced' / 'not_synced' |
| dfplayer_status | TEXT | NO | 'error' | 'ok' / 'error' |
| micro_sd_status | TEXT | NO | 'error' | 'ready' / 'error' / 'not_detected' |
| relay1 | BOOLEAN | NO | false | Status relay 1 |
| relay2 | BOOLEAN | NO | false | Status relay 2 |
| bell_status | TEXT | NO | 'standby' | 'standby' / 'playing' |
| last_boot | TIMESTAMPTZ | YES | NULL | Waktu boot terakhir |
| last_seen | TIMESTAMPTZ | NO | now() | Heartbeat terakhir |
| last_ntp_sync | TIMESTAMPTZ | YES | NULL | Sync NTP terakhir |
| next_bell | TIMESTAMPTZ | YES | NULL | Jadwal berikutnya (dihitung ESP32) |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

**Index:** `device_id` UNIQUE; `status`; `last_seen`.

### 2.3 `audios`

Daftar file MP3 yang TERSEDIA di MicroSD.

| Kolom | Tipe | Nullable | Default | Keterangan |
|-------|------|----------|---------|------------|
| id | UUID | NO | gen_random_uuid() | PK |
| file_number | INTEGER | NO | - | Nomor file (1 = 0001.mp3) |
| file_name | TEXT | NO | - | Nama file "0001.mp3" |
| label | TEXT | YES | NULL | Contoh: "Bel Masuk", "Istirahat", "Test Audio" |

**Note:** Daftar audio statis karena file ada di SD Card. Tidak ada upload.

Data awal (seed):
| file_number | file_name | label |
|-------------|-----------|-------|
| 1 | 0001.mp3 | Bel 1 |
| 2 | 0002.mp3 | Bel 2 |
| 3 | 0003.mp3 | Bel 3 |
| 4 | 0004.mp3 | Bel 4 |
| 5 | 0005.mp3 | Bel 5 |
| 6 | 0006.mp3 | Bel 6 |
| 7 | 0007.mp3 | Bel 7 |
| 8 | 0008.mp3 | Test Audio |
| 9-16 | 0009-0016.mp3 | Disesuaikan |

`UNIQUE(file_number)`

### 2.4 `schedules`

Jadwal bel per hari per perangkat.

| Kolom | Tipe | Nullable | Default | Keterangan |
|-------|------|----------|---------|------------|
| id | UUID | NO | gen_random_uuid() | PK |
| device_id | UUID | NO | - | FK → devices.id |
| name | TEXT | NO | - | Nama jadwal (contoh: "Bel Masuk") |
| day | TEXT | NO | - | 'monday' ... 'sunday' |
| time | TIME | NO | - | Jam (contoh: '07:00') |
| audio_id | UUID | NO | - | FK → audios.id |
| enabled | BOOLEAN | NO | true | Aktif / nonaktif |
| created_at | TIMESTAMPTZ | NO | now() | |
| updated_at | TIMESTAMPTZ | NO | now() | |

**Index:**
- `idx_schedule_device`
- `idx_schedule_day_time` (day + time)
- FK `device_id` → ON DELETE CASCADE
- FK `audio_id` → ON DELETE RESTRICT

### 2.5 `logs`

Riwayat aktivitas.

| Kolom | Tipe | Nullable | Default | Keterangan |
|-------|------|----------|---------|------------|
| id | UUID | NO | gen_random_uuid() | PK |
| device_id | UUID | NO | - | FK → devices.id |
| activity | TEXT | NO | - | Jenis: 'bell', 'test_audio', 'relay1', 'relay2', 'wifi', 'internet', 'ntp_sync', 'rtc_error', 'dfplayer_error', 'micro_sd_error', 'boot', 'schedule_changed' ... |
| status | TEXT | NO | - | 'success' / 'failed' / 'on' / 'off' |
| description | TEXT | YES | NULL | Keterangan tambahan |
| created_at | TIMESTAMPTZ | NO | now() | |

**Index:** `idx_logs_device_created`, `idx_logs_created`.

### 2.6 `system_status` (opsional)

Berfungsi menyimpan pengaturan status agregat jika diperlukan.

Untuk v1, `system_status` tidak diwajibkan — status terkini ada di tabel `devices`.
Jika dibutuhkan nanti:
- mixer_status (BOOLEAN) — apakah mixer menyala
- last_activity

## 3. Relasi Antar Tabel

```
profiles ──► auth.users

devices ── 1:N ──► schedules (device_id)
audios  ── 1:N ──◄ schedules (audio_id)
devices ── 1:N ──► logs (device_id)
```

## 4. Aktif/Nonaktif Jadwal

Simpan `enabled BOOLEAN DEFAULT true`.
Jika jadwal dimatikan, ESP32 men-skip jadwal tersebut tanpa menghapus baris.

## 5. Perluasan (Roadmap Phase Lanjut)

- Sistem status relay control dapat dikirim langsung dari dashboard ke kolom `relay1/relay2`.
- Tambahan field `mixer_status` bila ingin menyederhanakan.
- Riwayat audio di masa depan jika perlu (belum).

## 6. Referensi

- [Architecture](./architecture.md)
- [API Contract](./api.md)
- [Security & RLS](./security.md)