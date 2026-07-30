// ============================================
// SMART SCHOOL BELL IoT - DFPlayer Mini Manager Header
// ============================================
// Communication: Serial2 (TX2=GPIO17, RX2=GPIO16)
// BUSY Pin: GPIO27 (LOW=playing, HIGH=stopped)
// Library: DFRobotDFPlayerMini
// Baudrate: 9600
// ============================================
#ifndef DFPLAYER_H
#define DFPLAYER_H

#include <Arduino.h>
#include <HardwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include "config.h"
#include "utils.h"
#include "logger.h"

class DFPlayerManager {
public:
    static void begin();
    static void task(void* parameter);
    
    // Playback control
    static void play(int trackNumber);
    static void playTest();
    static void stop();
    static void setVolume(int volume);  // 0-30
    
    // Status
    static bool isPlaying();
    static int getCurrentTrack();
    static int getVolume();
    static bool isConnected();
    static bool isSDAvailable();
    
    // Callback
    static void onFinish();
    
private:
    static DFRobotDFPlayerMini player;
    static bool playerFound;
    static bool sdAvailable;
    static int currentVolume;
    static int currentTrack;
    static bool isNowPlaying;
    static unsigned long lastBusyCheck;
    
    // Internal
    static bool initPlayer();
    static bool checkBusy();
    static void updateStatus();
};

#endif // DFPLAYER_H