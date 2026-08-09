# SMART BELL IoT - Deployment

## 1. Prinsip

- **Cloud-hosted backend** (Supabase) supaya server tidak mati saat laptop mati.
- **Dashboard** dapat di-deploy ke platform statis (Vercel/Netlify) atau dijalankan lokal.
- **ESP32** terhubung langsung ke Supabase via HTTPS.

Ini adalah arsitektur yang disepakati setelah diskusi. Tidak ada VPS yang harus dikelola manual.

## 2. Komponen

| Komponen | Lokasi | Cara akses |
|----------|--------|------------|
| Supabase backend | Cloud (PaaS) | URL Supabase |
| Dashboard React | Vercel / Netlify / lokal | URL public |
| ESP32 | Sekolah | Koneksi internet via WiFi |

## 3. Peran Cloudflare Tunnel

- **TIDAK DIPERLUKAN** untuk komunikasi normal (dashboard ↔ Supabase, ESP32 ↔ Supabase).
- Tidak ada server lokal yang harus diekspos ke internet.
- Jika nanti ada komponen Node.js lokal (misal **Audio Server PTT** yang butuh latensi rendah), Cloudflare Tunnel dapat menjadi opsi agar server lokal dapat diakses dari internet.

> Catatan dari diskusi: Meninggalkan trial penggunaan Node/Express lokal. Semua fungsi backend kini ditangani Supabase.
> Audio untuk **Voice Note** tetap disimpan di Supabase Storage (upload file → ESP32 stream HTTPS).
> **PTT (Two-Way Audio)** adalah pengecualian: membutuhkan **Audio Server** terpisah (fase lanjut, belum dikerjakan sekarang).

## 4. Sumber Daya

| Resource | Keterangan |
|----------|------------|
| Supabase Project | 1 project (free tier cukup untuk uji awal) |
| Domain | Opsional (pakai default `*.supabase.co` / `*.vercel.app`) |
| HTTPS | Otomatis |

## 5. Persiapan (Untuk Implementasi Phase 2+)

1. Buat akun Supabase.
2. Buat project.
3. Copy `URL`, `anon key`, dan `service role key`.
4. Jalankan SQL schema (dari `docs/database.md`).
5. Buat auth user admin.
6. Buat `.env` dashboard sesuai `.env.example`.
7. Deploy dashboard ke Vercel/Netlify (atau jalankan lokal).
8. Isi `config.h` firmware dengan URL + key; flash ke ESP32.

## 6. Langkah Implementasi Detail

(setiap fase akan lebih detail di Phase 2, 3, dst.)

| Fase | Langkah |
|------|---------|
| Phase 2-3 | Setup Supabase + SQL schema |
| Phase 4 | Dashboard lokal |
| Phase 5 | Dashboard deploy ke platform statis |
| Phase 6+ | Firmware konek Supabase |

## 7. Rollback

- Supabase: Point in time recovery (paid) / duplicate project database.
- Dashboard: Git versioning.

## 8. Monitoring

- Logs: tabel `logs` di Supabase.
- Status device: kolom `last_seen` + dashboard.
- Alerts: belum diperlukan; dapat ditambahkan via Supabase Edge Functions (fase lanjut).

## 9. Checklist Ketika Go-Live

- [ ] RLS aktif pada semua tabel
- [ ] Service role key tidak ada di frontend
- [ ] Dashboard login hanya untuk admin
- [ ] Timer RTC + jadwal terisi
- [ ] SD berisi MP3 lengkap
- [ ] Test bel via dashboard & jadwal offline

## 10. Referensi

- [System Architecture](./architecture.md)
- [API Contract](./api.md)
- [Security](./security.md)
- [Database Schema](./database.md)