// ============================================
// SMART SCHOOL BELL IoT - ESP32 Main Program
// ============================================
// Hardware: ESP32 Dev Kit + RTC DS3231 + DFPlayer Mini + Relay 2ch
// Platform: Arduino Framework (PlatformIO / Arduino IDE)
// ============================================

#include <Arduino.h>
#include "config.h"
#include "wifi_manager.h"
#include "rtc_manager.h"
#include "relay_manager.h"
#include "dfplayer_manager.h"
#include "supabase_client.h"
#include "scheduler.h"
#include "heartbeat.h"

// ===== Global Objects =====
WiFiManager wifiManager;
RTCManager rtcManager;
RelayManager relayManager;
DFPlayerManager dfPlayerManager;
SupabaseClient supabaseClient(&wifiManager);
Scheduler scheduler(&rtcManager, &relayManager, &dfPlayerManager);
Heartbeat heartbeat(&supabaseClient, &rtcManager, &wifiManager, 
                    &relayManager, &dfPlayerManager, &scheduler);

// ===== Button Debounce =====
unsigned long lastBtnTest = 0;
unsigned long lastBtnReset = 0;
const unsigned long DEBOUNCE_MS = 300;

// ===== System State =====
enum SystemState {
    STATE_STARTUP,
    STATE_INIT,
    STATE_CONNECTING,
    STATE_RUNNING,
    STATE_ERROR,
    STATE_DEEP_SLEEP
};
SystemState systemState = STATE_STARTUP;

// ===== Forward Declarations =====
void handleTestButton();
void handleResetButton();
void updateLEDs();
void logSystemStatus();
void enterDeepSleep();

// ============================================
// SETUP
// ============================================
void setup() {
    // Initialize Serial for debugging
    #ifdef DEBUG_ENABLE
    Serial.begin(115200);
    #endif
    
    DEBUG_PRINTLN("\n========================================");
    DEBUG_PRINTLN(" SMART SCHOOL BELL IoT v1.0");
    DEBUG_PRINTLN(" Device: " DEVICE_ID);
    DEBUG_PRINTLN("========================================\n");
    
    // Initialize LED pins
    pinMode(LED_WIFI, OUTPUT);
    pinMode(LED_BELL, OUTPUT);
    pinMode(LED_STATUS, OUTPUT);
    digitalWrite(LED_WIFI, LOW);
    digitalWrite(LED_BELL, LOW);
    digitalWrite(LED_STATUS, LOW);
    
    // Initialize button pins
    pinMode(BTN_TEST, INPUT_PULLUP);
    pinMode(BTN_RESET, INPUT_PULLUP);
    
    // Blink status LED to indicate startup
    for (int i = 0; i < 3; i++) {
        digitalWrite(LED_STATUS, HIGH);
        delay(200);
        digitalWrite(LED_STATUS, LOW);
        delay(200);
    }
    
    // Phase 1: Initialize RTC
    DEBUG_PRINTLN("[System] Initializing RTC...");
    systemState = STATE_INIT;
    
    if (!rtcManager.begin()) {
        DEBUG_PRINTLN("[System] RTC initialization failed!");
        // Continue anyway, will use fallback time
    }
    
    // Phase 2: Initialize Relay
    relayManager.begin();
    
    // Phase 3: Initialize DFPlayer
    DEBUG_PRINTLN("[System] Initializing DFPlayer...");
    if (!dfPlayerManager.begin()) {
        DEBUG_PRINTLN("[System] DFPlayer initialization failed!");
        // Continue without audio
    }
    
    // Phase 4: Connect to WiFi
    DEBUG_PRINTLN("[System] Connecting to WiFi...");
    systemState = STATE_CONNECTING;
    
    if (wifiManager.connect()) {
        supabaseClient.logStartup();
        supabaseClient.logWiFiConnection(wifiManager.getLocalIP());
        
        // Phase 5: Sync RTC from NTP if connected
        DEBUG_PRINTLN("[System] Syncing RTC with NTP...");
        if (rtcManager.syncFromNTP()) {
            supabaseClient.logNTPSync(true);
        } else {
            supabaseClient.logNTPSync(false);
        }
        
        systemState = STATE_RUNNING;
        DEBUG_PRINTLN("[System] System ready!");
    } else {
        DEBUG_PRINTLN("[System] WiFi connection failed!");
        // Run offline mode - use RTC time without cloud features
        systemState = STATE_RUNNING;
    }
    
    // Final status LED
    digitalWrite(LED_STATUS, HIGH);
    
    // Log initial state
    logSystemStatus();
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
    // === 1. WiFi Maintenance ===
    wifiManager.maintain();
    
    // === 2. Button Handling ===
    handleTestButton();
    handleResetButton();
    
    // === 3. RTC Management ===
    if (rtcManager.needsSync() && wifiManager.isConnected()) {
        if (rtcManager.syncFromNTP()) {
            supabaseClient.logNTPSync(true);
            scheduler.resetExecutedFlags();
        }
    }
    
    // === 4. Relay Auto-off ===
    relayManager.update();
    
    // === 5. Schedule Checking ===
    scheduler.update();
    
    // === 6. Heartbeat (every 60s) ===
    heartbeat.send();
    
    // === 7. Schedule Update (every 5 min or day change) ===
    heartbeat.checkScheduleUpdate();
    
    // === 8. Update LEDs ===
    updateLEDs();
    
    // === 9. Short delay ===
    delay(10);  // Prevent watchdog timer issues
}

// ============================================
// BUTTON HANDLERS
// ============================================

// Test bell button (GPIO33)
void handleTestButton() {
    if (digitalRead(BTN_TEST) == LOW) {
        if (millis() - lastBtnTest > DEBOUNCE_MS) {
            lastBtnTest = millis();
            DEBUG_PRINTLN("[Button] Test bell pressed");
            
            if (!scheduler.isBellActive()) {
                scheduler.testBell();
                supabaseClient.createLog("Manual Test", "Success", "Test bell button pressed");
            } else {
                DEBUG_PRINTLN("[Button] Bell already ringing");
            }
        }
    }
}

// Reset button (GPIO34) - long press to reset
void handleResetButton() {
    if (digitalRead(BTN_RESET) == LOW) {
        if (millis() - lastBtnReset > DEBOUNCE_MS) {
            lastBtnReset = millis();
            
            // Count how long button is held
            unsigned long pressStart = millis();
            while (digitalRead(BTN_RESET) == LOW && millis() - pressStart < 5000) {
                delay(50);
            }
            
            unsigned long pressDuration = millis() - pressStart;
            
            if (pressDuration >= 5000) {
                // Long press (5s) - full reset
                DEBUG_PRINTLN("[Button] Factory reset!");
                supabaseClient.createLog("System", "Reset", "Factory reset triggered");
                delay(1000);
                ESP.restart();
            } else if (pressDuration >= 1000) {
                // Medium press (1s) - force schedule refresh
                DEBUG_PRINTLN("[Button] Force schedule refresh");
                heartbeat.forceRefresh();
            } else {
                // Short press - toggle relay test
                DEBUG_PRINTLN("[Button] Relay test");
                relayManager.relay1On(1000);
                delay(100);
                relayManager.relay2On(1000);
            }
        }
    }
}

// ============================================
// LED INDICATORS
// ============================================
void updateLEDs() {
    // WiFi LED - solid when connected, blink when not
    digitalWrite(LED_WIFI, wifiManager.isConnected() ? HIGH : LOW);
    
    // Status LED - heartbeat blink
    static unsigned long lastStatusBlink = 0;
    if (millis() - lastStatusBlink > 2000) {
        digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
        lastStatusBlink = millis();
    }
    
    // Bell LED - controlled by scheduler/DFPlayer (on when playing)
    // Already handled in dfPlayerManager
}

// ============================================
// SYSTEM UTILITIES
// ============================================
void logSystemStatus() {
    DEBUG_PRINTLN("\n--- System Status ---");
    DEBUG_PRINT("RTC: ");
    DEBUG_PRINTLN(rtcManager.isWorking() ? "OK" : "FAIL");
    DEBUG_PRINT("Time: ");
    DEBUG_PRINTLN(rtcManager.getFormattedDateTime());
    DEBUG_PRINT("Day: ");
    DEBUG_PRINTLN(rtcManager.getDayName());
    DEBUG_PRINT("WiFi: ");
    DEBUG_PRINTLN(wifiManager.isConnected() ? "Connected" : "Disconnected");
    DEBUG_PRINT("IP: ");
    DEBUG_PRINTLN(wifiManager.getLocalIP());
    DEBUG_PRINT("DFPlayer: ");
    DEBUG_PRINTLN(dfPlayerManager.isWorking() ? "OK" : "FAIL");
    DEBUG_PRINT("Free Heap: ");
    DEBUG_PRINT(ESP.getFreeHeap());
    DEBUG_PRINTLN(" bytes");
    DEBUG_PRINTLN("----------------------\n");
}

// ============================================
// DEEP SLEEP (for future battery mode)
// ============================================
void enterDeepSleep() {
    DEBUG_PRINTLN("[System] Entering deep sleep...");
    
    // Log sleep event
    supabaseClient.createLog("System", "Sleep", "Entering deep sleep mode");
    delay(100);
    
    // Configure wake-up sources
    // For now, use timer wake-up (1 hour)
    esp_sleep_enable_timer_wakeup(3600 * 1000000ULL);  // 1 hour in microseconds
    
    // Turn off LEDs
    digitalWrite(LED_WIFI, LOW);
    digitalWrite(LED_BELL, LOW);
    digitalWrite(LED_STATUS, LOW);
    
    // Enter deep sleep
    esp_deep_sleep_start();
}

// ============================================
// ISR (Interrupt Service Routines)
// ============================================
// Not using ISRs for now - buttons handled in loop with debounce