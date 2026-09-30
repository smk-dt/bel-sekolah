#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "app_state.h"

void initWiFi();
void handleWiFi(unsigned long now);
void initPttWebSocket();

#endif
