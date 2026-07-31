// ============================================
// SMART SCHOOL BELL IoT - Schedule Scheduler Implementation
// ============================================
#include "scheduler.h"
#include "supabase.h"
#include "dfplayer.h"

ScheduleEntry Scheduler::schedules[MAX_SCHEDULES];
int Scheduler::scheduleCount = 0;
bool Scheduler::scheduleLoaded = false;
String Scheduler::lastScheduleJson = "";
int Scheduler::lastTriggerDay = -1;
String Scheduler::lastSyncTimestamp = "";
String Scheduler::syncStatus = SYNC_STATUS_PENDING;

void Scheduler::begin() {
    LOG_INFO("SCHED", "Scheduler initialized");

    // Try to load schedule from NVS (Preferences)
    if (loadFromNVS()) {
        LOG_INFO("SCHED", "Schedule restored from NVS: " + String(scheduleCount) + " entries");
        lastTriggerDay = RTCManager::getDayOfWeek(); // Jangan trigger jadwal lama setelah reboot
        // Reset semua flag alreadyTriggered agar bisa dijadwalkan lagi hari ini
        for (int i = 0; i < scheduleCount; i++) {
            schedules[i].alreadyTriggered = false;
        }
    } else {
        LOG_INFO("SCHED", "No saved schedule in NVS");
    }
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
    // Expected format (get_today_schedule RPC):
    //   [{"id":1,"audio_id":1,"day_of_week":[1,2,3,4,5],"time":"07:00","enabled":true}, ...]
    DynamicJsonDocument doc(16384);
    DeserializationError error = deserializeJson(doc, jsonResponse);
    
    if (error) {
        LOG_ERROR("SCHED", "JSON parse error: " + String(error.c_str()));
        syncStatus = SYNC_STATUS_ERROR;
        return;
    }
    
    JsonArray arr = doc.as<JsonArray>();
    int count = 0;
    
    for (JsonObject obj : arr) {
        if (count >= MAX_SCHEDULES) break;
        
        int id = obj["id"] | 0;
        int audioId = obj["audio_id"] | 0;
        const char* timeStr = obj["time"] | "";
        bool enabled = obj["enabled"] | true;
        
        // day_of_week sekarang berupa array JSON: [1,2,3,4,5]
        // Konversi ke CSV string "1,2,3,4,5" agar cocok dengan isDayMatch()
        String dayCsv = "";
        if (obj["day_of_week"].is<JsonArray>()) {
            JsonArray days = obj["day_of_week"].as<JsonArray>();
            bool first = true;
            for (JsonVariant d : days) {
                if (!first) dayCsv += ",";
                dayCsv += String(d.as<int>());
                first = false;
            }
        }
        
        if (id > 0 && dayCsv.length() > 0 && strlen(timeStr) > 0) {
            schedules[count].id = id;
            schedules[count].audioId = audioId;
            schedules[count].dayOfWeek = dayCsv;
            schedules[count].timeStr = String(timeStr);
            schedules[count].trackNumber = audioId; // audio_id = track number DFPlayer (1-16)
            schedules[count].enabled = enabled;
            schedules[count].alreadyTriggered = false;
            count++;
        }
    }
    
    scheduleCount = count;
    scheduleLoaded = (count > 0);
    lastScheduleJson = jsonResponse;
    lastTriggerDay = RTCManager::getDayOfWeek();
    syncStatus = SYNC_STATUS_SYNCED;
    lastSyncTimestamp = buildSyncTimestamp();
    
    LOG_INFO("SCHED", "Loaded " + String(count) + " schedule entries");

    // Save to NVS for persistence after reboot
    saveToNVS();
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
    
    // Reset alreadyTriggered saat hari berganti
    int currentDay = RTCManager::getDayOfWeek();
    if (currentDay != lastTriggerDay) {
        resetDailyTriggers(currentDay);
    }
    
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

void Scheduler::resetDailyTriggers(int currentDay) {
    LOG_DEBUG("SCHED", "Day changed to " + String(currentDay) + ", resetting triggers");
    for (int i = 0; i < scheduleCount; i++) {
        schedules[i].alreadyTriggered = false;
    }
    lastTriggerDay = currentDay;
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
    
    // Log ke bell_history di Supabase (best effort)
    String nowTime = RTCManager::getTimeString();
    if (nowTime.length() == 0) nowTime = entry.timeStr;
    SupabaseClient::sendBellHistory(entry.id, nowTime, entry.trackNumber,
        "success", "Scheduled bell fired");
}

String Scheduler::getCurrentDayStr() {
    return String(RTCManager::getDayOfWeek());
}

int Scheduler::getTrackNumberFromAudioId(int audioId) {
    // Map audio_id to track number (usually 1:1 mapping)
    return audioId;
}

// ============================================
// NVS PERSISTENCE
// ============================================
void Scheduler::saveToNVS() {
    Preferences prefs;
    if (!prefs.begin("scheduler", false)) {
        LOG_ERROR("SCHED", "Failed to open NVS for writing");
        return;
    }

    // Save count
    prefs.putInt("count", scheduleCount);

    // Save each schedule entry as individual keys
    for (int i = 0; i < scheduleCount; i++) {
        String prefix = "s" + String(i) + "_";
        prefs.putInt((prefix + "id").c_str(), schedules[i].id);
        prefs.putInt((prefix + "aid").c_str(), schedules[i].audioId);
        prefs.putString((prefix + "day").c_str(), schedules[i].dayOfWeek);
        prefs.putString((prefix + "time").c_str(), schedules[i].timeStr);
        prefs.putInt((prefix + "track").c_str(), schedules[i].trackNumber);
        prefs.putBool((prefix + "en").c_str(), schedules[i].enabled);
        prefs.putBool((prefix + "trig").c_str(), schedules[i].alreadyTriggered);
    }

    prefs.end();
    LOG_INFO("SCHED", "Saved " + String(scheduleCount) + " schedules to NVS");
}

bool Scheduler::loadFromNVS() {
    Preferences prefs;
    if (!prefs.begin("scheduler", true)) {
        LOG_ERROR("SCHED", "Failed to open NVS for reading");
        return false;
    }

    int count = prefs.getInt("count", 0);
    if (count <= 0) {
        prefs.end();
        return false;
    }

    clearSchedule();

    for (int i = 0; i < count && i < MAX_SCHEDULES; i++) {
        String prefix = "s" + String(i) + "_";
        schedules[i].id = prefs.getInt((prefix + "id").c_str(), 0);
        schedules[i].audioId = prefs.getInt((prefix + "aid").c_str(), 0);
        schedules[i].dayOfWeek = prefs.getString((prefix + "day").c_str(), "");
        schedules[i].timeStr = prefs.getString((prefix + "time").c_str(), "");
        schedules[i].trackNumber = prefs.getInt((prefix + "track").c_str(), 1);
        schedules[i].enabled = prefs.getBool((prefix + "en").c_str(), true);
        schedules[i].alreadyTriggered = prefs.getBool((prefix + "trig").c_str(), false);
    }

    scheduleCount = count;
    scheduleLoaded = (count > 0);
    lastScheduleJson = ""; // Will be refreshed on next fetch

    prefs.end();
    return scheduleLoaded;
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

// ============================================
// REMOTE SYNC COMMAND & STATUS
// ============================================
bool Scheduler::syncFromServer() {
    syncStatus = SYNC_STATUS_PENDING;
    LOG_INFO("SCHED", "Manual sync requested via command");

    if (SupabaseClient::fetchSchedule()) {
        // updateSchedule() akan set syncStatus = SYNC_STATUS_SYNCED + timestamp
        return getSyncStatus() == SYNC_STATUS_SYNCED;
    }

    syncStatus = SYNC_STATUS_ERROR;
    return false;
}

String Scheduler::getSyncTimestamp() {
    return lastSyncTimestamp;
}

String Scheduler::getSyncStatus() {
    return syncStatus;
}

String Scheduler::buildSyncTimestamp() {
    // Format: YYYY-MM-DD HH:MM:SS (dari RTC)
    // Gunakan getNow() (API yang tersedia) + method DateTime (RTClib)
    DateTime now = RTCManager::getNow();
    String ts = String(now.year()) + "-";
    if (now.month() < 10) ts += "0";
    ts += String(now.month()) + "-";
    if (now.day() < 10) ts += "0";
    ts += String(now.day()) + " ";
    if (now.hour() < 10) ts += "0";
    ts += String(now.hour()) + ":";
    if (now.minute() < 10) ts += "0";
    ts += String(now.minute()) + ":";
    if (now.second() < 10) ts += "0";
    ts += String(now.second());
    return ts;
}
