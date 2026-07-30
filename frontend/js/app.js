// ============================================
// SMART SCHOOL BELL IoT - Main App Controller
// ============================================

// Initialize app on DOM ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('[App] Initializing Smart School Bell IoT...');
    
    try {
        // Initialize Supabase
        initSupabase();
        console.log('[App] Supabase initialized');
        
        // Listen for auth state changes
        listenAuthChanges();
        
        // Start auth flow
        await initAuth();
        
        console.log('[App] Initialization complete');
    } catch (err) {
        console.error('[App] Initialization error:', err);
        // If something fails, show login anyway
        showLogin();
    }
});

// Navigation
function navigateTo(page) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(el => el.classList.remove('active'));
    
    // Show target page
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // Update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // Refresh data on navigation
    switch (page) {
        case 'home':
            loadHomeData();
            break;
        case 'jadwal':
            loadScheduleData(getCurrentDayName());
            break;
        case 'status':
            loadStatusData();
            break;
    }
}

// Setup bottom navigation
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            navigateTo(page);
        });
    });
});

// Digital Clock
let clockInterval = null;

function startClock() {
    if (clockInterval) {
        clearInterval(clockInterval);
    }
    
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

function updateClock() {
    const now = new Date();
    const helpers = window.SupabaseHelpers;
    
    // Update home clock
    const homeClock = document.getElementById('home-clock');
    if (homeClock) {
        homeClock.textContent = helpers.formatTime(now);
    }
    
    const homeDate = document.getElementById('home-date');
    if (homeDate) {
        homeDate.textContent = helpers.formatDate(now);
    }
    
    // Update header clock
    const headerClock = document.getElementById('header-clock');
    if (headerClock) {
        headerClock.textContent = helpers.formatTime(now);
    }
}

// Auto-refresh home data periodically (every 30 seconds)
let autoRefreshInterval = null;

function startAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    autoRefreshInterval = setInterval(() => {
        // Only refresh if home page is active
        const homeActive = document.getElementById('page-home')?.classList.contains('active');
        if (homeActive) {
            loadHomeData();
        }
    }, 30000);
}

// Restart auto refresh on home page load
document.addEventListener('DOMContentLoaded', function() {
    // Watch for page changes to manage auto-refresh
    const observer = new MutationObserver(() => {
        const homeActive = document.getElementById('page-home')?.classList.contains('active');
        if (homeActive) {
            startAutoRefresh();
        }
    });
    
    const pageHome = document.getElementById('page-home');
    if (pageHome) {
        observer.observe(pageHome, { attributes: true, attributeFilter: ['class'] });
    }
    
    // Start auto refresh initially
    startAutoRefresh();
});

// Load audio list for schedules (shared utility)
async function loadAllAudios() {
    try {
        const sb = initSupabase();
        const { data, error } = await sb
            .from('audios')
            .select('*')
            .order('id', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[App] Load audios error:', err);
        return [];
    }
}

// Global error handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('[App] Unhandled promise rejection:', event.reason);
    // Don't show to user for minor issues
});

// Network status detection
window.addEventListener('online', function() {
    console.log('[App] Network is back online');
    // Refresh data
    if (currentUser) {
        loadHomeData();
    }
});

window.addEventListener('offline', function() {
    console.warn('[App] Network is offline');
    Swal.fire({
        icon: 'warning',
        title: 'Offline',
        text: 'Koneksi internet terputus',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
});