#include "wifi_manager.h"
#include <WiFiClient.h>

static bool pttTcpDiagnosticDone = false;

static void runPttTcpDiagnostic() {
  Serial.println("[PTT TCP TEST] Connecting to 10.127.158.210:3000");
  WiFiClient client;
  client.setTimeout(3);
  unsigned long startedAt = millis();
  bool connected = client.connect("10.127.158.210", 3000);
  unsigned long elapsedMs = millis() - startedAt;
  if (connected) {
    Serial.println("[PTT TCP TEST] CONNECTED");
  } else {
    Serial.println("[PTT TCP TEST] FAILED");
  }
  Serial.print("[PTT TCP TEST] Connect time: ");
  Serial.print(elapsedMs);
  Serial.println(" ms");
  client.stop();
}

void initWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  wifiOk = false;

  Serial.print("[WIFI] Connecting to ");
  Serial.println(WIFI_SSID);
  Serial.println("[WIFI] Connecting...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  wifiConnecting = true;
  wifiAttemptStartMs = millis();
}

void handleWiFi(unsigned long now) {
  wl_status_t status = WiFi.status();

  if (status == WL_CONNECTED) {
    wifiConnecting = false;
    wifiDisconnectPending = false;
    if (!wifiOk) {
      wifiOk = true;
      Serial.println("[WIFI] Connected");
      Serial.print("[WIFI] IP: ");
      Serial.println(WiFi.localIP());
      Serial.println("[WIFI DEBUG]");
      Serial.print("IP: ");
      Serial.println(WiFi.localIP());
      Serial.print("Subnet: ");
      Serial.println(WiFi.subnetMask());
      Serial.print("Gateway: ");
      Serial.println(WiFi.gatewayIP());
      Serial.print("SSID: ");
      Serial.println(WiFi.SSID());
      Serial.print("BSSID: ");
      Serial.println(WiFi.BSSIDstr());
      Serial.print("RSSI: ");
      Serial.print(WiFi.RSSI());
      Serial.println(" dBm");
      ntpManualSyncReq = true;
      initialScheduleSyncPending = true;
      if (!pttTcpDiagnosticDone) {
        runPttTcpDiagnostic();
        pttTcpDiagnosticDone = true;
      }
      if (!pttWsInitialized) {
        initPttWebSocket();
        pttWsInitialized = true;
      }
    }
    return;
  }

  if (wifiOk) {
    wifiOk = false;
    internetOk = false;
    supabaseRegistered = false;
    Serial.println("[WIFI] Connection lost");
  }

  if (wifiConnecting) {
    if ((now - wifiAttemptStartMs) < WIFI_BOOT_TIMEOUT_MS) return;
    wifiConnecting = false;
    Serial.println("[WIFI] Connection timeout");
    WiFi.disconnect(false);
    wifiDisconnectPending = true;
    wifiDisconnectMs = now;
    wifiLastRetryMs = now;
    return;
  }

  if (wifiDisconnectPending) {
    if ((now - wifiDisconnectMs) < WIFI_DISCONNECT_SETTLE_MS) return;
    wifiDisconnectPending = false;
    Serial.println("[WIFI] Retrying...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    wifiConnecting = true;
    wifiAttemptStartMs = now;
    return;
  }

  if ((now - wifiLastRetryMs) < WIFI_RETRY_INTERVAL_MS) return;
  wifiLastRetryMs = now;
  WiFi.disconnect(false);
  wifiDisconnectPending = true;
  wifiDisconnectMs = now;
}
