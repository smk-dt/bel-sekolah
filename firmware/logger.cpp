// ============================================
// SMART SCHOOL BELL IoT - Logger Implementation
// ============================================
#include "logger.h"
#include "utils.h"

// Static members
String Logger::logBuffer[MAX_LOG_ENTRIES];
int Logger::logIndex = 0;

void Logger::begin() {
    Serial.begin(115200);
    delay(100);
    Serial.println();
    info("LOGGER", "Logger initialized");
}

String Logger::getTimestamp() {
    // Format: [HH:MM:SS]
    char buf[12];
    sprintf(buf, "[%s]", g_sysStatus.rtcTime.c_str());
    return String(buf);
}

void Logger::addEntry(const char* levelStr, const char* tag, const char* message) {
    String timestamp = getTimestamp();
    String entry = timestamp + " [" + String(levelStr) + "] [" + String(tag) + "] " + String(message);
    
    // Save to buffer
    logBuffer[logIndex % MAX_LOG_ENTRIES] = entry;
    logIndex++;
    
    // Print to Serial
    Serial.println(entry);
}

void Logger::log(LogLevel level, const char* tag, const char* message) {
    switch (level) {
        case LOG_INFO:    addEntry("INFO", tag, message); break;
        case LOG_WARNING: addEntry("WARN", tag, message); break;
        case LOG_ERROR:   addEntry("ERROR", tag, message); break;
        case LOG_DEBUG:   addEntry("DEBUG", tag, message); break;
    }
}

void Logger::log(LogLevel level, const char* tag, const String& message) {
    log(level, tag, message.c_str());
}

void Logger::info(const char* tag, const char* message) {
    addEntry("INFO", tag, message);
}

void Logger::info(const char* tag, const String& message) {
    addEntry("INFO", tag, message.c_str());
}

void Logger::warn(const char* tag, const char* message) {
    addEntry("WARN", tag, message);
}

void Logger::warn(const char* tag, const String& message) {
    addEntry("WARN", tag, message.c_str());
}

void Logger::error(const char* tag, const char* message) {
    addEntry("ERROR", tag, message);
}

void Logger::error(const char* tag, const String& message) {
    addEntry("ERROR", tag, message.c_str());
}

void Logger::debug(const char* tag, const char* message) {
    #ifdef DEBUG_ENABLE
    addEntry("DEBUG", tag, message);
    #endif
}

void Logger::debug(const char* tag, const String& message) {
    #ifdef DEBUG_ENABLE
    addEntry("DEBUG", tag, message.c_str());
    #endif
}