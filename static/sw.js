// Service Worker dla Grafik SP4600
const CACHE_NAME = 'grafiksp4600-v1';
const urlsToCache = [
  '/',
  '/signin',
  '/static/style.css',
  '/static/app.js',
  '/static/PKN.WA.D.png',
  '/static/manifest.json'
];

// Instalacja Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache otwarty');
        return cache.addAll(urlsToCache);
      })
  );
});

// Aktywacja Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Usuwam stary cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptowanie żądań
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Zwróć z cache jeśli dostępne
        if (response) {
          return response;
        }
        
        // W przeciwnym razie spróbuj pobrać z sieci
        return fetch(event.request)
          .then(response => {
            // Sprawdź czy otrzymaliśmy poprawną odpowiedź
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Klonuj odpowiedź
            const responseToCache = response.clone();
            
            // Dodaj do cache
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Jeśli nie można pobrać z sieci, zwróć offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline');
            }
          });
      })
  );
});

// Obsługa wiadomości
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
