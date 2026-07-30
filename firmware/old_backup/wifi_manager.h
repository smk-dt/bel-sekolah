// ============================================
// SMART SCHOOL BELL IoT - WiFi Manager
// ============================================
#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"

class WiFiManager {
private:
    String ssid;
    String password;
    unsigned long lastReconnectAttempt;
    bool _connected;

public:
    WiFiManager() : ssid(WIFI_SSID), password(WIFI_PASSWORD), 
                    lastReconnectAttempt(0), _connected(false) {}
    
    // Connect to WiFi
    bool connect() {
        DEBUG_PRINT("[WiFi] Connecting to: ");
        DEBUG_PRINTLN(ssid);
        
        digitalWrite(LED_WIFI, LOW);
        
        WiFi.mode(WIFI_STA);
        WiFi.begin(ssid.c_str(), password.c_str());
        
        unsigned long startTime = millis();
        while (WiFi.status() != WL_CONNECTED) {
            delay(500);
            DEBUG_PRINT(".");
            
            if (millis() - startTime > WIFI_TIMEOUT_MS) {
                DEBUG_PRINTLN("\n[WiFi] Connection timeout!");
                _connected = false;
                digitalWrite(LED_WIFI, LOW);
                return false;
            }
        }
        
        DEBUG_PRINTLN("\n[WiFi] Connected!");
        DEBUG_PRINT("[WiFi] IP Address: ");
        DEBUG_PRINTLN(WiFi.localIP());
        DEBUG_PRINT("[WiFi] RSSI: ");
        DEBUG_PRINTLN(WiFi.RSSI());
        
        _connected = true;
        digitalWrite(LED_WIFI, HIGH);
        return true;
    }
    
    // Check and maintain connection
    bool maintain() {
        if (WiFi.status() != WL_CONNECTED) {
            if (millis() - lastReconnectAttempt > WIFI_RECONNECT_MS) {
                DEBUG_PRINTLN("[WiFi] Reconnecting...");
                lastReconnectAttempt = millis();
                WiFi.disconnect();
                _connected = connect();
                return _connected;
            }
            _connected = false;
            return false;
        }
        _connected = true;
        return true;
    }
    
    // Check if connected
    bool isConnected() {
        return _connected && WiFi.status() == WL_CONNECTED;
    }
    
    // Get RSSI
    int getRSSI() {
        if (isConnected()) {
            return WiFi.RSSI();
        }
        return 0;
    }
    
    // Get local IP
    String getLocalIP() {
        return WiFi.localIP().toString();
    }
    
    // Disconnect
    void disconnect() {
        WiFi.disconnect(true);
        WiFi.mode(WIFI_OFF);
        _connected = false;
        digitalWrite(LED_WIFI, LOW);
    }
    
    // Perform HTTP GET request
    String httpGet(const char* url) {
        if (!isConnected()) {
            DEBUG_PRINTLN("[HTTP] Not connected!");
            return "";
        }
        
        HTTPClient http;
        http.begin(url);
        http.addHeader("apikey", SUPABASE_ANON_KEY);
        http.addHeader("Authorization", "Bearer " SUPABASE_ANON_KEY);
        http.addHeader("Content-Type", "application/json");
        
        int httpCode = http.GET();
        String response = "";
        
        if (httpCode > 0) {
            response = http.getString();
            DEBUG_PRINTF("[HTTP] GET %d: %s\n", httpCode, url);
        } else {
            DEBUG_PRINTF("[HTTP] GET failed: %s\n", http.errorToString(httpCode).c_str());
        }
        
        http.end();
        return response;
    }
    
    // Perform HTTP POST request
    String httpPost(const char* url, const String& jsonBody) {
        if (!isConnected()) {
            DEBUG_PRINTLN("[HTTP] Not connected!");
            return "";
        }
        
        HTTPClient http;
        http.begin(url);
        http.addHeader("apikey", SUPABASE_ANON_KEY);
        http.addHeader("Authorization", "Bearer " SUPABASE_ANON_KEY);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Prefer", "return=minimal");
        
        int httpCode = http.POST(jsonBody);
        String response = "";
        
        if (httpCode > 0) {
            response = http.getString();
            DEBUG_PRINTF("[HTTP] POST %d: %s\n", httpCode, url);
        } else {
            DEBUG_PRINTF("[HTTP] POST failed: %s\n", http.errorToString(httpCode).c_str());
        }
        
        http.end();
        return response;
    }
    
    // Perform HTTP PATCH request
    String httpPatch(const char* url, const String& jsonBody) {
        if (!isConnected()) {
            DEBUG_PRINTLN("[HTTP] Not connected!");
            return "";
        }
        
        HTTPClient http;
        http.begin(url);
        http.addHeader("apikey", SUPABASE_ANON_KEY);
        http.addHeader("Authorization", "Bearer " SUPABASE_ANON_KEY);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Prefer", "return=minimal");
        
        int httpCode = http.PATCH(jsonBody);
        String response = "";
        
        if (httpCode > 0) {
            response = http.getString();
            DEBUG_PRINTF("[HTTP] PATCH %d: %s\n", httpCode, url);
        } else {
            DEBUG_PRINTF("[HTTP] PATCH failed: %s\n", http.errorToString(httpCode).c_str());
        }
        
        http.end();
        return response;
    }
};

#endif // WIFI_MANAGER_H