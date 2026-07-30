// ============================================
// SMART SCHOOL BELL IoT - Authentication
// ============================================

let currentUser = null;
let currentSession = null;

// Expose for app.js to use
window.currentUser = null;

// Hardcoded users for local development
const LOCAL_USERS = [
    { username: 'admin', password: 'admin123', role: 'admin', displayName: 'Administrator' },
    { username: 'operator', password: 'operator123', role: 'operator', displayName: 'Operator' },
];

// Initialize auth
async function initAuth() {
    try {
        // Cek session tersimpan di localStorage (bypass/login sebelumnya)
        const saved = localStorage.getItem('local-session');
        if (saved) {
            const session = JSON.parse(saved);
            currentUser = session.user;
            currentSession = session;
            window.currentUser = session.user;
            console.log('[Auth] User already logged in:', session.user.username);
            if (typeof App !== 'undefined' && App.showApp) {
                App.showApp();
            }
            return true;
        }

        // Coba cek Supabase session
        const sb = initSupabase();
        if (sb) {
            const { data: { session }, error } = await sb.auth.getSession();
            if (!error && session) {
                currentSession = session;
                currentUser = session.user;
                window.currentUser = session.user;
                console.log('[Auth] Supabase user logged in:', currentUser.email);
                if (typeof App !== 'undefined' && App.showApp) {
                    App.showApp();
                }
                return true;
            }
        }

        // Tidak ada session, tampilkan login
        if (typeof App !== 'undefined' && App.showLogin) {
            App.showLogin();
        }
        return false;
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
        // 1. Coba login ke user lokal
        const localUser = LOCAL_USERS.find(u => u.username === username && u.password === password);
        if (localUser) {
            currentSession = { type: 'local' };
            currentUser = {
                username: localUser.username,
                role: localUser.role,
                displayName: localUser.displayName,
            };
            window.currentUser = currentUser;

            // Simpan session ke localStorage
            localStorage.setItem('local-session', JSON.stringify({
                user: currentUser,
                type: 'local',
                timestamp: Date.now()
            }));

            console.log('[Auth] Local login successful:', localUser.username);
            if (typeof App !== 'undefined' && App.showApp) {
                App.showApp();
            }
            return true;
        }

        // 2. Fallback ke Supabase Auth (email format)
        const sb = initSupabase();
        if (sb) {
            try {
                const email = username.includes('@') ? username : username + '@smartbell.local';
                const { data, error } = await sb.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                if (!error && data.session) {
                    currentSession = data.session;
                    currentUser = data.user;
                    window.currentUser = data.user;
                    console.log('[Auth] Supabase login successful:', currentUser.email);
                    if (typeof App !== 'undefined' && App.showApp) {
                        App.showApp();
                    }
                    return true;
                }
            } catch (e) {
                // Supabase gagal, lanjut ke error below
            }
        }

        // 3. Kalau semua gagal
        throw new Error('Username atau password salah');
    } catch (err) {
        console.error('[Auth] Login failed:', err);
        throw err;
    }
}

// Logout handler
async function handleLogout() {
    try {
        // Hapus session lokal
        localStorage.removeItem('local-session');
        localStorage.removeItem('sb-session');
        localStorage.removeItem('user');

        // Logout dari Supabase kalau ada
        const sb = initSupabase();
        if (sb) {
            try {
                await sb.auth.signOut();
            } catch (_) {}
        }

        currentUser = null;
        currentSession = null;
        window.currentUser = null;

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
    if (sb) {
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