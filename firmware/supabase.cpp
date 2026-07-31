// ============================================
// SMART SCHOOL BELL IoT - Supabase REST Client Implementation
// ============================================
#include <WiFi.h>
#include "supabase.h"
#include "rtc.h"
#include "relay.h"
#include "dfplayer.h"
#include "scheduler.h"

// Static members
WiFiClientSecure SupabaseClient::client;
HTTPClient SupabaseClient::http;
String SupabaseClient::lastScheduleData = "";
unsigned long SupabaseClient::lastFetchTime = 0;
unsigned long SupabaseClient::lastStatusUpdate = 0;
unsigned long SupabaseClient::lastCommandPoll = 0;
bool SupabaseClient::initialized = false;
MissedLogEntry SupabaseClient::missedLogs[50];
int SupabaseClient::missedLogCount = 0;

void SupabaseClient::begin() {
    LOG_INFO("SUPABASE", "Initializing Supabase client");

    // Verify SSL certificate
    verifySSL();

    // Log connection info
    LOG_INFO("SUPABASE", "Supabase URL: " + String(SUPABASE_URL));
    String supabaseKeyPreview = String(SUPABASE_ANON_KEY).substring(0, 10);
    LOG_INFO("SUPABASE", "Supabase Key: " + supabaseKeyPreview + "...");

    initialized = true;
}

void SupabaseClient::task(void* parameter) {
    LOG_INFO("SUPABASE", "Supabase task started");

    while (1) {
        if (WiFi.status() == WL_CONNECTED) {
            unsigned long now = millis();

            // 1. Fetch schedule periodically (every SUPABASE_FETCH_INTERVAL_MS)
            if (now - lastFetchTime > SUPABASE_FETCH_INTERVAL_MS || lastFetchTime == 0) {
                LOG_DEBUG("SUPABASE", "Fetching schedule...");
                if (fetchSchedule()) {
                    lastFetchTime = now;
                }
            }

            // 2. Send enhanced heartbeat periodically (every 10 seconds)
            if (now - lastStatusUpdate > 10000 || lastStatusUpdate == 0) {
                LOG_DEBUG("SUPABASE", "Sending enhanced heartbeat...");
                if (sendEnhancedHeartbeat()) {
                    lastStatusUpdate = now;
                }
            }

            // 3. Poll for pending commands periodically (every 3 seconds)
            if (now - lastCommandPoll > 3000 || lastCommandPoll == 0) {
                LOG_DEBUG("SUPABASE", "Polling for commands...");
                if (listenForCommands()) {
                    lastCommandPoll = now;
                }
            }

            // 4. Flush missed logs if any
            if (missedLogCount > 0) {
                LOG_DEBUG("SUPABASE", "Flushing " + String(missedLogCount) + " missed logs...");
                flushMissedLogs();
            }
        } else {
            // WiFi not connected - buffer logs that would be sent
            static unsigned long lastWiFiWarn = 0;
            if (millis() - lastWiFiWarn > 30000) {
                LOG_WARN("SUPABASE", "WiFi disconnected, skipping API calls");
                lastWiFiWarn = millis();
            }
        }

        vTaskDelay(2000 / portTICK_PERIOD_MS); // Loop every 2 seconds
    }
}

// ============================================
// SCHEDULE FETCH
// ============================================
bool SupabaseClient::fetchSchedule() {
    if (!initialized || WiFi.status() != WL_CONNECTED) return false;

    // Use RPC get_today_schedule
    String url = buildUrl("/rest/v1/rpc/get_today_schedule");
    String response;

    int httpCode = httpPost(url, "{}", response);

    if (httpCode == 200) {
        lastScheduleData = response;
        LOG_INFO("SUPABASE", "Schedule fetched: " + String(response.length()) + " bytes");

        // Update schedule count
        DynamicJsonDocument doc(16384);
        DeserializationError error = deserializeJson(doc, response);
        if (!error) {
            g_sysStatus.schedulesCount = doc.as<JsonArray>().size();
        }

        // NEW: Forward fetched schedule to Scheduler for execution
        Scheduler::updateSchedule(response);

        return true;
    } else {
        LOG_ERROR("SUPABASE", "Fetch schedule failed: HTTP " + String(httpCode));
        return false;
    }
}

bool SupabaseClient::updateStatus(const String& statusJson) {
    if (!initialized || WiFi.status() != WL_CONNECTED) return false;

    // This is kept for backward compatibility - actual status goes via heartbeat
    String url = buildUrl("/rest/v1/rpc/update_device_status");
    String response;

    int httpCode = httpPost(url, statusJson, response);

    if (httpCode == 200 || httpCode == 201 || httpCode == 204) {
        LOG_DEBUG("SUPABASE", "Status updated successfully");
        return true;
    } else {
        LOG_ERROR("SUPABASE", "Status update failed: HTTP " + String(httpCode));
        return false;
    }
}

bool SupabaseClient::testConnection() {
    if (!initialized || WiFi.status() != WL_CONNECTED) return false;

    // Simple health check - query the Supabase REST API
    String url = buildUrl("/rest/v1/");
    String response;

    int httpCode = httpGet(url, response);

    if (httpCode == 200) {
        LOG_INFO("SUPABASE", "Connection test successful");
        return true;
    } else {
        LOG_ERROR("SUPABASE", "Connection test failed: HTTP " + String(httpCode));
        return false;
    }
}

// ============================================
// ENHANCED HEARTBEAT
// ============================================
bool SupabaseClient::sendHeartbeat() {
    // Legacy - delegates to enhanced version
    return sendEnhancedHeartbeat();
}

bool SupabaseClient::sendEnhancedHeartbeat() {
    if (!initialized || WiFi.status() != WL_CONNECTED) return false;

    // Get current RTC time
    String currentTime = g_sysStatus.rtcTime;
    if (currentTime == "--:--:--" || currentTime.length() == 0) {
        // Fallback if RTC not synced yet
        currentTime = RTCManager::getTimeString();
    }

    // Build full heartbeat payload
    DynamicJsonDocument doc(512);
    doc["p_device_id"] = g_sysStatus.deviceId;
    doc["p_online"] = true;
    doc["p_ip_address"] = g_sysStatus.ipAddress;
    doc["p_wifi_rssi"] = g_sysStatus.wifiRSSI;
    doc["p_uptime"] = (long)(millis() / 1000);
    doc["p_free_heap"] = ESP.getFreeHeap();
    doc["p_current_time"] = currentTime;
    doc["p_relay1"] = g_sysStatus.relay1State;
    doc["p_relay2"] = g_sysStatus.relay2State;
    doc["p_bell_status"] = g_sysStatus.bellActive ? "ringing" : (g_sysStatus.testActive ? "test" : "standby");
    doc["p_schedules_count"] = g_sysStatus.schedulesCount;
    doc["p_firmware_version"] = FIRMWARE_VERSION;
    doc["p_rtc_temp"] = RTCManager::getTemperature();
    doc["p_dfplayer_connected"] = g_sysStatus.dfplayerConnected;

    String body;
    serializeJson(doc, body);

    String url = buildUrl("/rest/v1/rpc/heartbeat");
    String response;

    int httpCode = httpPost(url, body, response);

    if (httpCode == 200 || httpCode == 201 || httpCode == 204) {
        LOG_DEBUG("SUPABASE", "Heartbeat sent successfully");
        return true;
    } else {
        LOG_WARN("SUPABASE", "Heartbeat failed: HTTP " + String(httpCode));
        return false;
    }
}

// ============================================
// COMMAND LISTENER
// ============================================
bool SupabaseClient::listenForCommands() {
    if (!initialized || WiFi.status() != WL_CONNECTED) return false;

    // Call RPC function get_pending_commands
    String url = buildUrl("/rest/v1/rpc/get_pending_commands");

    DynamicJsonDocument reqDoc(128);
    reqDoc["p_device_id"] = g_sysStatus.deviceId;
    String reqBody;
    serializeJson(reqDoc, reqBody);

    String response;
    int httpCode = httpPost(url, reqBody, response);

    if (httpCode == 200) {
        // Parse response array of commands
        DynamicJsonDocument respDoc(2048);
        DeserializationError error = deserializeJson(respDoc, response);

        if (!error) {
            JsonArray commands = respDoc.as<JsonArray>();

            if (commands.size() > 0) {
                LOG_INFO("SUPABASE", "Received " + String(commands.size()) + " command(s)");

                for (JsonObject cmd : commands) {
                    long commandId = cmd["id"] | 0;
                    const char* command = cmd["command"] | "";

                    if (commandId > 0 && strlen(command) > 0) {
                        LOG_INFO("SUPABASE", "Processing command #" + String(commandId) + ": " + String(command));
                        processCommand(String(command), commandId);
                    }
                }
            }
        }

        return true;
    } else if (httpCode != -1) {
        // Non-200 but got a response (e.g., no commands = 200 with [])
        LOG_DEBUG("SUPABASE", "Command poll response: HTTP " + String(httpCode));
    }

    return false;
}

void SupabaseClient::processCommand(const String& command, long commandId) {
    bool success = false;
    String resultMessage;

    LOG_INFO("SUPABASE", "Executing command: " + command);

    // Parse and execute command
    if (command == "test_audio") {
        if (DFPlayerManager::isConnected()) {
            // Don't start if sequence already active
            if (!RelayManager::isSequenceActive()) {
                RelayManager::startTestSequence();
                resultMessage = "Test audio sequence started";
                success = true;
            } else {
                resultMessage = "Sequence already active, cannot test";
                success = false;
            }
        } else {
            resultMessage = "DFPlayer not connected";
            success = false;
        }
    }
    else if (command == "relay_1_on") {
        RelayManager::setRelay1(true);
        resultMessage = "Relay 1 turned ON";
        success = true;
    }
    else if (command == "relay_1_off") {
        RelayManager::setRelay1(false);
        resultMessage = "Relay 1 turned OFF";
        success = true;
    }
    else if (command == "relay_2_on") {
        RelayManager::setRelay2(true);
        resultMessage = "Relay 2 turned ON";
        success = true;
    }
    else if (command == "relay_2_off") {
        RelayManager::setRelay2(false);
        resultMessage = "Relay 2 turned OFF";
        success = true;
    }
    else if (command == "sync_rtc") {
        if (WiFi.status() == WL_CONNECTED) {
            success = RTCManager::syncFromNTP();
            resultMessage = success ? "RTC synced from NTP" : "RTC sync failed";
        } else {
            resultMessage = "WiFi not connected, cannot sync RTC";
            success = false;
        }
    }
    else if (command == "restart") {
        // Send ACK first before restarting
        sendCommandAck(commandId, "done");
        sendSystemLog("info", "SUPABASE", "ESP restarting by command");

        LOG_INFO("SUPABASE", "Restarting ESP32 in 1 second...");
        delay(1000);
        ESP.restart();
        return; // Never reaches here
    }
    else if (command == "abort") {
        RelayManager::abortSequence();
        resultMessage = "Sequence aborted";
        success = true;
    }
    else {
        resultMessage = "Unknown command: " + command;
        success = false;
        LOG_WARN("SUPABASE", resultMessage);
    }

    // Send command ACK
    sendCommandAck(commandId, success ? "done" : "failed");

    // Log to system_logs
    sendSystemLog(success ? "info" : "error", "COMMAND",
        String(success ? "Executed: " : "Failed: ") + command + " - " + resultMessage);

    // If it was a bell-related command, also log to bell_history
    if (command == "test_audio") {
        sendBellHistory(0, RTCManager::getTimeString(), 8,
            success ? "success" : "failed", resultMessage);
    }
}

bool SupabaseClient::sendCommandAck(long commandId, const String& status) {
    if (!initialized || WiFi.status() != WL_CONNECTED) return false;

    String url = buildUrl("/rest/v1/rpc/update_command_status");

    DynamicJsonDocument doc(128);
    doc["p_command_id"] = commandId;
    doc["p_status"] = status;
    String body;
    serializeJson(doc, body);

    String response;
    int httpCode = httpPost(url, body, response);

    LOG_DEBUG("SUPABASE", "Command #" + String(commandId) + " ACK: " + status +
              " (HTTP " + String(httpCode) + ")");

    return (httpCode == 200 || httpCode == 201 || httpCode == 204);
}

// ============================================
// BELL HISTORY
// ============================================
bool SupabaseClient::sendBellEvent(int scheduleId, bool success, const String& message) {
    // Legacy wrapper
    return sendBellHistory(scheduleId,
        RTCManager::getTimeString(),
        0,
        success ? "success" : "failed",
        message);
}

bool SupabaseClient::sendBellHistory(int scheduleId, const String& time,
                                      int trackNumber, const String& status,
                                      const String& message) {
    if (WiFi.status() != WL_CONNECTED) {
        // Buffer this log for later
        addMissedLog("info", "BELL",
            "Schedule #" + String(scheduleId) + " Track #" + String(trackNumber) +
            " " + status + ": " + message);
        return false;
    }

    if (!initialized) return false;

    String url = buildUrl("/rest/v1/rpc/log_bell_event");

    DynamicJsonDocument doc(256);
    doc["p_device_id"] = g_sysStatus.deviceId;
    doc["p_schedule_id"] = scheduleId;
    doc["p_time"] = time;
    doc["p_track_number"] = trackNumber;
    doc["p_status"] = status;
    doc["p_message"] = message;

    String body;
    serializeJson(doc, body);

    String response;
    int httpCode = httpPost(url, body, response);

    if (httpCode != 200 && httpCode != 201 && httpCode != 204) {
        LOG_WARN("SUPABASE", "Bell history send failed: HTTP " + String(httpCode));
        return false;
    }

    return true;
}

// ============================================
// SYSTEM LOG
// ============================================
bool SupabaseClient::sendSystemLog(const String& level, const String& module, const String& message) {
    if (WiFi.status() != WL_CONNECTED) {
        // Buffer this log for later
        addMissedLog(level, module, message);
        return false;
    }

    if (!initialized) return false;

    String url = buildUrl("/rest/v1/rpc/log_system_event");

    DynamicJsonDocument doc(256);
    doc["p_device_id"] = g_sysStatus.deviceId;
    doc["p_level"] = level;
    doc["p_module"] = module;
    doc["p_message"] = message;

    String body;
    serializeJson(doc, body);

    String response;
    int httpCode = httpPost(url, body, response);

    if (httpCode != 200 && httpCode != 201 && httpCode != 204) {
        LOG_WARN("SUPABASE", "System log send failed: HTTP " + String(httpCode));
        return false;
    }

    return true;
}

// ============================================
// MISSED LOG BUFFER
// ============================================
void SupabaseClient::addMissedLog(const String& level, const String& module, const String& message) {
    if (missedLogCount >= 50) {
        // Buffer full - discard oldest
        for (int i = 1; i < 50; i++) {
            missedLogs[i - 1] = missedLogs[i];
        }
        missedLogCount = 49;
    }

    missedLogs[missedLogCount].level = level;
    missedLogs[missedLogCount].module = module;
    missedLogs[missedLogCount].message = message;
    missedLogs[missedLogCount].timestamp = millis();
    missedLogCount++;
}

bool SupabaseClient::flushMissedLogs() {
    if (WiFi.status() != WL_CONNECTED) return false;
    if (missedLogCount == 0) return true;

    LOG_INFO("SUPABASE", "Flushing " + String(missedLogCount) + " missed logs...");

    int flushed = 0;
    for (int i = 0; i < missedLogCount; i++) {
        bool sent = false;

        String url = buildUrl("/rest/v1/rpc/log_system_event");
        DynamicJsonDocument doc(256);
        doc["p_device_id"] = g_sysStatus.deviceId;
        doc["p_level"] = missedLogs[i].level;
        doc["p_module"] = missedLogs[i].module;
        doc["p_message"] = missedLogs[i].message;

        String body;
        serializeJson(doc, body);

        String response;
        int httpCode = httpPost(url, body, response);

        if (httpCode == 200 || httpCode == 201 || httpCode == 204) {
            flushed++;
        } else {
            // If send fails, stop trying to avoid spamming
            LOG_WARN("SUPABASE", "Flush stopped at log #" + String(i) + " (HTTP " + String(httpCode) + ")");
            break;
        }

        vTaskDelay(100 / portTICK_PERIOD_MS); // Small delay between sends
    }

    // Remove flushed logs from buffer
    if (flushed > 0) {
        int remaining = missedLogCount - flushed;
        for (int i = 0; i < remaining; i++) {
            missedLogs[i] = missedLogs[flushed + i];
        }
        missedLogCount = remaining;
    }

    LOG_INFO("SUPABASE", "Flushed " + String(flushed) + " logs, " +
              String(missedLogCount) + " remaining");

    return (flushed > 0);
}

// ============================================
// GETTERS
// ============================================
String SupabaseClient::getLastScheduleJson() {
    return lastScheduleData;
}

unsigned long SupabaseClient::getLastFetchTime() {
    return lastFetchTime;
}

// ============================================
// PRIVATE HELPERS
// ============================================
String SupabaseClient::buildUrl(const String& endpoint) {
    return String(SUPABASE_URL) + endpoint;
}

int SupabaseClient::httpGet(const String& url, String& response) {
    LOG_DEBUG("SUPABASE", "HTTP GET: " + url);

    client.setInsecure();
    http.begin(client, url);
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.GET();

    if (httpCode > 0) {
        response = http.getString();
    }

    http.end();
    return httpCode;
}

int SupabaseClient::httpPost(const String& url, const String& body, String& response) {
    LOG_DEBUG("SUPABASE", "HTTP POST: " + url);

    client.setInsecure();
    http.begin(client, url);
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
    http.addHeader("Content-Type", "application/json");

    int httpCode = http.POST(body);

    if (httpCode > 0) {
        response = http.getString();
    }

    http.end();
    return httpCode;
}

bool SupabaseClient::verifySSL() {
    // Using setInsecure() for simplicity
    // In production, use certificate fingerprint for better security
    client.setInsecure();
    LOG_DEBUG("SUPABASE", "SSL verification disabled (insecure mode)");
    return true;
}