#ifndef LED_MANAGER_H
#define LED_MANAGER_H

#include "app_state.h"

void initLED();
void handleLED(unsigned long now);
void handleRtcTest(unsigned long now);
void handleRtcRawTest(unsigned long now);

#endif
