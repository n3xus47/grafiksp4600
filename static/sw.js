// Service Worker dla Grafik SP4600 PWA
const CACHE_NAME = 'grafik-sp4600-v1.0.0';
const CACHE_VERSION = 1;

// Pliki do cache'owania podczas instalacji
const STATIC_CACHE_URLS = [
  '/',
  '/static/style.css',
  '/static/app.js',
  '/static/manifest.json',
  '/static/PKN.WA.D.png',
  '/static/PKN.WA.D.svg',
  '/signin'
];

// Pliki API do cache'owania dynamicznie
const API_CACHE_PATTERNS = [
  '/api/employees',
  '/api/swaps/inbox',
  '/api/slot'
];

// Pliki które nie powinny być cache'owane
const NO_CACHE_PATTERNS = [
  '/api/save',
  '/api/swaps/respond',
  '/api/swaps/boss',
  '/api/swaps/clear',
  '/login',
  '/logout',
  '/auth/callback',
  '/authorize'
];

// Instalacja Service Workera
self.addEventListener('install', (event) => {
  console.log('Service Worker: Instalowanie...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache'owanie plików statycznych');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Zainstalowany');
        // Aktywuj natychmiast nowy service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Błąd podczas instalacji:', error);
      })
  );
});

// Aktywacja Service Workera
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Aktywowanie...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Usuń stare cache'e
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Usuwanie starego cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Aktywowany');
        // Przejmij kontrolę nad wszystkimi klientami
        return self.clients.claim();
      })
  );
});

// Przechwytywanie żądań sieciowych
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const pathname = requestUrl.pathname;
  
  // Sprawdź czy to żądanie które nie powinno być cache'owane
  const shouldNotCache = NO_CACHE_PATTERNS.some(pattern => pathname.includes(pattern));
  if (shouldNotCache) {
    // Przekaż żądanie bezpośrednio do sieci
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Sprawdź czy to żądanie POST/PUT/DELETE - nie cache'uj
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Cache First Strategy dla plików statycznych
  if (isStaticResource(pathname)) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then((response) => {
              // Sprawdź czy odpowiedź jest prawidłowa
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Sklonuj odpowiedź do cache'a
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            });
        })
        .catch(() => {
          // Zwróć offline page dla głównych stron
          if (pathname === '/' || pathname === '/signin') {
            return caches.match('/');
          }
        })
    );
    return;
  }
  
  // Network First Strategy dla API i dynamicznych treści
  if (isApiRequest(pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Sprawdź czy odpowiedź jest prawidłowa
          if (!response || response.status !== 200) {
            throw new Error('Network response was not ok');
          }
          
          // Cache'uj tylko GET requests dla API
          if (event.request.method === 'GET') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        })
        .catch(() => {
          // Spróbuj zwrócić z cache'a jeśli sieć nie działa
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              
              // Zwróć podstawową odpowiedź offline dla API
              return new Response(
                JSON.stringify({ 
                  error: 'Brak połączenia z internetem', 
                  offline: true 
                }), 
                {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }
  
  // Domyślna strategia - spróbuj sieci, potem cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Funkcje pomocnicze
function isStaticResource(pathname) {
  return pathname.startsWith('/static/') || 
         pathname === '/' || 
         pathname === '/signin' ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.ico');
}

function isApiRequest(pathname) {
  return pathname.startsWith('/api/');
}

// Obsługa komunikatów od głównej aplikacji
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    caches.open(CACHE_NAME)
      .then((cache) => cache.keys())
      .then((keys) => {
        event.ports[0].postMessage({
          type: 'CACHE_SIZE',
          size: keys.length,
          cacheName: CACHE_NAME
        });
      });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        event.ports[0].postMessage({
          type: 'CACHE_CLEARED',
          success: true
        });
      })
      .catch((error) => {
        event.ports[0].postMessage({
          type: 'CACHE_CLEARED',
          success: false,
          error: error.message
        });
      });
  }
});

// Obsługa synchronizacji w tle (Background Sync)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background Sync:', event.tag);
  
  if (event.tag === 'background-sync-shifts') {
    event.waitUntil(syncShifts());
  }
});

// Funkcja synchronizacji zmian
async function syncShifts() {
  try {
    // Pobierz dane z IndexedDB lub localStorage
    const pendingChanges = await getPendingChanges();
    
    if (pendingChanges && pendingChanges.length > 0) {
      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ changes: pendingChanges })
      });
      
      if (response.ok) {
        // Usuń zsynchronizowane zmiany
        await clearPendingChanges();
        console.log('Service Worker: Zmiany zsynchronizowane');
      }
    }
  } catch (error) {
    console.error('Service Worker: Błąd synchronizacji:', error);
  }
}

// Funkcje do obsługi offline storage (przykładowe)
async function getPendingChanges() {
  // Implementacja zależna od używanego storage
  return [];
}

async function clearPendingChanges() {
  // Implementacja zależna od używanego storage
  return true;
}

console.log('Service Worker: Załadowany');
