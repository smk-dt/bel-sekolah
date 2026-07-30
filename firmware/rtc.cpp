// ============================================
// SMART SCHOOL BELL IoT - RTC Manager Implementation
// ============================================
#include <WiFi.h>
#include "rtc.h"

RTC_DS3231 RTCManager::rtc;
bool RTCManager::rtcFound = false;
bool RTCManager::ntpSyncDone = false;
unsigned long RTCManager::lastNTPSync = 0;
const char* RTCManager::NTP_SERVER1 = "pool.ntp.org";
const char* RTCManager::NTP_SERVER2 = "time.google.com";

void RTCManager::begin() {
    LOG_INFO("RTC", "Initializing RTC DS3231");
    
    // Initialize I2C
    Wire.begin(PIN_RTC_SDA, PIN_RTC_SCL);
    
    // Detect RTC
    if (detectRTC()) {
        LOG_INFO("RTC", "DS3231 detected successfully");
        rtcFound = true;
        
        // Set to compile time if RTC lost power
        if (rtc.lostPower()) {
            LOG_WARN("RTC", "RTC lost power, setting to compile time");
            rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
        }
    } else {
        LOG_ERROR("RTC", "DS3231 not found on I2C bus");
        rtcFound = false;
    }
    
    updateSystemStatus();
}

void RTCManager::task(void* parameter) {
    LOG_INFO("RTC", "RTC task started");
    
    while (1) {
        // Try NTP sync periodically
        unsigned long now = millis();
        if (WiFi.status() == WL_CONNECTED && 
            (now - lastNTPSync > NTP_SYNC_INTERVAL_MS || !ntpSyncDone)) {
            
            LOG_INFO("RTC", "Attempting NTP sync...");
            if (syncRTCToNTP()) {
                ntpSyncDone = true;
                lastNTPSync = now;
                LOG_INFO("RTC", "NTP sync successful");
            } else if (rtcFound) {
                LOG_WARN("RTC", "NTP sync failed, using RTC time");
            } else {
                LOG_ERROR("RTC", "NTP failed, no RTC available");
            }
        }
        
        // Update system status
        updateSystemStatus();
        
        vTaskDelay(10000 / portTICK_PERIOD_MS); // Check every 10 seconds
    }
}

bool RTCManager::detectRTC() {
    // Try to find RTC on I2C bus
    Wire.beginTransmission(0x68); // DS3231 address
    return (Wire.endTransmission() == 0);
}

DateTime RTCManager::getNow() {
    if (rtcFound) {
        return rtc.now();
    }
    // Return fake time if no RTC
    return DateTime(2026, 1, 1, 0, 0, 0);
}

String RTCManager::getTimeString() {
    if (!rtcFound) return "--:--:--";
    DateTime now = rtc.now();
    char buf[9];
    sprintf(buf, "%02d:%02d:%02d", now.hour(), now.minute(), now.second());
    return String(buf);
}

String RTCManager::getDateString() {
    if (!rtcFound) return "---, -- --- ----";
    DateTime now = rtc.now();
    
    const char* days[] = {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"};
    const char* months[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                           "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
    
    char buf[25];
    sprintf(buf, "%s, %02d %s %04d", 
            days[now.dayOfTheWeek()],
            now.day(), 
            months[now.month() - 1], 
            now.year());
    return String(buf);
}

int RTCManager::getHour() {
    if (!rtcFound) return 0;
    return rtc.now().hour();
}

int RTCManager::getMinute() {
    if (!rtcFound) return 0;
    return rtc.now().minute();
}

int RTCManager::getSecond() {
    if (!rtcFound) return 0;
    return rtc.now().second();
}

int RTCManager::getDayOfWeek() {
    if (!rtcFound) return 0;
    DateTime now = rtc.now();
    // Convert Sunday=0 to Monday=1 .. Sunday=7
    int dow = now.dayOfTheWeek();
    return (dow == 0) ? 7 : dow;
}

bool RTCManager::syncFromNTP() {
    return syncRTCToNTP();
}

bool RTCManager::isSynced() {
    return ntpSyncDone;
}

float RTCManager::getTemperature() {
    if (!rtcFound) return 0.0;
    return rtc.getTemperature();
}

unsigned long RTCManager::getEpoch() {
    if (rtcFound) {
        return rtc.now().unixtime();
    }
    return 0;
}

bool RTCManager::syncRTCToNTP() {
    if (WiFi.status() != WL_CONNECTED) {
        return false;
    }
    
    configTime(GMT_OFFSET_SEC, 0, NTP_SERVER1, NTP_SERVER2);
    
    // Wait for NTP time
    time_t now = time(nullptr);
    int retries = 0;
    while (now < 100000 && retries < 10) {
        delay(500);
        now = time(nullptr);
        retries++;
    }
    
    if (now >= 100000 && rtcFound) {
        // Update RTC with NTP time
        struct tm* timeinfo = localtime(&now);
        rtc.adjust(DateTime(
            timeinfo->tm_year + 1900,
            timeinfo->tm_mon + 1,
            timeinfo->tm_mday,
            timeinfo->tm_hour,
            timeinfo->tm_min,
            timeinfo->tm_sec
        ));
        return true;
    }
    
    return false;
}

void RTCManager::updateSystemStatus() {
    g_sysStatus.rtcWorking = rtcFound;
    g_sysStatus.rtcTime = getTimeString();
    g_sysStatus.rtcDate = getDateString();
    g_sysStatus.rtcTemp = getTemperature();
}