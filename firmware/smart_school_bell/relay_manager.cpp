#include "relay_manager.h"

void initRelays() {
  pinMode(PIN_RELAY1, OUTPUT);
  pinMode(PIN_RELAY2, OUTPUT);

  relay1Off();
  relay2Off();

  Serial.println("[RELAY] Initialized (OFF)");
}

void relay1On() {
  relay1State = true;
  digitalWrite(PIN_RELAY1, RELAY_ACTIVE_LOW ? LOW : HIGH);
  Serial.println("[RELAY] Relay 1 ON");
}

void relay1Off() {
  relay1State = false;
  digitalWrite(PIN_RELAY1, RELAY_OFF_VALUE);
  Serial.println("[RELAY] Relay 1 OFF");
}

void relay2On() {
  relay2State = true;
  digitalWrite(PIN_RELAY2, RELAY_ACTIVE_LOW ? LOW : HIGH);
  Serial.println("[RELAY] Relay 2 ON");
}

void relay2Off() {
  relay2State = false;
  digitalWrite(PIN_RELAY2, RELAY_OFF_VALUE);
  Serial.println("[RELAY] Relay 2 OFF");
}

void relayAllOn() {
  relay1On();
  relay2On();
}

void relayAllOff() {
  relay1Off();
  relay2Off();
}
