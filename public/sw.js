// Service Worker with Version-Based Caching
const APP_VERSION = '1.1.0'; // CHANGED FROM 1.0.0 TO 1.1.0
const CACHE_NAME = `chat-app-v${APP_VERSION}`;

// Files to cache immediately (App Shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/chat.html',
  '/auth.js',
  '/chat.js',
  '/style.css',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/version.json'
];

// ... REST OF YOUR sw.js CODE REMAINS THE SAME ...;

// ======================
// INSTALL EVENT
// ======================
self.addEventListener('install', event => {
  console.log(`📦 Installing PWA v${APP_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell...');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('App shell cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Cache installation failed:', error);
      })
  );
});

// ======================
// ACTIVATE EVENT
// ======================
self.addEventListener('activate', event => {
  console.log(`🔄 Activating PWA v${APP_VERSION}`);
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete old caches (keep current)
          if (cacheName !== CACHE_NAME && cacheName.startsWith('chat-app-')) {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Claiming clients...');
      return self.clients.claim();
    })
  );
});

// ======================
// FETCH EVENT
// ======================
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;
  
  // Skip API calls (always fetch fresh)
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    // Try cache first for static assets
    caches.match(event.request)
      .then(cachedResponse => {
        // Return cached version if found
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(response => {
            // Don't cache API responses
            if (!event.request.url.includes('/api/') && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // If offline and not in cache, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            return new Response('You are offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// ======================
// MESSAGE HANDLING
// ======================
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Skipping waiting to activate new service worker');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_FOR_UPDATES') {
    checkForUpdates();
  }
});

// ======================
// BACKGROUND SYNC
// ======================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    console.log('🔄 Background sync triggered');
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Implement offline message sync here
  console.log('Syncing messages...');
}

// ======================
// PUSH NOTIFICATIONS
// ======================
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || 'New message',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'ChatApp', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Check for updates function
async function checkForUpdates() {
  try {
    const response = await fetch('/version.json');
    const data = await response.json();
    
    if (data.version !== APP_VERSION) {
      console.log(`🔄 Update available: ${data.version}`);
      
      // Notify all clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          version: data.version,
          message: data.update_message || 'A new version is available'
        });
      });
    }
  } catch (error) {
    console.log('Update check failed:', error);
  }
}

// Periodically check for updates
self.addEventListener('periodicsync', event => {
  if (event.tag === 'check-updates') {
    console.log('📡 Periodic update check');
    event.waitUntil(checkForUpdates());
  }
});