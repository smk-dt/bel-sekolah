// ============================================
// SMART SCHOOL BELL IoT - Supabase Config
// ============================================

const CONFIG = {
    SUPABASE_URL: 'https://muqtpytomnnpntqqmxog.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXRweXRvbW5ucG50cXFteG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1NjM1MjcsImV4cCI6MjA1MDEzOTUyN30.JI8G0lrYGqfxO8FZbIfVnKdWeWl-sAeO-ncW_Tf4kqA',
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
