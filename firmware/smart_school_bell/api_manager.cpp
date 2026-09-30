  #include "api_manager.h"
  #include "rtc_manager.h"
  #include "command_manager.h"
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>

  bool deviceApiRequest(const String& action, const String& payloadBody, int& httpCode, String* responseOut) {
    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(HTTP_TIMEOUT_MS / 1000);
    String body = "{\"device_id\":\"" + String(DEVICE_ID_STR) + "\",\"token\":\"" + String(DEVICE_TOKEN) + 
                  "\",\"action\":\"" + action + "\",\"payload\":" + payloadBody + "}";
    HTTPClient http;
    String url = String(SUPABASE_URL) + "/functions/v1/device-api";
    http.begin(client, url);
    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Content-Type", "application/json");
    unsigned long requestStartMs = millis();
    int code = http.POST(body);
    unsigned long postDurationMs = millis() - requestStartMs;
    httpCode = code;
    String response = http.getString();
    unsigned long responseDurationMs = millis() - requestStartMs - postDurationMs;
    if (responseOut) *responseOut = response;
    http.end();
    unsigned long endDurationMs = millis() - requestStartMs - postDurationMs - responseDurationMs;
    unsigned long totalDurationMs = millis() - requestStartMs;
    if (totalDurationMs > 100UL) {
      Serial.printf("[HTTP BLOCK] %s POST=%lu ms GET_RESPONSE=%lu ms END=%lu ms TOTAL=%lu ms\n",
                    action.c_str(), postDurationMs, responseDurationMs, endDurationMs, totalDurationMs);
    }
    return code > 0;
  }

  void registerDevice() {
    RtcDateTime t = getRtcTime();
    String payload = "{\"device_id\":\"" + String(DEVICE_ID_STR) + "\",\"device_name\":\"" + String(DEVICE_NAME) + 
                    "\",\"firmware_version\":\"" + String(FIRMWARE_VERSION) + "\",\"status\":\"online\",\"ip_address\":\"" + 
                    WiFi.localIP().toString() + "\",\"wifi_ssid\":\"" + String(WIFI_SSID) + "\",\"wifi_rssi\":" + 
                    String(WiFi.RSSI()) + ",\"rtc_time\":\"" + formatIsoUtc(t) + "\",\"rtc_status\":\"" + 
                    String(rtcOk?"ok":"error") + "\",\"ntp_status\":\"" + String(ntpSynced?"synced":"not_synced") + 
                    "\",\"dfplayer_status\":\"" + String(dfPlayerOk?"ok":"error") + "\",\"micro_sd_status\":\"" + 
                    String(microSdOk?"ready":"not_detected") + "\",\"relay1\":" + String(relay1State?"true":"false") + 
                    ",\"relay2\":" + String(relay2State?"true":"false") + ",\"bell_status\":\"" + 
                    String(bellState==BELL_IDLE?"standby":"ringing") + "\",\"last_boot\":\"" + formatIsoUtc(t) + 
                    "\",\"last_seen\":\"" + formatIsoUtc(t) + "\"}";
    int code;
    if (!deviceApiRequest("register", payload, code)) {
      internetOk = false;
      Serial.printf("[DEVICE API] register request failed HTTP=%d\n", code);
      return;
    }
    internetOk = (code == 200 || code == 201);
    supabaseRegistered = internetOk;
    Serial.printf("[DEVICE API] register HTTP=%d registered=%s\n", code, supabaseRegistered ? "yes" : "no");
    if (!supabaseRegistered) Serial.println("[DEVICE API] Check device token/Edge Function secret");
  }

  void sendHeartbeat() {
    RtcDateTime t = getRtcTime();
    String payload = "{\"status\":\"online\",\"ip_address\":\"" + WiFi.localIP().toString() + "\",\"wifi_ssid\":\"" + 
                    String(WIFI_SSID) + "\",\"wifi_rssi\":" + String(WiFi.RSSI()) + ",\"rtc_time\":\"" + 
                    formatIsoUtc(t) + "\",\"rtc_status\":\"" + String(rtcOk?"ok":"error") + "\",\"relay1\":" + 
                    String(relay1State?"true":"false") + ",\"relay2\":" + String(relay2State?"true":"false") + 
                    ",\"bell_status\":\"" + String(bellState==BELL_IDLE?"standby":"ringing") + 
                    "\",\"last_seen\":\"" + formatIsoUtc(t) + "\"}";
    int code; String resp;
    if (!deviceApiRequest("heartbeat", payload, code, &resp)) {
      internetOk = false;
      Serial.printf("[HEARTBEAT DEBUG] request failed HTTP=%d\n", code);
      return;
    }
    internetOk = true;
    Serial.printf("[HEARTBEAT DEBUG] HTTP=%d\n", code);
    Serial.printf("[HEARTBEAT DEBUG] response=%s\n", resp.c_str());
    if (code == 200 || code == 201) processCommandsFromResponse(resp);
  }

  void handleSupabaseHeartbeat(unsigned long now) {
    if (bellState != BELL_IDLE || !wifiOk || (now - lastHeartbeatMs) < HEARTBEAT_INTERVAL_MS) return;
    lastHeartbeatMs = now;
    if (!supabaseRegistered) registerDevice();
    else sendHeartbeat();
  }
  static unsigned long lastCommandPollMs = 0;

  void pollCommands() {
    int code; String resp;
    Serial.println("[CMD] Polling...");
    if (!deviceApiRequest("commands", "{}", code, &resp)) {
      internetOk = false;
      Serial.printf("[CMD] Poll failed HTTP=%d\n", code);
      return;
    }
    internetOk = (code == 200 || code == 201);
    Serial.printf("[CMD] Poll HTTP=%d\n", code);
    if (internetOk && !pendingCommandResponseReady) {
      pendingCommandResponse = resp;
      pendingCommandResponseReady = true;
    }
  }

  void handleCommandPolling(unsigned long now) {
    if (bellState != BELL_IDLE || !wifiOk || !supabaseRegistered || (now - lastCommandPollMs) < COMMAND_POLL_INTERVAL_MS) return;
    lastCommandPollMs = now;
    pollCommands();
  }

