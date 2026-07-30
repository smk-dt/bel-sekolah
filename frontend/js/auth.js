// ============================================
// SMART SCHOOL BELL IoT - Authentication
// ============================================

let currentUser = null;
let currentSession = null;

// Expose for app.js to use
window.currentUser = null;

// Initialize auth
async function initAuth() {
    try {
        const sb = initSupabase();
        const { data: { session }, error } = await sb.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            currentSession = session;
            currentUser = session.user;
            window.currentUser = session.user;
            console.log('[Auth] User already logged in:', currentUser.email);
            
            // Use App module to show app
            if (typeof App !== 'undefined' && App.showApp) {
                App.showApp();
            }
            return true;
        } else {
            // Show login via App
            if (typeof App !== 'undefined' && App.showLogin) {
                App.showLogin();
            }
            return false;
        }
    } catch (err) {
        console.error('[Auth] Init error:', err);
        if (typeof App !== 'undefined' && App.showLogin) {
            App.showLogin();
        }
        return false;
    }
}

// Login form handler
async function handleLogin(username, password) {
    try {
        const sb = initSupabase();
        
        // Sign in with email/password
        // Username is stored in email field for Supabase Auth
        const email = username + '@smartbell.local';
        
        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            // Fallback: try direct sign in with username as email if custom
            console.error('[Auth] Login error:', error.message);
            
            // Try with the actual email if configured
            if (username.includes('@')) {
                const { data: data2, error: error2 } = await sb.auth.signInWithPassword({
                    email: username,
                    password: password
                });
                if (error2) throw error2;
                currentSession = data2.session;
                currentUser = data2.user;
                window.currentUser = data2.user;
            } else {
                throw new Error('Username atau password salah');
            }
        } else {
            currentSession = data.session;
            currentUser = data.user;
            window.currentUser = data.user;
        }
        
        console.log('[Auth] Login successful:', currentUser.email);
        
        // Use App module to show app
        if (typeof App !== 'undefined' && App.showApp) {
            App.showApp();
        }
        return true;
    } catch (err) {
        console.error('[Auth] Login failed:', err);
        throw err;
    }
}

// Logout handler
async function handleLogout() {
    try {
        const sb = initSupabase();
        const { error } = await sb.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        currentSession = null;
        window.currentUser = null;
        
        // Use App module to show login
        if (typeof App !== 'undefined' && App.showLogin) {
            App.showLogin();
        }
        
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Berhasil Logout', 'success');
        }
    } catch (err) {
        console.error('[Auth] Logout error:', err);
        if (typeof App !== 'undefined' && App.showToast) {
            App.showToast('Gagal logout: ' + err.message, 'error');
        }
    }
}

// Check auth state changes
function listenAuthChanges() {
    const sb = initSupabase();
    sb.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] State change:', event);
        if (event === 'SIGNED_IN' && session) {
            currentSession = session;
            currentUser = session.user;
            window.currentUser = session.user;
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentSession = null;
            window.currentUser = null;
            if (typeof App !== 'undefined' && App.showLogin) {
                App.showLogin();
            }
        }
    });
}

// Expose functions globally for HTML onclick/events
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.initAuth = initAuth;

// Setup event listeners for auth
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('form-login');
    const btnLogin = document.getElementById('btn-login');
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            
            if (!username || !password) {
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast('Masukkan username dan password', 'warning');
                }
                return;
            }
            
            // Loading state
            if (btnLogin) btnLogin.disabled = true;
            if (loginText) loginText.textContent = 'Memproses...';
            if (loginSpinner) loginSpinner.classList.remove('d-none');
            
            try {
                await handleLogin(username, password);
            } catch (err) {
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast(err.message || 'Username atau password salah', 'error');
                }
            } finally {
                if (btnLogin) btnLogin.disabled = false;
                if (loginText) loginText.textContent = 'Masuk';
                if (loginSpinner) loginSpinner.classList.add('d-none');
            }
        });
    }
});