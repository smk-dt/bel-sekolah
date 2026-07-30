// ============================================
// SMART SCHOOL BELL IoT - Status Page (Logs & Monitoring)
// ============================================

let logPage = 1;
const LOGS_PER_PAGE = 20;
let logRealTime = false;
let logRefreshInterval = null;

// Load status/logs data
async function loadStatusData() {
    try {
        const sb = initSupabase();
        const helpers = window.SupabaseHelpers;
        
        // Update device info summary
        const { data: device, error: deviceError } = await sb
            .from('devices')
            .select('*')
            .eq('device_id', helpers.DEFAULT_DEVICE_ID)
            .single();
        
        if (device) {
            document.getElementById('status-device-id').textContent = device.device_id;
            document.getElementById('status-device-name').textContent = device.device_name || 'Smart Bell';
            document.getElementById('status-fw-version').textContent = device.firmware_version || 'v1.0.0';
            
            const statusBadge = document.getElementById('status-device-status');
            statusBadge.textContent = device.status.toUpperCase();
            statusBadge.className = `badge ${device.status === 'online' ? 'bg-success' : 'bg-secondary'} fs-6`;
        }
        
        // Get system status
        const { data: sysStatus, error: sysError } = await sb
            .from('system_status')
            .select('*')
            .eq('device_id', helpers.DEFAULT_DEVICE_ID)
            .single();
        
        if (sysStatus) {
            updateStatusDetails(sysStatus);
        }
        
        // Load logs
        loadLogs();
        
    } catch (err) {
        console.error('[Status] Load error:', err);
    }
}

// Update detailed status
function updateStatusDetails(status) {
    // WiFi
    document.getElementById('detail-wifi').textContent = status.wifi || 'Unknown';
    document.getElementById('detail-wifi').className = `badge ${status.wifi === 'Connected' ? 'bg-success' : 'bg-danger'}`;
    
    // Internet
    document.getElementById('detail-internet').textContent = status.internet || 'Unknown';
    document.getElementById('detail-internet').className = `badge ${status.internet === 'Connected' ? 'bg-success' : 'bg-danger'}`;
    
    // RTC
    document.getElementById('detail-rtc').textContent = status.rtc || 'Unknown';
    document.getElementById('detail-rtc').className = `badge ${status.rtc === 'OK' ? 'bg-info text-dark' : 'bg-warning text-dark'}`;
    
    // RTC Time
    document.getElementById('detail-rtc-time').textContent = status.rtc_time || '--:--:--';
    
    // DFPlayer
    document.getElementById('detail-dfplayer').textContent = status.dfplayer || 'Unknown';
    document.getElementById('detail-dfplayer').className = `badge ${status.dfplayer === 'Connected' ? 'bg-success' : 'bg-danger'}`;
    
    // MicroSD
    document.getElementById('detail-microsd').textContent = status.micro_sd || 'Unknown';
    document.getElementById('detail-microsd').className = `badge ${status.micro_sd === 'Ready' ? 'bg-success' : 'bg-warning text-dark'}`;
    
    // Relay 1
    document.getElementById('detail-relay1').textContent = status.relay1 || 'OFF';
    document.getElementById('detail-relay1').className = `badge ${status.relay1 === 'ON' ? 'bg-success' : 'bg-secondary'}`;
    
    // Relay 2
    document.getElementById('detail-relay2').textContent = status.relay2 || 'OFF';
    document.getElementById('detail-relay2').className = `badge ${status.relay2 === 'ON' ? 'bg-success' : 'bg-secondary'}`;
    
    // Mixer
    document.getElementById('detail-mixer').textContent = status.mixer || 'OFF';
    document.getElementById('detail-mixer').className = `badge ${status.mixer === 'ON' ? 'bg-success' : 'bg-secondary'}`;
    
    // Bell status
    document.getElementById('detail-bell').textContent = status.bell || 'Standby';
    document.getElementById('detail-bell').className = `badge ${status.bell === 'Ringing' ? 'bg-danger' : 'bg-secondary'}`;
    
    // Last heartbeat
    document.getElementById('detail-heartbeat').textContent = status.last_heartbeat ? 
        status.last_heartbeat.slice(0, 19).replace('T', ' ') : '--';
    
    // Uptime
    if (status.uptime) {
        const uptime = status.uptime;
        let uptimeStr = '';
        if (uptime >= 86400) {
            const days = Math.floor(uptime / 86400);
            uptimeStr += `${days}h `;
        }
        const hours = Math.floor((uptime % 86400) / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        uptimeStr += `${hours}j ${mins}m`;
        document.getElementById('detail-uptime').textContent = uptimeStr;
    } else {
        document.getElementById('detail-uptime').textContent = '--';
    }
    
    // Free heap
    document.getElementById('detail-heap').textContent = status.free_heap ? 
        `${(status.free_heap / 1024).toFixed(1)} KB` : '--';
    
    // WiFi RSSI
    document.getElementById('detail-rssi').textContent = status.wifi_rssi ? 
        `${status.wifi_rssi} dBm` : '--';
    
    // Last sync
    document.getElementById('detail-last-sync').textContent = 
        status.updated_at ? status.updated_at.slice(0, 19).replace('T', ' ') : '--';
}

// Load logs
async function loadLogs() {
    try {
        const sb = initSupabase();
        const helpers = window.SupabaseHelpers;
        
        const tbody = document.getElementById('logs-tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3">
                    <div class="spinner-border text-primary spinner-border-sm" role="status"></div>
                    <span class="ms-2 text-muted">Memuat log...</span>
                </td>
            </tr>
        `;
        
        // Get filters
        const filterActivity = document.getElementById('log-filter-activity').value;
        
        // Build query
        let query = sb
            .from('logs')
            .select('*')
            .eq('device_id', helpers.DEFAULT_DEVICE_ID)
            .order('created_at', { ascending: false });
        
        if (filterActivity !== 'all') {
            query = query.eq('status', filterActivity);
        }
        
        const { data: logs, error } = await query;
        
        if (error) throw error;
        
        if (!logs || logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="bi bi-journal-text fs-2 d-block mb-2"></i>
                        Belum ada log aktivitas
                    </td>
                </tr>
            `;
            return;
        }
        
        // Pagination
        const totalPages = Math.ceil(logs.length / LOGS_PER_PAGE);
        if (logPage > totalPages) logPage = 1;
        const start = (logPage - 1) * LOGS_PER_PAGE;
        const pageLogs = logs.slice(start, start + LOGS_PER_PAGE);
        
        let html = '';
        pageLogs.forEach((log, index) => {
            const num = start + index + 1;
            const time = log.created_at ? 
                helpers.formatDateShort(log.created_at) + ' ' + helpers.formatTime(log.created_at) : '--';
            
            let statusClass = 'bg-secondary';
            if (log.status === 'Success') statusClass = 'bg-success';
            else if (log.status === 'Pending') statusClass = 'bg-warning text-dark';
            else if (log.status === 'Error' || log.status === 'Failed') statusClass = 'bg-danger';
            
            // Truncate description
            const desc = log.description && log.description.length > 50 ? 
                log.description.slice(0, 50) + '...' : (log.description || '-');
            
            html += `
                <tr>
                    <td class="text-center fw-semibold">${num}</td>
                    <td class="text-nowrap">${time}</td>
                    <td>${log.activity}</td>
                    <td>
                        <span class="badge ${statusClass}">${log.status || '-'}</span>
                    </td>
                    <td class="text-muted small" title="${log.description || ''}">${desc}</td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
        
        // Render pagination
        renderLogPagination(totalPages);
        
        // Update log count
        document.getElementById('log-count').textContent = logs.length;
        
    } catch (err) {
        console.error('[Status] Log load error:', err);
        document.getElementById('logs-tbody').innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-3 text-danger">
                    Gagal memuat log: ${err.message}
                </td>
            </tr>
        `;
    }
}

// Render log pagination
function renderLogPagination(totalPages) {
    const pagination = document.querySelector('#log-pagination ul');
    if (!pagination) return;
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    html += `
        <li class="page-item ${logPage === 1 ? 'disabled' : ''}">
            <button class="page-link" data-page="${logPage - 1}">
                <i class="bi bi-chevron-left"></i>
            </button>
        </li>
    `;
    
    for (let i = 1; i <= totalPages; i++) {
        html += `
            <li class="page-item ${i === logPage ? 'active' : ''}">
                <button class="page-link ${i === logPage ? 'active' : ''}" data-page="${i}">${i}</button>
            </li>
        `;
    }
    
    html += `
        <li class="page-item ${logPage === totalPages ? 'disabled' : ''}">
            <button class="page-link" data-page="${logPage + 1}">
                <i class="bi bi-chevron-right"></i>
            </button>
        </li>
    `;
    
    pagination.innerHTML = html;
    
    pagination.querySelectorAll('.page-link').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = parseInt(this.dataset.page);
            if (page && page !== logPage) {
                logPage = page;
                loadLogs();
            }
        });
    });
}

// Clear all logs
async function clearLogs() {
    Swal.fire({
        title: 'Hapus Semua Log?',
        text: 'Data log yang dihapus tidak dapat dikembalikan',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Hapus Semua',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const sb = initSupabase();
                const helpers = window.SupabaseHelpers;
                
                const { error } = await sb
                    .from('logs')
                    .delete()
                    .eq('device_id', helpers.DEFAULT_DEVICE_ID);
                
                if (error) throw error;
                
                Swal.fire({
                    icon: 'success',
                    title: 'Semua Log Dihapus',
                    timer: 1500,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
                
                loadLogs();
            } catch (err) {
                console.error('[Status] Clear logs error:', err);
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: err.message
                });
            }
        }
    });
}

// Refresh status data
async function refreshStatus() {
    const btn = document.getElementById('btn-refresh-status');
    const spinner = document.getElementById('refresh-spinner');
    
    btn.disabled = true;
    spinner.classList.remove('d-none');
    
    await loadStatusData();
    
    btn.disabled = false;
    spinner.classList.add('d-none');
    
    Swal.fire({
        icon: 'success',
        title: 'Data Diperbarui',
        timer: 1000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    logRealTime = !logRealTime;
    const btn = document.getElementById('btn-auto-refresh');
    
    if (logRealTime) {
        btn.classList.add('btn-success');
        btn.classList.remove('btn-outline-success');
        btn.innerHTML = '<i class="bi bi-clock-fill"></i> Auto On';
        
        // Refresh every 10 seconds
        logRefreshInterval = setInterval(() => {
            loadLogs();
        }, 10000);
    } else {
        btn.classList.remove('btn-success');
        btn.classList.add('btn-outline-success');
        btn.innerHTML = '<i class="bi bi-clock"></i> Auto';
        
        if (logRefreshInterval) {
            clearInterval(logRefreshInterval);
            logRefreshInterval = null;
        }
    }
}

// Setup status event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Refresh button
    document.getElementById('btn-refresh-status').addEventListener('click', refreshStatus);
    
    // Auto refresh toggle
    document.getElementById('btn-auto-refresh').addEventListener('click', toggleAutoRefresh);
    
    // Clear logs button
    document.getElementById('btn-clear-logs').addEventListener('click', clearLogs);
    
    // Log filter
    document.getElementById('log-filter-activity').addEventListener('change', function() {
        logPage = 1;
        loadLogs();
    });
});