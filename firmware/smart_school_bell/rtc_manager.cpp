#include "rtc_manager.h"

void initRTC() {
  Serial.println("[RTC] Initializing DS1302...");
  Rtc.Begin();

  if (Rtc.GetIsWriteProtected()) {
    Rtc.SetIsWriteProtected(false);
    Serial.println("[RTC] Write protection disabled");
  }

  if (!Rtc.GetIsRunning()) {
    Rtc.SetIsRunning(true);
    Serial.println("[RTC] Clock started");
  }

  RtcDateTime now = Rtc.GetDateTime();
  if (!Rtc.IsDateTimeValid() || now.Year() < RTC_VALID_YEAR_MIN || now.Year() > RTC_VALID_YEAR_MAX) {
    Serial.println("[RTC] Invalid time; setting compile time...");
    Rtc.SetDateTime(RtcDateTime(__DATE__, __TIME__));
    now = Rtc.GetDateTime();
  }

  rtcOk = now.IsValid() && now.Year() >= RTC_VALID_YEAR_MIN && now.Year() <= RTC_VALID_YEAR_MAX;
  Serial.println(rtcOk ? "[RTC] DS1302 status: OK" : "[RTC] DS1302 status: INVALID");
  Serial.print("[RTC] Time: ");
  Serial.println(formatDateTime(now));
}

void handleRTC(unsigned long now) {
  if (!rtcOk || (now - lastRtcCheckMs) < RTC_CHECK_INTERVAL_MS) {
    return;
  }
  lastRtcCheckMs = now;

  RtcDateTime t = Rtc.GetDateTime();
  if (!t.IsValid() || t.Year() < RTC_VALID_YEAR_MIN || t.Year() > RTC_VALID_YEAR_MAX) {
    rtcOk = false;
    Serial.println("[RTC] ERROR: DS1302 read failed");
  }
}

RtcDateTime getRtcTime() {
  if (!rtcOk) return RtcDateTime(0);
  return Rtc.GetDateTime();
}

String formatDateTime(const RtcDateTime& dt) {
  char str[20];
  sprintf(str, "%04u-%02u-%02u %02u:%02u:%02u",
          dt.Year(), dt.Month(), dt.Day(),
          dt.Hour(), dt.Minute(), dt.Second());
  return String(str);
}

String formatIsoUtc(const RtcDateTime& dt) {
  char str[25];
  sprintf(str, "%04u-%02u-%02uT%02u:%02u:%02uZ",
          dt.Year(), dt.Month(), dt.Day(),
          dt.Hour(), dt.Minute(), dt.Second());
  return String(str);
}
