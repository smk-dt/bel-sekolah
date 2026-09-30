#include "ntp_manager.h"
#include "rtc_manager.h"
#include <time.h>

void applyNtpTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo, 500)) return;
  Serial.printf("[NTP] Sync successful: %04d-%02d-%02d %02d:%02d:%02d WIB\n",
                timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);

  Rtc.SetDateTime(RtcDateTime(timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                              timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec));
  Serial.println("[RTC] Time updated from NTP");
  rtcOk = true; ntpSynced = true;
}

bool syncTimeFromNTP() {
  Serial.println("[NTP] Synchronizing...");
  configTime(7 * 3600, 0, NTP_SERVER);
  time_t now_t = 0;
  for (unsigned long start = millis(); (millis() - start) < NTP_TIMEOUT_MS;) {
    time(&now_t); if (now_t > 1700000000) break;
    delay(500);
  }
  if (now_t < 1700000000) { Serial.println("[NTP] Sync timeout"); return false; }
  lastNtpSyncMs = millis();
  applyNtpTime();
  return true;
}

void handleNtpSync(unsigned long now) {
  if (ntpInProgress) {
    time_t now_t; time(&now_t);
    if (now_t > 1700000000) { ntpInProgress = false; lastNtpSyncMs = now; applyNtpTime(); }
    else if ((now - ntpStartMs) >= NTP_TIMEOUT_MS) { ntpInProgress = false; lastNtpSyncMs = now; Serial.println("[NTP] Sync timeout"); }
    return;
  }
  if (!wifiOk) return;
  if (!ntpManualSyncReq && (now - lastNtpSyncMs) < NTP_SYNC_INTERVAL_MS) return;

  bool initial = ntpManualSyncReq;
  ntpManualSyncReq = false; lastNtpSyncMs = now;
  Serial.println(initial ? "[NTP] Starting initial sync..." : "[NTP] Synchronizing...");
  configTime(7 * 3600, 0, NTP_SERVER);
  ntpInProgress = true; ntpStartMs = now;
}
