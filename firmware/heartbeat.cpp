// ============================================
// SMART SCHOOL BELL IoT - Heartbeat Implementation
// ============================================
#include <WiFi.h>
#include "heartbeat.h"

unsigned long Heartbeat::lastHeartbeatTime = 0;
bool Heartbeat::lastHeartbeatResult = false;
unsigned long Heartbeat::uptimeOffset = 0;

void Heartbeat::begin() {
    LOG_INFO("HEARTBEAT", "Heartbeat initialized (interval: " + 
             String(HEARTBEAT_INTERVAL_MS) + "ms)");
    uptimeOffset = millis();
}

void Heartbeat::task(void* parameter) {
    LOG_INFO("HEARTBEAT", "Health monitor task started (heartbeat via Supabase task)");
    
    while (1) {
        unsigned long now = millis();
        
        // Health check every 60 seconds (no HTTP - purely local)
        static unsigned long lastHealthCheck = 0;
        if (now - lastHealthCheck > 60000) {
            checkHealth();
            lastHealthCheck = now;
        }
        
        vTaskDelay(5000 / portTICK_PERIOD_MS); // Check every 5 seconds
    }
}

String Heartbeat::buildHeartbeatJson() {
    DynamicJsonDocument doc(256);
    
    doc["uptime_seconds"] = getUptime() / 1000;
    doc["free_heap"] = getFreeHeap();
    doc["min_free_heap"] = getMinFreeHeap();
    doc["wifi_rssi"] = g_sysStatus.wifiRSSI;
    doc["cpu_freq"] = getCpuFreqMHz();
    doc["chip_model"] = getChipModel();
    doc["system_state"] = g_sysState;
    doc["rtc_time"] = g_sysStatus.rtcTime;
    doc["bell_active"] = g_sysStatus.bellActive;
    doc["schedules_count"] = g_sysStatus.schedulesCount;
    
    String jsonStr;
    serializeJson(doc, jsonStr);
    return jsonStr;
}

unsigned long Heartbeat::getUptime() {
    return millis() - uptimeOffset;
}

int Heartbeat::getFreeHeap() {
    return ESP.getFreeHeap();
}

int Heartbeat::getMinFreeHeap() {
    return ESP.getMinFreeHeap();
}

float Heartbeat::getCpuFreqMHz() {
    return ESP.getCpuFreqMHz();
}

String Heartbeat::getChipModel() {
    return String(ESP.getChipModel());
}

String Heartbeat::getChipRevision() {
    return String(ESP.getChipRevision());
}

unsigned long Heartbeat::getLastHeartbeatTime() {
    return lastHeartbeatTime;
}

bool Heartbeat::getLastHeartbeatResult() {
    return lastHeartbeatResult;
}

void Heartbeat::checkHealth() {
    int freeHeap = getFreeHeap();
    int minFreeHeap = getMinFreeHeap();
    
    LOG_DEBUG("HEARTBEAT", "Health check: FreeHeap=" + String(freeHeap) + 
              " MinFreeHeap=" + String(minFreeHeap) + 
              " Uptime=" + String(getUptime()/1000) + "s");
    
    // Warn if heap is critically low
    if (freeHeap < 10000) {
        LOG_ERROR("HEARTBEAT", "CRITICAL: Low heap memory! " + String(freeHeap) + " bytes");
    } else if (freeHeap < 20000) {
        LOG_WARN("HEARTBEAT", "Low heap memory: " + String(freeHeap) + " bytes");
    }
    
    // Update global status
    g_sysStatus.uptimeSeconds = getUptime() / 1000;
}