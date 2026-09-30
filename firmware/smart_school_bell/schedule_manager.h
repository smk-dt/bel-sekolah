#ifndef SCHEDULE_MANAGER_H
#define SCHEDULE_MANAGER_H

#include "app_state.h"

bool addSchedule(const char* name, uint8_t day, uint8_t hour, uint8_t minute, uint8_t track, bool enabled);
void clearScheduleCache();
const char* scheduleDayName(uint8_t day);
void printSchedule();
void checkSchedule();
void printNextBell();
bool syncSchedulesFromServer();
void handleScheduleSync(unsigned long now);

#endif
