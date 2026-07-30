// ============================================
// SMART SCHOOL BELL IoT - Supabase REST Client Header
// ============================================
// HTTP client to communicate with Supabase backend
// or any REST API with similar endpoints
// ============================================
#ifndef SUPABASE_H
#define SUPABASE_H

#include <Arduino.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "utils.h"
#include "logger.h"

class SupabaseClient {
public:
    static void begin();
    static void task(void* parameter);
    
    // API calls
    static bool fetchSchedule();
    static bool updateStatus(const String& statusJson);
    static bool testConnection();
    
    // Getter for fetched data
    static String getLastScheduleJson();
    static unsigned long getLastFetchTime();
    
    // Status update helpers
    static bool sendBellEvent(int scheduleId, bool success, const String& message);
    static bool sendHeartbeat();
    
private:
    static WiFiClientSecure client;
    static HTTPClient http;
    static String lastScheduleData;
    static unsigned long lastFetchTime;
    static unsigned long lastStatusUpdate;
    static bool initialized;
    
    // Internal helpers
    static String buildUrl(const String& endpoint);
    static int httpGet(const String& url, String& response);
    static int httpPost(const String& url, const String& body, String& response);
    static bool verifySSL();
};

#endif // SUPABASE_H