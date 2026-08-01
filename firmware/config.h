// ============================================
// SMART SCHOOL BELL IoT - Configuration
// ============================================
// Hardware: ESP32 DevKit V1 (ESP32-WROOM-32)
// Framework: Arduino with FreeRTOS
// ============================================
#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>
#include <WiFi.h>   // Global WiFi include agar tersedia di semua file

// ===== Device Identity =====
#define DEVICE_ID           "bel-smpn1-01"
#define FIRMWARE_VERSION    "2.0.0"
#define FIRMWARE_BUILD      __DATE__ " " __TIME__

// ===== WiFi Configuration (Default) =====
// Stored in Preferences (NVS) - these are fallback only
#define WIFI_SSID_DEFAULT       "wipo"
#define WIFI_PASSWORD_DEFAULT   "123456789"

// ===== Supabase Configuration =====
#define SUPABASE_URL        "https://ratkhbsmtfvuvngavqdk.supabase.co"
#define SUPABASE_ANON_KEY   "sb_publishable_2HKYCCcJ2xMgwndad5yUMA_mkdZb3_t"
#define SUPABASE_SCHEMA     "rest/v1"

// ===== Supabase Endpoints (REST + RPC) =====
// Jadwal: fetch dari tabel schedules (device_id filter)
#define SUPABASE_TABLE_SCHEDULES    SUPABASE_SCHEMA "/schedules"
// Command: poll perintah pending via RPC get_pending_commands
#define SUPABASE_RPC_COMMANDS       SUPABASE_SCHEMA "/rpc/get_pending_commands"
// Heartbeat: update status via RPC heartbeat
#define SUPABASE_RPC_HEARTBEAT      SUPABASE_SCHEMA "/rpc/heartbeat"
// Command ACK: update status via RPC update_command_status
#define SUPABASE_RPC_CMD_ACK        SUPABASE_SCHEMA "/rpc/update_command_status"
// Bell event log via RPC log_bell_event
#define SUPABASE_RPC_BELL_LOG       SUPABASE_SCHEMA "/rpc/log_bell_event"
// System log via RPC log_system_event
#define SUPABASE_RPC_SYS_LOG        SUPABASE_SCHEMA "/rpc/log_system_event"
// Register device via RPC register_device
#define SUPABASE_RPC_REGISTER       SUPABASE_SCHEMA "/rpc/register_device"

// ===== Schedule Sync (Scheduler NVS Cache) =====
// CATATAN: MAX_SCHEDULES didefinisikan sebagai static const int
// di Scheduler (scheduler.h) = 100. Jangan definisikan macro dengan
// nama yang sama di sini karena akan konflik dengan C++ member.
#define SCHEDULE_SYNC_INTERVAL_MS   300000  // 5 menit auto-resync (fallback bila command sync gagal)
#define NVS_KEY_SCHEDULES           "schedules"    // JSON array cache
#define NVS_KEY_SCHEDULE_HASH       "sched_hash"   // hash jadwal (deteksi perubahan)
#define NVS_KEY_LAST_SYNC           "last_sync"    // timestamp sync terakhir

// ===== Remote Command Constants =====
#define CMD_TEST_AUDIO          "test_audio"
#define CMD_RELAY1_ON           "relay_1_on"
#define CMD_RELAY1_OFF          "relay_1_off"
#define CMD_RELAY2_ON           "relay_2_on"
#define CMD_RELAY2_OFF          "relay_2_off"
#define CMD_SYNC_SCHEDULE       "sync_schedule"
#define CMD_RESTART             "restart"
#define CMD_GET_STATUS          "get_status"
#define CMD_STATUS_PENDING      "pending"
#define CMD_STATUS_PROCESSING   "processing"
#define CMD_STATUS_DONE         "done"
#define CMD_STATUS_FAILED       "failed"

// ===== Sync Status (dikirim ke heartbeat) =====
#define SYNC_STATUS_PENDING     "pending"
#define SYNC_STATUS_SYNCED      "synced"
#define SYNC_STATUS_ERROR       "error"

// ===== FreeRTOS Task Configuration =====
#define TASK_WIFI_PRIORITY      2
#define TASK_RTC_PRIORITY       2
#define TASK_SCHEDULER_PRIORITY 3
#define TASK_RELAY_PRIORITY     3
#define TASK_DFPLAYER_PRIORITY  3
#define TASK_HEARTBEAT_PRIORITY 1
#define TASK_SUPABASE_PRIORITY  2
#define TASK_STATUS_PRIORITY    1

#define TASK_WIFI_STACK         4096
#define TASK_RTC_STACK          3072
#define TASK_SCHEDULER_STACK    4096
#define TASK_RELAY_STACK        2048
#define TASK_DFPLAYER_STACK     3072
#define TASK_HEARTBEAT_STACK    3072
#define TASK_SUPABASE_STACK     4096
#define TASK_STATUS_STACK       2048

// ===== Timing =====
#define HEARTBEAT_INTERVAL_MS   10000   // 10 detik
#define SCHEDULE_CHECK_MS       1000    // 1 detik
#define NTP_SYNC_INTERVAL_MS    3600000 // 1 jam
#define WIFI_RETRY_INTERVAL_MS  10000   // 10 detik
#define RELAY_AUTO_OFF_MS       30000   // 30 detik safety
#define SUPABASE_FETCH_INTERVAL_MS  10000   // 10 detik fetch jadwal
#define SUPABASE_STATUS_INTERVAL_MS 5000    // 5 detik update status

// ===== DFPlayer =====
#define DFPLAYER_BAUDRATE       9600
#define AUDIO_TEST_TRACK        8       // 0008.mp3
#define AUDIO_FOLDER            1

// ===== Relay Sequence Timing (ms) =====
#define RELAY1_ON_DELAY         2000    // Relay1 ON -> tunggu 2 detik
#define RELAY2_ON_DELAY         500     // Relay2 ON -> tunggu 500ms
#define RELAY2_OFF_DELAY        1000    // Audio selesai -> Relay2 OFF -> tunggu 1 detik
#define RELAY_SEQUENCE_TIMEOUT  30000   // Safety timeout 30 detik

// ===== Pin Mapping GPIO =====
// LED RGB (RGB common cathode atau 3 LED terpisah)
#define PIN_LED_R               4       // GPIO4 - LED Red
#define PIN_LED_G               2       // GPIO2 - LED Green (built-in LED)
#define PIN_LED_B               32      // GPIO32 - LED Blue

// RTC DS3231 (I2C)
#define PIN_RTC_SDA             21      // GPIO21 - RTC SDA
#define PIN_RTC_SCL             22      // GPIO22 - RTC SCL

// DFPlayer Mini (Serial2)
#define PIN_DFPLAYER_RX         16      // GPIO16 - ESP32 RX2 -> DFPlayer TX
#define PIN_DFPLAYER_TX         17      // GPIO17 - ESP32 TX2 -> DFPlayer RX
#define PIN_DFPLAYER_BUSY       27      // GPIO27 - DFPlayer BUSY (LOW=playing)

// Relay
#define PIN_RELAY_1             25      // GPIO25 - Relay 1 (mixer power)
#define PIN_RELAY_2             26      // GPIO26 - Relay 2 (mixer audio)

// Button
#define PIN_BUTTON_TEST         33      // GPIO33 - Push button test
#define PIN_BUTTON_RESET        34      // GPIO34 - Push button reset

// NVS Preferences Namespace
#define NVS_NAMESPACE           "smart_bell"
#define NVS_KEY_SSID            "wifi_ssid"
#define NVS_KEY_PASSWORD        "wifi_pass"
#define NVS_KEY_FIRST_BOOT      "first_boot"

// ===== Debugging =====
// #define DEBUG_ENABLE

#ifdef DEBUG_ENABLE
  #define DEBUG_PRINT(...)      Serial.print(__VA_ARGS__)
  #define DEBUG_PRINTLN(...)    Serial.println(__VA_ARGS__)
  #define DEBUG_PRINTF(...)     Serial.printf(__VA_ARGS__)
#else
  #define DEBUG_PRINT(...)
  #define DEBUG_PRINTLN(...)
  #define DEBUG_PRINTF(...)
#endif

#endif // CONFIG_H