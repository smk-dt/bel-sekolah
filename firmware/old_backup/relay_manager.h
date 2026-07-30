// ============================================
// SMART SCHOOL BELL IoT - Relay Manager
// ============================================
#ifndef RELAY_MANAGER_H
#define RELAY_MANAGER_H

#include "config.h"

class RelayManager {
private:
    bool relay1State;
    bool relay2State;
    unsigned long relay1Timer;
    unsigned long relay2Timer;
    bool relay1Timed;
    bool relay2Timed;

public:
    RelayManager() : relay1State(false), relay2State(false),
                     relay1Timer(0), relay2Timer(0),
                     relay1Timed(false), relay2Timed(false) {}
    
    // Initialize relay pins
    void begin() {
        pinMode(RELAY_1_PIN, OUTPUT);
        pinMode(RELAY_2_PIN, OUTPUT);
        
        // Default: relays off
        digitalWrite(RELAY_1_PIN, HIGH);  // Active LOW relay module
        digitalWrite(RELAY_2_PIN, HIGH);
        
        relay1State = false;
        relay2State = false;
        
        DEBUG_PRINTLN("[Relay] Initialized");
    }
    
    // Turn relay 1 ON (with optional auto-off duration)
    void relay1On(unsigned long durationMs = 0) {
        digitalWrite(RELAY_1_PIN, LOW);   // Active LOW
        relay1State = true;
        
        if (durationMs > 0) {
            relay1Timer = millis();
            relay1Timed = true;
        } else {
            relay1Timed = false;
        }
        
        DEBUG_PRINTLN("[Relay] Relay 1 ON");
    }
    
    // Turn relay 1 OFF
    void relay1Off() {
        digitalWrite(RELAY_1_PIN, HIGH);
        relay1State = false;
        relay1Timed = false;
        
        DEBUG_PRINTLN("[Relay] Relay 1 OFF");
    }
    
    // Turn relay 2 ON (with optional auto-off duration)
    void relay2On(unsigned long durationMs = 0) {
        digitalWrite(RELAY_2_PIN, LOW);   // Active LOW
        relay2State = true;
        
        if (durationMs > 0) {
            relay2Timer = millis();
            relay2Timed = true;
        } else {
            relay2Timed = false;
        }
        
        DEBUG_PRINTLN("[Relay] Relay 2 ON");
    }
    
    // Turn relay 2 OFF
    void relay2Off() {
        digitalWrite(RELAY_2_PIN, HIGH);
        relay2State = false;
        relay2Timed = false;
        
        DEBUG_PRINTLN("[Relay] Relay 2 OFF");
    }
    
    // Turn all relays off
    void allOff() {
        relay1Off();
        relay2Off();
        DEBUG_PRINTLN("[Relay] All relays OFF");
    }
    
    // Check and handle timed relays (call in loop)
    void update() {
        if (relay1Timed && relay1State) {
            if (millis() - relay1Timer >= RELAY_ON_DURATION_MS) {
                relay1Off();
            }
        }
        
        if (relay2Timed && relay2State) {
            if (millis() - relay2Timer >= RELAY_ON_DURATION_MS) {
                relay2Off();
            }
        }
    }
    
    // Get relay 1 state
    bool isRelay1On() { return relay1State; }
    
    // Get relay 2 state
    bool isRelay2On() { return relay2State; }
    
    // Get relay 1 state string
    String getRelay1Str() { return relay1State ? "ON" : "OFF"; }
    
    // Get relay 2 state string
    String getRelay2Str() { return relay2State ? "ON" : "OFF"; }
};

#endif // RELAY_MANAGER_H