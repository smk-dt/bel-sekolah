#ifndef API_MANAGER_H
#define API_MANAGER_H

#include "app_state.h"

bool deviceApiRequest(const String& action, const String& payloadBody, int& httpCode, String* responseOut = nullptr);
void registerDevice();
void sendHeartbeat();
void pollCommands();
void handleSupabaseHeartbeat(unsigned long now);
void handleCommandPolling(unsigned long now);

#endif
