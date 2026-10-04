#include "bell_manager.h"
#include "relay_manager.h"
#include "dfplayer_manager.h"
#include "rtc_manager.h"

static const char* bellStateStr(BellState s) {
  switch (s) {
    case BELL_IDLE: return "IDLE";
    case BELL_RELAY1_ON: return "RELAY1_ON";
    case BELL_WAIT_PLAY_START: return "WAIT_PLAY_START";
    case BELL_WAIT_AUDIO: return "WAIT_AUDIO";
    case BELL_STOPPING: return "STOPPING";
  }
  return "?";
}

void startBell(uint8_t track, bool test) {
  if (bellState != BELL_IDLE) {
    Serial.println("[BELL] Busy - sequence already running");
    return;
  }
  if (!test && !rtcOk) {
    Serial.println("[BELL] Cannot start - RTC invalid (use BELL TEST)");
    return;
  }

  bellTrack = track;
  bellTest = test;
  bellAudioStarted = false;
  dbgStopReason = "NONE";
  dbgBusyFirst = true;

  bellState = BELL_RELAY1_ON;
  bellPhaseStartMs = millis();
  bellStartMs = bellPhaseStartMs;

  relay1On();
  Serial.println(test ? "[BELL] TEST START" : "[BELL] SCHEDULED START");
  Serial.println("[BELL] Relay 1 ON");
}

static unsigned long busyHighSinceMs = 0;
static bool busyHighConfirming = false;

void updateBell() {
  if (bellState == BELL_IDLE) return;
  unsigned long now = millis();

  if ((now - bellStartMs) >= BELL_TOTAL_TIMEOUT_MS) {
    Serial.println("[BELL SAFETY] TOTAL TIMEOUT! Emergency reset triggered.");
    stopTrack();
    relay2Off();
    relay1Off();
    bellAudioStarted = false;
    bellTest = false;
    bellTrack = 0;
    bellState = BELL_IDLE;
    Serial.println("[BELL] Returning to IDLE");
    return;
  }

  static BellState dbgPrevState = BELL_IDLE;
  if (dbgPrevState != bellState) {
    Serial.print("[BELL DEBUG] STATE: ");
    Serial.print(bellStateStr(dbgPrevState));
    Serial.print(" -> ");
    Serial.print(bellStateStr(bellState));
    Serial.print(" | elapsed: ");
    Serial.print(now);
    Serial.println(" ms");
    dbgPrevState = bellState;
  }

  bool curBusy = isDFPlayerBusy();
  if (dbgBusyFirst || curBusy != dbgBusyPrev) {
    if (!dbgBusyFirst) {
      Serial.print("[BELL DEBUG] BUSY CHANGE: ");
      Serial.print(dbgBusyPrev ? "LOW" : "HIGH");
      Serial.print(" -> ");
      Serial.print(curBusy ? "LOW" : "HIGH");
      Serial.print(" | elapsed: ");
      Serial.print(now);
      Serial.println(" ms");
    }
    dbgBusyPrev = curBusy;
    dbgBusyFirst = false;
  }

  switch (bellState) {

    case BELL_RELAY1_ON:
      if ((now - bellPhaseStartMs) >= BELL_RELAY1_DELAY_MS) {
        relay2On();
        if (dfPlayerOk) {
          playTrack(bellTrack);
          bellPhaseStartMs = now;
          bellState = BELL_WAIT_PLAY_START;
          Serial.println("[BELL] Waiting for playback start...");
        } else {
          Serial.println("[BELL] DFPlayer unavailable - relay 1 only");
          bellAudioStarted = false;
          bellPhaseStartMs = now;
          bellState = BELL_WAIT_AUDIO;
        }
      }
      break;

    case BELL_WAIT_PLAY_START:
      if (isDFPlayerBusy()) {
        bellAudioStarted = true;
        dfPlayerPlaying = true;
        bellPhaseStartMs = now;
        busyHighConfirming = false;
        bellState = BELL_WAIT_AUDIO;
        Serial.println("[BELL] Playback started");
      } else if ((now - bellPhaseStartMs) >= BELL_AUDIO_START_TIMEOUT_MS) {
        Serial.println("[DFPLAYER] Playback start timeout");
        dbgStopReason = "PLAY_START_TIMEOUT";
        bellAudioStarted = false;
        relay2Off();
        stopTrack();
        bellPhaseStartMs = now;
        bellState = BELL_STOPPING;
      }
      break;

    case BELL_WAIT_AUDIO:
      {
        if (bellAudioStarted && (now - dbgLastStatusLog) >= 5000) {
          dbgLastStatusLog = now;
          Serial.print("[BELL DEBUG] PLAYING | BUSY: ");
          Serial.print(isDFPlayerBusy() ? "LOW" : "HIGH");
          Serial.print(" | dfPlayerPlaying: ");
          Serial.print(dfPlayerPlaying ? "true" : "false");
          Serial.print(" | audioElapsed: ");
          Serial.print(now - dbgPlayCmdMs);
          Serial.print(" | phaseElapsed: ");
          Serial.print(now - bellPhaseStartMs);
          Serial.println(" ms");
        }

        bool done = false;
        bool needStop = false;

        if (bellAudioStarted) {
          if (!dfPlayerPlaying) {
            Serial.println("[BELL DEBUG] Playback finished | reason: DFPLAYER_PLAY_FINISHED");
            dbgStopReason = "DFPLAYER_PLAY_FINISHED";
            done = true;
            needStop = false;
          }
          else if (!isDFPlayerBusy()) {
            if (!busyHighConfirming) {
              busyHighConfirming = true;
              busyHighSinceMs = now;
              Serial.println("[BELL DEBUG] BUSY HIGH detected - starting confirmation timer");
            } else if ((now - busyHighSinceMs) >= BELL_BUSY_END_CONFIRM_MS) {
              Serial.println("[BELL DEBUG] Playback finished | reason: BUSY_HIGH_CONFIRMED");
              dbgStopReason = "BUSY_HIGH_CONFIRMED";
              done = true;
              needStop = false;
            }
          }
          else {
            if (busyHighConfirming) {
              busyHighConfirming = false;
              Serial.println("[BELL DEBUG] BUSY LOW again - confirmation cancelled");
            }
          }
        } else {
          done = (now - bellPhaseStartMs) >= BELL_AUDIO_FALLBACK_MS;
          if (done && dbgStopReason[0] == '\''N'\'')
dgStopReason = "FALLBACK_5s";
        }

        if (done) {
          relay2Off();
          Serial.println("[BELL] Relay 2 OFF");

          if (needStop) {
            stopTrack();
          } else if (bellAudioStarted) {
            if (dfPlayerPlaying) {
              dfPlayerPlaying = false;
              currentTrack = 0;
            }
          }

          bellPhaseStartMs = now;
          bellState = BELL_STOPPING;
        }
      }
      break;

    case BELL_STOPPING:
      if ((now - bellPhaseStartMs) >= BELL_STOP_DELAY_MS) {
        relay1Off();
        Serial.println("[BELL] Relay 1 OFF");
        bellAudioStarted = false;
        bellTrack = 0;
        bellState = BELL_IDLE;
        Serial.println(bellTest ? "[BELL] TEST COMPLETE" : "[BELL] SCHEDULED COMPLETE");
        Serial.println("[BELL] Returning to IDLE");
        bellTest = false;
      }
      break;
  }
}

const char* bellStateName() {
  switch (bellState) {
    case BELL_IDLE: return "IDLE";
    case BELL_RELAY1_ON: return "RELAY1_ON";
    case BELL_WAIT_PLAY_START: return "WAIT_PLAY_START";
    case BELL_WAIT_AUDIO: return "WAIT_AUDIO";
    case BELL_STOPPING: return "STOPPING";
  }
  return "?";
}
