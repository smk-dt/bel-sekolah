// ============================================
// SMART SCHOOL BELL IoT - Home Page
// ============================================

let homeInterval = null;
let nextBellInterval = null;

// Load home page data
async function loadHomeData() {
    try {
        const sb = initSupabase();
        const helpers = window.SupabaseHelpers;
        
        // Get device status
        const { data: device, error: deviceError } = await sb
            .from('devices')
            .select('*')
            .eq('device_id', helpers.DEFAULT_DEVICE_ID)
            .single();
        
        if (deviceError && deviceError.code !== 'PGRST116') {
            console.warn('[Home] Device fetch error:', deviceError.message);
        }
        
        if (device) {
            document.getElementById('home-esp-status-badge').textContent = device.status.toUpperCase();
            document.getElementById('home-fw-version').textContent = device.firmware_version || 'v1.0.0';
            
            if (device.status === 'online') {
                document.getElementById('home-esp-status-badge').className = 'badge bg-success ms-2';
                document.getElementById('header-esp-status').textContent = 'Online';
                document.getElementById('header-esp-status').className = 'badge bg-success me-2';
            } else {
                document.getElementById('home-esp-status-badge').className = 'badge bg-secondary ms-2';
                document.getElementById('header-esp-status').textContent = 'Offline';
                document.getElementById('header-esp-status').className = 'badge bg-secondary me-2';
            }
        }
        
        // Get system status
        const { data: sysStatus, error: sysError } = await sb
            .from('system_status')
            .select('*')
            .eq('device_id', helpers.DEFAULT_DEVICE_ID)
            .single();
        
        if (sysStatus) {
            updateHomeStatusBadges(sysStatus);
        }
        
        // Get today's schedules
        const today = helpers.getTodayName();
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 8);
        
        const { data: schedules, error: schedError } = await sb
            .from('schedules')
            .select('*, audios(audio_name, audio_file)')
            .eq('day', today)
            .eq('status', 'active')
            .order('time', { ascending: true });
        
        if (schedError) {
            console.warn('[Home] Schedule fetch error:', schedError.message);
        }
        
        // Calculate next and last bell
        if (schedules && schedules.length > 0) {
            const currentSec = helpers.timeToSeconds(currentTime);
            
            // Find next bell
            let nextSchedule = null;
            for (const s of schedules) {
                const schedSec = helpers.timeToSeconds(s.time);
                if (schedSec > currentSec) {
                    nextSchedule = s;
                    break;
                }
            }
            
            // If no next schedule today, take first schedule of today (next day)
            if (!nextSchedule) {
                nextSchedule = schedules[0];
            }
            
            // Update next bell display
            if (nextSchedule) {
                document.getElementById('home-next-time').textContent = nextSchedule.time.slice(0, 5);
                document.getElementById('home-next-audio').textContent = 
                    nextSchedule.audios?.audio_name || 'Unknown';
            }
            
            // Last bell = last schedule that has passed
            let lastSchedule = null;
            for (const s of schedules) {
                const schedSec = helpers.timeToSeconds(s.time);
                if (schedSec <= currentSec) {
                    lastSchedule = s;
                }
            }
            
            if (!lastSchedule) {
                // No schedule passed today - get last schedule from today
                lastSchedule = schedules[schedules.length - 1];
                document.getElementById('home-last-status').textContent = 'Next';
                document.getElementById('home-last-status').className = 'badge bg-info';
            } else {
                document.getElementById('home-last-status').textContent = 'Success';
                document.getElementById('home-last-status').className = 'badge bg-success';
            }
            
            if (lastSchedule) {
                document.getElementById('home-last-time').textContent = lastSchedule.time.slice(0, 5);
                document.getElementById('home-last-audio').textContent = 
                    lastSchedule.audios?.audio_name || 'Unknown';
            }
            
            // Start countdown
            startNextCountdown(nextSchedule);
        } else {
            document.getElementById('home-next-time').textContent = '--:--';
            document.getElementById('home-next-audio').textContent = 'Tidak ada jadwal';
            document.getElementById('home-last-time').textContent = '--:--';
            document.getElementById('home-last-audio').textContent = 'Tidak ada jadwal';
            document.getElementById('home-next-countdown').textContent = '--:--:--';
        }
        
        // Get recent log
        const { data: recentLog, error: logError } = await sb
            .from('logs')
            .select('*')
            .eq('device_id', helpers.DEFAULT_DEVICE_ID)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (recentLog) {
            document.getElementById('home-last-sync').textContent = helpers.formatTimeShort(recentLog.created_at);
        }
        
    } catch (err) {
        console.error('[Home] Load error:', err);
    }
}

// Update status badges on home
function updateHomeStatusBadges(status) {
    const helpers = window.SupabaseHelpers;
    
    // WiFi
    const wifiEl = document.getElementById('home-wifi-status');
    if (status.wifi === 'Connected') {
        wifiEl.className = 'badge bg-primary me-1';
        wifiEl.innerHTML = '<i class="bi bi-wifi"></i> WiFi';
    } else {
        wifiEl.className = 'badge bg-secondary me-1';
        wifiEl.innerHTML = '<i class="bi bi-wifi-off"></i> WiFi';
    }
    
    // Internet
    const netEl = document.getElementById('home-internet-status');
    if (status.internet === 'Connected') {
        netEl.className = 'badge bg-success me-1';
        netEl.innerHTML = '<i class="bi bi-globe"></i> Internet';
    } else {
        netEl.className = 'badge bg-danger me-1';
        netEl.innerHTML = '<i class="bi bi-globe-off"></i> Internet';
    }
    
    // RTC
    const rtcEl = document.getElementById('home-rtc-status');
    if (status.rtc === 'OK') {
        rtcEl.className = 'badge bg-info';
        rtcEl.innerHTML = '<i class="bi bi-clock"></i> RTC';
    } else {
        rtcEl.className = 'badge bg-warning text-dark';
        rtcEl.innerHTML = '<i class="bi bi-clock"></i> RTC';
    }
    
    // Relays
    const relay1El = document.getElementById('home-relay1-status');
    const relay2El = document.getElementById('home-relay2-status');
    
    if (status.relay1 === 'ON') {
        relay1El.innerHTML = '<span class="badge bg-success">ON</span>';
    } else {
        relay1El.innerHTML = '<span class="badge bg-secondary">OFF</span>';
    }
    
    if (status.relay2 === 'ON') {
        relay2El.innerHTML = '<span class="badge bg-success">ON</span>';
    } else {
        relay2El.innerHTML = '<span class="badge bg-secondary">OFF</span>';
    }
    
    // DFPlayer
    const dfEl = document.getElementById('home-dfplayer-status');
    dfEl.textContent = status.dfplayer === 'Connected' ? 'Connected' : 'Disconnected';
    dfEl.className = status.dfplayer === 'Connected' ? 'badge bg-success' : 'badge bg-danger';
    
    // MicroSD
    const sdEl = document.getElementById('home-microsd-status');
    sdEl.textContent = status.micro_sd === 'Ready' ? 'Ready' : status.micro_sd;
    sdEl.className = status.micro_sd === 'Ready' || status.micro_sd === 'Ready' ? 'badge bg-success' : 'badge bg-warning text-dark';
    
    // Mixer
    const mixEl = document.getElementById('home-mixer-status');
    mixEl.textContent = status.mixer === 'ON' ? 'ON' : 'OFF';
    mixEl.className = status.mixer === 'ON' ? 'badge bg-success' : 'badge bg-secondary';
    
    // Bell
    const bellEl = document.getElementById('home-bell-status');
    bellEl.textContent = status.bell || 'Standby';
    bellEl.className = status.bell === 'Ringing' ? 'badge bg-danger' : 'badge bg-secondary';
    
    // RTC time
    if (status.rtc_time) {
        document.getElementById('home-rtc-last-sync').textContent = status.rtc_time;
    }
    
    // Speaker status
    const spEl = document.getElementById('home-speaker-status');
    if (status.relay1 === 'ON' || status.relay2 === 'ON') {
        spEl.textContent = 'Active';
        spEl.className = 'badge bg-success';
    } else {
        spEl.textContent = 'Ready';
        spEl.className = 'badge bg-success';
    }
}

// Countdown timer for next bell
function startNextCountdown(nextSchedule) {
    if (nextBellInterval) {
        clearInterval(nextBellInterval);
    }
    
    nextBellInterval = setInterval(() => {
        const helpers = window.SupabaseHelpers;
        const now = new Date();
        const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        
        if (nextSchedule) {
            const schedSec = helpers.timeToSeconds(nextSchedule.time);
            let diff = schedSec - currentSec;
            
            if (diff < 0) {
                // Schedule has passed, recalculate
                clearInterval(nextBellInterval);
                loadHomeData();
                return;
            }
            
            document.getElementById('home-next-countdown').textContent = helpers.secondsToHms(diff);
        }
    }, 1000);
}

// Test audio
async function handleTestAudio() {
    try {
        const sb = initSupabase();
        const helpers = window.SupabaseHelpers;
        
        // Get test audio ID
        const { data: audios, error } = await sb
            .from('audios')
            .select('id, audio_file')
            .eq('audio_name', 'Test Audio')
            .limit(1);
        
        if (error) throw error;
        
        if (!audios || audios.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Audio tidak ditemukan',
                text: 'Test audio belum tersedia'
            });
            return;
        }
        
        // Send command via logs
        const audioId = audios[0].id;
        const { error: logError } = await sb
            .from('logs')
            .insert({
                device_id: helpers.DEFAULT_DEVICE_ID,
                activity: 'Test Audio',
                status: 'Pending',
                description: `Audio ID: ${audioId} - ${audios[0].audio_file}`
            });
        
        if (logError) throw logError;
        
        Swal.fire({
            icon: 'success',
            title: 'Perintah Test Audio Dikirim',
            text: 'ESP32 akan memutar audio test',
            timer: 2000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    } catch (err) {
        console.error('[Home] Test audio error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: err.message
        });
    }
}

// Relay control
async function handleRelayControl(relay, action) {
    try {
        const sb = initSupabase();
        const helpers = window.SupabaseHelpers;
        
        // Log the command
        const { error: logError } = await sb
            .from('logs')
            .insert({
                device_id: helpers.DEFAULT_DEVICE_ID,
                activity: `Relay ${relay} ${action.toUpperCase()}`,
                status: 'Pending',
                description: `Command: relay${relay}_${action}`
            });
        
        if (logError) throw logError;
        
        // Update local display
        const relayStatusEl = document.getElementById(`home-relay${relay}-status`);
        if (action === 'on') {
            relayStatusEl.innerHTML = '<span class="badge bg-success">ON</span>';
        } else {
            relayStatusEl.innerHTML = '<span class="badge bg-secondary">OFF</span>';
        }
        
        Swal.fire({
            icon: 'success',
            title: `Relay ${relay} ${action.toUpperCase()}`,
            text: 'Perintah telah dikirim ke ESP32',
            timer: 1500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    } catch (err) {
        console.error('[Home] Relay error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal',
            text: err.message
        });
    }
}

// Setup home event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Test audio button
    document.getElementById('btn-test-audio').addEventListener('click', handleTestAudio);
    
    // Relay buttons
    document.querySelectorAll('.btn-relay').forEach(btn => {
        btn.addEventListener('click', function() {
            const relay = this.dataset.relay;
            const action = this.dataset.action;
            handleRelayControl(relay, action);
        });
    });
});