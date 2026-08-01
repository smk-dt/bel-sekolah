-- ============================================
-- SMART SCHOOL BELL IoT - Database Schema (Supabase/PostgreSQL)
-- ============================================

-- ===== 1. TABEL UTAMA (existing) =====

-- Tabel schedules: menyimpan jadwal bel
-- audio_id = track number DFPlayer (1-16), file 0001.mp3 - 0016.mp3 di SD Card
-- day_of_week = array hari (1=Senin ... 7=Minggu)
-- time = format TEXT 'HH:MM' (konsisten dengan firmware)
CREATE TABLE IF NOT EXISTS schedules (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL DEFAULT 'bel-smpn1-01',
    audio_id INTEGER NOT NULL DEFAULT 1,
    day_of_week INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
    "time" TEXT NOT NULL DEFAULT '07:00',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel devices: registrasi perangkat ESP32
CREATE TABLE IF NOT EXISTS devices (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT 'School Bell',
    location TEXT DEFAULT '',
    firmware_version TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 2. TABEL BARU (Part A - Enhanced Monitoring & Remote Control) =====

-- 2a. esp_status: Latest status snapshot dari ESP32 (1 baris per device)
CREATE TABLE IF NOT EXISTS esp_status (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT UNIQUE NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    online BOOLEAN DEFAULT false,
    ip_address TEXT DEFAULT '',
    wifi_rssi INTEGER DEFAULT 0,
    uptime_seconds BIGINT DEFAULT 0,
    free_heap INTEGER DEFAULT 0,
    "current_time" TEXT DEFAULT '--:--:--',
    relay1_state BOOLEAN DEFAULT false,
    relay2_state BOOLEAN DEFAULT false,
    bell_status TEXT DEFAULT 'standby',  -- 'standby', 'ringing', 'test'
    schedules_count INTEGER DEFAULT 0,
    firmware_version TEXT DEFAULT '',
    rtc_temperature REAL DEFAULT 0,
    dfplayer_connected BOOLEAN DEFAULT false,
    schedule_sync_status TEXT DEFAULT 'pending',  -- 'pending', 'synced', 'error'
    last_bell_time TIMESTAMPTZ,
    last_schedule_sync TIMESTAMPTZ,
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: update updated_at on esp_status change
CREATE OR REPLACE FUNCTION update_esp_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_esp_status_updated_at ON esp_status;
CREATE TRIGGER trg_esp_status_updated_at
    BEFORE UPDATE ON esp_status
    FOR EACH ROW
    EXECUTE FUNCTION update_esp_status_updated_at();

-- 2b. esp_commands: Perintah remote untuk ESP32
CREATE TABLE IF NOT EXISTS esp_commands (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL,
    command TEXT NOT NULL,             -- 'test_audio', 'relay_1_on', 'relay_1_off', 'sync_schedule', etc.
    status TEXT DEFAULT 'pending',     -- 'pending', 'processing', 'done', 'failed', 'timeout'
    params JSONB,
    acked_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast polling
CREATE INDEX IF NOT EXISTS idx_esp_commands_pending
    ON esp_commands(device_id, status)
    WHERE status IN ('pending', 'processing');

-- 2c. bell_history: Riwayat bel otomatis
CREATE TABLE IF NOT EXISTS bell_history (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    schedule_id BIGINT REFERENCES schedules(id) ON DELETE SET NULL,
    "time" TEXT NOT NULL,
    track_number INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',  -- 'success', 'failed', 'skipped'
    message TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_bell_history_device
    ON bell_history(device_id, created_at DESC);

-- 2d. system_logs: Log sistem dari ESP32
CREATE TABLE IF NOT EXISTS system_logs (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    level TEXT NOT NULL DEFAULT 'info',  -- 'info', 'warn', 'error', 'debug'
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_system_logs_device_level
    ON system_logs(device_id, level, created_at DESC);

-- ===== 3. RPC FUNCTIONS (Part A) =====

-- 3a. Heartbeat: Update or insert esp_status
CREATE OR REPLACE FUNCTION heartbeat(
    p_device_id TEXT,
    p_online BOOLEAN,
    p_ip_address TEXT,
    p_wifi_rssi INTEGER,
    p_uptime BIGINT,
    p_free_heap INTEGER,
    p_current_time TEXT,
    p_relay1 BOOLEAN,
    p_relay2 BOOLEAN,
    p_bell_status TEXT,
    p_schedules_count INTEGER,
    p_firmware_version TEXT,
    p_rtc_temp REAL,
    p_dfplayer_connected BOOLEAN,
    p_schedule_sync_status TEXT DEFAULT 'pending',
    p_last_bell_time TIMESTAMPTZ DEFAULT NULL,
    p_last_schedule_sync TIMESTAMPTZ DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO esp_status (
        device_id, online, ip_address, wifi_rssi, uptime_seconds,
        free_heap, "current_time", relay1_state, relay2_state,
        bell_status, schedules_count, firmware_version,
        rtc_temperature, dfplayer_connected, last_heartbeat_at,
        schedule_sync_status, last_bell_time, last_schedule_sync
    ) VALUES (
        p_device_id, p_online, p_ip_address, p_wifi_rssi, p_uptime,
        p_free_heap, p_current_time, p_relay1, p_relay2,
        p_bell_status, p_schedules_count, p_firmware_version,
        p_rtc_temp, p_dfplayer_connected, NOW(),
        p_schedule_sync_status, p_last_bell_time, p_last_schedule_sync
    )
    ON CONFLICT (device_id) DO UPDATE SET
        online = EXCLUDED.online,
        ip_address = EXCLUDED.ip_address,
        wifi_rssi = EXCLUDED.wifi_rssi,
        uptime_seconds = EXCLUDED.uptime_seconds,
        free_heap = EXCLUDED.free_heap,
        "current_time" = EXCLUDED."current_time",
        relay1_state = EXCLUDED.relay1_state,
        relay2_state = EXCLUDED.relay2_state,
        bell_status = EXCLUDED.bell_status,
        schedules_count = EXCLUDED.schedules_count,
        firmware_version = EXCLUDED.firmware_version,
        rtc_temperature = EXCLUDED.rtc_temperature,
        dfplayer_connected = EXCLUDED.dfplayer_connected,
        last_heartbeat_at = NOW(),
        schedule_sync_status = EXCLUDED.schedule_sync_status,
        last_bell_time = EXCLUDED.last_bell_time,
        last_schedule_sync = EXCLUDED.last_schedule_sync;
END;
$$ LANGUAGE plpgsql;

-- 3b. Get pending commands for a device
CREATE OR REPLACE FUNCTION get_pending_commands(p_device_id TEXT)
RETURNS TABLE(id BIGINT, command TEXT) AS $$
BEGIN
    RETURN QUERY
    UPDATE esp_commands
    SET status = 'processing'
    WHERE id IN (
        SELECT id FROM esp_commands
        WHERE device_id = p_device_id
          AND status = 'pending'
        ORDER BY id ASC
        LIMIT 5
        FOR UPDATE SKIP LOCKED
    )
    RETURNING id, command;
END;
$$ LANGUAGE plpgsql;

-- 3c. Update command status (ACK from ESP32)
CREATE OR REPLACE FUNCTION update_command_status(
    p_command_id BIGINT,
    p_status TEXT
) RETURNS void AS $$
BEGIN
    UPDATE esp_commands
    SET status = p_status,
        acked_at = CASE WHEN p_status IN ('done', 'failed') THEN NOW() ELSE acked_at END,
        executed_at = CASE WHEN p_status IN ('done', 'failed') THEN NOW() ELSE executed_at END
    WHERE id = p_command_id;
END;
$$ LANGUAGE plpgsql;

-- 3d. Log bell event
CREATE OR REPLACE FUNCTION log_bell_event(
    p_device_id TEXT,
    p_schedule_id BIGINT,
    p_time TEXT,
    p_track_number INTEGER,
    p_status TEXT,
    p_message TEXT
) RETURNS void AS $$
BEGIN
    INSERT INTO bell_history (device_id, schedule_id, "time", track_number, status, message)
    VALUES (p_device_id, p_schedule_id, p_time, p_track_number, p_status, p_message);
END;
$$ LANGUAGE plpgsql;

-- 3e. Log system event
CREATE OR REPLACE FUNCTION log_system_event(
    p_device_id TEXT,
    p_level TEXT,
    p_module TEXT,
    p_message TEXT
) RETURNS void AS $$
BEGIN
    INSERT INTO system_logs (device_id, level, module, message)
    VALUES (p_device_id, p_level, p_module, p_message);
END;
$$ LANGUAGE plpgsql;

-- 3f. Get today's schedule (untuk device tertentu)
CREATE OR REPLACE FUNCTION get_today_schedule(
    p_device_id TEXT DEFAULT 'bel-smpn1-01'
) RETURNS TABLE(
    id BIGINT,
    audio_id INTEGER,
    day_of_week INTEGER[],
    "time" TEXT,
    enabled BOOLEAN
) AS $$
DECLARE
    today_dow INTEGER;
BEGIN
    -- ISODOW: 1=Senin, 2=Selasa, ... 7=Minggu (sesuai format INTEGER[])
    today_dow := EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Asia/Jakarta');

    RETURN QUERY
    SELECT
        s.id,
        s.audio_id,
        s.day_of_week,
        s."time",
        s.enabled
    FROM schedules s
    WHERE s.enabled = true
      AND s.device_id = p_device_id
      AND today_dow = ANY(s.day_of_week)
    ORDER BY s."time" ASC;
END;
$$ LANGUAGE plpgsql;

-- 3g. Update device status (legacy, but enhanced)
CREATE OR REPLACE FUNCTION update_device_status(
    p_device_id TEXT,
    p_online BOOLEAN,
    p_ip_address TEXT,
    p_wifi_rssi INTEGER,
    p_uptime BIGINT,
    p_free_heap INTEGER
) RETURNS void AS $$
BEGIN
    INSERT INTO esp_status (device_id, online, ip_address, wifi_rssi, uptime_seconds, free_heap)
    VALUES (p_device_id, p_online, p_ip_address, p_wifi_rssi, p_uptime, p_free_heap)
    ON CONFLICT (device_id) DO UPDATE SET
        online = EXCLUDED.online,
        ip_address = EXCLUDED.ip_address,
        wifi_rssi = EXCLUDED.wifi_rssi,
        uptime_seconds = EXCLUDED.uptime_seconds,
        free_heap = EXCLUDED.free_heap,
        last_heartbeat_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 3h. Register device (if not exists)
CREATE OR REPLACE FUNCTION register_device(
    p_device_id TEXT,
    p_name TEXT DEFAULT '',
    p_location TEXT DEFAULT '',
    p_firmware_version TEXT DEFAULT ''
) RETURNS void AS $$
BEGIN
    INSERT INTO devices (device_id, name, location, firmware_version)
    VALUES (p_device_id, p_name, p_location, p_firmware_version)
    ON CONFLICT (device_id) DO UPDATE SET
        firmware_version = EXCLUDED.firmware_version,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ===== 4. ROW LEVEL SECURITY (optional, untuk Supabase anon key) =====

-- Enable RLS on all tables
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE esp_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE esp_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE bell_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon access to RPC functions (bypass RLS via SECURITY DEFINER)
-- Note: RPC functions declared above are automatically SECURITY DEFINER
-- if created by Supabase dashboard. For raw SQL, ensure they are:

-- Example for future: secure per-device access
-- CREATE POLICY "Device can read own status"
--     ON esp_status FOR SELECT
--     USING (device_id = current_setting('app.device_id'));

-- ===== 5. SEED DATA (contoh) =====

-- Insert default device
INSERT INTO devices (device_id, name, location, firmware_version)
VALUES ('bel-smpn1-01', 'BEL Otomatis SMPN 1', 'Ruang Guru', '2.0.0')
ON CONFLICT (device_id) DO NOTHING;

-- Catatan: tidak ada tabel audios.
-- Audio berupa file 0001.mp3 - 0016.mp3 di SD Card DFPlayer.
-- Kolom schedules.audio_id = nomor track (1-16).

-- Insert sample schedules (Senin-Jumat, device bel-smpn1-01)
INSERT INTO schedules (device_id, audio_id, day_of_week, "time", enabled) VALUES
    ('bel-smpn1-01', 1, ARRAY[1,2,3,4,5], '07:00', true),   -- Bel Masuk Pagi
    ('bel-smpn1-01', 6, ARRAY[1,2,3,4,5], '07:05', true),   -- Doa Pagi
    ('bel-smpn1-01', 5, ARRAY[1,2,3,4,5], '07:10', true),   -- Indonesia Raya
    ('bel-smpn1-01', 2, ARRAY[1,2,3,4,5], '10:00', true),   -- Istirahat 1
    ('bel-smpn1-01', 3, ARRAY[1,2,3,4,5], '10:30', true),   -- Masuk Siang
    ('bel-smpn1-01', 2, ARRAY[1,2,3,4,5], '12:00', true),   -- Istirahat 2
    ('bel-smpn1-01', 3, ARRAY[1,2,3,4,5], '12:45', true),   -- Masuk Siang 2
    ('bel-smpn1-01', 4, ARRAY[1,2,3,4,5], '15:00', true)    -- Pulang
ON CONFLICT DO NOTHING;

-- ============================================
-- 2e. device_metadata: konfigurasi perangkat (key-value)
-- ============================================
CREATE TABLE IF NOT EXISTS device_metadata (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id, key)
);
ALTER TABLE device_metadata ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2f. esp_config: pengaturan perangkat (1 baris per device)
-- ============================================
CREATE TABLE IF NOT EXISTS esp_config (
    id BIGSERIAL PRIMARY KEY,
    device_id TEXT NOT NULL DEFAULT 'bel-smpn1-01',
    device_name TEXT DEFAULT 'School Bell',
    fw_version TEXT DEFAULT 'v1.0.0',
    wifi_ssid TEXT DEFAULT '',
    wifi_password TEXT DEFAULT '',
    sync_interval INTEGER DEFAULT 60,
    supabase_url TEXT DEFAULT '',
    supabase_key TEXT DEFAULT '',
    schedule_auto_sync BOOLEAN DEFAULT true,
    relay_on_bell BOOLEAN DEFAULT false,
    relay_duration INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id)
);
ALTER TABLE esp_config ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2g. audio_library: file audio terupload (referensi)
-- ============================================
CREATE TABLE IF NOT EXISTS audio_library (
    id BIGSERIAL PRIMARY KEY,
    filename TEXT DEFAULT '',
    name TEXT DEFAULT '',
    url TEXT DEFAULT '',
    size BIGINT DEFAULT 0,
    type TEXT DEFAULT '',
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE audio_library ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2h. app_settings: pengaturan aplikasi (key-value)
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Trigger updated_at untuk esp_config & app_settings
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_esp_config_updated_at ON esp_config;
CREATE TRIGGER trg_esp_config_updated_at
    BEFORE UPDATE ON esp_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. REALTIME PUBLICATION
-- ============================================

-- Sertakan tabel schedules untuk update realtime di dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;

-- ============================================
-- 7. INDEXES
-- ============================================

-- Index pencarian jadwal per device
CREATE INDEX IF NOT EXISTS idx_schedules_device_id ON schedules(device_id);