// ============================================
// SMART SCHOOL BELL IoT - WiFi Manager Header
// ============================================
#ifndef WIFI_H
#define WIFI_H

#include <Arduino.h>
#include <WiFi.h>
#include <Preferences.h>
#include "config.h"
#include "utils.h"
#include "logger.h"

class WiFiManager {
public:
    static void begin();
    static void task(void* parameter);
    
    // Credentials stored in NVS
    static void saveCredentials(const String& ssid, const String& password);
    static bool loadCredentials(String& ssid, String& password);
    
    // Connection status
    static bool isConnected();
    static String getSSID();
    static int32_t getRSSI();
    static String getIPAddress();
    
    // Manual connection
    static bool connect(const String& ssid, const String& password);
    static void disconnect();
    
    // Reconnect
    static void ensureConnected();
    
private:
    static Preferences preferences;
    static bool credentialsLoaded;
    static char currentSSID[32];
    static unsigned long lastReconnectAttempt;
    static const int MAX_RETRY_COUNT = 5;
};

#endif // WIFI_H