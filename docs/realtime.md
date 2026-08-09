# SMART BELL IoT - Realtime Architecture

## 1. Teknologi

- Supabase Realtime menggunakan **Postgres Changes** (CDC).
- Dashboard React subscribe ke perubahan tabel tanpa perlu WebSocket sendiri.

## 2. Event yang Di-subscribe

| Tabel | Peristiwa | Pengguna |
|-------|-----------|----------|
| `devices` | INSERT / UPDATE / DELETE | Dashboard (status device) |
| `logs` | INSERT | Dashboard (aktivitas terbaru) |
| `schedules` | INSERT / UPDATE / DELETE | Dashboard + ESP32 (ada command?) |
| `audios` | INSERT / UPDATE / DELETE | Dashboard |

## 3. Dashboard Subscribe

```
supabase
  .channel('devices-channel')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'devices' },
    (payload) => {
      // tambahkan status device card di UI
    }
  )
  .subscribe();
```

### 3.1 Filter per device (opsional)

```js
.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'devices', filter: "device_id=eq.SB-001" },
  callback
)
```

## 4. Peran ESP32

ESP32 mengirim status via **REST** (heartbeat). Ini berarti:

- ESP32 TIDAK perlu WebSocket/Socket.IO client.
- ESP32 tidak bergantung pada koneksi realtime.
- Jika koneksi putus → heartbeat tidak terkirim → dashboard menandai offline berdasarkan `last_seen`.

## 5. Mekanisme Komando (Dashboard → ESP32)

Karena ESP32 menjalankan polling REST, dua pendekatan:

- **A. Realtime**: Dashboard menulis ke tabel `devices.command_payload`; Supabase Realtime memberi sinyal ke dashboard saja. ESP32 mengambil via polling.
- **B. Polling perintah**: ESP32 melakukan GET `devices` setiap 5 detik untuk membaca kolom `command`.

Untuk v1, **solusi B (polling) lebih sederhana dan stabil** untuk ESP32.

## 5.5 Audio Server untuk PTT (Next Phase)

PTT (Two-Way Audio) adalah **audio realtime** — BUKAN upload file MP3.

- Transport audio PTT (WebRTC, WebSocket, dll) **BELUM ditentukan** (TBD).
- PTT akan berjalan melalui **Audio Server terpisah** (bukan Supabase Realtime / Postgres Changes).
- Kontrol relay PTT melalui dashboard (Kontrol A) ditulis ke `devices.command_payload` — lihat section 5.6.
- Supabase tetap menangani kontrol & status; Audio Server menangani aliran audio.
- Detail arsitektur PTT ditentukan pada fase implementasi.

## 5.6 Kontrol Relay Manual (Dashboard → ESP32)

Dashboard menyediakan kontrol relay manual yang kompatibel dengan mekanisme command polling (solusi B):

| Kontrol | Lokasi UI | Command |
|---------|-----------|---------|
| Relay 1 ON/OFF | Page Home / Bell | `relay_1_on` / `relay_1_off` |
| Relay 2 ON/OFF | Page Home / Bell | `relay_2_on` / `relay_2_off` |
| Relay ON/OFF | Page PTT (Kontrol A) | `relay_all_on` / `relay_all_off` |

### Alur

```
Dashboard toggle Relay 1 ON
      ↓
Supabase `devices.command_payload` = {"command":"relay_1_on"}
      ↓
ESP32 polling GET tiap 5 detik mendeteksi command
      ↓
ESP32 jalankan relay, set command = null, tulis log "relay" success
```

> **PENTING:** Kontrol relay manual **tidak menggantikan** scheduler Bell.
> Bell otomatis tetap berjalan sesuai jadwal; relay otomatis saat Bell tetap aktif.
> Perintah relay PTT dikirim via command payload yang sama (Kontrol A).

## 6. Deteksi Offline

Dashboard atau Edge Function dapat memeriksa `last_seen`:

```sql
select
  *,
  extract(epoch from (now() - last_seen)) as seconds_since_seen
from public.devices;
```

Jika `last_seen` > 30 detik → tampilkan OFFLINE.

> Idealnya refresh otomatis UI via Realtime `UPDATE` ketika ESP32 kembali "online".

## 7. Event Flow Contoh

### Setting Jadwal (Dashboard)

```
Admin ubah jadwal
      ↓
Supabase `schedules` UPDATE
      ↓
Realtime → Dashboard refresh
      ↓
ESP32 polling schedules (misal tiap 60 detik) → cache lokal
      ↓
Scheduler ESP32 menggunakan cache lokal
```

### Test Audio (Dashboard)

```
Admin klik "Play 0008.mp3"
      ↓
Supabase `devices.command_payload` = {"audio_id":"..."}
      ↓
ESP32 polling GET (tiap 5 detik) mendeteksi command
      ↓
ESP32 set command = null, jalankan DFPlayer("0008.mp3")
      ↓
ESP32 tulis log "test_audio" success
      ↓
Realtime `logs` INSERT → dashboard menampilkan log baru
```

## 8. Keamanan Realtime

- Realtime hanya membaca data yang diizinkan oleh RLS (lihat [security.md](./security.md)).
- ESP32 menggunakan Service Role (bukan user channel).
- Dashboard menggunakan token JWT user.

## 9. Parameter

| Kanal | Event | Tabel |
|-------|-------|-------|
| devices-updates | UPDATE | devices |
| logs-new | INSERT | logs |
| schedules-changes | INSERT/UPDATE/DELETE | schedules |
| audios-changes | INSERT/UPDATE/DELETE | audios |

## 10. Referensi

- [API Contract](./api.md)
- [Security & RLS](./security.md)
- [Database Schema](./database.md)
- [System Architecture](./architecture.md)