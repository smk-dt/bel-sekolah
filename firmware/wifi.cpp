// ============================================
// SMART SCHOOL BELL IoT - WiFi Manager Implementation
// ============================================
#include <WiFi.h>
#include "wifi_manager.h"

Preferences WiFiManager::preferences;
bool WiFiManager::credentialsLoaded = false;
char WiFiManager::currentSSID[32] = {0};
unsigned long WiFiManager::lastReconnectAttempt = 0;

void WiFiManager::begin() {
    LOG_INFO("WIFI", "Initializing WiFi Manager");
    
    // Open NVS
    preferences.begin(NVS_NAMESPACE, false);
    
    // Configure WiFi
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    
    // Load saved credentials
    String ssid, password;
    if (loadCredentials(ssid, password)) {
        LOG_INFO("WIFI", "Credentials loaded from NVS");
        connect(ssid, password);
    } else {
        LOG_WARN("WIFI", "No credentials in NVS, using defaults");
        connect(WIFI_SSID_DEFAULT, WIFI_PASSWORD_DEFAULT);
    }
}

void WiFiManager::task(void* parameter) {
    LOG_INFO("WIFI", "WiFi task started");
    
    while (1) {
        if (!isConnected()) {
            ensureConnected();
        }
        
        // Update system status
        g_sysStatus.wifiConnected = isConnected();
        g_sysStatus.wifiRSSI = getRSSI();
        g_sysStatus.ipAddress = getIPAddress();
        
        if (isConnected()) {
            g_sysState = SYS_RUNNING;
            led_setState(LED_NORMAL);
        } else {
            g_sysState = SYS_WIFI_CONNECTING;
            led_setState(LED_WIFI_WAIT);
        }
        
        vTaskDelay(5000 / portTICK_PERIOD_MS);
    }
}

void WiFiManager::saveCredentials(const String& ssid, const String& password) {
    preferences.putString(NVS_KEY_SSID, ssid);
    preferences.putString(NVS_KEY_PASSWORD, password);
    LOG_INFO("WIFI", "Credentials saved to NVS");
}

bool WiFiManager::loadCredentials(String& ssid, String& password) {
    ssid = preferences.getString(NVS_KEY_SSID, "");
    password = preferences.getString(NVS_KEY_PASSWORD, "");
    
    if (ssid.length() > 0) {
        strncpy(currentSSID, ssid.c_str(), sizeof(currentSSID) - 1);
        return true;
    }
    return false;
}

bool WiFiManager::isConnected() {
    return (WiFi.status() == WL_CONNECTED);
}

String WiFiManager::getSSID() {
    return WiFi.SSID();
}

int32_t WiFiManager::getRSSI() {
    if (isConnected()) {
        return WiFi.RSSI();
    }
    return 0;
}

String WiFiManager::getIPAddress() {
    return ipToString(WiFi.localIP());
}

bool WiFiManager::connect(const String& ssid, const String& password) {
    LOG_INFO("WIFI", "Connecting to: " + ssid);
    
    // Save credentials
    saveCredentials(ssid, password);
    
    strncpy(currentSSID, ssid.c_str(), sizeof(currentSSID) - 1);
    
    WiFi.begin(ssid.c_str(), password.c_str());
    
    // Wait for connection with timeout
    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < MAX_RETRY_COUNT) {
        delay(1000);
        retries++;
        LOG_INFO("WIFI", "Connecting... attempt " + String(retries));
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        LOG_INFO("WIFI", "Connected! IP: " + getIPAddress());
        g_sysStatus.wifiConnected = true;
        g_sysStatus.ipAddress = getIPAddress();
        return true;
    } else {
        LOG_ERROR("WIFI", "Failed to connect after " + String(MAX_RETRY_COUNT) + " attempts");
        g_sysStatus.wifiConnected = false;
        return false;
    }
}

void WiFiManager::disconnect() {
    WiFi.disconnect(true);
    LOG_INFO("WIFI", "Disconnected");
}

void WiFiManager::ensureConnected() {
    unsigned long now = millis();
    
    if (now - lastReconnectAttempt < WIFI_RETRY_INTERVAL_MS) {
        return; // Too soon to retry
    }
    
    lastReconnectAttempt = now;
    
    // Load credentials and try to reconnect
    String ssid, password;
    if (loadCredentials(ssid, password)) {
        LOG_INFO("WIFI", "Reconnecting to: " + ssid);
        WiFi.reconnect();
    } else {
        LOG_WARN("WIFI", "No saved credentials, trying defaults");
        WiFi.begin(WIFI_SSID_DEFAULT, WIFI_PASSWORD_DEFAULT);
    }
}