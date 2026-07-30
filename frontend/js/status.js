// ============================================
// SMART SCHOOL BELL IoT - Status / Monitoring
// ============================================

// ============================================
// DOM REFS
// ============================================
const statusDom = {
    // ESP Hero
    espHeroTitle: document.getElementById('esp-hero-title'),
    espHeroStatusBadge: document.getElementById('status-hero-badge'),
    espUptime: document.getElementById('esp-uptime'),
    espChipId: document.getElementById('esp-chip-id'),
    espFreeHeap: document.getElementById('esp-free-heap'),
    espWiFiRssi: document.getElementById('esp-wifi-rssi'),
    espLastSeen: document.getElementById('esp-last-seen'),
    espFwVersion: document.getElementById('esp-fw-version'),
    
    // Status cards
    statusCardsContainer: document.getElementById('status-cards'),
    
    // Timeline
    timelineContainer: document.getElementById('timeline-container'),
    
    // System log
    systemLogContainer: document.getElementById('system-log-container'),
};

// ============================================
// LOAD STATUS DATA
// ============================================
async function loadStatusData() {
    try {
        // Show skeletons
        App.showSkeleton('status-cards', 'grid', 4);
        App.showSkeleton('system-log-container', 'line', 6);

        const sb = window.initSupabase();
        if (!sb) return;

        // Fetch ESP latest status
        await fetchEspStatus(sb);
        
        // Fetch timeline (recent bell events)
        await fetchTimeline(sb);
        
        // Fetch system log
        await fetchSystemLog(sb);

    } catch (err) {
        console.error('[Status] Error loading:', err);
    }
}

// ============================================
// FETCH ESP STATUS
// ============================================
async function fetchEspStatus(sb) {
    try {
        const { data, error } = await sb
            .from('esp_status')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('[Status] ESP status fetch error:', error);
            renderEspStatusFallback();
            return;
        }

        if (data && data.length > 0) {
            renderEspStatus(data[0]);
        } else {
            renderEspStatusFallback();
        }
    } catch (err) {
        console.error('[Status] ESP status error:', err);
        renderEspStatusFallback();
    }
}

function renderEspStatus(status) {
    const isOnline = status.status === 'online';
    
    // Update global ESP status
    App.updateEspStatus(isOnline);

    // ESP Hero
    if (statusDom.espHeroTitle) {
        statusDom.espHeroTitle.textContent = `ESP32 ${status.device_name || 'School Bell'}`;
    }

    // Detail items
    if (statusDom.espUptime) {
        statusDom.espUptime.textContent = formatUptime(status.uptime) || '--';
    }
    if (statusDom.espChipId) {
        statusDom.espChipId.textContent = status.chip_id || '--';
    }
    if (statusDom.espFreeHeap) {
        statusDom.espFreeHeap.textContent = status.free_heap ? formatBytes(status.free_heap) : '--';
    }
    if (statusDom.espWiFiRssi) {
        const rssi = status.wifi_rssi;
        if (rssi !== undefined && rssi !== null) {
            statusDom.espWiFiRssi.textContent = `${rssi} dBm`;
            // Color code
            statusDom.espWiFiRssi.style.color = rssi > -50 ? 'var(--success)' : rssi > -70 ? 'var(--warning)' : 'var(--danger)';
        } else {
            statusDom.espWiFiRssi.textContent = '--';
        }
    }
    if (statusDom.espLastSeen) {
        statusDom.espLastSeen.textContent = status.updated_at ? formatTimeAgo(status.updated_at) : '--';
    }
    if (statusDom.espFwVersion) {
        statusDom.espFwVersion.textContent = status.fw_version || 'v1.0.0';
    }

    // Render status cards based on data
    const cards = [
        {
            title: 'DFPlayer Mini',
            desc: status.dfplayer ? 'Ready' : 'Error',
            icon: 'bi-music-note-beamed',
            color: status.dfplayer ? 'icon-success' : 'icon-danger',
            badge: status.dfplayer ? 'success' : 'error',
        },
        {
            title: 'RTC DS3231',
            desc: status.rtc_ok ? 'Sync OK' : 'Error',
            icon: 'bi-clock',
            color: status.rtc_ok ? 'icon-primary' : 'icon-danger',
            badge: status.rtc_ok ? 'success' : 'error',
        },
        {
            title: 'Relay 1',
            desc: status.relay1 ? 'ON' : 'OFF',
            icon: 'bi-toggle-on',
            color: status.relay1 ? 'icon-primary' : 'icon-secondary',
            badge: status.relay1 ? 'success' : 'warning',
        },
        {
            title: 'Relay 2',
            desc: status.relay2 ? 'ON' : 'OFF',
            icon: 'bi-toggle-on',
            color: status.relay2 ? 'icon-primary' : 'icon-secondary',
            badge: status.relay2 ? 'success' : 'warning',
        },
        {
            title: 'SD Card',
            desc: status.sd_card ? 'Terpasang' : 'Tidak ada',
            icon: 'bi-sd-card',
            color: status.sd_card ? 'icon-success' : 'icon-warning',
            badge: status.sd_card ? 'success' : 'warning',
        },
        {
            title: 'WiFi Signal',
            desc: status.wifi_rssi ? `${status.wifi_rssi} dBm` : '--',
            icon: 'bi-wifi',
            color: status.wifi_rssi > -70 ? 'icon-primary' : 'icon-warning',
            badge: status.wifi_rssi > -70 ? 'success' : 'warning',
        },
        {
            title: 'Mode',
            desc: status.mode || 'Automatic',
            icon: 'bi-gear',
            color: 'icon-secondary',
            badge: 'success',
        },
        {
            title: 'HTTP Server',
            desc: status.http_server ? 'Active' : 'Inactive',
            icon: 'bi-globe',
            color: status.http_server ? 'icon-success' : 'icon-danger',
            badge: status.http_server ? 'success' : 'error',
        },
    ];

    renderStatusCards(cards);
}

function renderEspStatusFallback() {
    // Update ESP status to offline
    App.updateEspStatus(false);

    const cards = [
        { title: 'ESP32', desc: 'Offline', icon: 'bi-cpu', color: 'icon-danger', badge: 'error' },
        { title: 'DFPlayer Mini', desc: 'Unknown', icon: 'bi-music-note-beamed', color: 'icon-secondary', badge: 'warning' },
        { title: 'RTC DS3231', desc: 'Unknown', icon: 'bi-clock', color: 'icon-secondary', badge: 'warning' },
        { title: 'Relay 1', desc: 'Unknown', icon: 'bi-toggle-on', color: 'icon-secondary', badge: 'warning' },
        { title: 'Relay 2', desc: 'Unknown', icon: 'bi-toggle-on', color: 'icon-secondary', badge: 'warning' },
        { title: 'WiFi', desc: 'Unknown', icon: 'bi-wifi', color: 'icon-secondary', badge: 'warning' },
        { title: 'Supabase', desc: 'Connected', icon: 'bi-cloud-check', color: 'icon-success', badge: 'success' },
        { title: 'System', desc: 'Standby', icon: 'bi-gear', color: 'icon-secondary', badge: 'warning' },
    ];

    renderStatusCards(cards);

    // Fill ESP hero with fallback
    if (statusDom.espHeroTitle) statusDom.espHeroTitle.textContent = 'ESP32 - Offline';
    if (statusDom.espUptime) statusDom.espUptime.textContent = '--';
    if (statusDom.espChipId) statusDom.espChipId.textContent = '--';
    if (statusDom.espFreeHeap) statusDom.espFreeHeap.textContent = '--';
    if (statusDom.espWiFiRssi) {
        statusDom.espWiFiRssi.textContent = '--';
        statusDom.espWiFiRssi.style.color = '';
    }
    if (statusDom.espLastSeen) statusDom.espLastSeen.textContent = '--';
    if (statusDom.espFwVersion) statusDom.espFwVersion.textContent = '--';
}

// ============================================
// RENDER STATUS CARDS
// ============================================
function renderStatusCards(cards) {
    const container = statusDom.statusCardsContainer;
    if (!container) return;

    container.innerHTML = '';

    const badgeIcons = {
        success: 'bi-check-circle-fill',
        warning: 'bi-exclamation-circle-fill',
        error: 'bi-x-circle-fill',
    };

    cards.forEach((card, index) => {
        const el = document.createElement('div');
        el.className = 'status-card';
        el.style.animationDelay = `${index * 0.05}s`;
        el.innerHTML = `
            <div class="status-card-icon ${card.color}">
                <i class="bi ${card.icon}"></i>
            </div>
            <div class="status-card-info">
                <div class="status-card-title">${card.title}</div>
                <div class="status-card-desc">${card.desc}</div>
            </div>
            <div class="status-card-badge">
                <i class="bi ${badgeIcons[card.badge] || badgeIcons.warning}" 
                   style="font-size:18px; color: var(--${card.badge === 'success' ? 'success' : card.badge === 'error' ? 'danger' : 'warning'});"></i>
            </div>
        `;
        container.appendChild(el);
    });
}

// ============================================
// FETCH TIMELINE
// ============================================
async function fetchTimeline(sb) {
    const container = statusDom.timelineContainer;
    if (!container) return;

    try {
        const { data, error } = await sb
            .from('bell_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        if (data && data.length > 0) {
            renderTimeline(data);
        } else {
            container.innerHTML = `
                <div style="text-align:center; padding:16px; color:var(--text-light);">
                    <i class="bi bi-clock-history" style="font-size:36px; display:block; margin-bottom:8px;"></i>
                    Belum ada aktivitas bel
                </div>
            `;
        }
    } catch (err) {
        console.error('[Status] Timeline error:', err);
        container.innerHTML = `
            <div style="text-align:center; padding:16px; color:var(--text-light);">
                Tidak dapat memuat timeline
            </div>
        `;
    }
}

function renderTimeline(events) {
    const container = statusDom.timelineContainer;
    if (!container) return;

    container.innerHTML = '<div class="timeline">';

    events.forEach((event, index) => {
        const status = event.status || 'success';
        const icon = status === 'success' ? 'bi-check-lg' : status === 'error' ? 'bi-x' : 'bi-clock';
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.style.animationDelay = `${index * 0.05}s`;
        item.innerHTML = `
            <div class="timeline-dot ${status}">
                <i class="bi ${icon}"></i>
            </div>
            <div class="timeline-content">
                <div class="timeline-time">${formatDateTime(event.created_at)}</div>
                <div class="timeline-activity">${event.schedule_name || 'Bel'} — ${event.schedule_time?.slice(0, 5) || '--:--'}</div>
                <div class="timeline-desc">${event.audio_played || '-'} ${event.notes ? '· ' + event.notes : ''}</div>
            </div>
        `;
        container.querySelector('.timeline').appendChild(item);
    });
}

// ============================================
// FETCH SYSTEM LOG
// ============================================
async function fetchSystemLog(sb) {
    const container = statusDom.systemLogContainer;
    if (!container) return;

    try {
        const { data, error } = await sb
            .from('system_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        if (data && data.length > 0) {
            renderSystemLog(data);
        } else {
            container.innerHTML = `
                <div style="text-align:center; padding:16px; color:var(--text-light);">
                    <i class="bi bi-journal-text" style="font-size:36px; display:block; margin-bottom:8px;"></i>
                    Log sistem kosong
                </div>
            `;
        }
    } catch (err) {
        console.error('[Status] System log error:', err);
        container.innerHTML = `
            <div style="text-align:center; padding:16px; color:var(--text-light);">
                Tidak dapat memuat log sistem
            </div>
        `;
    }
}

function renderSystemLog(logs) {
    const container = statusDom.systemLogContainer;
    if (!container) return;

    container.innerHTML = '';

    const icons = {
        error: 'bi-x-circle-fill',
        warning: 'bi-exclamation-circle-fill',
        info: 'bi-info-circle-fill',
    };

    logs.forEach((log, index) => {
        const el = document.createElement('div');
        el.className = 'log-item';
        el.style.animationDelay = `${index * 0.03}s`;
        el.innerHTML = `
            <div class="log-icon ${log.level || 'info'}">
                <i class="bi ${icons[log.level] || icons.info}"></i>
            </div>
            <span class="log-text">${log.message}</span>
            <span class="log-time">${formatTimeAgo(log.created_at)}</span>
        `;
        container.appendChild(el);
    });
}

// ============================================
// UTILITY HELPERS
// ============================================

function formatUptime(seconds) {
    if (!seconds && seconds !== 0) return null;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}h ${hours}j ${mins}m`;
    if (hours > 0) return `${hours}j ${mins}m`;
    return `${mins}m`;
}

function formatBytes(bytes) {
    if (!bytes) return '0B';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '--';
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 10) return 'Baru saja';
    if (diff < 60) return `${diff}d yang lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m yang lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}j yang lalu`;
    return `${Math.floor(diff / 86400)}h yang lalu`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '--';
    const date = new Date(dateStr);
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('id-ID', options);
}

// ============================================
// INIT
// ============================================
console.log('[Status] Module loaded');