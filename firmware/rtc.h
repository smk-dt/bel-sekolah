// ============================================
// SMART SCHOOL BELL IoT - RTC Manager Header
// ============================================
// Hardware: DS3231 via I2C (SDA=GPIO21, SCL=GPIO22)
// ============================================
#ifndef RTC_H
#define RTC_H

#include <Arduino.h>
#include <Wire.h>
#include <RTClib.h>
#include <time.h>
#include "config.h"
#include "utils.h"
#include "logger.h"

class RTCManager {
public:
    static void begin();
    static void task(void* parameter);
    
    // Time getters
    static DateTime getNow();
    static String getTimeString();
    static String getDateString();
    static int getHour();
    static int getMinute();
    static int getSecond();
    static int getDayOfWeek();  // 1=Monday, 7=Sunday
    
    // Sync
    static bool syncFromNTP();
    static bool isSynced();
    static float getTemperature();
    
    // Get epoch time
    static unsigned long getEpoch();
    
private:
    static RTC_DS3231 rtc;
    static bool rtcFound;
    static bool ntpSyncDone;
    static unsigned long lastNTPSync;
    static const char* NTP_SERVER1;
    static const char* NTP_SERVER2;
    static const int GMT_OFFSET_SEC = 7 * 3600;  // UTC+7 (WIB)
    
    static bool detectRTC();
    static bool syncRTCToNTP();
    static void updateSystemStatus();
};

#endif // RTC_H