#ifndef APP_STATE_H
#define APP_STATE_H

#include <Arduino.h>
#include <WiFi.h>
#include <RtcDS1302.h>
#include <DFRobotDFPlayerMini.h>
#include "config.h"

// Hardware Objects
extern ThreeWire myWire;
extern RtcDS1302<ThreeWire> Rtc;
extern HardwareSerial SerialDFPlayer;
extern DFRobotDFPlayerMini dfPlayer;

// Global States
extern bool relay1State;
extern bool relay2State;
extern bool rtcOk;
extern bool wifiOk;
extern bool pttWsInitialized;
extern bool internetOk;
extern bool supabaseRegistered;

extern unsigned long lastHeartbeatMs;
extern unsigned long lastRtcCheckMs;
extern unsigned long lastLedToggleMs;
extern unsigned long lastRtcTestMs;
extern unsigned long lastRtcRawTestMs;
extern bool ledOn;

extern bool wifiConnecting;
extern bool wifiDisconnectPending;
extern unsigned long wifiAttemptStartMs;
extern unsigned long wifiDisconnectMs;
extern unsigned long wifiLastRetryMs;

extern bool ntpSynced;
extern unsigned long lastNtpSyncMs;
extern bool ntpInProgress;
extern unsigned long ntpStartMs;
extern bool ntpManualSyncReq;

extern bool dfPlayerOk;
extern bool microSdOk;
extern bool dfPlayerPlaying;
extern uint8_t currentTrack;
extern uint8_t dfVolume;

// Bell State
enum BellState {
  BELL_IDLE = 0,
  BELL_RELAY1_ON,
  BELL_WAIT_PLAY_START,
  BELL_WAIT_AUDIO,
  BELL_STOPPING
};
extern BellState bellState;
extern unsigned long bellPhaseStartMs;
extern unsigned long bellStartMs;
extern uint8_t bellTrack;
extern bool bellTest;
extern bool bellAudioStarted;

// Diagnostics
extern bool dbgBusyPrev;
extern bool dbgBusyFirst;
extern unsigned long dbgPlayCmdMs;
extern unsigned long dbgLastStatusLog;
extern const char* dbgStopReason;

// Schedule Cache
struct SchedEntry {
  char     name[24];
  uint8_t  day;
  uint8_t  hour;
  uint8_t  minute;
  uint8_t  track;
  bool     enabled;
  uint32_t lastTriggerKey;
};
extern SchedEntry scheduleCache[SCHEDULE_MAX];
extern int scheduleCount;
extern unsigned long lastSchedCheckMs;
extern unsigned long lastScheduleSyncMs;
extern bool scheduleSyncRequested;
extern bool syncWasImmediate;
extern bool initialScheduleSyncPending;
extern String pendingCommandResponse;
extern volatile bool pendingCommandResponseReady;

#endif
