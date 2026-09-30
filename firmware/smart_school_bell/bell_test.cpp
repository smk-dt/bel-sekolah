#include "bell_test.h"
#include "bell_manager.h"

void executeBellTest(const String& payload) {
    int track = 0;
    int idx = payload.indexOf("\"track\"");
    if (idx >= 0) {
        idx = payload.indexOf(':', idx);
        if (idx >= 0) {
            track = payload.substring(idx + 1).toInt();
        }
    }

    if (track > 0 && track <= 255) {
        Serial.printf("[CMD BELL TEST] Valid track: %d\n", track);
        startBell((uint8_t)track, true);
    } else {
        Serial.printf("[CMD BELL TEST] Invalid track in payload: %s\n", payload.c_str());
    }
}