#ifndef COMMAND_MANAGER_H
#define COMMAND_MANAGER_H

#include "app_state.h"

void processCommand(const String& cmdId, const String& cmdType, const String& cmdPayload);
void processCommandsFromResponse(const String& response);

#endif
