// ============================================
// SMART SCHOOL BELL IoT - Home Dashboard
// ============================================

// ============================================
// DOM REFS
// ============================================
const homeDom = {
    deviceGrid: document.getElementById('device-grid'),
    nextbellTime: document.getElementById('nextbell-time'),
    nextbellName: document.getElementById('nextbell-name'),
    nextbellAudio: document.getElementById('nextbell-audio'),
    countdownValue: document.getElementById('countdown-value'),
    nextbellStatusBadge: document.getElementById('nextbell-status-badge'),
    heroSysStatus: document.getElementById('hero-sys-status'),
    btnTestAudio: document.getElementById('btn-test-audio'),
    qaAudioLoading: document.getElementById('qa-audio-loading'),
    btnSyncRtc: document.getElementById('btn-sync-rtc'),
    btnRefreshStatus: document.getElementById('btn-refresh-status'),
    btnRestartEsp: document.getElementById('btn-restart-esp'),
    relayButtons: document.querySelectorAll('.qa-relay'),
};

// ============================================
// DEVICE ICON MAPPING
// ============================================
const deviceIcons = {
    'DFPlayer Mini': { icon: 'bi-music-note-beamed', color: 'icon-success' },
    'RTC DS3231': { icon: 'bi-clock', color: 'icon-primary' },
    'Relay 1': { icon: 'bi-toggle-on', color: 'icon-primary' },
    'Relay 2': { icon: 'bi-toggle-on', color: 'icon-primary' },
    'WiFi': { icon: 'bi-wifi', color: 'icon-warning' },
    'Supabase': { icon: 'bi-cloud-check', color: 'icon-secondary' },
    'Audio Player': { icon: 'bi-volume-up', color: 'icon-success' },
    'ESP32': { icon: 'bi-cpu', color: 'icon-primary' },
};

function getDeviceIcon(deviceName) {
    for (const [key, value] of Object.entries(deviceIcons)) {
        if (deviceName.toLowerCase().includes(key.toLowerCase())) {
            return value;
        }
    }
    return { icon: 'bi-gear', color: 'icon-secondary' };
}

// ============================================
// LOAD HOME DATA
// ============================================
async function loadHomeData() {
    try {
        // Show skeleton
        App.showSkeleton('device-grid', 'grid', 4);
        
        const sb = window.initSupabase();
        if (!sb) {
            renderFallbackDevices();
            return;
        }

        // Fetch next schedule
        const now = new Date();
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const todayName = dayNames[now.getDay()];
        const currentTime = now.toTimeString().slice(0, 5);

        const { data: schedules, error: schedError } = await sb
            .from('schedules')
            .select('*')
            .eq('day', todayName)
            .eq('status', 'active')
            .gte('time', currentTime)
            .order('time', { ascending: true })
            .limit(1);

        if (schedError) {
            console.error('[Home] Schedule fetch error:', schedError);
            renderFallbackNextBell();
        } else if (schedules && schedules.length > 0) {
            renderNextBell(schedules[0]);
            startCountdown(schedules[0].time);
        } else {
            // Check if any schedule passed for today
            const { data: pastSchedules } = await sb
                .from('schedules')
                .select('*')
                .eq('day', todayName)
                .eq('status', 'active')
                .lt('time', currentTime)
                .order('time', { ascending: false })
                .limit(1);

            if (pastSchedules && pastSchedules.length > 0) {
                renderNextBellNone('Semua jadwal hari ini telah selesai');
            } else {
                renderNextBellNone('Tidak ada jadwal untuk hari ini');
            }
        }

        // Fetch device status from ESP (via API or Supabase)
        await fetchDeviceStatus(sb);

    } catch (err) {
        console.error('[Home] Error loading data:', err);
        renderFallbackDevices();
        renderFallbackNextBell();
    }
}

// ============================================
// RENDER DEVICES
// ============================================
async function fetchDeviceStatus(sb) {
    const devices = [
        { name: 'ESP32', status: 'ok', desc: 'Online' },
        { name: 'DFPlayer Mini', status: 'ok', desc: 'Ready' },
        { name: 'RTC DS3231', status: 'ok', desc: 'Sync OK' },
        { name: 'Relay 1', status: 'ok', desc: 'Normal' },
        { name: 'Relay 2', status: 'ok', desc: 'Normal' },
        { name: 'WiFi', status: 'ok', desc: 'Terhubung' },
    ];

    // Try to get actual status from supabase esp_status table
    try {
        const { data: espStatus } = await sb
            .from('esp_status')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (espStatus && espStatus.length > 0) {
            const status = espStatus[0];
            App.updateEspStatus(status.status === 'online');
            
            // Update relay status
            if (status.relay1 !== undefined) {
                devices[3].status = status.relay1 ? 'ok' : 'warning';
                devices[3].desc = status.relay1 ? 'ON' : 'OFF';
            }
            if (status.relay2 !== undefined) {
                devices[4].status = status.relay2 ? 'ok' : 'warning';
                devices[4].desc = status.relay2 ? 'ON' : 'OFF';
            }
            if (status.wifi_rssi !== undefined) {
                devices[5].status = status.wifi_rssi > -70 ? 'ok' : 'warning';
                devices[5].desc = `${status.wifi_rssi} dBm`;
            }
            if (status.dfplayer_status !== undefined) {
                devices[1].status = status.dfplayer_status ? 'ok' : 'error';
                devices[1].desc = status.dfplayer_status ? 'Ready' : 'Error';
            }

            // Enhanced status: ESP32 with uptime & free heap
            if (status.uptime_seconds !== undefined || status.free_heap !== undefined) {
                let desc = '';
                if (status.uptime_seconds !== undefined) {
                    const h = Math.floor(status.uptime_seconds / 3600);
                    const m = Math.floor((status.uptime_seconds % 3600) / 60);
                    desc += `${h}h ${m}m`;
                }
                if (status.free_heap !== undefined) {
                    const heapKB = (status.free_heap / 1024).toFixed(1);
                    desc += desc ? ` | ${heapKB} KB` : `${heapKB} KB`;
                }
                devices[0].desc = desc || 'Online';
            }

            // System state & CPU freq — update ESP32 status based on system_state
            if (status.system_state !== undefined) {
                const stateMap = {
                    0: 'Init',
                    1: 'WiFi...',
                    2: 'Online',
                    3: 'Sync...',
                    4: 'Error',
                    5: 'OTA',
                };
                const stateStr = stateMap[status.system_state] || `State ${status.system_state}`;
                // Append to existing desc or replace
                if (devices[0].desc !== 'Online') {
                    devices[0].desc += ` | ${stateStr}`;
                } else {
                    devices[0].desc = stateStr;
                }
            }

            // RTC time — update RTC DS3231 desc
            if (status.rtc_time) {
                devices[2].desc = status.rtc_time;
            }

            // Bell active — update visual indicator (render akan handle)
            if (status.bell_active !== undefined) {
                if (status.bell_active) {
                    // Bell is ringing — we can show this in the hero section
                    if (homeDom.heroSysStatus) {
                        homeDom.heroSysStatus.textContent = 'Bel Berbunyi';
                        homeDom.heroSysStatus.style.color = 'var(--danger)';
                    }
                } else {
                    if (homeDom.heroSysStatus && homeDom.heroSysStatus.textContent === 'Bel Berbunyi') {
                        homeDom.heroSysStatus.textContent = 'Aktif';
                        homeDom.heroSysStatus.style.color = '';
                    }
                }
            }

            // Schedules count — update badge if available
            if (status.schedules_count !== undefined) {
                const count = status.schedules_count;
                if (homeDom.nextbellStatusBadge && homeDom.nextbellStatusBadge.textContent !== 'Berbunyi') {
                    // Show count in badge tooltip or enhance description
                    homeDom.nextbellStatusBadge.title = `${count} jadwal aktif`;
                }
            }
        }
    } catch (err) {
        console.warn('[Home] Could not fetch ESP status:', err);
    }

    renderDevices(devices);
}

function renderDevices(devices) {
    const container = homeDom.deviceGrid;
    if (!container) return;

    container.innerHTML = '';
    
    devices.forEach((device, index) => {
        const iconInfo = getDeviceIcon(device.name);
        const card = document.createElement('div');
        card.className = `device-card status-${device.status}`;
        card.style.animationDelay = `${index * 0.05}s`;
        card.innerHTML = `
            <div class="device-card-header">
                <div class="device-icon ${iconInfo.color}">
                    <i class="bi ${iconInfo.icon}"></i>
                </div>
                <span class="device-status-dot ${device.status}"></span>
            </div>
            <div class="device-name">${device.name}</div>
            <div class="device-desc">${device.desc}</div>
        `;
        container.appendChild(card);
    });
}

function renderFallbackDevices() {
    const devices = [
        { name: 'ESP32', status: 'ok', desc: 'Online' },
        { name: 'DFPlayer Mini', status: 'ok', desc: 'Ready' },
        { name: 'RTC DS3231', status: 'ok', desc: 'Sync OK' },
        { name: 'Relay 1', status: 'ok', desc: 'Normal' },
        { name: 'Relay 2', status: 'ok', desc: 'Normal' },
        { name: 'WiFi', status: 'ok', desc: 'Terhubung' },
    ];
    renderDevices(devices);
}

// ============================================
// RENDER NEXT BELL
// ============================================
function renderNextBell(schedule) {
    if (!homeDom.nextbellTime) return;

    homeDom.nextbellTime.textContent = schedule.time.slice(0, 5);
    homeDom.nextbellName.textContent = schedule.name || 'Bel';
    homeDom.nextbellAudio.innerHTML = `<i class="bi bi-file-music"></i><span>${schedule.audio || 'default.mp3'}</span>`;
    homeDom.nextbellStatusBadge.textContent = 'Menunggu';
    homeDom.nextbellStatusBadge.className = 'status-badge waiting';
    homeDom.heroSysStatus.textContent = 'Aktif';
}

function renderNextBellNone(message) {
    if (!homeDom.nextbellTime) return;

    homeDom.nextbellTime.textContent = '--:--';
    homeDom.nextbellName.textContent = message || 'Tidak ada jadwal';
    homeDom.nextbellAudio.innerHTML = `<i class="bi bi-file-music"></i><span>---</span>`;
    homeDom.nextbellStatusBadge.textContent = 'Selesai';
    homeDom.nextbellStatusBadge.className = 'status-badge off';
    homeDom.countdownValue.textContent = '--:--:--';
    homeDom.heroSysStatus.textContent = 'Aktif';
}

// ============================================
// COUNTDOWN
// ============================================
let countdownInterval = null;

function startCountdown(targetTime) {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    function update() {
        const now = new Date();
        const [hours, minutes] = targetTime.split(':').map(Number);
        const target = new Date(now);
        target.setHours(hours, minutes, 0, 0);

        let diff = target.getTime() - now.getTime();

        if (diff <= 0) {
            // Schedule passed or about to ring
            if (homeDom.countdownValue) {
                homeDom.countdownValue.textContent = '00:00:00';
                homeDom.countdownValue.style.color = 'var(--success)';
            }
            if (homeDom.nextbellStatusBadge) {
                homeDom.nextbellStatusBadge.textContent = 'Berbunyi';
                homeDom.nextbellStatusBadge.className = 'status-badge active';
            }
            clearInterval(countdownInterval);
            return;
        }

        const hoursLeft = Math.floor(diff / 3600000);
        const minsLeft = Math.floor((diff % 3600000) / 60000);
        const secsLeft = Math.floor((diff % 60000) / 1000);

        if (homeDom.countdownValue) {
            homeDom.countdownValue.textContent = 
                `${String(hoursLeft).padStart(2, '0')}:${String(minsLeft).padStart(2, '0')}:${String(secsLeft).padStart(2, '0')}`;
            
            // Change color when less than 5 minutes
            if (diff < 300000) {
                homeDom.countdownValue.style.color = 'var(--warning)';
            } else {
                homeDom.countdownValue.style.color = 'var(--primary)';
            }
        }
    }

    update();
    countdownInterval = setInterval(update, 1000);
}

// ============================================
// COMMAND FEEDBACK - Wait for ESP to execute
// ============================================
async function sendCommandWithFeedback(command, label, timeoutMs = 10000) {
    const sb = window.initSupabase();
    if (!sb) {
        App.showToast('Tidak dapat mengirim perintah', 'warning');
        return false;
    }

    try {
        // Insert command
        const { data: insertData, error: insertError } = await sb
            .from('esp_commands')
            .insert([{
                command: command,
                status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select();

        if (insertError) throw insertError;

        // Get the inserted command ID
        const commandId = insertData?.[0]?.id;
        if (!commandId) {
            App.showToast(`Perintah ${label} dikirim (tanpa ID)`, 'info');
            return true;
        }

        // Show pending toast
        const toast = App.showToast(`${label}... menunggu ESP`, 'info', timeoutMs + 2000);

        // Poll for status change
        const startTime = Date.now();
        let executed = false;

        while (Date.now() - startTime < timeoutMs) {
            await new Promise(r => setTimeout(r, 1000)); // Poll every 1 second

            const { data, error: pollError } = await sb
                .from('esp_commands')
                .select('status')
                .eq('id', commandId)
                .single();

            if (pollError) continue; // Retry on error

            if (data?.status === 'done') {
                App.dismissToast(toast);
                App.showToast(`${label} berhasil`, 'success');
                executed = true;
                break;
            } else if (data?.status === 'failed') {
                App.dismissToast(toast);
                App.showToast(`${label} gagal di ESP`, 'error');
                executed = true;
                break;
            }
        }

        if (!executed) {
            App.dismissToast(toast);
            App.showToast(`${label} timeout (ESP tidak merespon)`, 'warning');
            return false;
        }

        return true;
    } catch (err) {
        console.error(`[Home] Command error (${command}):`, err);
        App.showToast(`Gagal mengirim ${label}`, 'error');
        return false;
    }
}

// ============================================
// RELAY TOGGLE SWITCH
// ============================================
async function toggleRelay(relayNum, turnOn) {
    const action = turnOn ? 'on' : 'off';
    const command = `relay_${relayNum}_${action}`;
    const label = `Relay ${relayNum} ${action.toUpperCase()}`;
    await sendCommandWithFeedback(command, label, 5000);
}

// Update relay checkboxes from ESP status
function updateRelayCheckboxes(relay1On, relay2On) {
    document.querySelectorAll('.relay-checkbox').forEach(cb => {
        const relay = parseInt(cb.dataset.relay);
        const targetState = relay === 1 ? relay1On : relay2On;
        if (targetState !== undefined && cb.checked !== targetState) {
            cb.checked = targetState;
        }
    });
}

// Init relay toggle listeners
function initRelayToggles() {
    document.querySelectorAll('.relay-checkbox').forEach(cb => {
        cb.addEventListener('change', async function() {
            const relay = this.dataset.relay;
            const turnOn = this.checked;
            // Disable during request
            this.disabled = true;
            await toggleRelay(relay, turnOn);
            this.disabled = false;
        });
    });
}

// Test Audio
if (homeDom.btnTestAudio) {
    homeDom.btnTestAudio.addEventListener('click', async function() {
        const loading = homeDom.qaAudioLoading;
        loading.classList.remove('d-none');
        
        await sendCommandWithFeedback('test_audio', 'Test Audio', 15000);
        
        setTimeout(() => {
            loading.classList.add('d-none');
        }, 1500);
    });
}

// Sync RTC
if (homeDom.btnSyncRtc) {
    homeDom.btnSyncRtc.addEventListener('click', async function() {
        await sendCommandWithFeedback('sync_rtc', 'Sync RTC', 10000);
    });
}

// Refresh Status
if (homeDom.btnRefreshStatus) {
    homeDom.btnRefreshStatus.addEventListener('click', function() {
        loadHomeData();
        App.showToast('Memperbarui status...', 'info');
    });
}

// Restart ESP
if (homeDom.btnRestartEsp) {
    homeDom.btnRestartEsp.addEventListener('click', async function() {
        if (!confirm('Yakin ingin merestart ESP32?')) return;
        
        // No polling feedback for restart since ESP will reboot
        try {
            const sb = window.initSupabase();
            if (sb) {
                await sb.from('esp_commands').insert([{
                    command: 'restart',
                    status: 'pending',
                    created_at: new Date().toISOString()
                }]);
                App.showToast('Perintah restart dikirim, ESP akan reboot...', 'success', 5000);
            }
        } catch (err) {
            App.showToast('Gagal restart ESP32', 'error');
        }
    });
}

// ============================================
// INIT HOME (called by App)
// ============================================
console.log('[Home] Module loaded');