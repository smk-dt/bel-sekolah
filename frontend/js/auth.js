// ============================================
// SMART SCHOOL BELL IoT - Authentication
// ============================================

let currentUser = null;
let currentSession = null;

// Initialize auth
async function initAuth() {
    try {
        const sb = initSupabase();
        const { data: { session }, error } = await sb.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            currentSession = session;
            currentUser = session.user;
            console.log('[Auth] User already logged in:', currentUser.email);
            showApp();
            return true;
        } else {
            showLogin();
            return false;
        }
    } catch (err) {
        console.error('[Auth] Init error:', err);
        showLogin();
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
            } else {
                throw new Error('Username atau password salah');
            }
        } else {
            currentSession = data.session;
            currentUser = data.user;
        }
        
        console.log('[Auth] Login successful:', currentUser.email);
        showApp();
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
        showLogin();
        
        Swal.fire({
            icon: 'success',
            title: 'Berhasil Logout',
            timer: 1500,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
        });
    } catch (err) {
        console.error('[Auth] Logout error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Gagal logout',
            text: err.message
        });
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
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            currentSession = null;
            showLogin();
        }
    });
}

// Show login page
function showLogin() {
    document.getElementById('page-login').classList.add('active');
    document.getElementById('app-main').classList.add('d-none');
    document.getElementById('app-main').classList.remove('d-block');
}

// Show main app
function showApp() {
    document.getElementById('page-login').classList.remove('active');
    document.getElementById('app-main').classList.remove('d-none');
    document.getElementById('app-main').classList.add('d-block');
    
    // Load initial data
    loadHomeData();
    loadScheduleData(getCurrentDayName());
    loadStatusData();
    
    // Start clock
    startClock();
    
    // Navigate to home by default
    navigateTo('home');
}

// Setup event listeners for auth
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('form-login');
    const btnLogin = document.getElementById('btn-login');
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');
    const btnLogout = document.getElementById('btn-logout');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        
        if (!username || !password) {
            Swal.fire({
                icon: 'warning',
                title: 'Lengkapi data',
                text: 'Masukkan username dan password'
            });
            return;
        }
        
        // Loading state
        btnLogin.disabled = true;
        loginText.textContent = 'Memproses...';
        loginSpinner.classList.remove('d-none');
        
        try {
            await handleLogin(username, password);
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Login Gagal',
                text: err.message || 'Username atau password salah',
                confirmButtonColor: '#0d6efd'
            });
        } finally {
            btnLogin.disabled = false;
            loginText.textContent = 'Masuk';
            loginSpinner.classList.add('d-none');
        }
    });

    btnLogout.addEventListener('click', function() {
        Swal.fire({
            title: 'Yakin ingin logout?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Ya, Logout',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                handleLogout();
            }
        });
    });
});