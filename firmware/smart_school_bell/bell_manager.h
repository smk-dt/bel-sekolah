#ifndef BELL_MANAGER_H
#define BELL_MANAGER_H

#include "app_state.h"

void startBell(uint8_t track, bool test);
void updateBell();
const char* bellStateName();

#endif
