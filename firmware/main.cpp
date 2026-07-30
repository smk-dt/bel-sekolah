// ============================================
// SMART SCHOOL BELL IoT - Supporting Functions
// ============================================
// NOTE: Entry point (setup/loop) is in firmware.ino
// This file contains global definitions and supporting functions
// ============================================
#include <Arduino.h>
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

// ===== Global System State =====
SystemStatus g_sysStatus;
SystemState g_sysState = SYS_BOOTING;

// ===== Forward Declarations =====
void taskSystemMonitor(void* parameter);
void taskWebServer(void* parameter);

// ===== FreeRTOS Task Handles =====
TaskHandle_t wifiTaskHandle = NULL;
TaskHandle_t rtcTaskHandle = NULL;
TaskHandle_t relayTaskHandle = NULL;
TaskHandle_t dfplayerTaskHandle = NULL;
TaskHandle_t schedulerTaskHandle = NULL;
TaskHandle_t supabaseTaskHandle = NULL;
TaskHandle_t heartbeatTaskHandle = NULL;
TaskHandle_t monitorTaskHandle = NULL;
TaskHandle_t webTaskHandle = NULL;

// ============================================
// FreeRTOS Task Creation
// ============================================
void createTasks() {
    // Priority levels (higher number = higher priority):
    // 3: System Monitor
    // 2: Relay, DFPlayer (critical timing)
    // 1: WiFi, RTC, Scheduler, Supabase
    // 0: Heartbeat, WebServer
    
    LOG_INFO("MAIN", "Creating FreeRTOS tasks...");
    
    // High Priority Tasks (critical timing)
    xTaskCreatePinnedToCore(
        RelayManager::task,      // Task function
        "RelayTask",             // Name
        2048,                    // Stack size (words)
        NULL,                    // Parameters
        2,                       // Priority
        &relayTaskHandle,        // Task handle
        1                        // Core (1 = APP)
    );
    
    xTaskCreatePinnedToCore(
        DFPlayerManager::task,
        "DFPlayerTask",
        2048,
        NULL,
        2,
        &dfplayerTaskHandle,
        1
    );
    
    // Medium Priority Tasks
    xTaskCreatePinnedToCore(
        WiFiManager::task,
        "WiFiTask",
        4096,
        NULL,
        1,
        &wifiTaskHandle,
        0  // Core 0 (PRO)
    );
    
    xTaskCreatePinnedToCore(
        RTCManager::task,
        "RTCTask",
        2048,
        NULL,
        1,
        &rtcTaskHandle,
        1
    );
    
    xTaskCreatePinnedToCore(
        Scheduler::task,
        "SchedulerTask",
        4096,
        NULL,
        1,
        &schedulerTaskHandle,
        1
    );
    
    xTaskCreatePinnedToCore(
        SupabaseClient::task,
        "SupabaseTask",
        8192,  // Larger stack for HTTP/JSON
        NULL,
        1,
        &supabaseTaskHandle,
        0
    );
    
    // Low Priority Tasks
    xTaskCreatePinnedToCore(
        Heartbeat::task,
        "HeartbeatTask",
        2048,
        NULL,
        0,
        &heartbeatTaskHandle,
        0
    );
    
    // System Monitor Task
    xTaskCreatePinnedToCore(
        taskSystemMonitor,
        "MonitorTask",
        2048,
        NULL,
        3,  // Highest priority for monitoring
        &monitorTaskHandle,
        0
    );
    
    // Web Server Task (for OTA/Config)
    xTaskCreatePinnedToCore(
        taskWebServer,
        "WebTask",
        4096,
        NULL,
        0,
        &webTaskHandle,
        0
    );
    
    LOG_INFO("MAIN", "All " + String(9) + " tasks created successfully");
}

// ============================================
// System Monitor Task (Highest Priority)
// ============================================
void taskSystemMonitor(void* parameter) {
    LOG_INFO("MONITOR", "System monitor task started");
    
    TickType_t lastWakeTime = xTaskGetTickCount();
    const TickType_t frequency = pdMS_TO_TICKS(10000); // 10 seconds
    
    while (1) {
        vTaskDelayUntil(&lastWakeTime, frequency);
        
        // Check task stack usage
        if (wifiTaskHandle != NULL) {
            UBaseType_t highWaterMark = uxTaskGetStackHighWaterMark(wifiTaskHandle);
            if (highWaterMark < 512) {
                LOG_WARN("MONITOR", "WiFiTask stack low: " + String(highWaterMark) + " words");
            }
        }
        
        if (supabaseTaskHandle != NULL) {
            UBaseType_t highWaterMark = uxTaskGetStackHighWaterMark(supabaseTaskHandle);
            if (highWaterMark < 1024) {
                LOG_WARN("MONITOR", "SupabaseTask stack low: " + String(highWaterMark) + " words");
            }
        }
        
        // Check system state
        if (g_sysState == SYS_ERROR) {
            LOG_ERROR("MONITOR", "System in ERROR state, attempting recovery...");
            led_setState(LED_ERROR);
            // Recovery: reset to running state
            g_sysState = SYS_RUNNING;
        }
        
        // Update system status fields
        g_sysStatus.uptimeSeconds = millis() / 1000;
        g_sysStatus.freeHeap = ESP.getFreeHeap();
    }
}

// ============================================
// Web Server Task (for OTA/WiFi Config Portal)
// ============================================
void taskWebServer(void* parameter) {
    LOG_INFO("WEB", "Web server task placeholder");
    
    // This task is reserved for future implementation of:
    // - WiFi Configuration Portal (AP mode)
    // - OTA Updates
    // - Device Admin Panel
    // - Real-time Monitoring web interface
    
    while (1) {
        vTaskDelay(10000 / portTICK_PERIOD_MS);
        
        // Placeholder: Check if we need to start AP mode for config
        // if (digitalRead(PIN_CONFIG_BUTTON) == LOW) {
        //     startConfigPortal();
        // }
    }
}

// ============================================
// GPIO Pin Setup
// ============================================
void setupPins() {
    // Relay outputs
    pinMode(PIN_RELAY_1, OUTPUT);
    pinMode(PIN_RELAY_2, OUTPUT);
    digitalWrite(PIN_RELAY_1, LOW);
    digitalWrite(PIN_RELAY_2, LOW);
    
    // LED indicator
    pinMode(PIN_LED_R, OUTPUT);
    pinMode(PIN_LED_G, OUTPUT);
    pinMode(PIN_LED_B, OUTPUT);
    digitalWrite(PIN_LED_R, LOW);
    digitalWrite(PIN_LED_G, LOW);
    digitalWrite(PIN_LED_B, LOW);
    
    // DFPlayer BUSY input
    pinMode(PIN_DFPLAYER_BUSY, INPUT_PULLUP);
    
    LOG_DEBUG("PINS", "GPIO pins initialized");
}

// ============================================
// System Information Display
// ============================================
void printSystemInfo() {
    LOG_INFO("MAIN", "Chip Model: " + String(ESP.getChipModel()));
    LOG_INFO("MAIN", "Chip Revision: v" + String(ESP.getChipRevision()));
    LOG_INFO("MAIN", "CPU Frequency: " + String(ESP.getCpuFreqMHz()) + " MHz");
    LOG_INFO("MAIN", "Flash Size: " + String(ESP.getFlashChipSize() / 1024 / 1024) + " MB");
    LOG_INFO("MAIN", "PSRAM: " + String(ESP.getPsramSize() / 1024 / 1024) + " MB");
    LOG_INFO("MAIN", "Free Heap: " + String(ESP.getFreeHeap()) + " bytes");
    LOG_INFO("MAIN", "Arduino Version: " + String(ARDUINO));
    LOG_INFO("MAIN", "SDK Version: " + String(ESP.getSdkVersion()));
}

// ============================================
// Error Handler
// ============================================
void handleError(const char* module, const char* msg) {
    g_sysState = SYS_ERROR;
    led_setState(LED_ERROR);
    LOG_ERROR(module, msg);
    
    // In production, could trigger hardware reset after some delay
    // if (millis() > 30000) {
    //     ESP.restart();
    // }
}