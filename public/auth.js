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
    
    // Clear errors
    document.querySelectorAll('.error').forEach(el => el.textContent = '');
  };
});

// Login form
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');

loginForm.onsubmit = async e => {
  e.preventDefault();
  const submitBtn = loginForm.querySelector('button');
  const originalText = submitBtn.innerHTML;
  
  // Show loading state
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
  submitBtn.disabled = true;
  
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: loginUsername.value.trim(),
        password: loginPassword.value
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      loginError.textContent = data.message || 'Login failed';
      loginError.style.display = 'block';
      return;
    }
    
    // Store auth data
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    // Show success message
    loginError.textContent = 'Login successful! Redirecting...';
    loginError.style.color = '#10b981';
    loginError.style.display = 'block';
    
    // Redirect after delay
    setTimeout(() => {
      window.location.href = 'chat.html';
    }, 1000);
    
  } catch (error) {
    console.error('Login error:', error);
    loginError.textContent = 'Network error. Please try again.';
    loginError.style.display = 'block';
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
};

// Register form
const registerForm = document.getElementById('registerForm');
const registerUsername = document.getElementById('registerUsername');
const registerEmail = document.getElementById('registerEmail');
const registerPassword = document.getElementById('registerPassword');
const registerError = document.getElementById('registerError');

registerForm.onsubmit = async e => {
  e.preventDefault();
  const submitBtn = registerForm.querySelector('button');
  const originalText = submitBtn.innerHTML;
  
  // Show loading state
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
  submitBtn.disabled = true;
  
  // Validation
  if (registerPassword.value.length < 6) {
    registerError.textContent = 'Password must be at least 6 characters';
    registerError.style.display = 'block';
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: registerUsername.value.trim(),
        email: registerEmail.value.trim(),
        password: registerPassword.value
      })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      registerError.textContent = data.message || 'Registration failed';
      registerError.style.display = 'block';
      return;
    }
    
    // Show success message and switch to login
    registerError.textContent = data.message || 'Registration successful!';
    registerError.style.color = '#10b981';
    registerError.style.display = 'block';
    
    // Clear form and switch to login after delay
    setTimeout(() => {
      registerForm.reset();
      tabs[0].click();
      registerError.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    console.error('Registration error:', error);
    registerError.textContent = 'Network error. Please try again.';
    registerError.style.display = 'block';
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
};

// Form validation feedback
const formGroups = document.querySelectorAll('.form-group input');
formGroups.forEach(input => {
  input.addEventListener('focus', () => {
    input.parentElement.classList.add('focused');
  });
  
  input.addEventListener('blur', () => {
    input.parentElement.classList.remove('focused');
  });
});

// Check for existing token
window.addEventListener('load', () => {
  const token = localStorage.getItem('token');
  if (token) {
    // Verify token
    fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      if (res.ok) {
        window.location.href = 'chat.html';
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    })
    .catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });
  }
});



// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('New service worker found!');
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              showUpdateNotification();
            }
          });
        });
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

// Handle app updates
function showUpdateNotification() {
  if (confirm('A new version is available. Update now?')) {
    // Reload to activate new service worker
    window.location.reload();
  }
}

// Check if app is installed
function checkIfPWAInstalled() {
  // Method 1: Check display mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Method 2: Check iOS standalone
  const isIOSStandalone = window.navigator.standalone === true;
  
  // Method 3: Check URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const isFromShare = urlParams.has('share-target');
  
  return isStandalone || isIOSStandalone || isFromShare;
}

// Show install button if not installed
if (!checkIfPWAInstalled() && !localStorage.getItem('appInstalled')) {
  // Show install button in auth page
  const installBtn = document.createElement('button');
  installBtn.id = 'pwaInstallBtn';
  installBtn.className = 'pwa-install-btn';
  installBtn.innerHTML = '<i class="fas fa-download"></i> Install App';
  installBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #007AFF;
    color: white;
    border: none;
    border-radius: 50px;
    padding: 12px 20px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(0, 122, 255, 0.3);
    z-index: 1000;
  `;
  
  document.body.appendChild(installBtn);
  
  installBtn.addEventListener('click', () => {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      window.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          installBtn.style.display = 'none';
          localStorage.setItem('appInstalled', 'true');
        }
        window.deferredPrompt = null;
      });
    }
  });
}