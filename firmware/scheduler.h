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
    
private:
    static const int MAX_SCHEDULES = 100;
    static ScheduleEntry schedules[MAX_SCHEDULES];
    static int scheduleCount;
    static bool scheduleLoaded;
    static String lastScheduleJson;
    
    // Core logic
    static void checkSchedule();
    static bool isTimeMatch(const ScheduleEntry& entry);
    static bool isDayMatch(const ScheduleEntry& entry);
    static void executeSchedule(const ScheduleEntry& entry);
    static int getTrackNumberFromAudioId(int audioId);
    
    // Helper
    static String getCurrentDayStr();
};

#endif // SCHEDULER_H