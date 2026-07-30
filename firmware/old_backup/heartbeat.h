// ============================================
// SMART SCHOOL BELL IoT - Heartbeat Manager
// ============================================
#ifndef HEARTBEAT_H
#define HEARTBEAT_H

#include <ArduinoJson.h>
#include "config.h"
#include "supabase_client.h"
#include "rtc_manager.h"
#include "wifi_manager.h"
#include "relay_manager.h"
#include "dfplayer_manager.h"
#include "scheduler.h"

class Heartbeat {
private:
    SupabaseClient* supabase;
    RTCManager* rtc;
    WiFiManager* wifi;
    RelayManager* relay;
    DFPlayerManager* dfPlayer;
    Scheduler* scheduler;
    
    unsigned long lastHeartbeat;
    unsigned long lastScheduleFetch;
    
    // Schedule fetch interval (5 minutes)
    static const unsigned long SCHEDULE_FETCH_INTERVAL = 300000;
    
    // Last known day for detecting day change
    String lastKnownDay;

public:
    Heartbeat(SupabaseClient* s, RTCManager* r, WiFiManager* w,
              RelayManager* rl, DFPlayerManager* df, Scheduler* sch)
        : supabase(s), rtc(r), wifi(w), relay(rl), dfPlayer(df), scheduler(sch),
          lastHeartbeat(0), lastScheduleFetch(0), lastKnownDay("") {}
    
    // Send heartbeat - call in main loop
    void send() {
        unsigned long now = millis();
        
        // Only send every HEARTBEAT_INTERVAL
        if (now - lastHeartbeat < HEARTBEAT_INTERVAL_MS) return;
        lastHeartbeat = now;
        
        if (!wifi->isConnected()) return;
        
        DEBUG_PRINTLN("[Heartbeat] Sending...");
        
        // Build system status JSON
        String sysJson = "\"wifi\":\"";
        sysJson += (wifi->isConnected() ? "Connected" : "Disconnected");
        sysJson += "\",\"wifi_rssi\":";
        sysJson += String(wifi->getRSSI());
        sysJson += ",\"internet\":\"";
        sysJson += (wifi->isConnected() ? "Connected" : "Disconnected");
        sysJson += "\",\"rtc\":\"";
        sysJson += (rtc->isWorking() ? "OK" : "Error");
        sysJson += "\",\"rtc_time\":\"";
        sysJson += rtc->getFormattedTime();
        sysJson += "\",\"dfplayer\":\"";
        sysJson += (dfPlayer->isWorking() ? "Connected" : "Disconnected");
        sysJson += "\",\"micro_sd\":\"";
        sysJson += (dfPlayer->hasSDCard() ? "Ready" : "Not Found");
        sysJson += "\",\"relay1\":\"";
        sysJson += relay->getRelay1Str();
        sysJson += "\",\"relay2\":\"";
        sysJson += relay->getRelay2Str();
        sysJson += "\",\"bell\":\"";
        sysJson += scheduler->getBellStatus();
        sysJson += "\",\"free_heap\":";
        sysJson += String(ESP.getFreeHeap());
        sysJson += ",\"uptime\":";
        sysJson += String(millis() / 1000);
        sysJson += ",\"last_heartbeat\":\"now()\"";
        
        // Send to Supabase
        supabase->upsertSystemStatus(sysJson);
        
        // Update device status
        supabase->updateDeviceStatus(
            wifi->isConnected() ? "online" : "offline",
            wifi->getLocalIP(),
            wifi->getRSSI()
        );
        
        DEBUG_PRINTLN("[Heartbeat] Sent");
    }
    
    // Check and fetch schedules - call in main loop
    void checkScheduleUpdate() {
        unsigned long now = millis();
        
        // Check if day changed
        String currentDay = rtc->getDayName();
        bool dayChanged = (currentDay != lastKnownDay);
        
        // Fetch if day changed or interval reached
        if (dayChanged || (now - lastScheduleFetch > SCHEDULE_FETCH_INTERVAL)) {
            DEBUG_PRINTF("[Schedule] Fetching for day: %s\n", currentDay.c_str());
            
            if (wifi->isConnected()) {
                // Clear previous schedules first on day change
                if (dayChanged) {
                    scheduler->resetExecutedFlags();
                }
                
                // Fetch schedules from Supabase
                JsonArray scheduleArray;
                if (supabase->fetchSchedules(currentDay, scheduleArray)) {
                    scheduler->addFromJson(scheduleArray);
                    DEBUG_PRINTF("[Schedule] Loaded %d items\n", scheduler->getCount());
                } else {
                    DEBUG_PRINTLN("[Schedule] Fetch failed or no schedules");
                    // Keep existing schedules if fetch fails
                }
                
                lastScheduleFetch = now;
                lastKnownDay = currentDay;
            }
        }
    }
    
    // Force schedule refresh
    void forceRefresh() {
        lastScheduleFetch = 0;
        lastKnownDay = "";
        DEBUG_PRINTLN("[Heartbeat] Schedule refresh forced");
    }
};

#endif // HEARTBEAT_H