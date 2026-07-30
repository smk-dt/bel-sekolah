// ============================================
// SMART SCHOOL BELL IoT - Supabase REST Client
// ============================================
#ifndef SUPABASE_CLIENT_H
#define SUPABASE_CLIENT_H

#include <ArduinoJson.h>
#include "config.h"
#include "wifi_manager.h"

class SupabaseClient {
private:
    WiFiManager* wifi;
    String baseUrl;
    String anonKey;
    
    // Buffer for JSON documents
    StaticJsonDocument<4096> jsonDoc;

public:
    SupabaseClient(WiFiManager* w) : wifi(w) {
        baseUrl = String(SUPABASE_URL);
        anonKey = String(SUPABASE_ANON_KEY);
    }
    
    // ===== Schedule Operations =====
    
    // Fetch schedules for a specific day
    bool fetchSchedules(const String& day, JsonArray& outputArray) {
        String url = baseUrl + API_SCHEDULES + day;
        url += "&status=eq.active";
        url += "&order=time.asc";
        
        DEBUG_PRINTF("[Supabase] Fetching schedules for %s\n", day.c_str());
        
        String response = wifi->httpGet(url.c_str());
        if (response.length() == 0) {
            DEBUG_PRINTLN("[Supabase] Empty response");
            return false;
        }
        
        // Parse JSON array
        DeserializationError error = deserializeJson(jsonDoc, response);
        if (error) {
            DEBUG_PRINTF("[Supabase] JSON parse error: %s\n", error.c_str());
            return false;
        }
        
        JsonArray jsonArray = jsonDoc.as<JsonArray>();
        if (jsonArray.isNull()) {
            DEBUG_PRINTLN("[Supabase] Response is not an array");
            return false;
        }
        
        // Copy to output
        outputArray = jsonArray;
        
        DEBUG_PRINTF("[Supabase] Got %d schedules\n", jsonArray.size());
        return true;
    }
    
    // Fetch all schedules for today
    bool fetchTodaySchedules(JsonArray& outputArray) {
        // We'll fetch dynamically based on current day in main loop
        return false;
    }
    
    // ===== Device Operations =====
    
    // Update device status
    bool updateDeviceStatus(const String& status, const String& ip, int rssi) {
        String url = baseUrl + String("/rest/v1/devices?device_id=eq.") + DEVICE_ID;
        
        String json = "{";
        json += "\"status\":\"" + status + "\",";
        json += "\"last_ip\":\"" + ip + "\",";
        json += "\"firmware_version\":\"" FIRMWARE_VERSION "\",";
        json += "\"updated_at\":\"now()\"";
        json += "}";
        
        wifi->httpPatch(url.c_str(), json);
        return true;
    }
    
    // ===== System Status Operations =====
    
    // Upsert system status
    bool upsertSystemStatus(const String& jsonBody) {
        String url = baseUrl + String("/rest/v1/system_status?device_id=eq.") + DEVICE_ID;
        
        String json = "{";
        json += "\"device_id\":\"" DEVICE_ID "\",";
        json += jsonBody;
        json += "}";
        
        // First try PATCH
        String response = wifi->httpPatch(url.c_str(), json);
        
        // If PATCH didn't affect any rows, do INSERT
        if (response.length() == 0) {
            String insertUrl = baseUrl + String("/rest/v1/system_status");
            wifi->httpPost(insertUrl.c_str(), json);
        }
        
        return true;
    }
    
    // ===== Log Operations =====
    
    // Create a log entry
    bool createLog(const String& activity, const String& status, const String& description) {
        String url = baseUrl + String("/rest/v1/logs");
        
        String json = "{";
        json += "\"device_id\":\"" DEVICE_ID "\",";
        json += "\"activity\":\"" + escapeJson(activity) + "\",";
        json += "\"status\":\"" + escapeJson(status) + "\",";
        json += "\"description\":\"" + escapeJson(description) + "\"";
        json += "}";
        
        wifi->httpPost(url.c_str(), json);
        return true;
    }
    
    // Create bell log entry
    bool logBellEvent(const String& scheduleDay, const String& scheduleTime, int audioId) {
        String desc = "Schedule: " + scheduleDay + " " + scheduleTime + " | Audio: #" + String(audioId);
        return createLog("Bell Ring", "Success", desc);
    }
    
    // Log system startup
    bool logStartup() {
        return createLog("System Startup", "Success", "Device started. FW: " FIRMWARE_VERSION);
    }
    
    // Log WiFi connection
    bool logWiFiConnection(const String& ip) {
        return createLog("WiFi Connected", "Success", "IP: " + ip);
    }
    
    // Log NTP sync
    bool logNTPSync(bool success) {
        if (success) {
            return createLog("NTP Sync", "Success", "Time synchronized");
        } else {
            return createLog("NTP Sync", "Failed", "Could not sync time");
        }
    }
    
    // Log error
    bool logError(const String& source, const String& message) {
        return createLog(source, "Error", message);
    }

private:
    // Escape JSON string
    String escapeJson(const String& input) {
        String output = input;
        output.replace("\\", "\\\\");
        output.replace("\"", "\\\"");
        output.replace("\n", "\\n");
        output.replace("\r", "\\r");
        output.replace("\t", "\\t");
        return output;
    }
};

#endif // SUPABASE_CLIENT_H