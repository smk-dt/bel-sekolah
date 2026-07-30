// ============================================
// SMART SCHOOL BELL IoT - RTC DS3231 Manager
// ============================================
#ifndef RTC_MANAGER_H
#define RTC_MANAGER_H

#include <Wire.h>
#include <RTClib.h>
#include "config.h"

class RTCManager {
private:
    RTC_DS3231 rtc;
    bool _initialized;
    unsigned long lastNtpSync;
    bool lastNtpSyncSuccess;
    
    // NTP sync
    const char* ntpServer = "pool.ntp.org";
    const long gmtOffsetSec = 7 * 3600;  // WIB (UTC+7)
    const int daylightOffsetSec = 0;
    
    // Days of week in Indonesian
    const char* daysOfWeek[7] = {"Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"};

public:
    RTCManager() : _initialized(false), lastNtpSync(0), lastNtpSyncSuccess(false) {}
    
    // Initialize RTC
    bool begin() {
        Wire.begin(RTC_SDA_PIN, RTC_SCL_PIN);
        
        if (!rtc.begin()) {
            DEBUG_PRINTLN("[RTC] Couldn't find DS3231!");
            _initialized = false;
            return false;
        }
        
        DEBUG_PRINTLN("[RTC] DS3231 found!");
        
        // Check if RTC lost power
        if (rtc.lostPower()) {
            DEBUG_PRINTLN("[RTC] RTC lost power, setting from NTP...");
            // Will sync from NTP in main loop
        }
        
        _initialized = true;
        return true;
    }
    
    // Sync time from NTP
    bool syncFromNTP() {
        if (!_initialized) return false;
        
        DEBUG_PRINTLN("[RTC] Syncing from NTP...");
        
        configTime(gmtOffsetSec, daylightOffsetSec, ntpServer);
        
        struct tm timeinfo;
        if (!getLocalTime(&timeinfo)) {
            DEBUG_PRINTLN("[RTC] NTP sync failed!");
            lastNtpSyncSuccess = false;
            return false;
        }
        
        // Convert to UNIX timestamp
        time_t t = mktime(&timeinfo);
        
        // Adjust for timezone (mktime doesn't handle timezone well on ESP32)
        t += gmtOffsetSec;
        
        rtc.adjust(DateTime(t));
        
        DEBUG_PRINT("[RTC] Synced: ");
        DEBUG_PRINTLN(getFormattedDateTime());
        
        lastNtpSync = millis();
        lastNtpSyncSuccess = true;
        return true;
    }
    
    // Check if NTP sync is needed
    bool needsSync() {
        if (!lastNtpSyncSuccess) return true;
        return (millis() - lastNtpSync) > NTP_SYNC_INTERVAL_MS;
    }
    
    // Get current time as DateTime
    DateTime getDateTime() {
        if (!_initialized) {
            return DateTime(2024, 1, 1, 0, 0, 0);
        }
        return rtc.now();
    }
    
    // Get current hour (0-23)
    int getHour() {
        return getDateTime().hour();
    }
    
    // Get current minute (0-59)
    int getMinute() {
        return getDateTime().minute();
    }
    
    // Get current second (0-59)
    int getSecond() {
        return getDateTime().second();
    }
    
    // Get current day name (Indonesian)
    String getDayName() {
        int dayOfWeek = getDateTime().dayOfTheWeek();
        return String(daysOfWeek[dayOfWeek]);
    }
    
    // Get formatted time string (HH:MM:SS)
    String getFormattedTime() {
        DateTime now = getDateTime();
        char buf[9];
        sprintf(buf, "%02d:%02d:%02d", now.hour(), now.minute(), now.second());
        return String(buf);
    }
    
    // Get formatted date string (DD/MM/YYYY)
    String getFormattedDate() {
        DateTime now = getDateTime();
        char buf[11];
        sprintf(buf, "%02d/%02d/%04d", now.day(), now.month(), now.year());
        return String(buf);
    }
    
    // Get full formatted date time
    String getFormattedDateTime() {
        DateTime now = getDateTime();
        char buf[20];
        sprintf(buf, "%02d/%02d/%04d %02d:%02d:%02d", 
                now.day(), now.month(), now.year(),
                now.hour(), now.minute(), now.second());
        return String(buf);
    }
    
    // Get time as seconds since midnight
    int getTotalSeconds() {
        DateTime now = getDateTime();
        return now.hour() * 3600 + now.minute() * 60 + now.second();
    }
    
    // Get temperature from DS3231
    float getTemperature() {
        if (!_initialized) return 0.0;
        return rtc.getTemperature();
    }
    
    // Check if RTC is working
    bool isWorking() {
        return _initialized;
    }
    
    // Convert string time (HH:MM:SS) to total seconds
    static int timeToSeconds(const String& timeStr) {
        int h = 0, m = 0, s = 0;
        if (sscanf(timeStr.c_str(), "%d:%d:%d", &h, &m, &s) >= 2) {
            return h * 3600 + m * 60 + s;
        }
        return 0;
    }
    
    // Format seconds to HH:MM:SS
    static String secondsToTimeStr(int totalSec) {
        int h = totalSec / 3600;
        int m = (totalSec % 3600) / 60;
        int s = totalSec % 60;
        char buf[9];
        sprintf(buf, "%02d:%02d:%02d", h, m, s);
        return String(buf);
    }
};

#endif // RTC_MANAGER_H