-- ============================================
-- SMART SCHOOL BELL IoT - Supabase Database Schema
-- ============================================

-- 1. TABEL PROFILES (untuk auth users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: buat profile otomatis setelah sign up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'admin')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. TABEL DEVICES
CREATE TABLE IF NOT EXISTS devices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id TEXT UNIQUE NOT NULL,
    device_name TEXT NOT NULL DEFAULT 'Smart Bell',
    status TEXT NOT NULL DEFAULT 'offline',
    firmware_version TEXT DEFAULT 'v1.0.0',
    ip_address TEXT DEFAULT '',
    wifi_name TEXT DEFAULT '',
    signal TEXT DEFAULT '',
    last_boot TIMESTAMPTZ,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL AUDIO
CREATE TABLE IF NOT EXISTS audios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    audio_name TEXT NOT NULL,
    audio_file TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data audio
INSERT INTO audios (audio_name, audio_file, description) VALUES
    ('Bel Masuk', '0001.mp3', 'Bel masuk sekolah'),
    ('Pergantian Jam 1', '0002.mp3', 'Pergantian jam pertama'),
    ('Pergantian Jam 2', '0003.mp3', 'Pergantian jam kedua'),
    ('Istirahat', '0004.mp3', 'Bel istirahat'),
    ('Masuk Setelah Istirahat', '0005.mp3', 'Bel masuk setelah istirahat'),
    ('Pulang', '0006.mp3', 'Bel pulang sekolah'),
    ('Test Audio', '0008.mp3', 'Digunakan untuk test speaker')
ON CONFLICT DO NOTHING;

-- 4. TABEL SCHEDULE (Jadwal Bel)
CREATE TABLE IF NOT EXISTS schedules (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    day TEXT NOT NULL CHECK (day IN ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
    time TIME NOT NULL,
    audio_id BIGINT NOT NULL REFERENCES audios(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_day_time UNIQUE (day, time)
);

-- 5. TABEL SYSTEM STATUS
CREATE TABLE IF NOT EXISTS system_status (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    relay1 TEXT DEFAULT 'OFF',
    relay2 TEXT DEFAULT 'OFF',
    rtc TEXT DEFAULT 'OK',
    internet TEXT DEFAULT 'Disconnected',
    wifi TEXT DEFAULT 'Disconnected',
    dfplayer TEXT DEFAULT 'Disconnected',
    micro_sd TEXT DEFAULT 'No Card',
    mixer TEXT DEFAULT 'OFF',
    bell TEXT DEFAULT 'Standby',
    rtc_time TEXT DEFAULT '',
    last_sync TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL LOGS
CREATE TABLE IF NOT EXISTS logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Success',
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL ERROR LOGS
CREATE TABLE IF NOT EXISTS error_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    error TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_schedules_day ON schedules(day);
CREATE INDEX IF NOT EXISTS idx_schedules_time ON schedules(time);
CREATE INDEX IF NOT EXISTS idx_logs_device ON logs(device_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policies: hanya authenticated users yang bisa akses
CREATE POLICY "Authenticated users can read profiles"
    ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE POLICY "Authenticated users can read devices"
    ON devices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage devices"
    ON devices FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can read audios"
    ON audios FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read schedules"
    ON schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedules"
    ON schedules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules"
    ON schedules FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete schedules"
    ON schedules FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read system_status"
    ON system_status FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage system_status"
    ON system_status FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can read logs"
    ON logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert logs"
    ON logs FOR INSERT TO service_role USING (true);

CREATE POLICY "Authenticated users can read error_logs"
    ON error_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert error_logs"
    ON error_logs FOR INSERT TO service_role USING (true);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_status_updated_at
    BEFORE UPDATE ON system_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default device on first heartbeat
CREATE OR REPLACE FUNCTION upsert_device(
    p_device_id TEXT,
    p_device_name TEXT,
    p_firmware_version TEXT,
    p_ip_address TEXT,
    p_wifi_name TEXT,
    p_signal TEXT,
    p_last_boot TIMESTAMPTZ
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO devices (device_id, device_name, firmware_version, ip_address, wifi_name, signal, last_boot, last_seen, status)
    VALUES (p_device_id, p_device_name, p_firmware_version, p_ip_address, p_wifi_name, p_signal, p_last_boot, NOW(), 'online')
    ON CONFLICT (device_id)
    DO UPDATE SET
        device_name = EXCLUDED.device_name,
        firmware_version = EXCLUDED.firmware_version,
        ip_address = EXCLUDED.ip_address,
        wifi_name = EXCLUDED.wifi_name,
        signal = EXCLUDED.signal,
        last_boot = EXCLUDED.last_boot,
        last_seen = NOW(),
        status = 'online';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;