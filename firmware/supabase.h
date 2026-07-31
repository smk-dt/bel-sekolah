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

// Missed log entry structure
struct MissedLogEntry {
    String level;    // "info", "warn", "error", "debug"
    String module;
    String message;
    unsigned long timestamp;
};

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
    
    // ===== NEW: Command listener =====
    static bool listenForCommands();
    static bool sendCommandAck(long commandId, const String& status);
    
    // ===== NEW: Bell & system log =====
    static bool sendBellHistory(int scheduleId, const String& time, int trackNumber, const String& status, const String& message);
    static bool sendSystemLog(const String& level, const String& module, const String& message);
    
    // ===== NEW: Missed log buffer =====
    static void addMissedLog(const String& level, const String& module, const String& message);
    static bool flushMissedLogs();
    
    // ===== NEW: Enhanced heartbeat with full payload =====
    static bool sendEnhancedHeartbeat();
    
    // ===== Command handler =====
    static void processCommand(const String& command, long commandId);
    
private:
    static WiFiClientSecure client;
    static HTTPClient http;
    static String lastScheduleData;
    static unsigned long lastFetchTime;
    static unsigned long lastStatusUpdate;
    static unsigned long lastCommandPoll;
    static bool initialized;
    
    // Missed logs buffer
    static MissedLogEntry missedLogs[50];
    static int missedLogCount;
    
    // Internal helpers
    static String buildUrl(const String& endpoint);
    static int httpGet(const String& url, String& response);
    static int httpPost(const String& url, const String& body, String& response);
    static bool verifySSL();
};

#endif // SUPABASE_H