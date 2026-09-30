#include "command_manager.h"
#include "relay_manager.h"
#include "dfplayer_manager.h"
#include "bell_manager.h"
#include "bell_test.h"
#include <ArduinoJson.h>

void processCommand(const String& cmdId, const String& cmdType, const String& cmdPayload) {
  Serial.printf("[CMD DEBUG] id=%s type=%s payload=%s\n", cmdId.c_str(), cmdType.c_str(), cmdPayload.c_str());
  Serial.print("[CMD] Executing: "); Serial.println(cmdType);
  lastHeartbeatMs = 0; // Trigger heartbeat segera setelah command relay

  if (cmdType == "relay_1_on") relay1On();
  else if (cmdType == "relay_1_off") relay1Off();
  else if (cmdType == "relay_2_on") relay2On();
  else if (cmdType == "relay_2_off") relay2Off();
  else if (cmdType == "relay_all_on") relayAllOn();
  else if (cmdType == "relay_all_off") relayAllOff();
  else if (cmdType == "play_audio") {
    int track = 0; int idx = cmdPayload.indexOf("\"track\"");
    if (idx >= 0) { idx = cmdPayload.indexOf(':', idx); if (idx >= 0) track = cmdPayload.substring(idx + 1).toInt(); }
    if (track > 0 && track <= 255) playTrack((uint8_t)track);
  } else if (cmdType == "bell_test") {
    executeBellTest(cmdPayload);
  } else if (cmdType == "stop") stopTrack();
  else if (cmdType == "sync_schedule" || cmdType == "refresh_schedule") scheduleSyncRequested = true;
}

void processCommandsFromResponse(const String& response) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  DynamicJsonDocument doc(4096);
#endif
  DeserializationError error = deserializeJson(doc, response);
  if (error) { Serial.printf("[CMD DEBUG] JSON parse failed: %s\n", error.c_str()); return; }
  JsonArray commands = doc["commands"].as<JsonArray>();
  if (commands.isNull()) { Serial.println("[CMD DEBUG] commands array missing"); return; }
  if (commands.size() > 0) Serial.printf("[CMD] Received %d command(s)\n", commands.size());
  for (JsonObject cmd : commands) {
    String id = cmd["id"] | ""; String type = cmd["type"] | ""; String payload = "{}";
    if (cmd["payload"].is<JsonObject>() || cmd["payload"].is<JsonArray>()) serializeJson(cmd["payload"], payload);
    else if (cmd["payload"].is<String>()) payload = cmd["payload"].as<String>();
    if (type.length() > 0) processCommand(id, type, payload);
  }
}