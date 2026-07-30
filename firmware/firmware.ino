// ============================================
// SMART SCHOOL BELL IoT - Arduino Sketch File
// ============================================
// ESP32 Based Automatic School Bell System
// 
// CARA UPLOAD KE ESP32:
// 1. Buka folder "firmware" di Arduino IDE
// 2. Pilih Board: ESP32 Dev Module
// 3. Setting:
//    - Upload Speed: 115200
//    - Flash Size: 4MB (32Mb)
//    - Partition Scheme: Default 4MB with spiffs
// 4. Install Library (via Library Manager):
//    - RTClib by Adafruit
//    - DFRobotDFPlayerMini by DFRobot
//    - ArduinoJson by Benoit Blanchon
// 5. Edit config.h: isi WiFi & Supabase credentials
// 6. Klik Upload
// ============================================
#include <Arduino.h>

// ===== Semua header firmware =====
#include "config.h"
#include "utils.h"
#include "logger.h"
#include "wifi_manager.h"
#include "rtc.h"
#include "relay.h"
#include "dfplayer.h"
#include "scheduler.h"
#include "supabase.h"
#include "heartbeat.h"

// ===== Global System State (didefinisikan di main.cpp dengan 'extern') =====
extern SystemStatus g_sysStatus;
extern SystemState g_sysState;

// ===== Task Handles (didefinisikan di main.cpp dengan 'extern') =====
extern TaskHandle_t wifiTaskHandle;
extern TaskHandle_t rtcTaskHandle;
extern TaskHandle_t relayTaskHandle;
extern TaskHandle_t dfplayerTaskHandle;
extern TaskHandle_t schedulerTaskHandle;
extern TaskHandle_t supabaseTaskHandle;
extern TaskHandle_t heartbeatTaskHandle;
extern TaskHandle_t monitorTaskHandle;
extern TaskHandle_t webTaskHandle;

// ===== Function prototypes dari main.cpp =====
extern void setupPins();
extern void printSystemInfo();
extern void createTasks();
extern void handleError(const char* module, const char* msg);
extern void taskSystemMonitor(void* parameter);
extern void taskWebServer(void* parameter);

// ============================================
// SETUP - Dipanggil sekali saat ESP32 dinyalakan
// ============================================
void setup() {
    // 1. Initialize GPIO pins first
    setupPins();
    
    // 2. Initialize LED indicator
    led_setState(LED_BOOT);
    
    // 3. Initialize Logger
    Logger::begin();
    
    LOG_INFO("MAIN", "========================================");
    LOG_INFO("MAIN", "  SMART SCHOOL BELL IoT v" FIRMWARE_VERSION);
    LOG_INFO("MAIN", "  ESP32 Automatic Bell System");
    LOG_INFO("MAIN", "========================================");
    
    // 4. Print system info
    printSystemInfo();
    
    // 5. Initialize WiFi
    led_setState(LED_WIFI_WAIT);
    WiFiManager::begin();
    
    // 6. Initialize RTC
    RTCManager::begin();
    
    // 7. Initialize Relay
    RelayManager::begin();
    
    // 8. Initialize DFPlayer
    DFPlayerManager::begin();
    
    // 9. Initialize Scheduler
    Scheduler::begin();
    
    // 10. Initialize Supabase
    SupabaseClient::begin();
    
    // 11. Initialize Heartbeat
    Heartbeat::begin();
    
    // 12. Update global status
    g_sysStatus.firmwareVersion = FIRMWARE_VERSION;
    g_sysStatus.uptimeSeconds = 0;
    
    // 13. Create FreeRTOS tasks
    createTasks();
    
    LOG_INFO("MAIN", "System initialized! Creating tasks...");
    g_sysState = SYS_RUNNING;
    led_setState(LED_NORMAL);
}

// ============================================
// LOOP - Berjalan terus setelah setup
// ============================================
void loop() {
    // ESP32 FreeRTOS - loop() runs on core 1 with lower priority
    // All tasks run via FreeRTOS scheduler, so this is mostly idle
    
    vTaskDelay(1000 / portTICK_PERIOD_MS);
    
    // Periodic log every hour
    static int watchdogCounter = 0;
    watchdogCounter++;
    
    if (watchdogCounter % 3600 == 0) {
        LOG_DEBUG("MAIN", "System alive - Uptime: " + 
                  String(Heartbeat::getUptime() / 1000) + "s, " +
                  "FreeHeap: " + String(Heartbeat::getFreeHeap()) + " bytes, " +
                  "RTC: " + RTCManager::getTimeString());
    }
}