// ============================================
// SMART SCHOOL BELL IoT - Supabase REST Client Implementation
// ============================================
#include <WiFi.h>
#include "supabase.h"
#include "rtc.h"

WiFiClientSecure SupabaseClient::client;
HTTPClient SupabaseClient::http;
String SupabaseClient::lastScheduleData = "";
unsigned long SupabaseClient::lastFetchTime = 0;
unsigned long SupabaseClient::lastStatusUpdate = 0;
bool SupabaseClient::initialized = false;

void SupabaseClient::begin() {
    LOG_INFO("SUPABASE", "Initializing Supabase client");
    
    // Verify SSL certificate
    verifySSL();
    
    // Check SSL/TLS fingerprint verification
    LOG_INFO("SUPABASE", "Supabase URL: " + String(SUPABASE_URL));
    String supabaseKeyPreview = String(SUPABASE_ANON_KEY).substring(0, 10);
    LOG_INFO("SUPABASE", "Supabase Key: " + supabaseKeyPreview + "...");
    
    initialized = true;
}

void SupabaseClient::task(void* parameter) {
    LOG_INFO("SUPABASE", "Supabase task started");
    
    while (1) {
        if (WiFi.status() == WL_CONNECTED) {
            unsigned long now = millis();
            
            // Fetch schedule periodically
            if (now - lastFetchTime > SUPABASE_FETCH_INTERVAL_MS || lastFetchTime == 0) {
                LOG_INFO("SUPABASE", "Fetching schedule...");
                if (fetchSchedule()) {
                    lastFetchTime = now;
                }
            }
            
            // Send status update periodically
            if (now - lastStatusUpdate > SUPABASE_STATUS_INTERVAL_MS || lastStatusUpdate == 0) {
                LOG_DEBUG("SUPABASE", "Sending status update...");
                
                // Build status JSON
                DynamicJsonDocument doc(1024);
                doc["wifi_connected"] = g_sysStatus.wifiConnected;
                doc["wifi_rssi"] = g_sysStatus.wifiRSSI;
                doc["ip_address"] = g_sysStatus.ipAddress;
                doc["rtc_working"] = g_sysStatus.rtcWorking;
                doc["rtc_time"] = g_sysStatus.rtcTime;
                doc["rtc_date"] = g_sysStatus.rtcDate;
                doc["rtc_temp"] = g_sysStatus.rtcTemp;
                doc["dfplayer_connected"] = g_sysStatus.dfplayerConnected;
                doc["sd_card_ready"] = g_sysStatus.sdCardReady;
                doc["relay1_state"] = g_sysStatus.relay1State;
                doc["relay2_state"] = g_sysStatus.relay2State;
                doc["bell_active"] = g_sysStatus.bellActive;
                doc["test_active"] = g_sysStatus.testActive;
                doc["schedules_count"] = g_sysStatus.schedulesCount;
                doc["system_state"] = g_sysState;
                
                String jsonStr;
                serializeJson(doc, jsonStr);
                
                if (updateStatus(jsonStr)) {
                    lastStatusUpdate = now;
                }
            }
        } else {
            // WiFi not connected, skip API calls
            if (millis() % 30000 < 1000) { // Log every ~30s
                LOG_WARN("SUPABASE", "WiFi disconnected, skipping API calls");
            }
        }
        
        vTaskDelay(5000 / portTICK_PERIOD_MS);
    }
}

bool SupabaseClient::fetchSchedule() {
    if (!initialized) return false;
    
    String url = buildUrl("/rest/v1/rpc/get_today_schedule");
    String response;
    
    int httpCode = httpGet(url, response);
    
    if (httpCode == 200) {
        lastScheduleData = response;
        LOG_INFO("SUPABASE", "Schedule fetched: " + String(response.length()) + " bytes");
        
        // Update schedule count in status
        DynamicJsonDocument doc(16384);
        DeserializationError error = deserializeJson(doc, response);
        if (!error) {
            g_sysStatus.schedulesCount = doc.as<JsonArray>().size();
        }
        
        return true;
    } else {
        LOG_ERROR("SUPABASE", "Fetch schedule failed: HTTP " + String(httpCode));
        return false;
    }
}

bool SupabaseClient::updateStatus(const String& statusJson) {
    if (!initialized) return false;
    
    String url = buildUrl("/rest/v1/rpc/update_device_status");
    String response;
    
    int httpCode = httpPost(url, statusJson, response);
    
    if (httpCode == 200 || httpCode == 201 || httpCode == 204) {
        LOG_DEBUG("SUPABASE", "Status updated successfully");
        return true;
    } else {
        LOG_ERROR("SUPABASE", "Status update failed: HTTP " + String(httpCode));
        return false;
    }
}

bool SupabaseClient::testConnection() {
    if (!initialized) return false;
    
    String url = buildUrl("/rest/v1/rpc/ping");
    String response;
    
    int httpCode = httpGet(url, response);
    
    if (httpCode == 200) {
        LOG_INFO("SUPABASE", "Connection test successful");
        return true;
    } else {
        LOG_ERROR("SUPABASE", "Connection test failed: HTTP " + String(httpCode));
        return false;
    }
}

String SupabaseClient::getLastScheduleJson() {
    return lastScheduleData;
}

unsigned long SupabaseClient::getLastFetchTime() {
    return lastFetchTime;
}

bool SupabaseClient::sendBellEvent(int scheduleId, bool success, const String& message) {
    if (!initialized) return false;
    
    DynamicJsonDocument doc(512);
    doc["schedule_id"] = scheduleId;
    doc["success"] = success;
    doc["message"] = message;
    doc["timestamp"] = RTCManager::getEpoch();
    
    String body;
    serializeJson(doc, body);
    
    String url = buildUrl("/rest/v1/rpc/log_bell_event");
    String response;
    
    int httpCode = httpPost(url, body, response);
    return (httpCode == 200 || httpCode == 201 || httpCode == 204);
}

bool SupabaseClient::sendHeartbeat() {
    if (!initialized) return false;
    
    DynamicJsonDocument doc(256);
    doc["uptime_ms"] = millis();
    doc["wifi_rssi"] = g_sysStatus.wifiRSSI;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["system_state"] = g_sysState;
    doc["timestamp"] = RTCManager::getEpoch();
    
    String body;
    serializeJson(doc, body);
    
    String url = buildUrl("/rest/v1/rpc/heartbeat");
    String response;
    
    int httpCode = httpPost(url, body, response);
    return (httpCode == 200 || httpCode == 201 || httpCode == 204);
}

// ===== Private Helpers =====

String SupabaseClient::buildUrl(const String& endpoint) {
    return String(SUPABASE_URL) + endpoint;
}

int SupabaseClient::httpGet(const String& url, String& response) {
    LOG_DEBUG("SUPABASE", "HTTP GET: " + url);
    
    client.setInsecure(); // Skip SSL certificate validation for simplicity
    http.begin(client, url);
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.GET();
    
    if (httpCode > 0) {
        response = http.getString();
    }
    
    http.end();
    return httpCode;
}

int SupabaseClient::httpPost(const String& url, const String& body, String& response) {
    LOG_DEBUG("SUPABASE", "HTTP POST: " + url);
    
    client.setInsecure();
    http.begin(client, url);
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
    http.addHeader("Content-Type", "application/json");
    
    int httpCode = http.POST(body);
    
    if (httpCode > 0) {
        response = http.getString();
    }
    
    http.end();
    return httpCode;
}

bool SupabaseClient::verifySSL() {
    // Using setInsecure() for simplicity
    // In production, use certificate fingerprint for better security
    client.setInsecure();
    LOG_DEBUG("SUPABASE", "SSL verification disabled (insecure mode)");
    return true;
}