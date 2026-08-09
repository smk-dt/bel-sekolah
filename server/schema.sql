-- ============================================================
-- SMART BELL IoT - Supabase PostgreSQL Schema
-- ============================================================
-- Jalankan file ini di Supabase SQL Editor
-- Isi: Tabel, Index, RLS Policies, Seed data
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES
-- Menyimpan informasi user tambahan, terhubung ke auth.users
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger: auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trigger_profiles_updated_at on public.profiles;
create trigger trigger_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ------------------- DEVICES --------------------------------
-- Menyimpan informasi dan status terbaru setiap ESP32
-- ------------------- ----------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  device_name text not null default 'Smart Bell',
  firmware_version text,
  status text not null default 'offline',
  ip_address text,
  wifi_ssid text,
  wifi_rssi integer,
  internet_status text not null default 'disconnected',
  rtc_time timestamptz,
  rtc_status text not null default 'error',
  ntp_status text not null default 'not_synced',
  dfplayer_status text not null default 'error',
  micro_sd_status text not null default 'error',
  relay1 boolean not null default false,
  relay2 boolean not null default false,
  bell_status text not null default 'standby',
  last_boot timestamptz,
  last_seen timestamptz not null default now(),
  last_ntp_sync timestamptz,
  next_bell timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_devices_status on public.devices (status);
create index if not exists idx_devices_last_seen on public.devices (last_seen);

drop trigger if exists trigger_devices_updated_at on public.devices;
create trigger trigger_devices_updated_at
  before update on public.devices
  for each row execute procedure public.handle_updated_at();

-- ------------------------------------------------------------
-- 3. AUDIOS (BELL) - METADATA SAJA
-- ============================================================
-- Daftar file MP3 yang TERSEDIA di MicroSD DFPlayer.
-- PENTING: Supabase TIDAK menyimpan file MP3 Bell.
-- File fisik ada di MicroSD DFPlayer di perangkat ESP32.
-- Tabel ini hanya referensi metadata (nomor file, nama, label).
--
-- Voice Note adalah sistem TERPISAH.
-- Storage & mekanisme Voice Note dibangun pada fase Voice Note.
-- ============================================================
create table if not exists public.audios (
  id uuid primary key default gen_random_uuid(),
  file_number integer not null unique,
  file_name text not null,
  label text
);

-- ------------------------------------------------------------
-- 4. SCHEDULES
-- Jadwal bel per hari per perangkat
-- ============================================================
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  name text not null,
  day text not null check (day in ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  time time not null,
  audio_id uuid not null references public.audios (id) on delete restrict,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_schedule_device on public.schedules (device_id);
create index if not exists idx_schedule_day_time on public.schedules (day, time);

drop trigger if exists trigger_schedules_updated_at on public.schedules;
create trigger trigger_schedules_updated_at
  before update on public.schedules
  for each row execute procedure public.handle_updated_at();

-- ------------------------------------------------------------
-- 5. LOGS
-- Riwayat aktivitas perangkat
-- ============================================================
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  activity text not null,
  status text not null,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_logs_device_created on public.logs (device_id, created_at desc);
create index if not exists idx_logs_created on public.logs (created_at desc);

-- ------------------------------------------------------------
-- RLS - ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.audios enable row level security;
alter table public.schedules enable row level security;
alter table public.logs enable row level security;

-- PROFILES: user hanya bisa baca/update profil sendiri
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- DEVICES: admin bisa baca semua, hanya service role yang insert/update
-- (ESP32 mengupdate status melalui service role / edge function)
create policy "devices_select_authenticated" on public.devices
  for select to authenticated using (true);

create policy "devices_insert_service" on public.devices
  for insert with check (true);

create policy "devices_update_service" on public.devices
  for update using (true) with check (true);

-- AUDIOS: metadata bell bisa dibaca semua user authenticated
create policy "audios_select_authenticated" on public.audios
  for select to authenticated using (true);

-- SCHEDULES: admin bisa CRUD
create policy "schedules_select_authenticated" on public.schedules
  for select to authenticated using (true);

create policy "schedules_insert_authenticated" on public.schedules
  for insert to authenticated with check (true);

create policy "schedules_update_authenticated" on public.schedules
  for update to authenticated using (true);

create policy "schedules_delete_authenticated" on public.schedules
  for delete to authenticated using (true);

-- LOGS: bisa dibaca semua user authenticated; insert via service
create policy "logs_select_authenticated" on public.logs
  for select to authenticated using (true);

create policy "logs_insert_service" on public.logs
  for insert with check (true);

-- ------------------------------------------------------------
-- SEED DATA - AUDIOS (Referensi file MP3 di MicroSD)
-- ============================================================
-- File fisik TIDAK di-upload ke Supabase.
-- Data ini hanya metadata agar dashboard menampilkan daftar bel.
-- ============================================================
insert into public.audios (file_number, file_name, label)
values
  (1,  '0001.mp3',   'Bel Masuk'),
  (2,  '0002.mp3',   'Bel 2'),
  (3,  '0003.mp3',   'Bel 3'),
  (4,  '0004.mp3',   'Bel 4'),
  (5,  '0005.mp3',   'Bel 5'),
  (6,  '0006.mp3',   'Bel 6'),
  (7,  '0007.mp3',   'Bel 7'),
  (8,  '0008.mp3',   'Test Audio'),
  (9,  '0009.mp3',   'Bel 9'),
  (10, '0010.mp3',   'Bel 10'),
  (11, '0011.mp3',   'Bel 11'),
  (12, '0012.mp3',   'Bel 12'),
  (13, '0013.mp3',   'Bel 13'),
  (14, '0014.mp3',   'Bel 14'),
  (15, '0015.mp3',   'Bel 15'),
  (16, '0016.mp3',   'Bel 16')
on conflict (file_number) do nothing;