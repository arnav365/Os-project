// DOM Elements
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const indicator = document.getElementById('tab-indicator');

const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const formMfa = document.getElementById('form-mfa');
const formForgot = document.getElementById('form-forgot');
const formReset = document.getElementById('form-reset');
const viewSuccess = document.getElementById('view-success');

let tempUserId = null; // Store user ID temporarily for MFA flow

const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// API Configuration
const API_BASE = '/api/auth';

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Check if token exists on load
    const token = localStorage.getItem('os_token') || sessionStorage.getItem('os_token');
    const userStr = localStorage.getItem('os_user') || sessionStorage.getItem('os_user');
    const user = userStr ? JSON.parse(userStr) : null;
    
    if (token && user) {
        showSuccessView(user);
    }

    // Attach event listeners to avoid CSP inline script violations
    document.getElementById('tab-login')?.addEventListener('click', () => switchTab('login'));
    document.getElementById('tab-register')?.addEventListener('click', () => switchTab('register'));
    
    document.querySelectorAll('.forgot-link').forEach(el => el.addEventListener('click', (e) => { 
        e.preventDefault(); 
        switchTab('forgot'); 
    }));
    
    document.querySelectorAll('.btn-secondary').forEach(btn => {
        if (btn.textContent.includes('Cancel')) {
            btn.addEventListener('click', () => switchTab('login'));
        } else if (btn.textContent.includes('Terminate Session')) {
            btn.addEventListener('click', logout);
        }
    });
});

// UI Logic: Tab Switcher
function switchTab(tab) {
    [formLogin, formRegister, formMfa, formForgot, formReset].forEach(f => {
        if(f) f.classList.remove('active-form');
    });

    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        indicator.style.transform = 'translateX(0)';
        formLogin.classList.add('active-form');
    } else if (tab === 'register') {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        indicator.style.transform = 'translateX(100%)';
        formRegister.classList.add('active-form');
    } else if (tab === 'forgot') {
        tabLogin.classList.remove('active');
        tabRegister.classList.remove('active');
        indicator.style.transform = 'translateX(50%)';
        formForgot.classList.add('active-form');
    } else if (tab === 'reset') {
        tabLogin.classList.remove('active');
        tabRegister.classList.remove('active');
        indicator.style.transform = 'translateX(50%)';
        formReset.classList.add('active-form');
    }
}

// Logic: Show Toasts
function showToast(msg, type = 'error') {
    toastMessage.textContent = msg;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

// Logic: Redirect to Dashboard
function redirectToDashboard() {
    window.location.href = 'dashboard.html';
}

// UI Logic: Logout
function logout() {
    localStorage.removeItem('os_token');
    localStorage.removeItem('os_user');
    sessionStorage.removeItem('os_token');
    sessionStorage.removeItem('os_user');
    
    viewSuccess.classList.remove('active-form');
    document.querySelector('.tab-switcher').style.display = 'flex';
    switchTab('login');
    showToast('Session terminated.', 'success');
}

// API Integration: Generic fetch wrapper
async function apiCall(endpoint, data, btnElement, spinnerId) {
    const btnText = btnElement.childNodes[0].nodeValue; // Cache original text
    const spinner = document.getElementById(spinnerId);
    
    // Add loading UI
    btnElement.style.opacity = '0.7';
    btnElement.style.pointerEvents = 'none';
    spinner.classList.add('active');

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        let result;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            result = await response.json();
        } else {
            result = { success: false, message: await response.text() };
        }
        
        if (!response.ok) {
            throw new Error(result.message || 'Operation failed');
        }
        
        return result;
    } catch (err) {
        showToast(err.message, 'error');
        return null;
    } finally {
        // Reset loading UI
        btnElement.style.opacity = '1';
        btnElement.style.pointerEvents = 'all';
        spinner.classList.remove('active');
    }
}

// Login Submission
formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    const res = await apiCall('/login', { email, password }, document.getElementById('btn-login-submit'), 'spinner-login');
    
    if (res && res.success) {
        if (res.mfaRequired) {
            tempUserId = res.userId;
            
            // Switch to MFA View
            formLogin.classList.remove('active-form');
            formMfa.classList.add('active-form');
            
            showToast(res.message, 'success');
            document.getElementById('mfa-otp').focus();
        } else {
            const rememberMe = document.getElementById('login-remember').checked;
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('os_token', res.token);
            storage.setItem('os_user', JSON.stringify(res.user));
            redirectToDashboard();
        }
    }
});

// MFA Submission
if(formMfa) {
    formMfa.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const otp = document.getElementById('mfa-otp').value;
        
        if (!tempUserId) {
            showToast('Session error, please login again.', 'error');
            return switchTab('login');
        }
        
        const res = await apiCall('/verify-mfa', { userId: tempUserId, otp }, document.getElementById('btn-mfa-submit'), 'spinner-mfa');
        
        if (res && res.success) {
            const rememberMe = document.getElementById('login-remember').checked;
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('os_token', res.token);
            storage.setItem('os_user', JSON.stringify(res.user));
            redirectToDashboard();
        }
    });
}

// Registration Submission
formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    
    const res = await apiCall('/register', { username, email, password, role }, document.getElementById('btn-reg-submit'), 'spinner-reg');
    
    if (res && res.success) {
        if (res.mfaRequired) {
            tempUserId = res.userId;
            
            // Switch to MFA View
            formRegister.classList.remove('active-form');
            formMfa.classList.add('active-form');
            
            showToast(res.message, 'success');
            document.getElementById('mfa-otp').focus();
        } else {
            sessionStorage.setItem('os_token', res.token);
            sessionStorage.setItem('os_user', JSON.stringify(res.user));
            redirectToDashboard();
        }
    }
});

// Forgot Password Submission
if (formForgot) {
    formForgot.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;
        const res = await apiCall('/forgotpassword', { email }, document.getElementById('btn-forgot-submit'), 'spinner-forgot');
        
        if (res && res.success) {
            showToast('Recovery instructions drafted. System OTP generated.', 'success');
            // Mock mode: the token is usually emailed. For testing we could show the reset form directly.
            // But we will be standard: switch back to login and let user "simulate" email arriving.
            // Or let's switch to reset tab directly so they can paste it if they see it in backend logs.
            switchTab('reset');
            if (res.resetOtp) {
                // Pre-fill for convenience in mock scenarios if backend returns it (it shouldn't in real prod)
                document.getElementById('reset-otp').value = res.resetOtp;
            }
        }
    });
}

// Reset Password Submission
if (formReset) {
    formReset.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = document.getElementById('reset-otp').value;
        const password = document.getElementById('reset-password').value;
        
        const res = await fetch(`${API_BASE}/resetpassword`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otp, password })
        });
        const result = await res.json();
        
        if (res.ok && result.success) {
            showToast('Security Key updated via reset matrix. Please login.', 'success');
            switchTab('login');
        } else {
            showToast(result.message || 'Token verification failed.', 'error');
        }
    });
}
