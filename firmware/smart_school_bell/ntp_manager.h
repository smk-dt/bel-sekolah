#ifndef NTP_MANAGER_H
#define NTP_MANAGER_H

#include "app_state.h"

void applyNtpTime();
bool syncTimeFromNTP();
void handleNtpSync(unsigned long now);

#endif
