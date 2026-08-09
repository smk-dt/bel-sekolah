# SMART BELL IoT - API Contract

## 1. Pendahuluan

API disediakan oleh **Supabase** (PostgREST). Tidak ada server Express terpisah yang wajib berjalan.

- Base URL: `https://<project-ref>.supabase.co/rest/v1`
- Format: JSON
- Auth: `Authorization: Bearer <token>` (JWT/Supabase)

## 2. Autentikasi

| Skema | Keterangan |
|-------|------------|
| Dashboard | Login via Supabase Auth → session JWT |
| ESP32 | Service Role Key / Device Key (jangan dipakai dari frontend) |

> Di dokumentasi ini, `{headers}` standar untuk Supabase:
> - `apikey`: anon key / service role key
> - `Authorization`: Bearer JWT

## 3. Shared Errors

Semua endpoint dapat mengembalikan:

| Kode | Arti |
|------|------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 500 | Internal Server Error |

Error response format (Supabase):
```json
{
  "message": "Oops, something went wrong",
  "code": "PGRST301",
  "hint": null,
  "details": null
}
```

## 4. Endpoint Schedule

### 4.1 GET schedules

Ambil daftar jadwal.

**Endpoint:** `GET /rest/v1/schedules?select=*,audio:audios(*)`

**Auth:** Dashboard (admin) / ESP32 (service role)

**Query params:**
| Param | Contoh | Keterangan |
|-------|--------|------------|
| day | `eq.monday` | Filter per hari |
| enabled | `eq.true` | Hanya aktif |
| order | `time.asc` | Sorting waktu |
| device_id | `eq.<uuid>` | Filter perangkat |

**Response 200:**
```json
[
  {
    "id": "uuid",
    "device_id": "uuid",
    "name": "Bel Masuk",
    "day": "monday",
    "time": "07:00:00",
    "audio_id": "uuid",
    "enabled": true,
    "audio": {
      "id": "uuid",
      "file_number": 1,
      "file_name": "0001.mp3",
      "label": "Bel 1"
    }
  }
]
```

### 4.2 POST schedule

**Endpoint:** `POST /rest/v1/schedules`

**Auth:** **ADMIN only** (dashboard)

**Request body:**
```json
{
  "device_id": "uuid",
  "name": "Bel Masuk",
  "day": "monday",
  "time": "07:00:00",
  "audio_id": "uuid",
  "enabled": true
}
```

**Response 201:**
```json
{
  "id": "uuid",
  "device_id": "uuid",
  "name": "Bel Masuk",
  "day": "monday",
  "time": "07:00:00",
  "audio_id": "uuid",
  "enabled": true,
  "created_at": "2026-08-09T08:00:00Z",
  "updated_at": "2026-08-09T08:00:00Z"
}
```

### 4.3 PUT schedule

**Endpoint:** `PATCH /rest/v1/schedules?id=eq.<uuid>`

**Auth:** **ADMIN only** (dashboard)

**Request body (sebagian saja boleh):**
```json
{
  "name": "Bel Istirahat",
  "time": "10:00:00",
  "enabled": false
}
```

**Response 204** (no content)

### 4.4 DELETE schedule

**Endpoint:** `DELETE /rest/v1/schedules?id=eq.<uuid>`

**Auth:** **ADMIN only** (dashboard)

**Response 204** (no content)

**Error:** 409 jika masih direferensikan (tidak berlaku untuk schedule langsung).

## 5. Audio API

### 5.1 GET audios

**Endpoint:** `GET /rest/v1/audios`

**Auth:** admin / device

**Response 200:**
```json
[
  {
    "id": "uuid",
    "file_number": 1,
    "file_name": "0001.mp3",
    "label": "Bel 1"
  }
]
```

> Daftar audio statis dari MicroSD. Tidak ada upload MP3.

## 6. Device API

### 6.1 GET device status

**Endpoint:** `GET /rest/v1/devices`

**Auth:** ADMIN 

**Response 200:**
```json
[
  {
    "id": "uuid",
    "device_id": "SB-001",
    "device_name": "Smart Bell",
    "firmware_version": "1.0.0",
    "status": "online",
    "ip_address": "192.168.1.20",
    "wifi_ssid": "Sekolah-WiFi",
    "wifi_rssi": -45,
    "internet_status": "connected",
    "rtc_time": "2024-08-09T08:00:00+07:00",
    "rtc_status": "ok",
    "ntp_status": "synced",
    "dfplayer_status": "ok",
    "micro_sd_status": "ready",
    "relay1": false,
    "relay2": false,
    "bell_status": "standby",
    "last_boot": "2024-08-09T07:00:00Z",
    "last_seen": "2024-08-09T08:00:10Z",
    "last_ntp_sync": "2024-08-09T07:30:00Z",
    "next_bell": "2024-08-09T09:00:00+07:00"
  }
]
```

### 6.2 Menambahkan device (untuk ESP32 registration)

**Endpoint:** `POST /rest/v1/devices` (service role)

**Body:**
```json
{
  "device_id": "SB-001",
  "device_name": "Smart Bell"
}
```

### 6.3 Update device status (heartbeat)

**Endpoint:** `PATCH /rest/v1/devices?device_id=eq.SB-001` (service role)

**Body:**
```json
{
  "device_id": "SB-001",
  "device_name": "Smart Bell",
  "status": "online",
  "firmware_version": "1.0.0",
  "ip_address": "192.168.1.20",
  "wifi_ssid": "Sekolah-WiFi",
  "wifi_rssi": -45,
  "internet_status": "connected",
  "rtc_time": "2024-08-09T08:00:10Z",
  "rtc_status": "ok",
  "ntp_status": "synced",
  "dfplayer_status": "ok",
  "micro_sd_status": "ready",
  "relay1": false,
  "relay2": false,
  "bell_status": "standby",
  "last_seen": "2024-08-09T08:00:10Z",
  "last_ntp_sync": "2024-08-09T07:30:00Z",
  "next_bell": null,
  "last_boot": "2024-08-09T07:00:00Z"
}
```

**Response 204/200.**

## 7. Play Audio (Test)

Ini adalah kontrol yang dikirim DASHBOARD ke ESP32.

ESP32 TIDAK menerima streaming MP3. ESP32 memutar file yang SUDAH ADA di MicroSD.

**Mekanisme:** Dashboard menulis perintah ke field di `devices` (misal `command_payload`), dan ESP32 melakukan poll setiap X detik (`/rest/v1/devices?id=eq...&select=command_payload`) — atau gunakan Realtime.

- Endpoint (Realtime/db): field `command` di `devices`
- Auth: ADMIN
- Body untuk TEST AUDIO:
```json
{
  "command": "play_audio",
  "command_payload": {
    "audio_id": "<uuid 0008.mp3>"
  }
}
```
- ESP32 membaca command, eksekusi, mengosongkan field, lalu mencatat log.

### Fallback (tanpa Realtime):
ESP32 melakukan `GET /rest/v1/devices?device_id=eq.SB-001&select=command,command_payload` setiap 5 detik.

## 8. Relay Command

Dashboard mengirim perintah relay ON/OFF dengan menulis langsung ke kolom `relay1` / `relay2`:

**PATCH** `rest/v1/devices?device_id=eq.SB-001`

```json
{
  "relay1": true
}
```

ESP32 memonitor perubahan `relay1`/`relay2` (via Realtime atau polling) lalu mengaktifkan GPIO relay sesuai nilai.

**Arah kontrol semua relay didefinisikan pada fase implementasi.**

## 9. Sync Time

**Endpoint (opsional):** ESP32 bisa meminta waktu dari Supabase.

**GET** `https://<ref>.supabase.co/rest/v1/select` atau panggil RPC:

```sql
select now();
```

ESP32 hanya membaca sebagai referensi (bukan sumber utama); sumber utama waktu lokal (RTC + NTP).

## 10. Log API

### 10.1 POST log

**Endpoint** `POST /rest/v1/logs`

**Auth:** device / admin

**Body:**
```json
{
  "device_id": "uuid",
  "activity": "bell",
  "status": "success",
  "description": "Bel jadwal 07:00 diputar"
}
```

### 10.2 GET logs

**Endpoint:** `GET /rest/v1/logs?order=created_at.desc&limit=100`

**Auth:** admin

**Response 200:**
```json
[
  {
    "id": "uuid",
    "device_id": "uuid",
    "activity": "bell",
    "status": "success",
    "description": "Bel jadwal 07:00 diputar",
    "created_at": "2024-08-09T07:00:05Z"
  }
]
```

## 11. Error Codes Umum

| Kode | Situasi |
|------|---------|
| PGRST204 | Tidak ada baris ditemukan (untuk PATCH) |
| 23505 | Duplikat (unique violation) |
| PGRST301 | Unexpected error |

## 12. Keterangan

- Tidak ada endpoint `/login` manual — login via Supabase Auth (email/username mapping).
- Tidak ada endpoint streaming MP3 — audio selalu dari MicroSD DFPlayer.
- Setiap perubahan table `devices`/`schedules` juga dapat di-subscribe via Realtime (lihat [realtime.md](./realtime.md)).

## 13. Referensi

- [Database Schema](./database.md)
- [Realtime Architecture](./realtime.md)
- [Security & RLS](./security.md)