// ============================================
// SMART SCHOOL BELL IoT - Relay Manager Header
// ============================================
// Hardware: 2-Channel Relay Module
// Relay 1 (Mixer Power)  -> GPIO25
// Relay 2 (Mixer Audio)  -> GPIO26
// ============================================
#ifndef RELAY_H
#define RELAY_H

#include <Arduino.h>
#include "config.h"
#include "utils.h"
#include "logger.h"

// Relay states for sequence control
enum RelaySequenceState {
    SEQ_IDLE = 0,
    SEQ_RELAY1_ON,          // Step 1: Relay1 ON
    SEQ_WAIT_RELAY1_DELAY,  // Step 2: Wait 2 detik
    SEQ_RELAY2_ON,          // Step 3: Relay2 ON
    SEQ_WAIT_RELAY2_DELAY,  // Step 4: Wait 500ms
    SEQ_PLAY_AUDIO,         // Step 5: Play audio
    SEQ_WAIT_AUDIO_DONE,    // Step 6: Wait BUSY HIGH
    SEQ_RELAY2_OFF,         // Step 7: Relay2 OFF
    SEQ_WAIT_RELAY2_OFF,    // Step 8: Wait 1 detik
    SEQ_RELAY1_OFF          // Step 9: Relay1 OFF
};

class RelayManager {
public:
    static void begin();
    static void task(void* parameter);
    
    // Direct control
    static void setRelay1(bool state);
    static void setRelay2(bool state);
    static bool getRelay1State();
    static bool getRelay2State();
    
    // Sequence control
    static void startBellSequence(int trackNumber);
    static void startTestSequence();
    static void abortSequence();
    static bool isSequenceActive();
    
    // Callback to set when audio playback is complete
    static void onAudioComplete();
    
    // Get current sequence state
    static RelaySequenceState getSequenceState();
    
private:
    static bool relay1State;
    static bool relay2State;
    
    // Sequence data
    static RelaySequenceState seqState;
    static int seqTrackNumber;
    static unsigned long seqTimestamp;
    static bool seqIsTest;
    
    // Sequence step handlers
    static void stepRelay1On();
    static void stepWaitRelay1Delay();
    static void stepRelay2On();
    static void stepWaitRelay2Delay();
    static void stepPlayAudio();
    static void stepWaitAudioDone();
    static void stepRelay2Off();
    static void stepWaitRelay2Off();
    static void stepRelay1Off();
    static void stepComplete();
    
    // Timeout monitor
    static unsigned long seqStartTime;
    static void checkTimeout();
};

// External flag for audio completion
extern bool g_audioPlaying;
extern int g_audioTrackPlaying;

#endif // RELAY_H