-- ============================================
-- MIGRATION 001 - SMART SCHOOL BELL IoT
-- INCREMENTAL SCHEMA FIX (ALTER, bukan rebuild)
-- ============================================
-- CARA PAKAI:
-- 1. Buka Supabase Dashboard → SQL Editor
-- 2. Paste seluruh isi file ini
-- 3. Jalankan (Run)
--
-- CATATAN:
-- - Migration ini TIDAK menghapus tabel audios
--   (hanya melepas FK dari schedules ke audios)
-- - Jika ingin menghapus tabel audios setelah migration:
--   DROP TABLE IF EXISTS audios;
-- ============================================

-- ============================================
-- 1. FIX TABEL SCHEDULES
-- ============================================

-- 1a. Tambah device_id (untuk multi-device)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT 'bel-smpn1-01';

-- 1b. audio_id: lepaskan FK ke audios, jadikan INTEGER (track number 1-16)
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_audio_id_fkey;
ALTER TABLE schedules ALTER COLUMN audio_id TYPE INTEGER USING COALESCE(audio_id, 1)::INTEGER;
ALTER TABLE schedules ALTER COLUMN audio_id SET DEFAULT 1;
ALTER TABLE schedules ALTER COLUMN audio_id SET NOT NULL;

-- 1c. day_of_week: TEXT ('1,2,3,4,5') → INTEGER[] (ARRAY[1,2,3,4,5])
ALTER TABLE schedules ALTER COLUMN day_of_week TYPE INTEGER[]
    USING (string_to_array(regexp_replace(day_of_week, '\s', '', 'g'), ',')::INTEGER[]);
ALTER TABLE schedules ALTER COLUMN day_of_week SET DEFAULT ARRAY[1,2,3,4,5]::INTEGER[];

-- 1d. time: TIME → TEXT (format 'HH:MM' konsisten dengan firmware)
ALTER TABLE schedules ALTER COLUMN time TYPE TEXT USING TO_CHAR(time, 'HH24:MI');
ALTER TABLE schedules ALTER COLUMN time SET DEFAULT '07:00';

-- ============================================
-- 2. TAMBAH KOLOM DI ESP_STATUS
-- ============================================
ALTER TABLE esp_status ADD COLUMN IF NOT EXISTS schedule_sync_status TEXT DEFAULT 'pending';
ALTER TABLE esp_status ADD COLUMN IF NOT EXISTS last_bell_time TIMESTAMPTZ;
ALTER TABLE esp_status ADD COLUMN IF NOT EXISTS last_schedule_sync TIMESTAMPTZ;

-- ============================================
-- 3. TAMBAH KOLOM DI ESP_COMMANDS
-- ============================================
ALTER TABLE esp_commands ADD COLUMN IF NOT EXISTS params JSONB;
ALTER TABLE esp_commands ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

-- ============================================
-- 4. UPDATE heartbeat() RPC
--    Tambah 3 params sync status (dengan DEFAULT
--    agar panggilan lama 14-param tetap berfungsi)
-- ============================================
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
        free_heap, current_time, relay1_state, relay2_state,
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
        current_time = EXCLUDED.current_time,
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

-- ============================================
-- 5. UPDATE get_today_schedule() RPC
--    - Tambah p_device_id (dengan DEFAULT agar
--      panggilan lama tanpa param tetap berfungsi)
--    - Gunakan EXTRACT(ISODOW) → 1=Senin ... 7=Minggu
--      (sesuai format INTEGER[] di schedules)
--    - Tidak JOIN tabel audios (audio_id = track 1-16)
-- ============================================
CREATE OR REPLACE FUNCTION get_today_schedule(
    p_device_id TEXT DEFAULT 'bel-smpn1-01'
) RETURNS TABLE(
    id BIGINT,
    audio_id INTEGER,
    day_of_week INTEGER[],
    time TEXT,
    enabled BOOLEAN
) AS $$
DECLARE
    today_dow INTEGER;
BEGIN
    -- ISODOW: 1=Senin, 2=Selasa, ... 7=Minggu
    today_dow := EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'Asia/Jakarta');

    RETURN QUERY
    SELECT
        s.id,
        s.audio_id,
        s.day_of_week,
        s.time,
        s.enabled
    FROM schedules s
    WHERE s.enabled = true
      AND s.device_id = p_device_id
      AND today_dow = ANY(s.day_of_week)
    ORDER BY s.time ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. UPDATE update_command_status() RPC
--    Tambah update kolom executed_at
-- ============================================
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

-- ============================================
-- 7. REALTIME: tambah schedules ke publikasi
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;

-- ============================================
-- 8. INDEX untuk pencarian jadwal per device
-- ============================================
CREATE INDEX IF NOT EXISTS idx_schedules_device_id ON schedules(device_id);

-- ============================================
-- 9. TABEL YANG DIPAKAI FRONTEND SETTINGS
--    (esp_config, audio_library, app_settings)
-- ============================================

-- 9a. esp_config: pengaturan perangkat (1 baris per device)
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

-- 9b. audio_library: file audio terupload (referensi, bukan sumber bel)
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

-- 9c. app_settings: pengaturan aplikasi (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at untuk esp_config & app_settings
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

-- RLS untuk tabel baru (read/write via anon key)
ALTER TABLE esp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
