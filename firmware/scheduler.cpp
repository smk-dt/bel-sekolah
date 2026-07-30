// ============================================
// SMART SCHOOL BELL IoT - Schedule Scheduler Implementation
// ============================================
#include "scheduler.h"

ScheduleEntry Scheduler::schedules[MAX_SCHEDULES];
int Scheduler::scheduleCount = 0;
bool Scheduler::scheduleLoaded = false;
String Scheduler::lastScheduleJson = "";

void Scheduler::begin() {
    LOG_INFO("SCHED", "Scheduler initialized");
}

void Scheduler::task(void* parameter) {
    LOG_INFO("SCHED", "Scheduler task started (check every " + String(SCHEDULE_CHECK_MS) + "ms)");
    
    while (1) {
        // Only check if schedule is loaded and relay is idle
        if (scheduleLoaded && !RelayManager::isSequenceActive()) {
            checkSchedule();
        }
        
        vTaskDelay(SCHEDULE_CHECK_MS / portTICK_PERIOD_MS);
    }
}

void Scheduler::updateSchedule(const String& jsonResponse) {
    LOG_INFO("SCHED", "Updating schedule from server");
    
    // Clear existing schedule
    clearSchedule();
    
    // Parse JSON using ArduinoJson
    // Expected format: [{"id":1,"audio_id":1,"day_of_week":"1,2,3,4,5","time":"07:00","audios":{"track_number":1}}, ...]
    DynamicJsonDocument doc(16384);
    DeserializationError error = deserializeJson(doc, jsonResponse);
    
    if (error) {
        LOG_ERROR("SCHED", "JSON parse error: " + String(error.c_str()));
        return;
    }
    
    JsonArray arr = doc.as<JsonArray>();
    int count = 0;
    
    for (JsonObject obj : arr) {
        if (count >= MAX_SCHEDULES) break;
        
        int id = obj["id"] | 0;
        int audioId = obj["audio_id"] | 0;
        const char* dayStr = obj["day_of_week"] | "";
        const char* timeStr = obj["time"] | "";
        bool enabled = obj["enabled"] | true;
        
        // Get track number from nested audios object
        int trackNumber = 1; // Default
        if (obj.containsKey("audios")) {
            JsonObject audio = obj["audios"];
            trackNumber = audio["track_number"] | 1;
        }
        
        if (id > 0 && strlen(dayStr) > 0 && strlen(timeStr) > 0) {
            schedules[count].id = id;
            schedules[count].audioId = audioId;
            schedules[count].dayOfWeek = String(dayStr);
            schedules[count].timeStr = String(timeStr);
            schedules[count].trackNumber = trackNumber;
            schedules[count].enabled = enabled;
            schedules[count].alreadyTriggered = false;
            count++;
        }
    }
    
    scheduleCount = count;
    scheduleLoaded = (count > 0);
    lastScheduleJson = jsonResponse;
    
    LOG_INFO("SCHED", "Loaded " + String(count) + " schedule entries");
}

void Scheduler::clearSchedule() {
    for (int i = 0; i < MAX_SCHEDULES; i++) {
        schedules[i].id = 0;
        schedules[i].audioId = 0;
        schedules[i].dayOfWeek = "";
        schedules[i].timeStr = "";
        schedules[i].trackNumber = 0;
        schedules[i].enabled = false;
        schedules[i].alreadyTriggered = false;
    }
    scheduleCount = 0;
    scheduleLoaded = false;
}

int Scheduler::getScheduleCount() {
    return scheduleCount;
}

bool Scheduler::hasActiveSchedule() {
    return scheduleLoaded;
}

void Scheduler::checkSchedule() {
    if (!scheduleLoaded || scheduleCount == 0) return;
    
    // Current time from RTC
    int currentHour = RTCManager::getHour();
    int currentMinute = RTCManager::getMinute();
    
    String currentDayStr = getCurrentDayStr();
    
    for (int i = 0; i < scheduleCount; i++) {
        ScheduleEntry& entry = schedules[i];
        
        if (!entry.enabled || entry.alreadyTriggered) continue;
        
        // Check if today matches
        if (!isDayMatch(entry)) continue;
        
        // Check if time matches
        if (isTimeMatch(entry)) {
            LOG_INFO("SCHED", "Schedule match! ID=" + String(entry.id) + 
                     " Time=" + entry.timeStr + 
                     " Track=" + String(entry.trackNumber));
            
            executeSchedule(entry);
            break; // Only execute one schedule per check
        }
    }
}

bool Scheduler::isTimeMatch(const ScheduleEntry& entry) {
    int currentHour = RTCManager::getHour();
    int currentMinute = RTCManager::getMinute();
    
    // Parse entry time
    int entryHour = entry.timeStr.substring(0, 2).toInt();
    int entryMinute = entry.timeStr.substring(3, 5).toInt();
    
    return (currentHour == entryHour && currentMinute == entryMinute && 
            RTCManager::getSecond() < 2); // Within first 2 seconds of the minute
}

bool Scheduler::isDayMatch(const ScheduleEntry& entry) {
    int currentDay = RTCManager::getDayOfWeek(); // 1=Monday, 7=Sunday
    
    // Parse day_of_week - can be comma separated like "1,2,3,4,5" or single "1"
    String dayStr = entry.dayOfWeek;
    
    // Check if current day is in the comma-separated list
    int startPos = 0;
    int commaPos;
    
    do {
        commaPos = dayStr.indexOf(',', startPos);
        String dayToken;
        
        if (commaPos >= 0) {
            dayToken = dayStr.substring(startPos, commaPos);
            startPos = commaPos + 1;
        } else {
            dayToken = dayStr.substring(startPos);
        }
        
        dayToken.trim();
        
        if (dayToken.toInt() == currentDay) {
            return true;
        }
        
    } while (commaPos >= 0);
    
    return false;
}

void Scheduler::executeSchedule(const ScheduleEntry& entry) {
    if (RelayManager::isSequenceActive()) {
        LOG_WARN("SCHED", "Relay busy, cannot execute schedule");
        return;
    }
    
    // Mark as triggered
    for (int i = 0; i < scheduleCount; i++) {
        if (schedules[i].id == entry.id) {
            schedules[i].alreadyTriggered = true;
            break;
        }
    }
    
    LOG_INFO("SCHED", "Executing schedule ID=" + String(entry.id) + 
             " Track=" + String(entry.trackNumber));
    
    // Start relay sequence
    RelayManager::startBellSequence(entry.trackNumber);
}

String Scheduler::getCurrentDayStr() {
    return String(RTCManager::getDayOfWeek());
}

int Scheduler::getTrackNumberFromAudioId(int audioId) {
    // Map audio_id to track number (usually 1:1 mapping)
    return audioId;
}

void Scheduler::triggerSchedule(int scheduleId) {
    for (int i = 0; i < scheduleCount; i++) {
        if (schedules[i].id == scheduleId) {
            LOG_INFO("SCHED", "Manual trigger schedule ID=" + String(scheduleId));
            executeSchedule(schedules[i]);
            return;
        }
    }
    LOG_WARN("SCHED", "Schedule ID=" + String(scheduleId) + " not found");
}