// ============================================
// SMART SCHOOL BELL IoT - Main Application
// ============================================

const App = (function() {

    // ============================================
    // STATE
    // ============================================
    const state = {
        currentPage: 'home',
        isLoggedIn: false,
        espOnline: false,
        darkMode: localStorage.getItem('ssb-dark') === 'true',
        toastTimer: null,
        clockInterval: null,
    };

    // ============================================
    // DOM REFS
    // ============================================
    const $ = (id) => document.getElementById(id);
    const dom = {};

    // Cache DOM elements
    function cacheDom() {
        dom.appShell = $('app-shell');
        dom.pageLogin = $('page-login');
        
        dom.headerClock = $('header-clock');
        dom.headerDate = $('header-date');
        dom.espDot = $('esp-dot');
        dom.espLabel = $('esp-label');
        dom.headerEsp = $('header-esp');
        
        dom.btnLogout = $('btn-logout');
        dom.bottomNav = $('bottom-nav');
        dom.navItems = document.querySelectorAll('.nav-item');
        dom.pages = document.querySelectorAll('.page');
        dom.toastContainer = $('toast-container');
        dom.appContent = $('app-content');
    }

    // ============================================
    // TOAST SYSTEM
    // ============================================
    function showToast(message, type = 'info', duration = 3000) {
        if (!dom.toastContainer) return;

        const icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-x-circle-fill',
            warning: 'bi-exclamation-circle-fill',
            info: 'bi-info-circle-fill'
        };

        const toast = document.createElement('div');
        toast.className = `toast-item ${type}`;
        toast.innerHTML = `
            <i class="bi ${icons[type] || icons.info} toast-icon"></i>
            <span class="toast-message">${message}</span>
            <button class="toast-close">&times;</button>
        `;

        dom.toastContainer.appendChild(toast);

        // Close button handler
        toast.querySelector('.toast-close').addEventListener('click', () => {
            dismissToast(toast);
        });

        // Auto dismiss
        const timer = setTimeout(() => {
            dismissToast(toast);
        }, duration);

        toast._timer = timer;

        return toast;
    }

    function dismissToast(toast) {
        if (toast._timer) {
            clearTimeout(toast._timer);
        }
        toast.classList.add('toast-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    // ============================================
    // SYSTEM CLOCK
    // ============================================
    function startClock() {
        if (dom.headerClock) {
            dom.headerClock.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false });
        }
        
        if (state.clockInterval) {
            clearInterval(state.clockInterval);
        }

        state.clockInterval = setInterval(() => {
            const now = new Date();
            
            // Header clock
            if (dom.headerClock) {
                dom.headerClock.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
            }
            
            // Header date
            if (dom.headerDate) {
                const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
                dom.headerDate.textContent = now.toLocaleDateString('id-ID', options);
            }

            // Update hero clock on home page if visible
            const heroClock = $('hero-clock');
            if (heroClock) {
                heroClock.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
            }

            const heroDate = $('hero-date');
            if (heroDate) {
                const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
                heroDate.textContent = now.toLocaleDateString('id-ID', options);
            }
        }, 1000);
    }

    function stopClock() {
        if (state.clockInterval) {
            clearInterval(state.clockInterval);
            state.clockInterval = null;
        }
    }

    // ============================================
    // PAGE ROUTING
    // ============================================
    function navigateTo(pageName) {
        if (pageName === state.currentPage) return;

        // Update nav items
        dom.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        // Update pages
        dom.pages.forEach(page => {
            page.classList.remove('active');
            if (page.id === `page-${pageName}`) {
                page.classList.add('active');
                // Trigger page-specific load
                triggerPageLoad(pageName);
            }
        });

        state.currentPage = pageName;
    }

    function triggerPageLoad(pageName) {
        // These functions are defined in their respective files
        switch (pageName) {
            case 'home':
                if (typeof loadHomeData === 'function') {
                    loadHomeData();
                }
                break;
            case 'jadwal':
                if (typeof loadScheduleData === 'function') {
                    // Get current active day from DOM
                    const activeDay = document.querySelector('.day-tab.active');
                    const day = activeDay ? activeDay.dataset.day : 'Senin';
                    loadScheduleData(day);
                }
                break;
            case 'status':
                if (typeof loadStatusData === 'function') {
                    loadStatusData();
                }
                break;
            case 'settings':
                if (typeof loadSettingsData === 'function') {
                    loadSettingsData();
                }
                break;
        }
    }

    // ============================================
    // ESP STATUS UPDATE
    // ============================================
    function updateEspStatus(isOnline) {
        state.espOnline = isOnline;
        
        // Header ESP status
        if (dom.espDot) {
            dom.espDot.className = `esp-dot ${isOnline ? 'online' : 'offline'}`;
        }
        if (dom.espLabel) {
            dom.espLabel.textContent = isOnline ? 'Online' : 'Offline';
        }
        if (dom.headerEsp) {
            dom.headerEsp.className = `header-esp-status ${isOnline ? '' : 'offline'}`;
        }

        // Hero badge (home page)
        const heroEspText = $('hero-esp-text');
        const heroEspBadge = $('hero-esp-badge');
        if (heroEspText) {
            heroEspText.textContent = isOnline ? 'Online' : 'Offline';
        }
        if (heroEspBadge) {
            const dot = heroEspBadge.querySelector('.badge-dot');
            if (dot) {
                dot.className = `badge-dot ${isOnline ? 'online' : 'offline'}`;
            }
        }

        // Status page badge
        const statusHeroBadge = $('status-hero-badge');
        if (statusHeroBadge) {
            const dot = statusHeroBadge.querySelector('.badge-dot');
            if (dot) {
                dot.className = `badge-dot ${isOnline ? 'online' : 'offline'}`;
            }
            statusHeroBadge.style.color = isOnline ? 'var(--success)' : 'var(--danger)';
            const textNode = statusHeroBadge.childNodes[2];
            if (textNode) {
                textNode.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
            }
        }
    }

    // ============================================
    // DARK MODE
    // ============================================
    function toggleDarkMode() {
        state.darkMode = !state.darkMode;
        applyDarkMode(state.darkMode);
        localStorage.setItem('ssb-dark', state.darkMode);
    }

    function applyDarkMode(enabled) {
        if (enabled) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    // ============================================
    // SKELETON LOADING
    // ============================================
    function showSkeleton(containerId, type = 'card', count = 4) {
        const container = $(containerId);
        if (!container) return;

        let html = '';
        
        if (type === 'grid') {
            html = '<div class="skeleton-grid">';
            for (let i = 0; i < count; i++) {
                html += '<div class="skeleton skeleton-card"></div>';
            }
            html += '</div>';
        } else if (type === 'card') {
            for (let i = 0; i < count; i++) {
                html += '<div class="skeleton skeleton-card" style="margin-bottom: 12px;"></div>';
            }
        } else if (type === 'line') {
            for (let i = 0; i < count; i++) {
                html += `<div class="skeleton skeleton-line" style="width: ${80 - i * 10}%;"></div>`;
            }
        } else if (type === 'table') {
            for (let i = 0; i < count; i++) {
                html += `
                    <div style="display:flex; gap:12px; padding:12px 0; border-bottom:1px solid var(--border-light);">
                        <div class="skeleton" style="width:30px; height:20px; border-radius:4px;"></div>
                        <div class="skeleton" style="flex:1; height:20px; border-radius:4px;"></div>
                        <div class="skeleton" style="width:80px; height:20px; border-radius:4px;"></div>
                        <div class="skeleton" style="width:60px; height:20px; border-radius:4px;"></div>
                    </div>
                `;
            }
        }

        container.innerHTML = html;
    }

    function hideSkeleton(containerId) {
        const container = $(containerId);
        if (container) {
            container.innerHTML = '';
        }
    }

    // ============================================
    // SHOW APP (called by auth.js)
    // ============================================
    function showApp() {
        dom.pageLogin.classList.add('d-none');
        dom.appShell.classList.remove('d-none');
        dom.appShell.style.opacity = '0';
        
        setTimeout(() => {
            dom.appShell.style.transition = 'opacity 0.4s ease';
            dom.appShell.style.opacity = '1';
            
            // Start clock
            startClock();
            
            // Load initial page
            navigateTo('home');
        }, 50);
    }

    function showLogin() {
        dom.appShell.classList.add('d-none');
        dom.pageLogin.classList.remove('d-none');
        
        // Stop clock
        stopClock();
    }

    // ============================================
    // INIT
    // ============================================
    function init() {
        cacheDom();
        applyDarkMode(state.darkMode);

        // Logout button - delegates to auth.js
        if (dom.btnLogout) {
            dom.btnLogout.addEventListener('click', function() {
                if (typeof window.handleLogout === 'function') {
                    window.handleLogout();
                }
            });
        }

        // Bottom navigation
        dom.navItems.forEach(item => {
            item.addEventListener('click', function() {
                const page = this.dataset.page;
                navigateTo(page);
            });
        });

        console.log('[App] Initialized');
        
        // Auth initialization is handled by auth.js itself
        // which is loaded after this file
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================
    // PUBLIC API
    // ============================================
    return {
        navigateTo,
        showToast,
        dismissToast,
        updateEspStatus,
        toggleDarkMode,
        showSkeleton,
        hideSkeleton,
        startClock,
        stopClock,
        showApp,
        showLogin,
        getState: () => ({ ...state }),
    };

})();