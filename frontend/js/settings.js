      // ============================================
// SMART SCHOOL BELL IoT - Settings Page
// ============================================

// ============================================
// DOM REFS
// ============================================
const settingsDom = {
    // System Settings
    sysDeviceName: document.getElementById('sys-device-name'),
    sysFwVersion: document.getElementById('sys-fw-version'),
    sysWifiSsid: document.getElementById('sys-wifi-ssid'),
    sysWifiPass: document.getElementById('sys-wifi-pass'),
    sysSyncInterval: document.getElementById('sys-sync-interval'),
    sysBtnSave: document.getElementById('sys-btn-save'),
    sysBtnRestart: document.getElementById('sys-btn-restart'),
    sysBtnReset: document.getElementById('sys-btn-reset'),
    
    // Supabase Settings
    sbUrl: document.getElementById('sb-url'),
    sbAnonKey: document.getElementById('sb-anon-key'),
    sbBtnSave: document.getElementById('sb-btn-save'),
    sbBtnTest: document.getElementById('sb-btn-test'),
    sbTestResult: document.getElementById('sb-test-result'),
    
    // Audio Library
    audioLibraryContainer: document.getElementById('audio-library'),
    audioUploadBtn: document.getElementById('audio-upload-btn'),
    audioUploadInput: document.getElementById('audio-upload-input'),
    audioUploadProgress: document.getElementById('audio-upload-progress'),
    
    // Schedule Advanced
    schedAutoSync: document.getElementById('sched-auto-sync'),
    schedRelayOnBell: document.getElementById('sched-relay-on-bell'),
    schedRelayDuration: document.getElementById('sched-relay-duration'),
    schedBtnSave: document.getElementById('sched-adv-btn-save'),
    
    // Notification
    notifEnabled: document.getElementById('notif-enabled'),
    notifEmail: document.getElementById('notif-email'),
    notifBtnSave: document.getElementById('notif-btn-save'),
    
    // Danger Zone
    dangerClearLogs: document.getElementById('danger-clear-logs'),
    dangerClearAll: document.getElementById('danger-clear-all'),
};

// ============================================
// LOAD SETTINGS
// ============================================
async function loadSettingsData() {
    try {
        const sb = window.initSupabase();
        if (!sb) return;

        // Load system settings from esp_config table
        await loadSystemSettings(sb);
        
        // Load audio library
        await loadAudioLibrary(sb);
        
        // Load advanced settings
        await loadAdvancedSettings(sb);
        
        // Load notification settings
        await loadNotificationSettings(sb);

    } catch (err) {
        console.error('[Settings] Error loading:', err);
    }
}

// ============================================
// SYSTEM SETTINGS
// ============================================
async function loadSystemSettings(sb) {
    try {
        const { data, error } = await sb
            .from('esp_config')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        const config = data && data.length > 0 ? data[0] : {};
        
        if (settingsDom.sysDeviceName) settingsDom.sysDeviceName.value = config.device_name || 'School Bell';
        if (settingsDom.sysFwVersion) settingsDom.sysFwVersion.value = config.fw_version || 'v1.0.0';
        if (settingsDom.sysWifiSsid) settingsDom.sysWifiSsid.value = config.wifi_ssid || '';
        if (settingsDom.sysWifiPass) settingsDom.sysWifiPass.value = config.wifi_password || '';
        if (settingsDom.sysSyncInterval) settingsDom.sysSyncInterval.value = config.sync_interval || '60';

    } catch (err) {
        console.error('[Settings] Load system error:', err);
    }
}

// Save system settings
if (settingsDom.sysBtnSave) {
    settingsDom.sysBtnSave.addEventListener('click', async function() {
        const sb = window.initSupabase();
        if (!sb) return;

        const config = {
            device_name: settingsDom.sysDeviceName?.value || 'School Bell',
            fw_version: settingsDom.sysFwVersion?.value || 'v1.0.0',
            wifi_ssid: settingsDom.sysWifiSsid?.value || '',
            wifi_password: settingsDom.sysWifiPass?.value || '',
            sync_interval: parseInt(settingsDom.sysSyncInterval?.value) || 60,
        };

        this.disabled = true;
        this.textContent = 'Menyimpan...';

        try {
            // Check if config exists
            const { data: existing } = await sb.from('esp_config').select('id').limit(1);
            
            if (existing && existing.length > 0) {
                await sb.from('esp_config').update(config).eq('id', existing[0].id);
            } else {
                await sb.from('esp_config').insert([config]);
            }

            // Send update command to ESP
            await sb.from('esp_commands').insert([{
                command: 'update_config',
                params: JSON.stringify(config),
                status: 'pending',
            }]);

            App.showToast('Pengaturan sistem disimpan', 'success');
        } catch (err) {
            console.error('[Settings] Save system error:', err);
            App.showToast('Gagal menyimpan pengaturan', 'error');
        } finally {
            this.disabled = false;
            this.textContent = 'Simpan Pengaturan';
        }
    });
}

// Restart ESP
if (settingsDom.sysBtnRestart) {
    settingsDom.sysBtnRestart.addEventListener('click', async function() {
        if (!confirm('Yakin ingin merestart ESP32?')) return;
        
        const sb = window.initSupabase();
        if (!sb) return;

        try {
            await sb.from('esp_commands').insert([{
                command: 'restart',
                status: 'pending',
            }]);
            App.showToast('Perintah restart dikirim', 'success');
        } catch (err) {
            App.showToast('Gagal restart', 'error');
        }
    });
}

// Reset to factory
if (settingsDom.sysBtnReset) {
    settingsDom.sysBtnReset.addEventListener('click', async function() {
        if (!confirm('⚠️ RESET PABRIK? Semua data akan dihapus!\nLanjutkan?')) return;
        if (!confirm('KONFIRMASI: Anda yakin ingin menghapus semua data?')) return;
        
        const sb = window.initSupabase();
        if (!sb) return;

        try {
            // Clear all tables
            await sb.from('esp_config').delete().neq('id', 0);
            await sb.from('esp_status').delete().neq('id', 0);
            await sb.from('bell_history').delete().neq('id', 0);
            await sb.from('system_logs').delete().neq('id', 0);
            
            // Send reset command
            await sb.from('esp_commands').insert([{
                command: 'factory_reset',
                status: 'pending',
            }]);

            App.showToast('Reset pabrik dijalankan', 'warning');
            
            // Reload settings
            setTimeout(() => loadSettingsData(), 1000);
        } catch (err) {
            console.error('[Settings] Reset error:', err);
            App.showToast('Gagal reset', 'error');
        }
    });
}

// ============================================
// SUPABASE SETTINGS
// ============================================
if (settingsDom.sbBtnSave) {
    settingsDom.sbBtnSave.addEventListener('click', async function() {
        const sb = window.initSupabase();
        if (!sb) return;

        const config = {
            supabase_url: settingsDom.sbUrl?.value || CONFIG.SUPABASE_URL,
            supabase_key: settingsDom.sbAnonKey?.value || CONFIG.SUPABASE_ANON_KEY,
        };

        this.disabled = true;
        this.textContent = 'Menyimpan...';

        try {
            const { data: existing } = await sb.from('esp_config').select('id').limit(1);
            
            if (existing && existing.length > 0) {
                await sb.from('esp_config').update({
                    supabase_url: config.supabase_url,
                    supabase_key: config.supabase_key,
                }).eq('id', existing[0].id);
            } else {
                await sb.from('esp_config').insert([config]);
            }

            // Send to ESP
            await sb.from('esp_commands').insert([{
                command: 'update_supabase_config',
                params: JSON.stringify(config),
                status: 'pending',
            }]);

            App.showToast('Konfigurasi Supabase disimpan', 'success');
        } catch (err) {
            App.showToast('Gagal menyimpan', 'error');
        } finally {
            this.disabled = false;
            this.textContent = 'Simpan';
        }
    });
}

// Test Supabase connection
if (settingsDom.sbBtnTest) {
    settingsDom.sbBtnTest.addEventListener('click', async function() {
        const resultEl = settingsDom.sbTestResult;
        resultEl.classList.remove('d-none');
        resultEl.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Menguji koneksi...';
        resultEl.className = 'test-result alert alert-info';

        try {
            const sb = window.initSupabase();
            if (!sb) throw new Error('Supabase client not initialized');

            // Try a simple query pada tabel devices (validasi koneksi + RLS)
            const { data, error } = await sb.from('devices').select('device_id').limit(1);
            
            if (error) throw error;

            resultEl.className = 'test-result alert alert-success';
            resultEl.innerHTML = '<i class="bi bi-check-circle"></i> Koneksi berhasil!';
        } catch (err) {
            resultEl.className = 'test-result alert alert-danger';
            resultEl.innerHTML = `<i class="bi bi-x-circle"></i> Gagal: ${err.message}`;
        }
    });
}

// Load Supabase fields from CONFIG
if (settingsDom.sbUrl) settingsDom.sbUrl.value = CONFIG.SUPABASE_URL;
if (settingsDom.sbAnonKey) settingsDom.sbAnonKey.value = CONFIG.SUPABASE_ANON_KEY;

// ============================================
// AUDIO LIBRARY
// ============================================
async function loadAudioLibrary(sb) {
    const container = settingsDom.audioLibraryContainer;
    if (!container) return;

    try {
        const { data, error } = await sb
            .from('audio_library')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:24px; color:var(--text-light);">
                    <i class="bi bi-music-note-list" style="font-size:36px; display:block; margin-bottom:8px;"></i>
                    Belum ada file audio. Upload file .mp3 atau .wav
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        data.forEach((audio, index) => {
            const item = document.createElement('div');
            item.className = 'audio-item';
            item.style.animationDelay = `${index * 0.03}s`;
            item.innerHTML = `
                <div class="audio-item-icon">
                    <i class="bi bi-file-music"></i>
                </div>
                <div class="audio-item-info">
                    <div class="audio-item-name">${audio.filename || audio.name || 'Audio'}</div>
                    <div class="audio-item-meta">${audio.duration ? formatDuration(audio.duration) : '--'} · ${audio.size ? formatBytes(audio.size) : '--'}</div>
                </div>
                <div class="audio-item-actions">
                    <button class="audio-play-btn" data-url="${audio.url || ''}" title="Play">
                        <i class="bi bi-play-fill"></i>
                    </button>
                    <button class="audio-delete-btn" data-id="${audio.id}" title="Hapus">
                        <i class="bi bi-trash3"></i>
                    </button>
                </div>
            `;
            container.appendChild(item);

            // Play button
            item.querySelector('.audio-play-btn').addEventListener('click', function() {
                const url = this.dataset.url;
                if (url) {
                    const audio = new Audio(url);
                    audio.play().catch(err => App.showToast('Gagal memutar audio', 'error'));
                }
            });

            // Delete button
            item.querySelector('.audio-delete-btn').addEventListener('click', async function() {
                if (!confirm('Hapus file audio ini?')) return;
                try {
                    await sb.from('audio_library').delete().eq('id', this.dataset.id);
                    App.showToast('Audio dihapus', 'success');
                    loadAudioLibrary(sb);
                } catch (err) {
                    App.showToast('Gagal menghapus', 'error');
                }
            });
        });

    } catch (err) {
        console.error('[Settings] Audio library error:', err);
        container.innerHTML = '<div style="text-align:center; padding:24px; color:var(--danger);">Gagal memuat library audio</div>';
    }
}

// Upload audio
if (settingsDom.audioUploadBtn && settingsDom.audioUploadInput) {
    settingsDom.audioUploadBtn.addEventListener('click', function() {
        settingsDom.audioUploadInput.click();
    });

    settingsDom.audioUploadInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Validate
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['mp3', 'wav', 'ogg'].includes(ext)) {
            App.showToast('Format file harus .mp3, .wav, atau .ogg', 'warning');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            App.showToast('Ukuran file maksimal 5MB', 'warning');
            return;
        }

        const progressEl = settingsDom.audioUploadProgress;
        progressEl.classList.remove('d-none');
        progressEl.innerHTML = `
            <div class="upload-progress">
                <div class="upload-progress-bar" style="width:0%"></div>
            </div>
            <span class="upload-status">Mengupload ${file.name}...</span>
        `;

        try {
            const sb = window.initSupabase();
            if (!sb) throw new Error('Not connected');

            const filename = `${Date.now()}_${file.name}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await sb.storage
                .from('audio')
                .upload(filename, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: urlData } = sb.storage
                .from('audio')
                .getPublicUrl(filename);

            const publicUrl = urlData.publicUrl;

            // Save to audio_library table
            await sb.from('audio_library').insert([{
                filename: file.name,
                url: publicUrl,
                size: file.size,
                type: ext,
            }]);

            progressEl.innerHTML = `<i class="bi bi-check-circle" style="color:var(--success)"></i> Upload berhasil!`;
            App.showToast('Audio berhasil diupload', 'success');

            // Reload library
            loadAudioLibrary(sb);
            this.value = '';

        } catch (err) {
            console.error('[Settings] Upload error:', err);
            progressEl.innerHTML = `<i class="bi bi-x-circle" style="color:var(--danger)"></i> Gagal: ${err.message}`;
        }

        setTimeout(() => {
            progressEl.classList.add('d-none');
        }, 3000);
    });
}

// ============================================
// ADVANCED SCHEDULE SETTINGS
// ============================================
async function loadAdvancedSettings(sb) {
    try {
        const { data, error } = await sb
            .from('esp_config')
            .select('schedule_auto_sync, relay_on_bell, relay_duration')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        const config = data && data.length > 0 ? data[0] : {};

        if (settingsDom.schedAutoSync) settingsDom.schedAutoSync.checked = config.schedule_auto_sync !== false;
        if (settingsDom.schedRelayOnBell) settingsDom.schedRelayOnBell.checked = config.relay_on_bell === true;
        if (settingsDom.schedRelayDuration) settingsDom.schedRelayDuration.value = config.relay_duration || '5';

    } catch (err) {
        console.error('[Settings] Load advanced error:', err);
    }
}

if (settingsDom.schedBtnSave) {
    settingsDom.schedBtnSave.addEventListener('click', async function() {
        const sb = window.initSupabase();
        if (!sb) return;

        const config = {
            schedule_auto_sync: settingsDom.schedAutoSync?.checked ?? true,
            relay_on_bell: settingsDom.schedRelayOnBell?.checked ?? false,
            relay_duration: parseInt(settingsDom.schedRelayDuration?.value) || 5,
        };

        this.disabled = true;
        this.textContent = 'Menyimpan...';

        try {
            const { data: existing } = await sb.from('esp_config').select('id').limit(1);
            
            if (existing && existing.length > 0) {
                await sb.from('esp_config').update(config).eq('id', existing[0].id);
            } else {
                await sb.from('esp_config').insert([config]);
            }

            await sb.from('esp_commands').insert([{
                command: 'update_advanced_config',
                params: JSON.stringify(config),
                status: 'pending',
            }]);

            App.showToast('Pengaturan lanjutan disimpan', 'success');
        } catch (err) {
            App.showToast('Gagal menyimpan', 'error');
        } finally {
            this.disabled = false;
            this.textContent = 'Simpan';
        }
    });
}

// ============================================
// NOTIFICATION SETTINGS
// ============================================
async function loadNotificationSettings(sb) {
    try {
        const { data, error } = await sb
            .from('app_settings')
            .select('*')
            .eq('key', 'notifications')
            .limit(1);

        if (error) throw error;

        const settings = data && data.length > 0 ? JSON.parse(data[0].value || '{}') : {};

        if (settingsDom.notifEnabled) settingsDom.notifEnabled.checked = settings.enabled !== false;
        if (settingsDom.notifEmail) settingsDom.notifEmail.value = settings.email || '';

    } catch (err) {
        console.error('[Settings] Load notifications error:', err);
    }
}

if (settingsDom.notifBtnSave) {
    settingsDom.notifBtnSave.addEventListener('click', async function() {
        const sb = window.initSupabase();
        if (!sb) return;

        const value = JSON.stringify({
            enabled: settingsDom.notifEnabled?.checked ?? true,
            email: settingsDom.notifEmail?.value || '',
        });

        this.disabled = true;
        this.textContent = 'Menyimpan...';

        try {
            const { data: existing } = await sb.from('app_settings').select('id').eq('key', 'notifications').limit(1);
            
            if (existing && existing.length > 0) {
                await sb.from('app_settings').update({ value }).eq('id', existing[0].id);
            } else {
                await sb.from('app_settings').insert([{ key: 'notifications', value }]);
            }

            App.showToast('Pengaturan notifikasi disimpan', 'success');
        } catch (err) {
            App.showToast('Gagal menyimpan', 'error');
        } finally {
            this.disabled = false;
            this.textContent = 'Simpan';
        }
    });
}

// ============================================
// DANGER ZONE
// ============================================

// Clear logs
if (settingsDom.dangerClearLogs) {
    settingsDom.dangerClearLogs.addEventListener('click', async function() {
        if (!confirm('Hapus semua log? Data tidak bisa dikembalikan.')) return;
        
        const sb = window.initSupabase();
        if (!sb) return;

        try {
            await sb.from('bell_history').delete().neq('id', 0);
            await sb.from('system_logs').delete().neq('id', 0);
            App.showToast('Semua log dihapus', 'success');
        } catch (err) {
            App.showToast('Gagal menghapus log', 'error');
        }
    });
}

// Clear all data
if (settingsDom.dangerClearAll) {
    settingsDom.dangerClearAll.addEventListener('click', async function() {
        if (!confirm('⚠️ HAPUS SEMUA DATA? Semua jadwal, log, dan pengaturan akan hilang!')) return;
        if (!confirm('KONFIRMASI AKHIR: Tindakan ini tidak bisa dibatalkan! Lanjutkan?')) return;
        
        const sb = window.initSupabase();
        if (!sb) return;

        try {
            await sb.from('schedules').delete().neq('id', 0);
            await sb.from('bell_history').delete().neq('id', 0);
            await sb.from('system_logs').delete().neq('id', 0);
            await sb.from('esp_config').delete().neq('id', 0);
            await sb.from('esp_status').delete().neq('id', 0);
            await sb.from('esp_commands').delete().neq('id', 0);
            await sb.from('audio_library').delete().neq('id', 0);
            await sb.from('app_settings').delete().neq('id', 0);
            
            App.showToast('Semua data telah dihapus', 'warning');
            setTimeout(() => location.reload(), 1500);
        } catch (err) {
            App.showToast('Gagal menghapus data', 'error');
        }
    });
}

// ============================================
// UTILITY HELPERS
// ============================================
function formatDuration(seconds) {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (!bytes) return '0B';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
}

// ============================================
// INIT
// ============================================
console.log('[Settings] Module loaded');