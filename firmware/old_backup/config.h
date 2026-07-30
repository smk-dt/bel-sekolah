// ============================================
// SMART SCHOOL BELL IoT - ESP32 Configuration
// ============================================
#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ===== Device Identification =====
#define DEVICE_ID           "SMKDT001"
#define DEVICE_NAME         "Smart Bell SMK DT"
#define FIRMWARE_VERSION    "v1.0.0"

// ===== WiFi Configuration =====
#define WIFI_SSID           "YourWiFiSSID"
#define WIFI_PASSWORD       "YourWiFiPassword"
#define WIFI_TIMEOUT_MS     15000     // 15 detik timeout koneksi
#define WIFI_RECONNECT_MS   30000     // Coba reconnect setiap 30 detik

// ===== Supabase Configuration =====
#define SUPABASE_URL        "https://your-project.supabase.co"
#define SUPABASE_ANON_KEY   "your-anon-key"
#define SUPABASE_BUCKET     "audio-files"

// ===== API Endpoints (Supabase REST) =====
#define API_SCHEDULES       "/rest/v1/schedules?select=*,audios(audio_name,audio_file)&day=eq."
#define API_DEVICES         "/rest/v1/devices?device_id=eq." DEVICE_ID
#define API_DEVICE_UPDATE   "/rest/v1/devices?device_id=eq." DEVICE_ID
#define API_STATUS          "/rest/v1/system_status?device_id=eq." DEVICE_ID
#define API_STATUS_UPSERT   "/rest/v1/system_status?device_id=eq." DEVICE_ID
#define API_LOGS            "/rest/v1/logs"
#define API_AUDIOS          "/rest/v1/audios"

// ===== Pin Mapping (ESP32 Dev Kit) =====
// Relay Module (2 channel)
#define RELAY_1_PIN         26      // GPIO26 - Relay 1 (Speaker/Mixer)
#define RELAY_2_PIN         27      // GPIO27 - Relay 2 (Amplifier)

// DFPlayer Mini (Software Serial)
#define DFPLAYER_TX_PIN     17      // GPIO17 - DFPlayer RX
#define DFPLAYER_RX_PIN     16      // GPIO16 - DFPlayer TX
#define DFPLAYER_BUSY_PIN   4       // GPIO4  - DFPlayer BUSY

// RTC DS3231 (I2C)
#define RTC_SDA_PIN         21      // GPIO21 - I2C SDA
#define RTC_SCL_PIN         22      // GPIO22 - I2C SCL

// LED Indicators
#define LED_WIFI            2       // GPIO2  - WiFi status LED
#define LED_BELL            15      // GPIO15 - Bell active LED
#define LED_STATUS          32      // GPIO32 - System status LED

// Button Input
#define BTN_TEST            33      // GPIO33 - Test bell button
#define BTN_RESET           34      // GPIO34 - Reset button (input only)

// ===== Timing Constants =====
#define HEARTBEAT_INTERVAL_MS   60000    // Kirim heartbeat setiap 60 detik
#define SCHEDULE_CHECK_MS       1000     // Cek jadwal setiap 1 detik
#define NTP_SYNC_INTERVAL_MS    3600000  // Sinkronisasi NTP setiap 1 jam
#define BELL_RING_DURATION_MS   3000     // Durasi bel berbunyi (3 detik)
#define RELAY_ON_DURATION_MS    2000     // Durasi relay ON (2 detik)
#define AUDIO_PLAY_TIMEOUT_MS   30000    // Timeout pemutaran audio (30 detik)

// ===== Audio Configuration =====
#define DFPLAYER_VOLUME         25       // Volume 0-30
#define DFPLAYER_EQ_NORMAL      0        // EQ Normal
#define AUDIO_FOLDER_MAIN       1        // Folder audio utama di microSD

// ===== System Limits =====
#define MAX_SCHEDULES           100      // Maks jadwal yang bisa disimpan
#define MAX_AUDIO_FILES         50       // Maks file audio
#define WIFI_RSSI_THRESHOLD     -80      // Threshold RSSI untuk peringatan (dBm)

// ===== Debug =====
// #define DEBUG_ENABLE            // Uncomment untuk debug serial

#ifdef DEBUG_ENABLE
  #define DEBUG_PRINT(x)      Serial.print(x)
  #define DEBUG_PRINTLN(x)    Serial.println(x)
  #define DEBUG_PRINTF(x...)  Serial.printf(x)
#else
  #define DEBUG_PRINT(x)
  #define DEBUG_PRINTLN(x)
  #define DEBUG_PRINTF(x...)
#endif

// ===== EEPROM Configuration =====
#define EEPROM_SIZE             512
#define EEPROM_WIFI_SSID_ADDR   0
#define EEPROM_WIFI_PASS_ADDR   32
#define EEPROM_CONFIG_MAGIC     0xBELL

#endif // CONFIG_H