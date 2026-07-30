// ============================================
// SMART SCHOOL BELL IoT - DFPlayer Mini Manager
// ============================================
#ifndef DFPLAYER_MANAGER_H
#define DFPLAYER_MANAGER_H

#include <SoftwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include "config.h"

class DFPlayerManager {
private:
    SoftwareSerial swSerial;
    DFRobotDFPlayerMini dfPlayer;
    bool _initialized;
    bool _isPlaying;
    unsigned long playStartTime;
    int currentTrack;
    int lastBusyState;

public:
    DFPlayerManager() : swSerial(DFPLAYER_RX_PIN, DFPLAYER_TX_PIN),
                        _initialized(false), _isPlaying(false),
                        playStartTime(0), currentTrack(0),
                        lastBusyState(HIGH) {}
    
    // Initialize DFPlayer Mini
    bool begin() {
        swSerial.begin(9600);
        
        delay(1000); // Wait for DFPlayer to boot
        
        if (!dfPlayer.begin(swSerial)) {
            DEBUG_PRINTLN("[DFPlayer] Initialization failed!");
            DEBUG_PRINTLN("[DFPlayer] Check connections and microSD card");
            _initialized = false;
            return false;
        }
        
        DEBUG_PRINTLN("[DFPlayer] Initialized!");
        
        // Configure DFPlayer
        dfPlayer.volume(DFPLAYER_VOLUME);
        dfPlayer.EQ(DFPLAYER_EQ_NORMAL);
        dfPlayer.outputDevice(DFPLAYER_DEVICE_SD);  // Use microSD card
        
        _initialized = true;
        _isPlaying = false;
        
        // Set busy pin
        pinMode(DFPLAYER_BUSY_PIN, INPUT_PULLUP);
        lastBusyState = digitalRead(DFPLAYER_BUSY_PIN);
        
        return true;
    }
    
    // Play a track from specified folder
    void playTrack(int trackNumber) {
        if (!_initialized) return;
        
        DEBUG_PRINTF("[DFPlayer] Playing track %d\n", trackNumber);
        
        dfPlayer.playFolder(AUDIO_FOLDER_MAIN, trackNumber);
        
        _isPlaying = true;
        currentTrack = trackNumber;
        playStartTime = millis();
        
        digitalWrite(LED_BELL, HIGH);
    }
    
    // Play specific file in main folder
    void playTrackNumber(int trackNumber) {
        playTrack(trackNumber);
    }
    
    // Stop playing
    void stop() {
        if (!_initialized) return;
        
        dfPlayer.stop();
        _isPlaying = false;
        currentTrack = 0;
        
        digitalWrite(LED_BELL, LOW);
        
        DEBUG_PRINTLN("[DFPlayer] Stopped");
    }
    
    // Pause playback
    void pause() {
        if (!_initialized || !_isPlaying) return;
        
        dfPlayer.pause();
        DEBUG_PRINTLN("[DFPlayer] Paused");
    }
    
    // Resume playback
    void resume() {
        if (!_initialized) return;
        
        dfPlayer.start();
        _isPlaying = true;
        DEBUG_PRINTLN("[DFPlayer] Resumed");
    }
    
    // Set volume (0-30)
    void setVolume(int volume) {
        if (!_initialized) return;
        
        volume = constrain(volume, 0, 30);
        dfPlayer.volume(volume);
        DEBUG_PRINTF("[DFPlayer] Volume: %d\n", volume);
    }
    
    // Get current volume
    int getVolume() {
        if (!_initialized) return 0;
        return dfPlayer.readVolume();
    }
    
    // Check if audio is still playing
    bool isPlaying() {
        if (!_initialized) return false;
        
        // Check busy pin
        int busyState = digitalRead(DFPLAYER_BUSY_PIN);
        
        // LOW means playing, HIGH means stopped
        if (busyState == HIGH && _isPlaying) {
            _isPlaying = false;
            digitalWrite(LED_BELL, LOW);
        }
        
        // Also check timeout
        if (_isPlaying && (millis() - playStartTime > AUDIO_PLAY_TIMEOUT_MS)) {
            DEBUG_PRINTLN("[DFPlayer] Play timeout, stopping");
            stop();
            return false;
        }
        
        return _isPlaying;
    }
    
    // Check if DFPlayer is working
    bool isWorking() {
        return _initialized;
    }
    
    // Get current track number
    int getCurrentTrack() {
        return currentTrack;
    }
    
    // Get total tracks on SD card
    int getTotalTracks() {
        if (!_initialized) return 0;
        return dfPlayer.readFileCountsInFolder(AUDIO_FOLDER_MAIN);
    }
    
    // Check SD card status
    bool hasSDCard() {
        if (!_initialized) return false;
        return dfPlayer.readState() != 0;
    }
    
    // Play a tone/dummy for testing
    void playTestTone() {
        playTrack(1); // Assume track 1 is test tone
    }
};

#endif // DFPLAYER_MANAGER_H