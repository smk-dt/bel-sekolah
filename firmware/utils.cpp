// ============================================
// SMART SCHOOL BELL IoT - Utilities Implementation
// ============================================
#include <WiFi.h>
#include <esp_mac.h>
#include "utils.h"

// Use GPIO2 (LED_G) as built-in LED indicator
#define PIN_LED_BUILTIN PIN_LED_G

// ===== LED Control =====
static LEDState g_ledState = LED_OFF;
static unsigned long g_lastLedToggle = 0;
static bool g_ledOn = false;

void led_setState(LEDState state) {
    g_ledState = state;
    
    switch (state) {
        case LED_BOOT:
            // Blink cepat 100ms
            digitalWrite(PIN_LED_BUILTIN, HIGH);
            g_ledOn = true;
            g_lastLedToggle = millis();
            break;
            
        case LED_WIFI_WAIT:
            // Blink lambat 500ms
            digitalWrite(PIN_LED_BUILTIN, HIGH);
            g_ledOn = true;
            g_lastLedToggle = millis();
            break;
            
        case LED_NORMAL:
            // Menyala tetap
            digitalWrite(PIN_LED_BUILTIN, HIGH);
            g_ledOn = true;
            break;
            
        case LED_ERROR:
            // Blink cepat terus 200ms
            digitalWrite(PIN_LED_BUILTIN, HIGH);
            g_ledOn = true;
            g_lastLedToggle = millis();
            break;
            
        case LED_OFF:
            digitalWrite(PIN_LED_BUILTIN, LOW);
            g_ledOn = false;
            break;
    }
}

void led_update() {
    unsigned long now = millis();
    unsigned long interval = 0;
    
    switch (g_ledState) {
        case LED_BOOT:
            interval = 100;   // 100ms blink
            break;
        case LED_WIFI_WAIT:
            interval = 500;   // 500ms blink
            break;
        case LED_ERROR:
            interval = 200;   // 200ms blink
            break;
        case LED_NORMAL:
        case LED_OFF:
            return;  // No blinking needed
    }
    
    if (interval > 0 && now - g_lastLedToggle >= interval) {
        g_ledOn = !g_ledOn;
        digitalWrite(PIN_LED_BUILTIN, g_ledOn ? HIGH : LOW);
        g_lastLedToggle = now;
    }
}

// ===== Utility Functions =====
String ipToString(IPAddress ip) {
    String result = "";
    for (int i = 0; i < 4; i++) {
        if (i > 0) result += ".";
        result += String(ip[i]);
    }
    return result;
}

String getDeviceId() {
    // Get MAC address using ESP-IDF native API (tidak bergantung WiFi.status)
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char macStr[18];
    sprintf(macStr, "%02X:%02X:%02X:%02X:%02X:%02X",
            mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    String result = String(macStr);
    result.replace(":", "");
    return result;
}

String getFirmwareVersion() {
    return String(FIRMWARE_VERSION);
}

String getISOTimestamp() {
    // Format: 2026-07-28T23:59:59+07:00
    // Using RTC time if available
    unsigned long epoch = 0;
    
    // Try to get from global RTC time
    char buf[30];
    // We'll use a simple format
    sprintf(buf, "%sT%s+07:00", 
            g_sysStatus.rtcDate.c_str(),
            g_sysStatus.rtcTime.c_str());
    
    return String(buf);
}