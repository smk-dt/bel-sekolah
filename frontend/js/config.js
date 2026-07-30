// ============================================
// SMART SCHOOL BELL IoT - Supabase Configuration
// ============================================
// !!! IMPORTANT: Ganti dengan URL dan Key Supabase Anda !!!
// Di Vercel, gunakan Environment Variables

const SUPABASE_URL = window.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'your-anon-key';

// Inisialisasi Supabase client
let supabase;

function initSupabase() {
    if (!supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            },
            realtime: {
                params: {
                    eventsPerSecond: 10
                }
            }
        });
        console.log('[Config] Supabase client initialized');
    }
    return supabase;
}

// Utility: format waktu
function formatTime(date) {
    if (!date) return '--:--:--';
    const d = new Date(date);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatDate(date) {
    if (!date) return '---';
    const d = new Date(date);
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateShort(date) {
    if (!date) return '--';
    const d = new Date(date);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTimeShort(date) {
    if (!date) return '--:--';
    const d = new Date(date);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Utility: get current day name in Indonesian
function getCurrentDayName() {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[new Date().getDay()];
}

// Utility: get today's schedules query helper
function getTodayName() {
    return getCurrentDayName();
}

// Utility: seconds to HH:MM:SS
function secondsToHms(seconds) {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Utility: time string to seconds
function timeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + (parseInt(parts[2]) || 0);
}

// Device ID default
const DEFAULT_DEVICE_ID = 'SMKDT001';
const DEVICE_NAME = 'Smart Bell SMK DT';

// Export for other scripts
window.SupabaseHelpers = {
    formatTime,
    formatDate,
    formatDateShort,
    formatTimeShort,
    getCurrentDayName,
    getTodayName,
    secondsToHms,
    timeToSeconds,
    DEFAULT_DEVICE_ID,
    DEVICE_NAME
};