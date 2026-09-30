#ifndef RTC_MANAGER_H
#define RTC_MANAGER_H

#include "app_state.h"

void initRTC();
void handleRTC(unsigned long now);
RtcDateTime getRtcTime();
String formatDateTime(const RtcDateTime& dt);
String formatIsoUtc(const RtcDateTime& dt);

#endif
