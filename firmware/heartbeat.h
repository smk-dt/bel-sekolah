// ============================================
// SMART SCHOOL BELL IoT - Heartbeat Header
// ============================================
// Sends heartbeat to server every 10 seconds
// Monitors system health (free heap, uptime, etc.)
// ============================================
#ifndef HEARTBEAT_H
#define HEARTBEAT_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "utils.h"
#include "logger.h"
#include "rtc.h"
#include "supabase.h"

class Heartbeat {
public:
    static void begin();
    static void task(void* parameter);
    
    // Health info
    static unsigned long getUptime();
    static int getFreeHeap();
    static int getMinFreeHeap();
    static float getCpuFreqMHz();
    static String getChipModel();
    static String getChipRevision();
    
    // Last heartbeat
    static unsigned long getLastHeartbeatTime();
    static bool getLastHeartbeatResult();

private:
    static unsigned long lastHeartbeatTime;
    static bool lastHeartbeatResult;
    static unsigned long uptimeOffset;
    
    // Build heartbeat payload
    static String buildHeartbeatJson();
    
    // Health monitoring
    static void checkHealth();
};

#endif // HEARTBEAT_H