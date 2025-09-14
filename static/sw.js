// Service Worker dla Grafik SP4600
const CACHE_NAME = 'grafiksp4600-v' + Date.now();
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

// Obsługa powiadomień push
self.addEventListener('push', event => {
  console.log('Push event received:', event);
  
  const options = {
    body: event.data ? event.data.text() : 'Nowa prośba w skrzynce',
    icon: '/static/PKN.WA.D.png',
    badge: '/static/PKN.WA.D.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Otwórz skrzynkę',
        icon: '/static/PKN.WA.D.png'
      },
      {
        action: 'close',
        title: 'Zamknij',
        icon: '/static/PKN.WA.D.png'
      }
    ],
    requireInteraction: true,
    tag: 'grafik-notification'
  };

  event.waitUntil(
    self.registration.showNotification('Grafik SP4600', options)
  );
});

// Obsługa kliknięć w powiadomienia
self.addEventListener('notificationclick', event => {
  console.log('Notification click received:', event);
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Tylko zamknij powiadomienie
    return;
  } else {
    // Domyślne zachowanie - otwórz aplikację
    event.waitUntil(
      clients.matchAll().then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});

// Background sync - sprawdzanie nowych próśb
self.addEventListener('sync', event => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForNewRequests());
  }
});

// Funkcja sprawdzania nowych próśb i zmian statusu
async function checkForNewRequests() {
  try {
    const response = await fetch('/api/swaps/inbox');
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      // Pobierz poprzednie statusy z IndexedDB lub localStorage
      const previousStatuses = await getPreviousStatuses();
      const currentStatuses = {};
      let hasChanges = false;
      let notificationMessage = '';
      
      // Sprawdź każdą prośbę
      data.items.forEach(item => {
        currentStatuses[item.id] = item.final_status;
        
        // Sprawdź czy status się zmienił
        if (previousStatuses[item.id] && previousStatuses[item.id] !== item.final_status) {
          hasChanges = true;
          const statusText = getStatusText(item.final_status);
          
          if (!notificationMessage) {
            notificationMessage = `Status prośby się zmienił: ${statusText}`;
          } else {
            notificationMessage += `, ${statusText}`;
          }
        }
        
        // Sprawdź nowe prośby
        if (!previousStatuses[item.id] && (item.final_status === 'OCZEKUJACE' || item.final_status === 'WSTEPNIE_ZATWIERDZONE')) {
          hasChanges = true;
          if (!notificationMessage) {
            notificationMessage = `Masz nową prośbę w skrzynce`;
          } else {
            notificationMessage += `, nowa prośba`;
          }
        }
      });
      
      // Zapisz aktualne statusy
      await savePreviousStatuses(currentStatuses);
      
      // Wyślij powiadomienie jeśli są zmiany
      if (hasChanges && notificationMessage) {
        self.registration.showNotification('Grafik SP4600', {
          body: notificationMessage,
          icon: '/static/PKN.WA.D.png',
          badge: '/static/PKN.WA.D.png',
          tag: 'grafik-notification',
          data: { url: '/' }
        });
      }
    }
  } catch (error) {
    console.error('Error checking for new requests:', error);
  }
}

// Funkcje pomocnicze do przechowywania statusów w Service Worker
async function getPreviousStatuses() {
  try {
    const cache = await caches.open('grafiksp4600-statuses');
    const response = await cache.match('/statuses');
    if (response) {
      return await response.json();
    }
  } catch (error) {
    console.error('Error getting previous statuses:', error);
  }
  return {};
}

async function savePreviousStatuses(statuses) {
  try {
    const cache = await caches.open('grafiksp4600-statuses');
    await cache.put('/statuses', new Response(JSON.stringify(statuses)));
  } catch (error) {
    console.error('Error saving previous statuses:', error);
  }
}

// Funkcja pomocnicza do mapowania statusów
function getStatusText(finalStatus) {
  switch (finalStatus) {
    case 'OCZEKUJACE': return 'Oczekujące';
    case 'WSTEPNIE_ZATWIERDZONE': return 'Wstępnie zatwierdzone';
    case 'ZATWIERDZONE': return 'Zatwierdzone';
    case 'ODRZUCONE': return 'Odrzucone';
    case 'ODRZUCONE_PRZEZ_SZEFA': return 'Odrzucone przez szefa';
    default: return finalStatus;
  }
}
