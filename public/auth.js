// ==============================
// AUTHENTICATION & PWA
// ==============================

// Use unique variable name to avoid conflicts
let pwaInstallPrompt = null;

const tabs = document.querySelectorAll('.tab');
const forms = document.querySelectorAll('.auth-form');
const API_BASE = '/api/auth';

// Tab switching
tabs.forEach(tab => {
  tab.onclick = () => {
    tabs.forEach(t => t.classList.remove('active'));
    forms.forEach(f => f.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
    document.querySelectorAll('.error').forEach(el => el.textContent = '');
  };
});

// Login form
document.getElementById('loginForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const original = btn.innerHTML;
  const errorEl = document.getElementById('loginError');
  
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('loginUsername').value.trim(),
        password: document.getElementById('loginPassword').value
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.message || 'Login failed');
    
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    errorEl.textContent = 'Login successful! Redirecting...';
    errorEl.style.color = '#10b981';
    
    setTimeout(() => location.href = 'chat.html', 1000);
    
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
};

// Register form
document.getElementById('registerForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const original = btn.innerHTML;
  const errorEl = document.getElementById('registerError');
  const password = document.getElementById('registerPassword').value;
  
  if (password.length < 6) {
    errorEl.textContent = 'Password must be at least 6 characters';
    btn.innerHTML = original;
    btn.disabled = false;
    return;
  }
  
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: document.getElementById('registerUsername').value.trim(),
        email: document.getElementById('registerEmail').value.trim(),
        password: password
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    
    errorEl.textContent = data.message || 'Registration successful!';
    errorEl.style.color = '#10b981';
    
    setTimeout(() => {
      e.target.reset();
      tabs[0].click();
      errorEl.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    btn.innerHTML = original;
    btn.disabled = false;
  }
};

// Check token
if (localStorage.getItem('token')) {
  fetch(`${API_BASE}/me`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  })
  .then(res => {
    if (res.ok) location.href = 'chat.html';
    else localStorage.clear();
  })
  .catch(() => localStorage.clear());
}

// ==============================
// PWA INSTALLATION
// ==============================

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('✅ ServiceWorker registered with scope:', reg.scope);
      })
      .catch(err => {
        console.error('❌ ServiceWorker registration failed:', err);
      });
  });
}

// Install Prompt Event
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('🎯 beforeinstallprompt event fired!');
  
  // Prevent default prompt
  e.preventDefault();
  
  // Store the event
  pwaInstallPrompt = e;
  
  // Make it globally available
  window.pwaInstallPrompt = pwaInstallPrompt;
  
  console.log('✅ Install prompt stored. Will show in 3 seconds...');
  
  // Show install prompt after delay
  setTimeout(() => {
    if (pwaInstallPrompt && 
        !localStorage.getItem('installDismissed') &&
        !localStorage.getItem('appInstalled')) {
      
      console.log('📱 Showing install prompt');
      
      // Connect install button
      const installBtn = document.getElementById('installButton');
      if (installBtn) {
        installBtn.onclick = async () => {
          if (pwaInstallPrompt) {
            try {
              pwaInstallPrompt.prompt();
              const choice = await pwaInstallPrompt.userChoice;
              
              if (choice.outcome === 'accepted') {
                console.log('✅ User accepted installation');
                localStorage.setItem('appInstalled', 'true');
                showToast('App installed successfully!', 'success');
              } else {
                console.log('❌ User dismissed installation');
                localStorage.setItem('installDismissed', 'true');
              }
              
              // Hide the prompt
              document.getElementById('installContainer').style.display = 'none';
              pwaInstallPrompt = null;
              window.pwaInstallPrompt = null;
              
            } catch (error) {
              console.error('Install error:', error);
            }
          }
        };
      }
      
      // Show the container
      const container = document.getElementById('installContainer');
      if (container) {
        container.style.display = 'flex';
      }
    }
  }, 3000);
});

// App installed event
window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA was installed');
  localStorage.setItem('appInstalled', 'true');
  
  const container = document.getElementById('installContainer');
  if (container) {
    container.style.display = 'none';
  }
  
  showToast('App installed successfully!', 'success');
});

// Check if already running as PWA
if (window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone === true) {
  console.log('📱 Running as installed PWA');
  localStorage.setItem('appInstalled', 'true');
}

// Toast function
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : 
                type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Debug functions
window.testPWA = function() {
  console.log('🔧 PWA Debug:');
  console.log('- pwaInstallPrompt:', pwaInstallPrompt ? 'Available' : 'Not available');
  console.log('- window.pwaInstallPrompt:', window.pwaInstallPrompt ? 'Available' : 'Not available');
  console.log('- appInstalled:', localStorage.getItem('appInstalled'));
  console.log('- installDismissed:', localStorage.getItem('installDismissed'));
  console.log('- Display mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
  
  if (pwaInstallPrompt) {
    console.log('🎯 Triggering install prompt...');
    pwaInstallPrompt.prompt();
  } else {
    console.log('❌ No install prompt available');
    console.log('💡 Wait 3-5 seconds after page load');
  }
};

window.clearPWA = function() {
  console.log('🗑️ Clearing PWA data...');
  
  localStorage.removeItem('appInstalled');
  localStorage.removeItem('installDismissed');
  
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => r.unregister()));
  }
  
  console.log('✅ Cleared. Reloading...');
  setTimeout(() => location.reload(), 1000);
};

console.log('✅ auth.js loaded with PWA support');