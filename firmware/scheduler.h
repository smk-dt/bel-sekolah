// ============================================
// SMART SCHOOL BELL IoT - Schedule Scheduler Header
// ============================================
// Checks schedule every 1 second based on RTC time
// Triggers bell sequence when time matches
// ============================================
#ifndef SCHEDULER_H
#define SCHEDULER_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "config.h"
#include "utils.h"
#include "logger.h"
#include "rtc.h"
#include "relay.h"

struct ScheduleEntry {
    int id;
    int audioId;
    String dayOfWeek;       // 1-7 (1=Monday, 7=Sunday)
    String timeStr;         // "HH:MM" format
    String audioFile;       // Audio file name
    int trackNumber;        // Track number on DFPlayer SD
    bool enabled;
    bool alreadyTriggered;  // Prevent double-trigger
};

class Scheduler {
public:
    static void begin();
    static void task(void* parameter);
    
    // Schedule management
    static void updateSchedule(const String& jsonResponse);
    static void clearSchedule();
    static int getScheduleCount();
    static bool hasActiveSchedule();
    
    // Manual trigger
    static void triggerSchedule(int scheduleId);
    
    // ===== NEW: NVS persistence =====
    static void saveToNVS();
    static bool loadFromNVS();
    
    // ===== NEW: Remote sync command & status =====
    static bool syncFromServer();
    static String getSyncTimestamp();
    static String getSyncStatus();
    
private:
    static const int MAX_SCHEDULES = 100;
    static ScheduleEntry schedules[MAX_SCHEDULES];
    static int scheduleCount;
    static bool scheduleLoaded;
    static String lastScheduleJson;
    static int lastTriggerDay;   // Reset alreadyTriggered saat hari berubah
    static String lastSyncTimestamp; // Untuk heartbeat schedule_sync
    static String syncStatus;    // "pending", "synced", "error"
    
    // Core logic
    static void checkSchedule();
    static bool isTimeMatch(const ScheduleEntry& entry);
    static bool isDayMatch(const ScheduleEntry& entry);
    static void executeSchedule(const ScheduleEntry& entry);
    static int getTrackNumberFromAudioId(int audioId);
    static void resetDailyTriggers(int currentDay);
    
    // Helper
    static String getCurrentDayStr();
    static String buildSyncTimestamp();
};

#endif // SCHEDULER_H