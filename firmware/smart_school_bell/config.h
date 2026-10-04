#ifndef CONFIG_H
#define CONFIG_H
#include <Arduino.h>
extern const char* WIFI_SSID;
extern const char* WIFI_PASSWORD;
extern const char* SUPABASE_URL;
extern const char* SUPABASE_ANON_KEY;
extern const char* DEVICE_ID_STR;
extern const char* DEVICE_NAME;
extern const char* FIRMWARE_VERSION;
extern const char* DEVICE_TOKEN;
#define RTC_CLK     19
#define RTC_DAT     22
#define RTC_RST     21
#define PIN_RELAY1  25
#define PIN_RELAY2  26
#define PIN_LED     2
#define PIN_STATUS_LED 13
#define PIN_EXTERNAL_BUTTON 18
#define PIN_DFPLAYER_RX  16
#define PIN_DFPLAYER_TX  17
#define PIN_BUSY         27
#define DFPLAYER_BAUD    9600
#define RELAY_ACTIVE_LOW true
#define RELAY_OFF_VALUE  (RELAY_ACTIVE_LOW ? HIGH : LOW)
#define LED_ACTIVE_LOW true
#define LED_ON_VALUE    (LED_ACTIVE_LOW ? LOW : HIGH)
#define LED_OFF_VALUE   (LED_ACTIVE_LOW ? HIGH : LOW)
#define HEARTBEAT_INTERVAL_MS        3000UL
#define COMMAND_POLL_INTERVAL_MS     2000UL
#define WIFI_RETRY_INTERVAL_MS       1000UL
#define WIFI_BOOT_TIMEOUT_MS         15000UL
#define WIFI_DISCONNECT_SETTLE_MS    250UL
#define RTC_CHECK_INTERVAL_MS        60000UL
#define HTTP_TIMEOUT_MS              10000UL
#define LOOP_DELAY_MS                10UL
#define BELL_RELAY1_DELAY_MS         3000UL
#define BELL_AUDIO_START_TIMEOUT_MS  10000UL
#define BELL_BUSY_END_CONFIRM_MS     300UL
#define BELL_AUDIO_FALLBACK_MS       5000UL
#define BELL_STOP_DELAY_MS           1000UL
#define BELL_TOTAL_TIMEOUT_MS        315000UL
#define SCHEDULE_MAX                 32
#define SCHEDULE_CHECK_INTERVAL_MS   1000UL
#define SCHEDULE_VERBOSE_DEBUG       0
#define RTC_TEST_ENABLED             0
#define RTC_RAW_TEST_ENABLED         0
#define SCHEDULE_SYNC_INTERVAL_MS    (30UL * 1000UL)
#define COMMAND_POLL_LIMIT            5
#define NTP_SYNC_INTERVAL_MS         21600000UL
#define NTP_TIMEOUT_MS               15000UL
#define NTP_SERVER                   "pool.ntp.org"
#define RTC_VALID_YEAR_MIN           2025
#define RTC_VALID_YEAR_MAX           2099
#define RTC_UTC_OFFSET_HOURS         7
#define PTT_WS_HOST                  "10.127.158.210"
#define PTT_WS_PORT                  3000
#define PTT_WS_PATH                  "/ptt"

#endif



