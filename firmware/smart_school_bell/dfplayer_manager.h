#ifndef DFPLAYER_MANAGER_H
#define DFPLAYER_MANAGER_H

#include "app_state.h"

void initDFPlayer();
bool isDFPlayerBusy();
void updateDFPlayer();
void playTrack(uint8_t track);
void stopTrack();
void printDFStatus();

#endif
