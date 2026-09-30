#include "serial_manager.h"
#include "relay_manager.h"
#include "rtc_manager.h"
#include "dfplayer_manager.h"
#include "bell_manager.h"
#include "schedule_manager.h"
#include "ntp_manager.h"
String serialBuffer = "";
void printHelp() { Serial.println("=== Available commands ==="); Serial.println("R1 ON/OFF, R2 ON/OFF, ALL ON/OFF, STATUS, RTC, TIME, SYNC TIME, PLAY <n>, STOP, DFSTATUS, BELL TEST <n>, SCHEDULE, NEXT BELL, SYNC SCHEDULE, HELP"); }
void printTimeInfo() { Serial.println("RTC:"); if (rtcOk) Serial.println("  " + formatDateTime(getRtcTime())); else Serial.println("  N/A"); Serial.println("NTP: " + String(ntpSynced?"SYNCED":"NOT SYNCED")); }
void printStatus() { Serial.printf("[STATUS]\nWiFi: %s\n", wifiOk?"CONNECTED":"DISCONNECTED"); if (wifiOk) Serial.println("IP: " + WiFi.localIP().toString()); Serial.printf("RTC: %s\nNTP: %s\nRelay 1: %s\nRelay 2: %s\nDFPlayer: %s\nMicroSD: %s\nBell: %s", rtcOk?"OK":"INVALID", ntpSynced?"SYNCED":"NOT SYNCED", relay1State?"ON":"OFF", relay2State?"ON":"OFF", dfPlayerOk?"OK":"ERROR", microSdOk?"OK":"ERROR", bellStateName()); if (bellState != BELL_IDLE) Serial.printf(" (track %d)", bellTrack); Serial.printf("\nSchedules: %d\nDevice API: %s\n", scheduleCount, supabaseRegistered?"registered":"not registered"); }
void handleSerialCommand(String cmd) { cmd.toUpperCase(); if (cmd == "R1 ON") relay1On(); else if (cmd == "R1 OFF") relay1Off(); else if (cmd == "R2 ON") relay2On(); else if (cmd == "R2 OFF") relay2Off(); else if (cmd == "ALL ON") relayAllOn(); else if (cmd == "ALL OFF") relayAllOff(); else if (cmd == "STATUS") printStatus(); else if (cmd == "RTC" || cmd == "TIME") printTimeInfo(); else if (cmd == "SYNC TIME") { if (wifiOk) ntpManualSyncReq = true; } else if (cmd.startsWith("PLAY ")) playTrack((uint8_t)cmd.substring(5).toInt()); else if (cmd == "STOP") { dbgStopReason = "MANUAL_STOP"; stopTrack(); } else if (cmd == "DFSTATUS") printDFStatus(); else if (cmd.startsWith("BELL TEST ")) startBell((uint8_t)cmd.substring(10).toInt(), true); else if (cmd == "SCHEDULE") printSchedule(); else if (cmd == "NEXT BELL") printNextBell(); else if (cmd == "SYNC SCHEDULE") { scheduleSyncRequested = true; Serial.println("[SCHEDULE] Sync requested"); } else if (cmd == "HELP") printHelp(); }
void handleSerial() { while (Serial.available() > 0) { char c = (char)Serial.read(); if (c == '\n') { serialBuffer.trim(); if (serialBuffer.length() > 0) handleSerialCommand(serialBuffer); serialBuffer = ""; } else if (c != '\r') { if (serialBuffer.length() < 64) serialBuffer += c; } } }
