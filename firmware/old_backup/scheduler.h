// ============================================
// SMART SCHOOL BELL IoT - Schedule Manager
// ============================================
#ifndef SCHEDULER_H
#define SCHEDULER_H

#include <ArduinoJson.h>
#include "config.h"
#include "rtc_manager.h"
#include "relay_manager.h"
#include "dfplayer_manager.h"

// Schedule structure
struct Schedule {
    int id;
    String day;
    String time;       // HH:MM:SS
    int audioId;
    String audioName;
    String audioFile;
    String status;     // active / inactive
    bool executed;     // already executed for this minute
};

class Scheduler {
private:
    Schedule schedules[MAX_SCHEDULES];
    int scheduleCount;
    RTCManager* rtc;
    RelayManager* relay;
    DFPlayerManager* dfPlayer;
    int lastCheckedSecond;
    bool bellActive;
    unsigned long bellStartTime;
    int currentPlayingTrack;
    
    // Ring sequence state
    enum RingState {
        RING_IDLE,
        RING_STARTING,
        RING_PLAYING_AUDIO,
        RING_RELAY_ON,
        RING_COMPLETE
    };
    RingState ringState;
    unsigned long ringStateTime;

public:
    Scheduler(RTCManager* r, RelayManager* rl, DFPlayerManager* df) 
        : rtc(r), relay(rl), dfPlayer(df), scheduleCount(0),
          lastCheckedSecond(-1), bellActive(false), bellStartTime(0),
          currentPlayingTrack(0), ringState(RING_IDLE), ringStateTime(0) {}
    
    // Clear all schedules
    void clear() {
        scheduleCount = 0;
        DEBUG_PRINTLN("[Schedule] Cleared all schedules");
    }
    
    // Parse and add schedule from JSON
    bool addFromJson(const JsonArray& jsonArray) {
        clear();
        
        for (const auto& item : jsonArray) {
            if (scheduleCount >= MAX_SCHEDULES) {
                DEBUG_PRINTLN("[Schedule] Max schedules reached!");
                break;
            }
            
            Schedule& s = schedules[scheduleCount];
            
            // Parse schedule fields
            s.id = item["id"].as<int>();
            s.day = item["day"].as<String>();
            
            // Parse time
            if (item["time"].is<String>()) {
                s.time = item["time"].as<String>();
            } else if (item["time"].is<const char*>()) {
                s.time = String(item["time"].as<const char*>());
            }
            
            // Ensure time format has seconds
            if (s.time.length() == 5) {
                s.time += ":00";
            }
            
            // Audio info from joined table
            if (item["audios"].is<JsonObject>()) {
                JsonObject audio = item["audios"];
                s.audioName = audio["audio_name"].as<String>();
                s.audioFile = audio["audio_file"].as<String>();
            }
            
            s.audioId = item["audio_id"].as<int>();
            s.status = item["status"].as<String>();
            s.executed = false;
            
            scheduleCount++;
        }
        
        DEBUG_PRINTF("[Schedule] Loaded %d schedules\n", scheduleCount);
        return scheduleCount > 0;
    }
    
    // The main scheduler loop - call every iteration
    void update() {
        // Handle bell ringing sequence
        if (ringState != RING_IDLE) {
            updateBellSequence();
            return;
        }
        
        // Check schedules every second
        if (!rtc->isWorking()) return;
        
        int currentSec = rtc->getTotalSeconds();
        if (currentSec == lastCheckedSecond) return;
        lastCheckedSecond = currentSec;
        
        String currentDay = rtc->getDayName();
        
        // Check each schedule
        for (int i = 0; i < scheduleCount; i++) {
            Schedule& s = schedules[i];
            
            // Skip if inactive or already executed
            if (s.status != "active" || s.executed) continue;
            
            // Check if day matches
            if (s.day != currentDay) continue;
            
            // Check if time matches (within the same minute)
            int scheduleSec = RTCManager::timeToSeconds(s.time);
            int currentMinute = (currentSec / 60) * 60;
            int scheduleMinute = (scheduleSec / 60) * 60;
            
            if (currentMinute == scheduleMinute) {
                DEBUG_PRINTF("[Schedule] Trigger: %s at %s\n", s.day.c_str(), s.time.c_str());
                triggerBell(i);
                s.executed = true;
            }
        }
    }
    
    // Track if schedule executed (for the next check cycle)
    void resetExecutedFlags() {
        for (int i = 0; i < scheduleCount; i++) {
            schedules[i].executed = false;
        }
    }
    
    // Manual test bell
    void testBell() {
        DEBUG_PRINTLN("[Schedule] Manual bell test");
        // Play first active schedule's audio, or track 1
        int trackNum = 1;
        for (int i = 0; i < scheduleCount; i++) {
            if (schedules[i].status == "active") {
                trackNum = schedules[i].audioId;
                break;
            }
        }
        
        // Start bell sequence with specified track
        startBellSequence(trackNum);
    }
    
    // Get schedule count
    int getCount() { return scheduleCount; }
    
    // Check if bell is currently ringing
    bool isBellActive() { return ringState != RING_IDLE; }
    
    // Get current bell status string
    String getBellStatus() {
        if (ringState != RING_IDLE) return "Ringing";
        return "Standby";
    }

private:
    // Trigger bell ringing for a schedule
    void triggerBell(int index) {
        if (index < 0 || index >= scheduleCount) return;
        
        int trackNumber = schedules[index].audioId;
        if (trackNumber <= 0) trackNumber = 1;  // Default track
        
        startBellSequence(trackNumber);
    }
    
    // Start the bell sequence
    void startBellSequence(int trackNumber) {
        if (bellActive) return;
        
        DEBUG_PRINTF("[Bell] Starting sequence, track %d\n", trackNumber);
        
        ringState = RING_STARTING;
        ringStateTime = millis();
        bellActive = true;
        currentPlayingTrack = trackNumber;
        
        // Record log to Supabase will be handled by main
    }
    
    // Update bell ringing sequence
    void updateBellSequence() {
        unsigned long now = millis();
        
        switch (ringState) {
            case RING_STARTING:
                // Turn on relay 1 (mixer/speaker)
                relay->relay1On(RELAY_ON_DURATION_MS);
                // Start playing audio
                dfPlayer->playTrack(currentPlayingTrack);
                ringState = RING_PLAYING_AUDIO;
                ringStateTime = now;
                DEBUG_PRINTLN("[Bell] Playing audio...");
                break;
                
            case RING_PLAYING_AUDIO:
                // Wait for audio to finish or timeout
                if (!dfPlayer->isPlaying()) {
                    // Audio finished, turn on bell relay briefly
                    relay->relay2On(BELL_RING_DURATION_MS);
                    ringState = RING_RELAY_ON;
                    ringStateTime = now;
                    DEBUG_PRINTLN("[Bell] Audio finished, relay ON");
                }
                break;
                
            case RING_RELAY_ON:
                // Wait for relay duration
                if (now - ringStateTime >= BELL_RING_DURATION_MS) {
                    ringState = RING_COMPLETE;
                    ringStateTime = now;
                    DEBUG_PRINTLN("[Bell] Sequence complete");
                }
                break;
                
            case RING_COMPLETE:
                // Finalize
                bellActive = false;
                ringState = RING_IDLE;
                dfPlayer->stop();
                relay->allOff();
                DEBUG_PRINTLN("[Bell] Ready for next schedule");
                break;
                
            default:
                ringState = RING_IDLE;
                bellActive = false;
                break;
        }
    }
};

#endif // SCHEDULER_H