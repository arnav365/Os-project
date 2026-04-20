// Global State Configuration
const API_BASE = '/api/system';
let authToken = localStorage.getItem('os_token') || sessionStorage.getItem('os_token');
let userStr = localStorage.getItem('os_user') || sessionStorage.getItem('os_user');
let currentUser = userStr ? JSON.parse(userStr) : null;

// Identity Verification on Load
document.addEventListener('DOMContentLoaded', () => {
    // Immediate Guard checks if session state exists
    if (!authToken || !currentUser) {
        window.location.href = 'index.html';
        return;
    }

    // Populate Top Nav Bar
    document.getElementById('nav-role').textContent = currentUser.role.toUpperCase();
    document.getElementById('nav-username').textContent = currentUser.username;
    
    // Populate Session Identity Widget
    document.getElementById('avatar-initial').textContent = currentUser.username.charAt(0).toUpperCase();
    document.getElementById('node-username').textContent = currentUser.username;
    document.getElementById('node-email').textContent = currentUser.email;
    
    const roleBadge = document.getElementById('node-role');
    roleBadge.textContent = `${currentUser.role} PRIVILEGES`;
    if (currentUser.role === 'admin') {
        roleBadge.style.color = '#ef4444'; // Red for admin
        roleBadge.style.borderColor = '#ef4444';
        roleBadge.style.background = 'rgba(239,68,68,0.15)';
    }

    // Generate Mock Cryptographic visual string for fun aesthetic
    const randomHex = Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
    document.getElementById('connection-string').textContent = `[ENCRYPTED_SHA256]\n${randomHex}`;

    // Load API Resources
    fetchTelemetry();
    
    // Evaluate Admin Dashboard Need
    if (currentUser.role === 'admin') {
        document.getElementById('admin-panel').style.display = 'flex';
        fetchUserManifest();
    }
    
    // Attach event listeners
    document.getElementById('btn-refresh-telemetry')?.addEventListener('click', fetchTelemetry);
});

// Logout Event Listener
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('os_token');
    localStorage.removeItem('os_user');
    sessionStorage.removeItem('os_token');
    sessionStorage.removeItem('os_user');
    window.location.href = 'index.html';
});

// Toast System
function showErrorMap(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// Fetch Generic wrapper integrating bearing tokens
async function authFetch(endpoint) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed API sequence");
    return data;
}

// OS API Integration: Grab Mock Telemetry
async function fetchTelemetry() {
    const loader = document.getElementById('loader-telemetry');
    const dataList = document.getElementById('telemetry-data');
    
    loader.style.display = 'block';
    dataList.style.display = 'none';

    try {
        const response = await authFetch('/status');
        const tel = response.data;

        // Render Values
        document.getElementById('tel-os').textContent = tel.os_version;
        document.getElementById('tel-up').textContent = tel.uptime;
        document.getElementById('tel-mem').textContent = tel.memory_usage;
        document.getElementById('tel-disk').textContent = tel.disk_health;
        document.getElementById('tel-net').textContent = tel.network_status;
        
        document.getElementById('tel-cpu').textContent = tel.cpu_usage;
        document.getElementById('tel-cpu-bar').style.setProperty('--prog', tel.cpu_usage);

        loader.style.display = 'none';
        dataList.style.display = 'flex';
        
    } catch (err) {
        loader.textContent = "Telemetry Link Failed. " + err.message;
        if(err.message.includes('authorize')) {
            showErrorMap("Session expired. Please reconnect.");
        }
    }
}

// OS API Integration: Fetch User Identities (Admin only)
async function fetchUserManifest() {
    const tbody = document.getElementById('users-table-body');
    try {
        const response = await authFetch('/users');
        const users = response.data;
        
        tbody.innerHTML = '';
        users.forEach(user => {
            const dateStr = new Date(user.createdAt).toLocaleDateString();
            const badgeCls = user.role === 'admin' ? 'border: 1px solid #ef4444; color:#ef4444; background: rgba(239,68,68,0.1)' : 'border: 1px solid #10b981; color:#10b981; background: rgba(16,185,129,0.1)';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="primary font-medium">${user.username}</td>
                <td class="text-muted"><span class="mono">${user.email}</span></td>
                <td><span style="padding: 2px 8px; border-radius:4px; font-size:11px; text-transform:uppercase; ${badgeCls}">${user.role}</span></td>
                <td class="mono text-muted">${dateStr}</td>
            `;
            tbody.appendChild(tr);
        });

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4">No data retrieved.</td></tr>`;
        }
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Security Fault: ${err.message}</td></tr>`;
    }
}

// Security: Auto-logout Idle Timer (5 Minutes)
let idleTimeout;
function resetIdleTimer() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        localStorage.removeItem('os_token');
        localStorage.removeItem('os_user');
        sessionStorage.removeItem('os_token');
        sessionStorage.removeItem('os_user');
        window.location.href = 'index.html?msg=idle_timeout';
    }, 5 * 60 * 1000); // 5 minutes
}

// Listen for activity to reset timer
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => 
    document.addEventListener(evt, resetIdleTimer, true)
);

// Start initial timer
resetIdleTimer();
