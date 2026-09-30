#include "button_manager.h"
#include "relay_manager.h"
#include "bell_manager.h"
#include "app_state.h"
#include <Arduino.h>

static const unsigned long DEBOUNCE_INTERVAL_MS = 50UL;
static unsigned long lastButtonChangeMs = 0;
static bool lastRawState = HIGH;
static bool debouncedState = HIGH;

static void setStatusLed(bool on) {
  digitalWrite(PIN_STATUS_LED, on ? HIGH : LOW);
}

void initButton() {
  pinMode(PIN_EXTERNAL_BUTTON, INPUT_PULLUP);
  pinMode(PIN_STATUS_LED, OUTPUT);
  setStatusLed(false);
  lastRawState = digitalRead(PIN_EXTERNAL_BUTTON);
  debouncedState = lastRawState;
  Serial.println("[BUTTON] GPIO18 initialized as INPUT_PULLUP");
  Serial.printf("[BUTTON DEBUG] GPIO18=%s\n", lastRawState == HIGH ? "HIGH" : "LOW");
}

void handleButton(unsigned long now) {
  bool rawState = digitalRead(PIN_EXTERNAL_BUTTON);
  
  if (rawState != lastRawState) {
    lastButtonChangeMs = now;
    lastRawState = rawState;
    Serial.printf("[BUTTON DEBUG] GPIO18=%s\n", rawState == HIGH ? "HIGH" : "LOW");
    return;
  }
  
  if ((now - lastButtonChangeMs) < DEBOUNCE_INTERVAL_MS) return;

  if (rawState != debouncedState) {
    if (rawState == LOW && debouncedState == HIGH) {
      Serial.println("[BUTTON] PRESSED");
      if (relay1State || relay2State) {
        relayAllOff();
      } else {
        relayAllOn();
      }
    }
    debouncedState = rawState;
  }
}

void handleStatusLed(unsigned long now) {
  if (!wifiOk) {
    if ((now - lastLedToggleMs) >= 250UL) {
      lastLedToggleMs = now;
      digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    }
    return;
  }
  if (relay1State && relay2State) {
    digitalWrite(PIN_STATUS_LED, HIGH);
    return;
  }
  if ((now - lastLedToggleMs) >= 1000UL) {
    lastLedToggleMs = now;
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
  }
}

