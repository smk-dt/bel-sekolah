# SMART BELL IoT - Security

## 1. Tujuan

- Melindungi data sekolah dan kontrol perangkat dari akses tidak sah.
- Memastikan ESP32 hanya berkomunikasi dengan backend yang benar.
- Memudahkan audit (siapa melakukan apa, kapan).

## 2. Lapisan Keamanan Utama

| Layer | Teknologi |
|-------|-----------|
| Authentication | Supabase Auth (JWT) |
| Authorization | Row Level Security (RLS) PostgreSQL |
| Device | API key / Service Role (tidak dari frontend) |
| HTTPS | Default dari Supabase |
| Validasi input | Frontend + DB constraints |

## 3. Role dan Principal

| Principal | Kredensial | Kemampuan |
|-----------|------------|-----------|
| Admin (guru) | Email + password → JWT via Supabase Auth | Semua data |
| ESP32 | Service Role Key | Read schedules, tulis status & logs, baca command |
| Anonim (tidak login) | anon key (RLS enabled) | tanpa akses |

> **PENTING**: Service Role Key hanya boleh dipakai di sisi server. JANGAN pernah dimasukkan ke kode frontend.

## 4. Row Level Security (RLS)

Rencana dasar per tabel:

### 4.1 `profiles`

- **SELECT**: authenticated dan row = auth.uid()
- **INSERT**: otomatis pada signup (trigger)
- **UPDATE**: pemilik

### 4.2 `devices`

- **SELECT**: authenticated (status untuk dashboard)
- **INSERT**: service_role (saat registration)
- **UPDATE**: service_role / authenticated (subset kolom)

### 4.3 `schedules`

- **SELECT**: authenticated, service_role
- **INSERT/UPDATE/DELETE**: authenticated + role admin

### 4.4 `audios`

- **SELECT**: authenticated, service_role
- **INSERT/UPDATE/DELETE**: TUTUP (data statis)

### 4.5 `logs`

- **INSERT**: authenticated dan service_role
- **SELECT**: authenticated

> Wajib: Enable RLS pada semua tabel.

## 5. Skenario Keamanan

| Situasi | Penanganan |
|---------|------------|
| User belum login | 401 |
| User bukan admin edit schedule | Ditolak RLS (403) |
| Anonim baca devices | Ditolak RLS |
| ESP32 kirim status | Menggunakan service key |
| Input tidak valid | Ditolak oleh DB constraints |

## 6. Manajemen Secret

| Secret | Tempat simpan |
|--------|---------------|
| anon key | `.env` di dashboard |
| service role key | Server-side, GitHub secret, config firmware |
| JWT Secret | Supabase built-in |

## 7. Validasi Input

- `device_id` format: SB-xxx.
- `time` hanya TIME valid.
- `activity` log di whitelist.

## 8. HTTPS & Transport

- Semua akses Supabase melalui HTTPS.
- Minimal TLS pada koneksi HTTP.

## 9. Deployment (Fase Lanjut)

- Jangan commit `.env`/key ke repo publik.
- Evaluasi penyimpanan key di flash ESP32.
- Rate limiting login (disediakan Supabase).

## 10. Referensi

- [API Contract](./api.md)
- [Database Schema](./database.md)
- [Deployment](./deployment.md)