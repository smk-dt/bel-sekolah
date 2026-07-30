// ============================================
// SMART SCHOOL BELL IoT - Relay Manager Implementation
// ============================================
#include "relay.h"

// Global flags (used by DFPlayer)
bool g_audioPlaying = false;
int g_audioTrackPlaying = 0;

// Static members
bool RelayManager::relay1State = false;
bool RelayManager::relay2State = false;
RelaySequenceState RelayManager::seqState = SEQ_IDLE;
int RelayManager::seqTrackNumber = 0;
unsigned long RelayManager::seqTimestamp = 0;
bool RelayManager::seqIsTest = false;
unsigned long RelayManager::seqStartTime = 0;

void RelayManager::begin() {
    LOG_INFO("RELAY", "Initializing Relay Manager");
    
    pinMode(PIN_RELAY_1, OUTPUT);
    pinMode(PIN_RELAY_2, OUTPUT);
    
    // Default OFF (LOW = relay off)
    digitalWrite(PIN_RELAY_1, LOW);
    digitalWrite(PIN_RELAY_2, LOW);
    
    relay1State = false;
    relay2State = false;
    
    g_sysStatus.relay1State = false;
    g_sysStatus.relay2State = false;
    
    LOG_INFO("RELAY", "Relays initialized - both OFF");
}

void RelayManager::task(void* parameter) {
    LOG_INFO("RELAY", "Relay task started");
    
    while (1) {
        if (seqState != SEQ_IDLE) {
            // Check timeout first
            checkTimeout();
            
            // Execute current step
            switch (seqState) {
                case SEQ_RELAY1_ON:
                    stepRelay1On();
                    break;
                    
                case SEQ_WAIT_RELAY1_DELAY:
                    stepWaitRelay1Delay();
                    break;
                    
                case SEQ_RELAY2_ON:
                    stepRelay2On();
                    break;
                    
                case SEQ_WAIT_RELAY2_DELAY:
                    stepWaitRelay2Delay();
                    break;
                    
                case SEQ_PLAY_AUDIO:
                    stepPlayAudio();
                    break;
                    
                case SEQ_WAIT_AUDIO_DONE:
                    stepWaitAudioDone();
                    break;
                    
                case SEQ_RELAY2_OFF:
                    stepRelay2Off();
                    break;
                    
                case SEQ_WAIT_RELAY2_OFF:
                    stepWaitRelay2Off();
                    break;
                    
                case SEQ_RELAY1_OFF:
                    stepRelay1Off();
                    break;
                    
                default:
                    break;
            }
        }
        
        // Update global status
        g_sysStatus.relay1State = relay1State;
        g_sysStatus.relay2State = relay2State;
        
        vTaskDelay(50 / portTICK_PERIOD_MS); // Check every 50ms for responsive sequence
    }
}

void RelayManager::setRelay1(bool state) {
    if (relay1State != state) {
        digitalWrite(PIN_RELAY_1, state ? HIGH : LOW);
        relay1State = state;
        LOG_INFO("RELAY", "Relay1 " + String(state ? "ON" : "OFF"));
    }
}

void RelayManager::setRelay2(bool state) {
    if (relay2State != state) {
        digitalWrite(PIN_RELAY_2, state ? HIGH : LOW);
        relay2State = state;
        LOG_INFO("RELAY", "Relay2 " + String(state ? "ON" : "OFF"));
    }
}

bool RelayManager::getRelay1State() {
    return relay1State;
}

bool RelayManager::getRelay2State() {
    return relay2State;
}

void RelayManager::startBellSequence(int trackNumber) {
    if (seqState != SEQ_IDLE) {
        LOG_WARN("RELAY", "Sequence already active, ignoring");
        return;
    }
    
    LOG_INFO("RELAY", "Starting bell sequence - Track: " + String(trackNumber));
    
    seqTrackNumber = trackNumber;
    seqIsTest = false;
    seqState = SEQ_RELAY1_ON;
    seqTimestamp = millis();
    seqStartTime = millis();
    
    g_sysStatus.bellActive = true;
    g_sysStatus.testActive = false;
}

void RelayManager::startTestSequence() {
    if (seqState != SEQ_IDLE) {
        LOG_WARN("RELAY", "Sequence already active, ignoring test");
        return;
    }
    
    LOG_INFO("RELAY", "Starting TEST sequence with track " + String(AUDIO_TEST_TRACK));
    
    seqTrackNumber = AUDIO_TEST_TRACK;
    seqIsTest = true;
    seqState = SEQ_RELAY1_ON;
    seqTimestamp = millis();
    seqStartTime = millis();
    
    g_sysStatus.bellActive = false;
    g_sysStatus.testActive = true;
}

void RelayManager::abortSequence() {
    if (seqState != SEQ_IDLE) {
        LOG_WARN("RELAY", "Sequence aborted!");
        
        // Turn off everything
        setRelay2(false);
        setRelay1(false);
        
        seqState = SEQ_IDLE;
        g_sysStatus.bellActive = false;
        g_sysStatus.testActive = false;
    }
}

bool RelayManager::isSequenceActive() {
    return (seqState != SEQ_IDLE);
}

RelaySequenceState RelayManager::getSequenceState() {
    return seqState;
}

void RelayManager::onAudioComplete() {
    // Audio is done, move to next step
    if (seqState == SEQ_WAIT_AUDIO_DONE) {
        LOG_INFO("RELAY", "Audio complete, continuing sequence");
        seqState = SEQ_RELAY2_OFF;
        seqTimestamp = millis();
    }
}

// ===== Sequence Step Handlers =====

void RelayManager::stepRelay1On() {
    setRelay1(true);
    seqState = SEQ_WAIT_RELAY1_DELAY;
    seqTimestamp = millis();
    LOG_INFO("RELAY", "Step 1/9: Relay1 ON - waiting " + String(RELAY1_ON_DELAY) + "ms");
}

void RelayManager::stepWaitRelay1Delay() {
    if (millis() - seqTimestamp >= RELAY1_ON_DELAY) {
        seqState = SEQ_RELAY2_ON;
        seqTimestamp = millis();
    }
}

void RelayManager::stepRelay2On() {
    setRelay2(true);
    seqState = SEQ_WAIT_RELAY2_DELAY;
    seqTimestamp = millis();
    LOG_INFO("RELAY", "Step 3/9: Relay2 ON - waiting " + String(RELAY2_ON_DELAY) + "ms");
}

void RelayManager::stepWaitRelay2Delay() {
    if (millis() - seqTimestamp >= RELAY2_ON_DELAY) {
        seqState = SEQ_PLAY_AUDIO;
        seqTimestamp = millis();
    }
}

void RelayManager::stepPlayAudio() {
    LOG_INFO("RELAY", "Step 5/9: Playing audio track " + String(seqTrackNumber));
    
    // Signal external module to play audio
    // This is picked up by DFPlayer task
    g_audioTrackPlaying = seqTrackNumber;
    g_audioPlaying = true;
    
    seqState = SEQ_WAIT_AUDIO_DONE;
    seqTimestamp = millis();
}

void RelayManager::stepWaitAudioDone() {
    // Check if audio is done via BUSY pin
    // BUSY = LOW means playing, HIGH means done
    int busyState = digitalRead(PIN_DFPLAYER_BUSY);
    
    // Also check if audio playing flag cleared
    if (busyState == HIGH && !g_audioPlaying) {
        LOG_INFO("RELAY", "Step 6/9: Audio finished (BUSY=HIGH)");
        seqState = SEQ_RELAY2_OFF;
        seqTimestamp = millis();
    }
    
    // Safety: if audio track changed or timeout
    if (millis() - seqTimestamp > 60000) { // 1 minute max audio
        LOG_WARN("RELAY", "Audio timeout, continuing sequence");
        g_audioPlaying = false;
        seqState = SEQ_RELAY2_OFF;
        seqTimestamp = millis();
    }
}

void RelayManager::stepRelay2Off() {
    setRelay2(false);
    seqState = SEQ_WAIT_RELAY2_OFF;
    seqTimestamp = millis();
    LOG_INFO("RELAY", "Step 7/9: Relay2 OFF - waiting " + String(RELAY2_OFF_DELAY) + "ms");
}

void RelayManager::stepWaitRelay2Off() {
    if (millis() - seqTimestamp >= RELAY2_OFF_DELAY) {
        seqState = SEQ_RELAY1_OFF;
        seqTimestamp = millis();
    }
}

void RelayManager::stepRelay1Off() {
    setRelay1(false);
    LOG_INFO("RELAY", "Step 9/9: Relay1 OFF - sequence complete");
    stepComplete();
}

void RelayManager::stepComplete() {
    seqState = SEQ_IDLE;
    g_sysStatus.bellActive = false;
    g_sysStatus.testActive = false;
    g_audioPlaying = false;
    g_audioTrackPlaying = 0;
    
    LOG_INFO("RELAY", "Bell sequence completed successfully in " + 
             String((millis() - seqStartTime) / 1000) + "s");
}

void RelayManager::checkTimeout() {
    if (millis() - seqStartTime > RELAY_SEQUENCE_TIMEOUT) {
        LOG_ERROR("RELAY", "Sequence timeout after " + String(RELAY_SEQUENCE_TIMEOUT) + "ms");
        
        // Emergency stop
        setRelay2(false);
        setRelay1(false);
        g_audioPlaying = false;
        
        seqState = SEQ_IDLE;
        g_sysStatus.bellActive = false;
        g_sysStatus.testActive = false;
    }
}