#ifndef SERIAL_MANAGER_H
#define SERIAL_MANAGER_H
#include "app_state.h"
extern String serialBuffer;
void printHelp();
void printTimeInfo();
void printStatus();
void handleSerialCommand(String cmd);
void handleSerial();
#endif

