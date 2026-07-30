// ============================================
// SMART SCHOOL BELL IoT - Utilities Header
// ============================================
#ifndef UTILS_H
#define UTILS_H

#include <Arduino.h>
#include "config.h"

// LED States
enum LEDState {
    LED_BOOT = 0,       // Blink cepat (boot)
    LED_WIFI_WAIT = 1,  // Blink lambat (menunggu WiFi)
    LED_NORMAL = 2,     // Menyala tetap (normal)
    LED_ERROR = 3,      // Blink cepat terus (error)
    LED_OFF = 4         // Mati
};

// System State
enum SystemState {
    SYS_BOOTING,
    SYS_WIFI_CONNECTING,
    SYS_RUNNING,
    SYS_ERROR
};

// System Status Structure
struct SystemStatus {
    bool wifiConnected;
    bool internetAvailable;
    bool rtcWorking;
    bool dfplayerConnected;
    bool sdCardReady;
    bool relay1State;
    bool relay2State;
    bool bellActive;        // Schedule bell is ringing
    bool testActive;        // Test bell is ringing
    
    int32_t wifiRSSI;
    float rtcTemp;
    String rtcTime;
    String rtcDate;
    String ipAddress;
    String deviceId;
    String firmwareVersion;
    String lastBoot;
    uint32_t freeHeap;
    uint32_t uptimeSeconds;
    int schedulesCount;         // Number of schedules loaded
    
    SystemStatus() {
        wifiConnected = false;
        internetAvailable = false;
        rtcWorking = false;
        dfplayerConnected = false;
        sdCardReady = false;
        relay1State = false;
        relay2State = false;
        bellActive = false;
        testActive = false;
        wifiRSSI = 0;
        rtcTemp = 0;
        rtcTime = "--:--:--";
        rtcDate = "---, -- --- ----";
        ipAddress = "0.0.0.0";
        deviceId = DEVICE_ID;
        firmwareVersion = FIRMWARE_VERSION;
        lastBoot = "";
        freeHeap = 0;
        uptimeSeconds = 0;
        schedulesCount = 0;
    }
};

// Global system status (extern)
extern SystemStatus g_sysStatus;
extern SystemState g_sysState;

// LED Control
void led_setState(LEDState state);
void led_update();          // Call periodically to handle blinking

// Utility Functions
String ipToString(IPAddress ip);
String formatTime(unsigned long epoch);
String formatDate(unsigned long epoch);
String getDeviceId();
String getFirmwareVersion();

// Timestamp
String getISOTimestamp();

#endif // UTILS_H