// ============================================
// SMART SCHOOL BELL IoT - Supabase Config
// ============================================

const CONFIG = {
    SUPABASE_URL: 'https://ratkhbsmtfvuvngavqdk.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_2HKYCCcJ2xMgwndad5yUMA_mkdZb3_t',
    API_BASE: '/api',
};

// Initialize Supabase client (singleton — only create once)
let _supabaseClient = null;

function initSupabase() {
    // Return existing client if available
    if (_supabaseClient) {
        return _supabaseClient;
    }
    
    // Create new client only once
    if (window.supabase) {
        _supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        console.log('[Config] Supabase client initialized');
        return _supabaseClient;
    }
    
    console.error('[Config] Supabase SDK not loaded');
    return null;
}

// Expose to window for other modules
window.initSupabase = initSupabase;
