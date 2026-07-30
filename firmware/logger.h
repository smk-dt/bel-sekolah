// ============================================
// SMART SCHOOL BELL IoT - Logger Header
// ============================================
#ifndef LOGGER_H
#define LOGGER_H

#include <Arduino.h>
#include "config.h"

enum LogLevel {
    LOG_INFO,
    LOG_WARNING,
    LOG_ERROR,
    LOG_DEBUG
};

class Logger {
public:
    static void begin();
    static void log(LogLevel level, const char* tag, const char* message);
    static void log(LogLevel level, const char* tag, const String& message);
    
    static void info(const char* tag, const char* message);
    static void info(const char* tag, const String& message);
    
    static void warn(const char* tag, const char* message);
    static void warn(const char* tag, const String& message);
    
    static void error(const char* tag, const char* message);
    static void error(const char* tag, const String& message);
    
    static void debug(const char* tag, const char* message);
    static void debug(const char* tag, const String& message);

private:
    static const int MAX_LOG_ENTRIES = 50;
    static String logBuffer[MAX_LOG_ENTRIES];
    static int logIndex;
    static const unsigned long FLUSH_INTERVAL = 60000; // 1 menit
    
    static void addEntry(const char* levelStr, const char* tag, const char* message);
    static String getTimestamp();
};

// Macro shortcuts
#define LOG_INFO(tag, msg)      Logger::info(tag, msg)
#define LOG_WARN(tag, msg)      Logger::warn(tag, msg)
#define LOG_ERROR(tag, msg)     Logger::error(tag, msg)
#define LOG_DEBUG(tag, msg)     Logger::debug(tag, msg)

#endif // LOGGER_H