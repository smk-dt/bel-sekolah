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

    // Try to get actual status from supabase_esp_status table
    try {
        const { data: espStatus } = await sb
            .from('esp_status')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (espStatus && espStatus.length > 0) {
            const status = espStatus[0];
            App.updateEspStatus(status.status === 'online');
            
            // Update relay status if available
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
            if (status.dfplayer !== undefined) {
                devices[1].status = status.dfplayer ? 'ok' : 'error';
                devices[1].desc = status.dfplayer ? 'Ready' : 'Error';
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
// QUICK ACTIONS
// ============================================

// Test Audio
if (homeDom.btnTestAudio) {
    homeDom.btnTestAudio.addEventListener('click', async function() {
        const loading = homeDom.qaAudioLoading;
        loading.classList.remove('d-none');
        
        try {
            const sb = window.initSupabase();
            if (sb) {
                // Send command via supabase
                await sb.from('esp_commands').insert([{
                    command: 'test_audio',
                    status: 'pending',
                    created_at: new Date().toISOString()
                }]);
                App.showToast('Perintah test audio dikirim', 'success');
            } else {
                App.showToast('Tidak dapat mengirim perintah', 'warning');
            }
        } catch (err) {
            console.error('[Home] Test audio error:', err);
            App.showToast('Gagal mengirim perintah test audio', 'error');
        } finally {
            setTimeout(() => {
                loading.classList.add('d-none');
            }, 1000);
        }
    });
}

// Relay buttons
homeDom.relayButtons.forEach(btn => {
    btn.addEventListener('click', async function() {
        const relay = this.dataset.relay;
        const action = this.dataset.action;
        
        try {
            const sb = window.initSupabase();
            if (sb) {
                await sb.from('esp_commands').insert([{
                    command: `relay_${relay}_${action}`,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }]);
                App.showToast(`Relay ${relay} ${action === 'on' ? 'ON' : 'OFF'}`, 'success');
            }
        } catch (err) {
            console.error('[Home] Relay error:', err);
            App.showToast('Gagal mengontrol relay', 'error');
        }
    });
});

// Sync RTC
if (homeDom.btnSyncRtc) {
    homeDom.btnSyncRtc.addEventListener('click', async function() {
        try {
            const sb = window.initSupabase();
            if (sb) {
                await sb.from('esp_commands').insert([{
                    command: 'sync_rtc',
                    status: 'pending',
                    created_at: new Date().toISOString()
                }]);
                App.showToast('Perintah sync RTC dikirim', 'success');
            }
        } catch (err) {
            App.showToast('Gagal sync RTC', 'error');
        }
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
        
        try {
            const sb = window.initSupabase();
            if (sb) {
                await sb.from('esp_commands').insert([{
                    command: 'restart',
                    status: 'pending',
                    created_at: new Date().toISOString()
                }]);
                App.showToast('Perintah restart dikirim', 'success');
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