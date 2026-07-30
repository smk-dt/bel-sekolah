// ============================================
// SMART SCHOOL BELL IoT - DFPlayer Mini Manager Implementation
// ============================================
#include "dfplayer.h"
#include "relay.h"

DFRobotDFPlayerMini DFPlayerManager::player;
bool DFPlayerManager::playerFound = false;
bool DFPlayerManager::sdAvailable = false;
int DFPlayerManager::currentVolume = 20;  // Default volume 20/30
int DFPlayerManager::currentTrack = 0;
bool DFPlayerManager::isNowPlaying = false;
unsigned long DFPlayerManager::lastBusyCheck = 0;

// Serial2 for DFPlayer
static HardwareSerial DFSerial(2);

void DFPlayerManager::begin() {
    LOG_INFO("DFPLAYER", "Initializing DFPlayer Mini");
    
    // Setup BUSY pin
    pinMode(PIN_DFPLAYER_BUSY, INPUT_PULLUP);
    
    // Initialize Serial2 for DFPlayer
    DFSerial.begin(DFPLAYER_BAUDRATE, SERIAL_8N1, PIN_DFPLAYER_RX, PIN_DFPLAYER_TX);
    delay(500);
    
    // Try to init DFPlayer
    if (initPlayer()) {
        playerFound = true;
        player.setTimeOut(500);
        
        // Set volume
        player.volume(currentVolume);
        
        LOG_INFO("DFPLAYER", "DFPlayer initialized successfully");
        
        // Check SD card
        delay(1000);
        sdAvailable = true;
        LOG_INFO("DFPLAYER", "SD Card ready");
    } else {
        playerFound = false;
        sdAvailable = false;
        LOG_ERROR("DFPLAYER", "DFPlayer not found! Check wiring");
    }
    
    g_sysStatus.dfplayerConnected = playerFound;
    g_sysStatus.sdCardReady = sdAvailable;
}

void DFPlayerManager::task(void* parameter) {
    LOG_INFO("DFPLAYER", "DFPlayer task started");
    
    while (1) {
        // Check if there's a new track to play (from relay sequence)
        if (g_audioPlaying && g_audioTrackPlaying > 0 && !isNowPlaying) {
            LOG_INFO("DFPLAYER", "Playing requested track: " + String(g_audioTrackPlaying));
            play(g_audioTrackPlaying);
        }
        
        // Monitor BUSY pin
        if (isNowPlaying && checkBusy()) {
            // Audio finished (BUSY went HIGH)
            LOG_INFO("DFPLAYER", "Audio playback completed (BUSY=DONE)");
            onFinish();
        }
        
        // Update status
        updateStatus();
        
        vTaskDelay(100 / portTICK_PERIOD_MS); // Check every 100ms
    }
}

bool DFPlayerManager::initPlayer() {
    int retries = 0;
    while (retries < 3) {
        if (player.begin(DFSerial)) {
            return true;
        }
        delay(500);
        retries++;
        LOG_WARN("DFPLAYER", "Init attempt " + String(retries) + " failed");
    }
    return false;
}

void DFPlayerManager::play(int trackNumber) {
    if (!playerFound) {
        LOG_ERROR("DFPLAYER", "Cannot play - DFPlayer not connected");
        return;
    }
    
    LOG_INFO("DFPLAYER", "Playing track " + String(trackNumber));
    player.play(trackNumber);
    currentTrack = trackNumber;
    isNowPlaying = true;
}

void DFPlayerManager::playTest() {
    play(AUDIO_TEST_TRACK);
}

void DFPlayerManager::stop() {
    if (!playerFound) return;
    player.stop();
    isNowPlaying = false;
    currentTrack = 0;
}

void DFPlayerManager::setVolume(int volume) {
    if (!playerFound) return;
    currentVolume = constrain(volume, 0, 30);
    player.volume(currentVolume);
}

bool DFPlayerManager::isPlaying() {
    return isNowPlaying;
}

int DFPlayerManager::getCurrentTrack() {
    return currentTrack;
}

int DFPlayerManager::getVolume() {
    return currentVolume;
}

bool DFPlayerManager::isConnected() {
    return playerFound;
}

bool DFPlayerManager::isSDAvailable() {
    return sdAvailable;
}

void DFPlayerManager::onFinish() {
    isNowPlaying = false;
    currentTrack = 0;
    g_audioPlaying = false;
    g_audioTrackPlaying = 0;
    
    // Notify relay manager
    RelayManager::onAudioComplete();
}

bool DFPlayerManager::checkBusy() {
    // BUSY pin: LOW = playing, HIGH = stopped
    int busyState = digitalRead(PIN_DFPLAYER_BUSY);
    
    // Additional check via DFPlayer library
    if (busyState == HIGH) {
        return true; // Not busy -> finished
    }
    
    return false;
}

void DFPlayerManager::updateStatus() {
    g_sysStatus.dfplayerConnected = playerFound;
    g_sysStatus.sdCardReady = sdAvailable;
}