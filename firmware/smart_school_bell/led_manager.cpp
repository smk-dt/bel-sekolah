#include "led_manager.h"
#include "rtc_manager.h"

void initLED() {
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LED_OFF_VALUE);
}

void handleLED(unsigned long now) {
  if (wifiOk) digitalWrite(PIN_LED, LED_ON_VALUE);
  else if ((now - lastLedToggleMs) >= 500) {
    lastLedToggleMs = now; ledOn = !ledOn;
    digitalWrite(PIN_LED, ledOn ? LED_ON_VALUE : LED_OFF_VALUE);
  }
}

void handleRtcTest(unsigned long now) {
  if (RTC_TEST_ENABLED == 0 || (now - lastRtcTestMs) < 5000UL) return;
  lastRtcTestMs = now;
  if (rtcOk) Serial.printf("[RTC TEST] %s\n", formatDateTime(getRtcTime()).c_str());
}

void handleRtcRawTest(unsigned long now) {
  if (RTC_RAW_TEST_ENABLED == 0 || (now - lastRtcRawTestMs) < 2000UL) return;
  lastRtcRawTestMs = now;
  if (rtcOk) {
    RtcDateTime t = getRtcTime();
    Serial.printf("[RTC RAW] %u-%u-%u %u:%u:%u | Unix: %u\n",
                  t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Unix32Time());
  }
}
