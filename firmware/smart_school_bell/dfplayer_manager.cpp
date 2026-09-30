#include "dfplayer_manager.h"

void initDFPlayer() {
  pinMode(PIN_BUSY, INPUT_PULLUP);
  Serial.println("[DFPLAYER] Initializing (UART2 @9600)...");

  SerialDFPlayer.begin(DFPLAYER_BAUD, SERIAL_8N1, PIN_DFPLAYER_RX, PIN_DFPLAYER_TX);
  delay(100);

  if (!dfPlayer.begin(SerialDFPlayer)) {
    dfPlayerOk = false;
    microSdOk = false;
    Serial.println("[DFPLAYER] ERROR: module/SD not detected");
    Serial.println("[DFPLAYER] Bell continues with relay 1 only");
    return;
  }

  dfPlayer.setTimeOut(500);
  dfPlayer.volume(dfVolume);
  dfPlayerOk = true;
  microSdOk = true;

  Serial.println("[DFPLAYER] OK - module + MicroSD detected");
  Serial.print("[DFPLAYER] Volume: ");
  Serial.println(dfVolume);
}

bool isDFPlayerBusy() {
  return digitalRead(PIN_BUSY) == LOW;
}

void updateDFPlayer() {
  if (!dfPlayerOk) return;
  if (!dfPlayer.available()) return;

  uint8_t type = dfPlayer.readType();
  if (type == DFPlayerPlayFinished) {
    Serial.print("[BELL DEBUG] DFPLAYER EVENT: DFPlayerPlayFinished");
    Serial.print(" | millis: "); Serial.print(millis());
    Serial.print(" | elapsed since play: "); Serial.print(millis() - dbgPlayCmdMs);
    Serial.print(" | dfPlayerPlaying: "); Serial.print(dfPlayerPlaying ? "true" : "false");
    Serial.print(" | bellAudioStarted: "); Serial.print(bellAudioStarted ? "true" : "false");
    Serial.print(" | BUSY: "); Serial.println(isDFPlayerBusy() ? "LOW" : "HIGH");

    dfPlayerPlaying = false;
    currentTrack = 0;
  } else if (type == DFPlayerCardInserted) {
    microSdOk = true;
    Serial.println("[DFPLAYER] MicroSD inserted");
  } else if (type == DFPlayerCardRemoved) {
    microSdOk = false;
    Serial.println("[DFPLAYER] MicroSD removed");
  } else {
    Serial.print("[BELL DEBUG] DFPLAYER EVENT: type=");
    Serial.print(type);
    Serial.print(" | millis: "); Serial.print(millis());
    Serial.print(" | elapsed: "); Serial.print(millis() - dbgPlayCmdMs);
    Serial.println(" ms");
  }
}

void playTrack(uint8_t track) {
  if (!dfPlayerOk) {
    Serial.println("[DFPLAYER] Cannot play - module not initialized");
    return;
  }
  if (track == 0) track = 1;

  dfPlayer.playMp3Folder(track);
  dfPlayerPlaying = true;
  currentTrack = track;

  Serial.print("[DFPLAYER] Playing track ");
  Serial.println(track);

  dbgPlayCmdMs = millis();
  dbgBusyFirst = true;
  dbgLastStatusLog = millis();
  Serial.println("[BELL DEBUG] PLAY command sent");
  Serial.print("[BELL DEBUG] Track: "); Serial.println(track);
  Serial.print("[BELL DEBUG] millis: "); Serial.println(dbgPlayCmdMs);
  Serial.print("[BELL DEBUG] BUSY: "); Serial.println(isDFPlayerBusy() ? "LOW" : "HIGH");
}

void stopTrack() {
  if (!dfPlayerOk) return;
  if (dfPlayerPlaying) {
    Serial.print("[BELL DEBUG] STOP CALLED | reason: ");
    Serial.print(dbgStopReason);
    Serial.print(" | state: ");
    // Note: bellStateName() will be in bell_manager
    extern const char* bellStateName(); 
    Serial.print(bellStateName());
    Serial.print(" | elapsed since play: ");
    Serial.print(millis() - dbgPlayCmdMs);
    Serial.println(" ms");

    dfPlayer.stop();
    dfPlayerPlaying = false;
    currentTrack = 0;
    Serial.println("[DFPLAYER] Stop");
  }
}

void printDFStatus() {
  Serial.println("[DFPLAYER] Status:");
  Serial.print("  Module:   "); Serial.println(dfPlayerOk ? "OK" : "ERROR");
  Serial.print("  MicroSD:  "); Serial.println(microSdOk ? "OK" : "ERROR");
  Serial.print("  Playing:  "); Serial.println(dfPlayerPlaying ? "YES" : "NO");
  Serial.print("  Track:    "); Serial.println(currentTrack);
  Serial.print("  BUSY pin: "); Serial.println(isDFPlayerBusy() ? "LOW (playing)" : "HIGH (idle)");
  Serial.print("  Volume:   "); Serial.println(dfVolume);
}
