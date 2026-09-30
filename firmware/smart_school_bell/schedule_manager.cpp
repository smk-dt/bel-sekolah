#include "schedule_manager.h"
#include "rtc_manager.h"
#include "bell_manager.h"
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

bool addSchedule(const char* name, uint8_t day, uint8_t hour, uint8_t minute, uint8_t track, bool enabled) {
  if (scheduleCount >= SCHEDULE_MAX) return false;
  SchedEntry& e = scheduleCache[scheduleCount];
  strncpy(e.name, name, sizeof(e.name) - 1);
  e.name[sizeof(e.name) - 1] = '\0';
  e.day = day;
  e.hour = hour;
  e.minute = minute;
  e.track = track;
  e.enabled = enabled;
  e.lastTriggerKey = 0xFFFFFFFF;
  scheduleCount++;
  return true;
}

void clearScheduleCache() {
  scheduleCount = 0;
}

const char* scheduleDayName(uint8_t day) {
  static const char* names[8] = {"", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"};
  return (day >= 1 && day <= 7) ? names[day] : "?";
}

void printSchedule() {
  Serial.printf("[SCHEDULE] Cached entries (%d/%d):\n", scheduleCount, SCHEDULE_MAX);
  if (scheduleCount == 0) {
    Serial.println("  (empty)");
    return;
  }
  for (int i = 0; i < scheduleCount; i++) {
    const SchedEntry& e = scheduleCache[i];
    Serial.printf("  #%d %s %02d:%02d track=%d %s %s\n",
                  i + 1, e.day ? scheduleDayName(e.day) : "EVERY DAY",
                  e.hour, e.minute, e.track, e.enabled ? "ON" : "OFF", e.name);
  }
}

void checkSchedule() {
  unsigned long now = millis();
  if ((now - lastSchedCheckMs) < SCHEDULE_CHECK_INTERVAL_MS) return;
  lastSchedCheckMs = now;
  if (!rtcOk) return;

  RtcDateTime t = getRtcTime();
  uint8_t dow = t.DayOfWeek();
  uint8_t isoDow = (dow == 0) ? 7 : dow;
  uint8_t hh = t.Hour();
  uint8_t mm = t.Minute();

  static unsigned long lastSummaryMs = 0;
  if (SCHEDULE_VERBOSE_DEBUG == 0 && (now - lastSummaryMs >= 30000)) {
    Serial.printf("[SCHEDULE] RTC=%04d-%02d-%02d %02d:%02d:%02d DOW=%d cache=%d\n",
                  t.Year(), t.Month(), t.Day(), hh, mm, t.Second(), isoDow, scheduleCount);
    lastSummaryMs = now;
  }

  for (int i = 0; i < scheduleCount; i++) {
    SchedEntry& e = scheduleCache[i];
    if (SCHEDULE_VERBOSE_DEBUG == 1) {
      Serial.printf("[SCHEDULE DEBUG] #%d day=%d time=%02d:%02d enabled=%d track=%d\n",
                    i, e.day, e.hour, e.minute, e.enabled ? 1 : 0, e.track);
    }
    if (!e.enabled) continue;

    if ((e.day == 0 || e.day == isoDow) && (e.hour == hh) && (e.minute == mm)) {
      uint32_t dateKey = (uint32_t)t.Year() * 10000UL + (uint32_t)t.Month() * 100UL + (uint32_t)t.Day();
      uint32_t key = dateKey * 10000UL + (uint32_t)hh * 100UL + (uint32_t)mm;

      if (e.lastTriggerKey == key) {
        static unsigned long lastBlockLogMs[SCHEDULE_MAX] = {0};
        if (now - lastBlockLogMs[i] >= 60000) {
          Serial.printf("[SCHEDULE] #%d blocked - already triggered\n", i);
          lastBlockLogMs[i] = now;
        }
        continue;
      }

      if (bellState != BELL_IDLE) {
        static unsigned long lastBusyLogMs[SCHEDULE_MAX] = {0};
        if (now - lastBusyLogMs[i] >= 60000) {
          Serial.printf("[SCHEDULE] #%d blocked - bell busy\n", i);
          lastBusyLogMs[i] = now;
        }
        continue;
      }

      e.lastTriggerKey = key;
      Serial.printf("[SCHEDULE MATCH] #%d day=%d time=%02d:%02d track=%d\n", i, e.day, hh, mm, e.track);
      startBell(e.track, false);
      break;
    }
  }
}

void printNextBell() {
  if (!rtcOk) { Serial.println("[SCHEDULE] next: unknown (RTC unavailable)"); return; }
  if (scheduleCount == 0) { Serial.println("[SCHEDULE] next: none (no cached schedules)"); return; }

  RtcDateTime t = getRtcTime();
  uint8_t today = (t.DayOfWeek() == 0) ? 7 : t.DayOfWeek();
  int curMin = t.Hour() * 60 + t.Minute();
  int bestAhead = 7 * 1440 + 1;
  int bestIdx = -1;

  for (int i = 0; i < scheduleCount; i++) {
    const SchedEntry& e = scheduleCache[i];
    if (!e.enabled) continue;
    int schMin = e.hour * 60 + e.minute;
    int ahead = schMin;
    if (e.day != 0 && e.day != today) ahead += ((e.day + 7 - today) % 7) * 1440;
    if (ahead <= curMin) ahead += (e.day == 0 ? 1440 : 7 * 1440);
    if (ahead < bestAhead) { bestAhead = ahead; bestIdx = i; }
  }

  if (bestIdx < 0) { Serial.println("[SCHEDULE] next: none (all entries disabled)"); return; }
  const SchedEntry& e = scheduleCache[bestIdx];
  int days = bestAhead / 1440;
  int hh = (bestAhead % 1440) / 60;
  int mm = bestAhead % 60;
  Serial.print("[SCHEDULE] next: ");
  if (days == 0) Serial.print("TODAY");
  else if (days == 1) Serial.print("TOMORROW");
  else { Serial.print("in "); Serial.print(days); Serial.printf(" days (%s)", scheduleDayName(e.day)); }
  Serial.printf(" %02d:%02d track=%d %s\n", hh, mm, e.track, e.name);
}

bool syncSchedulesFromServer() {
  if (!wifiOk) { Serial.println("[SCHEDULE] Sync skipped - no WiFi (cache retained)"); return false; }
  Serial.println("[SCHEDULE] Sync started");

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(HTTP_TIMEOUT_MS / 1000);
  String body = "{\"device_id\":\"" + String(DEVICE_ID_STR) + "\",\"token\":\"" + String(DEVICE_TOKEN) + "\",\"action\":\"get_schedule\"}";
  String url = String(SUPABASE_URL) + "/functions/v1/schedule-api";

  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Content-Type", "application/json");

  unsigned long requestStartMs = millis();
  int code = http.POST(body);
  unsigned long postDurationMs = millis() - requestStartMs;
  String resp = http.getString();
  unsigned long responseDurationMs = millis() - requestStartMs - postDurationMs;
  http.end();
  unsigned long endDurationMs = millis() - requestStartMs - postDurationMs - responseDurationMs;
  unsigned long totalDurationMs = millis() - requestStartMs;
  if (totalDurationMs > 100UL) {
    Serial.printf("[HTTP BLOCK] schedule POST=%lu ms GET_RESPONSE=%lu ms END=%lu ms TOTAL=%lu ms\n",
                  postDurationMs, responseDurationMs, endDurationMs, totalDurationMs);
  }
  Serial.printf("[SCHEDULE] HTTP %d\n", code);

  if (code <= 0) { Serial.println("[SCHEDULE] Sync failed - network/timeout (cache retained)"); return false; }
  if (code != 200) { Serial.printf("[SCHEDULE] Server error HTTP %d (cache retained)\n", code); return false; }

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  DynamicJsonDocument doc(16384);
#endif
  DeserializationError err = deserializeJson(doc, resp);
  if (err) { Serial.println("[SCHEDULE] JSON parse failed (cache retained)"); return false; }
  if (!doc["ok"].as<bool>()) { Serial.println("[SCHEDULE] Server ok=false (cache retained)"); return false; }

  JsonArray arr = doc["schedules"].as<JsonArray>();
  if (arr.isNull()) { Serial.println("[SCHEDULE] Missing schedules array (cache retained)"); return false; }

  SchedEntry tmp[SCHEDULE_MAX];
  int tmpCount = 0;
  int skipped = 0;

  for (JsonObject o : arr) {
    if (tmpCount >= SCHEDULE_MAX) break;
    int day = -1;
    if (o["day"].is<int>()) day = o["day"].as<int>();
    else if (o["day_of_week"].is<int>()) day = o["day_of_week"].as<int>();
    else if (o["day"].is<const char*>()) {
      const char* dayStr = o["day"].as<const char*>();
      if (dayStr) {
        if (strcasecmp(dayStr, "Monday") == 0) day = 1;
        else if (strcasecmp(dayStr, "Tuesday") == 0) day = 2;
        else if (strcasecmp(dayStr, "Wednesday") == 0) day = 3;
        else if (strcasecmp(dayStr, "Thursday") == 0) day = 4;
        else if (strcasecmp(dayStr, "Friday") == 0) day = 5;
        else if (strcasecmp(dayStr, "Saturday") == 0) day = 6;
        else if (strcasecmp(dayStr, "Sunday") == 0) day = 7;
      }
    }
    if (day < 0 || day > 7) { skipped++; continue; }

    const char* timeStr = o["time"] | "";
    int track = o["track"] | 0;
    bool enabled = o["enabled"].is<bool>() ? o["enabled"].as<bool>() : true;
    if (track <= 0 || track > 255) { skipped++; continue; }

    int hh = -1, mm = -1;
    if (timeStr && strlen(timeStr) >= 4) {
      char tbuf[9] = {0}; strncpy(tbuf, timeStr, 8);
      char* c1 = strchr(tbuf, ':');
      if (c1) { *c1 = '\0'; hh = atoi(tbuf); mm = atoi(c1 + 1); }
    }
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) { skipped++; continue; }

    const char* dName = o["name"] | o["label"] | "Bell";
    strncpy(tmp[tmpCount].name, dName, sizeof(tmp[tmpCount].name)-1);
    tmp[tmpCount].name[sizeof(tmp[tmpCount].name)-1] = '\0';
    tmp[tmpCount].day = (uint8_t)day;
    tmp[tmpCount].hour = (uint8_t)hh;
    tmp[tmpCount].minute = (uint8_t)mm;
    tmp[tmpCount].track = (uint8_t)track;
    tmp[tmpCount].enabled = enabled;

    uint32_t prevKey = 0xFFFFFFFF;
    for (int j = 0; j < scheduleCount; j++) {
      const SchedEntry& old = scheduleCache[j];
      if (old.day == (uint8_t)day && old.hour == (uint8_t)hh && old.minute == (uint8_t)mm && old.track == (uint8_t)track) {
        prevKey = old.lastTriggerKey; break;
      }
    }
    tmp[tmpCount].lastTriggerKey = prevKey;
    tmpCount++;
  }

  if (tmpCount == 0 && arr.size() > 0) { Serial.println("[SCHEDULE] All entries invalid (cache retained)"); return false; }
  for (int i = 0; i < tmpCount; i++) scheduleCache[i] = tmp[i];
  scheduleCount = tmpCount;
  Serial.printf("[SCHEDULE] Sync success - %d entries\n", scheduleCount);
  return true;
}

void handleScheduleSync(unsigned long now) {
  if (bellState != BELL_IDLE || !wifiOk) return;
  if (scheduleSyncRequested) {
    scheduleSyncRequested = false; syncWasImmediate = true; lastScheduleSyncMs = now;
    Serial.println("[SCHEDULE] Immediate sync started");
    syncSchedulesFromServer(); syncWasImmediate = false;
  } else if ((now - lastScheduleSyncMs) >= SCHEDULE_SYNC_INTERVAL_MS) {
    lastScheduleSyncMs = now; syncSchedulesFromServer();
  }
}
