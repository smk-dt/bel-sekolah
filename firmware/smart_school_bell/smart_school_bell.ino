/*
============================================================
 SMART SCHOOL BELL IoT - ESP32 Firmware (Modular Version)
 Phase 10: DFPlayer + MicroSD + Secure Schedule Sync
============================================================
*/

#include "config.h"
#include "app_state.h"
#include "relay_manager.h"
#include "rtc_manager.h"
#include "wifi_manager.h"
#include "dfplayer_manager.h"
#include "bell_manager.h"
#include "schedule_manager.h"
#include "ntp_manager.h"
#include "api_manager.h"
#include "command_manager.h"
#include "serial_manager.h"
#include "led_manager.h"
#include "button_manager.h"
#include <WebSocketsClient.h>
#include <ESP_I2S.h>

static WebSocketsClient pttWebSocket;
static bool pttWsTestSent = false;

// ---- PTT PCM receive buffer (diagnostic phase - no I2S output) ----
#define PTT_PCM_FRAME_BYTES 640   // 320 samples x int16 LE, 16 kHz mono, 20 ms
#define PTT_PCM_RING_CAPACITY 6400 // 200 ms of PCM
static uint8_t pttPcmRing[PTT_PCM_RING_CAPACITY];
static volatile size_t pttPcmHead = 0;   // producer write pos
static volatile size_t pttPcmTail = 0;   // consumer read pos
static volatile uint32_t pttPcmUsedBytes = 0;
static uint32_t pttPcmReceivedFrames = 0;
static uint32_t pttPcmReceivedBytes = 0;
static uint32_t pttPcmConsumedFrames = 0;
static uint32_t pttPcmConsumedBytes = 0;
static uint32_t pttPcmOverflows = 0;
static uint32_t pttPcmUnderflows = 0;
static uint32_t pttPcmPendingUnderflows = 0;  // empty ticks awaiting proof the stream is still alive
static uint32_t pttPcmInvalidFrames = 0;
static uint32_t pttPcmSequenceErrors = 0;
static uint32_t pttPcmPeakBytes = 0;
static uint32_t pttPcmStreamSeq = 0;
static bool pttPcmStreamActive = false;
static bool pttPcmSummaryPrinted = false;
static uint32_t pttPcmLastFrameMs = 0;

// ---- PTT I2S output to PCM5102A (minimal drain patch) ----
#define PTT_I2S_BCK 32
#define PTT_I2S_WS 33
#define PTT_I2S_DOUT 23
static I2SClass pttI2s;                            // ESP_I2S built-in (Arduino-ESP32 core 3.3.3)
static bool pttI2sStarted = false;
static uint32_t pttI2sFramesWritten = 0;
static uint32_t pttI2sBytesWritten = 0;
static uint32_t pttI2sWriteErrors = 0;
static uint8_t pttPcmFrameBuf[PTT_PCM_FRAME_BYTES]; // one 640 B PCM frame (copy then write)

static void pttPcmPrintSummary() {
  Serial.printf("[PTT RING] DONE RxFrames=%lu RxBytes=%lu CsmFrames=%lu CsmBytes=%lu Invalid=%lu Overflow=%lu Underflow=%lu SeqErr=%lu Peak=%lu\n",
                (unsigned long)pttPcmReceivedFrames, (unsigned long)pttPcmReceivedBytes,
                (unsigned long)pttPcmConsumedFrames, (unsigned long)pttPcmConsumedBytes,
                (unsigned long)pttPcmInvalidFrames, (unsigned long)pttPcmOverflows,
                (unsigned long)pttPcmUnderflows, (unsigned long)pttPcmSequenceErrors,
                (unsigned long)pttPcmPeakBytes);
}

static void pttPcmResetCounters() {
  pttPcmHead = 0; pttPcmTail = 0; pttPcmUsedBytes = 0;
  pttPcmReceivedFrames = pttPcmReceivedBytes = 0;
  pttPcmConsumedFrames = pttPcmConsumedBytes = 0;
  pttPcmOverflows = pttPcmUnderflows = 0;
  pttPcmPendingUnderflows = 0;
  pttPcmInvalidFrames = 0; pttPcmSequenceErrors = 0;
  pttPcmPeakBytes = 0; pttPcmStreamSeq = 0;
  pttPcmStreamActive = false; pttPcmSummaryPrinted = false;
  pttPcmLastFrameMs = 0;
  memset(pttPcmRing, 0, sizeof(pttPcmRing));
}

static void initPttI2S() {
  pttI2s.setPins(PTT_I2S_BCK, PTT_I2S_WS, PTT_I2S_DOUT); // bclk=32, ws=33, dout=23; din/mclk=-1
  pttI2sStarted = pttI2s.begin(I2S_MODE_STD, 16000, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO);
  if (pttI2sStarted) {
    Serial.println("[I2S] Initialized");
    Serial.println("[I2S] 16kHz / 16-bit / MONO");
    Serial.println("[I2S] BCK=32 WS=33 DOUT=23");
  } else {
    Serial.println("[I2S] INIT FAILED");
  }
}

static void pttPcmConsumerTask(void* parameter) {
  (void)parameter;
  for (;;) {
    if (pttPcmUsedBytes >= PTT_PCM_FRAME_BYTES) {
      // Frames arrived since the empty ticks: stream was still alive, so
      // those empty ticks were genuine active-stream underflow.
      pttPcmUnderflows += pttPcmPendingUnderflows;
      pttPcmPendingUnderflows = 0;
      // consume one frame: copy 640B (wrap-aware) then write to I2S (was discard)
      if (pttPcmTail + PTT_PCM_FRAME_BYTES > PTT_PCM_RING_CAPACITY) {
        size_t part1 = PTT_PCM_RING_CAPACITY - pttPcmTail;
        memcpy(pttPcmFrameBuf, &pttPcmRing[pttPcmTail], part1);
        memcpy(pttPcmFrameBuf + part1, pttPcmRing, PTT_PCM_FRAME_BYTES - part1);
      } else {
        memcpy(pttPcmFrameBuf, &pttPcmRing[pttPcmTail], PTT_PCM_FRAME_BYTES);
      }
      if (pttI2sStarted) {
        size_t i2sSent = pttI2s.write(pttPcmFrameBuf, PTT_PCM_FRAME_BYTES);
        if (i2sSent == PTT_PCM_FRAME_BYTES) {
          pttI2sFramesWritten++;
          pttI2sBytesWritten += PTT_PCM_FRAME_BYTES;
        } else {
          pttI2sWriteErrors++;
        }
      }
      pttPcmTail = (pttPcmTail + PTT_PCM_FRAME_BYTES) % PTT_PCM_RING_CAPACITY;
      pttPcmUsedBytes -= PTT_PCM_FRAME_BYTES;
      pttPcmConsumedFrames++;
      pttPcmConsumedBytes += PTT_PCM_FRAME_BYTES;
    } else if (pttPcmStreamActive) {
      pttPcmPendingUnderflows++;  // deferred: counted only if a later frame proves the stream is alive
    }
    if (pttPcmStreamActive && !pttPcmSummaryPrinted &&
        (millis() - pttPcmLastFrameMs) > 1000) {
      pttPcmPendingUnderflows = 0;  // stream over: unproven empty ticks are tail idle, not underflow
      Serial.println("[PTT RING] stream idle 1s - summary:");
      pttPcmPrintSummary();
      if (pttI2sStarted) {
        Serial.printf("[I2S] Frames=%lu Bytes=%lu Errors=%lu\n",
                      (unsigned long)pttI2sFramesWritten,
                      (unsigned long)pttI2sBytesWritten,
                      (unsigned long)pttI2sWriteErrors);
      }
      pttPcmSummaryPrinted = true;
      pttPcmStreamActive = false;
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

static void pttWebSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("[PTT WS] Connected");
      pttWebSocket.sendTXT("PTT_TEST");
      pttWsTestSent = true;
      break;
    case WStype_TEXT:
      if (payload && strcmp((const char*)payload, "PTT_ACK") == 0) {
        Serial.println("[PTT WS] ACK received");
      }
      break;
    case WStype_DISCONNECTED:
      Serial.println("[PTT WS] Disconnected");
      pttWsTestSent = false;
      pttPcmResetCounters();
      break;
    case WStype_ERROR:
      Serial.println("[PTT WS] ERROR");
      if (payload) {
        Serial.printf("[PTT WS] ERROR payload: %s\n", (const char*)payload);
      }
      break;
    case WStype_BIN: {
      // Producer: minimal work - validate, copy to ring, update counters
      if (!payload || length != PTT_PCM_FRAME_BYTES) {
        pttPcmInvalidFrames++;
        Serial.printf("[PTT RING] INVALID frame len=%u\n", (unsigned)length);
        break;
      }
      // no in-band seq number (640B raw PCM payload preserved);
      // TCP ordering guarantees frame N arrives in order -> local numbering only
      pttPcmStreamSeq++;
      if (pttPcmUsedBytes + PTT_PCM_FRAME_BYTES > PTT_PCM_RING_CAPACITY) {
        pttPcmOverflows++;
        break;
      }
      for (size_t i = 0; i < PTT_PCM_FRAME_BYTES; i++) {
        pttPcmRing[pttPcmHead] = payload[i];
        pttPcmHead = (pttPcmHead + 1) % PTT_PCM_RING_CAPACITY;
      }
      pttPcmUsedBytes += PTT_PCM_FRAME_BYTES;
      if (pttPcmUsedBytes > pttPcmPeakBytes) pttPcmPeakBytes = pttPcmUsedBytes;
      pttPcmReceivedFrames++;
      pttPcmReceivedBytes += PTT_PCM_FRAME_BYTES;
      if (!pttPcmStreamActive) {
        pttPcmStreamActive = true;
        pttPcmSummaryPrinted = false;
      }
      pttPcmLastFrameMs = millis();
      if (pttPcmReceivedFrames % 25 == 0) {
        Serial.printf("[PTT RING] RX=%lu Used=%lu Peak=%lu\n",
                      (unsigned long)pttPcmReceivedFrames,
                      (unsigned long)pttPcmUsedBytes,
                      (unsigned long)pttPcmPeakBytes);
      }
      break;
    }
    default:
      break;
  }
}

static void pttWebSocketTask(void* parameter) {
  (void)parameter;
  for (;;) {
    pttWebSocket.loop();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void initPttWebSocket() {
  pttWebSocket.begin(PTT_WS_HOST, PTT_WS_PORT, PTT_WS_PATH);
  pttWebSocket.onEvent(pttWebSocketEvent);
  pttWebSocket.setReconnectInterval(5000);
  pttPcmResetCounters();
  xTaskCreatePinnedToCore(pttWebSocketTask, "pttWsTask", 8192, nullptr, 1, nullptr, 1);
  xTaskCreatePinnedToCore(pttPcmConsumerTask, "pttPcmConsumer", 4096, nullptr, 1, nullptr, 1);
}

static void networkTask(void* parameter) {
  (void)parameter;
  for (;;) {
    unsigned long now = millis();
    handleWiFi(now);
    handleNtpSync(now);
    handleSupabaseHeartbeat(now);
    handleCommandPolling(now);
    handleScheduleSync(now);
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("========================================\nSMART SCHOOL BELL IoT\nModular Firmware Baseline\n========================================");

  initLED();
  initRelays();
  initButton();
  initRTC();
  initWiFi();

  if (rtcOk) Serial.println("[RTC] Using local RTC time");
  else Serial.println("[RTC] ERROR: RTC time unavailable");

  lastHeartbeatMs = millis();
  initDFPlayer();
  clearScheduleCache();
  lastScheduleSyncMs = millis();
  initPttI2S();

  xTaskCreatePinnedToCore(networkTask, "networkTask", 12288, nullptr, 1, nullptr, 0);

  Serial.println("\n[SYSTEM] READY\nType HELP for available commands.");
}

void loop() {
  unsigned long now = millis();
  static unsigned long lastButtonCallMs = 0;
  static unsigned long lastLoopDebugMs = 0;

  if (lastButtonCallMs != 0) {
    unsigned long buttonGapMs = now - lastButtonCallMs;
    if (buttonGapMs > 200UL) {
      Serial.printf("[BUTTON LOOP DELAY] %lu ms\n", buttonGapMs);
    }
  }
  lastButtonCallMs = now;

  if ((now - lastLoopDebugMs) >= 1000UL) {
    lastLoopDebugMs = now;
    Serial.println("[LOOP] running; handleButton active");
  }

  // Baseline Loop Order (STRICT)
  handleSerial();
  if (pendingCommandResponseReady) {
    String response = pendingCommandResponse;
    pendingCommandResponse = "";
    pendingCommandResponseReady = false;
    processCommandsFromResponse(response);
  }
  handleButton(now);
  handleRTC(now);
  updateDFPlayer();
  updateBell();
  checkSchedule();
  handleLED(now);
  handleStatusLed(now);
  handleRtcTest(now);
  handleRtcRawTest(now);

  delay(LOOP_DELAY_MS);
}


