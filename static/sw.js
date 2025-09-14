// Service Worker dla Grafik SP4600 - PWA z Web Push Notifications
// Service Worker to skrypt który działa w tle przeglądarki i umożliwia:
// - Cachowanie plików (szybsze ładowanie)
// - Działanie offline
// - Web Push Notifications (powiadomienia push z serwera)

// Nazwa cache z aktualnym czasem - zapewnia że cache się odświeża przy każdej aktualizacji
const CACHE_NAME = 'grafiksp4600-v' + new Date().toISOString().replace(/[:.]/g, '-');

// Lista plików które mają być cachowane (przechowywane lokalnie)
const urlsToCache = [
  '/',                    // Strona główna
  '/signin',              // Strona logowania
  '/static/style.css',    // Arkusz stylów
  '/static/app.js',       // Główny plik JavaScript
  '/static/PKN.WA.D.png', // Logo Orlenu
  '/static/PKN.WA.D-192.png', // Ikona 192x192
  '/static/PKN.WA.D-512.png', // Ikona 512x512
  '/static/manifest.json' // Manifest PWA
];

// VAPID Public Key - musi być zgodny z kluczem na serwerze
const VAPID_PUBLIC_KEY = 'BIvhQxAeGQGHEfdZRg8c1DyFQ2i35xL-ZBlfVz8GO4u8UxSVbWeCVACXpBi7_L7nDQJl3nxMoIYSPNJDn8xOsBQ';

// Funkcja do konwersji VAPID public key z base64 na Uint8Array
const urlB64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

// Instalacja Service Worker - uruchamia się gdy przeglądarka instaluje SW
self.addEventListener('install', event => {
  console.log('Service Worker: Instalacja rozpoczęta');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache otwarty');
        return cache.addAll(urlsToCache);  // Dodaj wszystkie pliki do cache
      })
      .then(() => {
        console.log('Service Worker: Wszystkie pliki zostały zacachowane');
        return self.skipWaiting(); // Wymuś natychmiastową aktywację
      })
  );
});

// Aktywacja Service Worker - uruchamia się gdy SW staje się aktywny
self.addEventListener('activate', event => {
  console.log('Service Worker: Aktywacja rozpoczęta');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Usuwam stary cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Wymuś natychmiastowe przejęcie kontroli nad wszystkimi klientami
      return self.clients.claim();
    }).then(() => {
      // Zarejestruj się do Web Push po aktywacji
      return self.registration.pushManager.getSubscription().then(subscription => {
        if (!subscription) {
          console.log('Service Worker: Brak subskrypcji push, rejestruję...');
          return self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
          }).then(subscription => {
            console.log('Service Worker: Subskrypcja push utworzona:', subscription);
            return saveSubscriptionToServer(subscription);
          }).catch(error => {
            console.error('Service Worker: Błąd tworzenia subskrypcji push:', error);
            return null;
          });
        } else {
          console.log('Service Worker: Subskrypcja push już istnieje:', subscription);
          return subscription;
        }
      }).catch(error => {
        console.error('Service Worker: Błąd pobierania subskrypcji push:', error);
        return null;
      });
    })
  );
});

// Funkcja do zapisania subskrypcji na serwerze
const saveSubscriptionToServer = async (subscription) => {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('Service Worker: Subskrypcja zapisana na serwerze:', result);
      return result;
    } else {
      console.error('Service Worker: Błąd zapisywania subskrypcji:', response.status);
    }
  } catch (error) {
    console.error('Service Worker: Błąd podczas zapisywania subskrypcji:', error);
  }
};

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

// Obsługa wiadomości z głównego wątku
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'GET_SUBSCRIPTION') {
    // Zwróć aktualną subskrypcję do głównego wątku
    self.registration.pushManager.getSubscription().then(subscription => {
      event.ports[0].postMessage({ subscription: subscription });
    });
  } else if (event.data && event.data.type === 'SUBSCRIBE_PUSH') {
    // Zarejestruj się do push notifications
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
    }).then(subscription => {
      saveSubscriptionToServer(subscription);
      event.ports[0].postMessage({ success: true, subscription: subscription });
    }).catch(error => {
      console.error('Service Worker: Błąd subskrypcji push:', error);
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

// Obsługa powiadomień push z serwera
self.addEventListener('push', event => {
  console.log('Service Worker: Otrzymano push event:', event);
  
  let notificationData = {
    title: 'Grafik SP4600',
    body: 'Masz nową prośbę w skrzynce',
    icon: '/static/PKN.WA.D-192.png',
    badge: '/static/PKN.WA.D-192.png',
    data: {
      url: '/',
      timestamp: Date.now()
    }
  };
  
  // Jeśli push event zawiera dane, użyj ich
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData
      };
    } catch (error) {
      console.error('Service Worker: Błąd parsowania danych push:', error);
      // Użyj domyślnych danych
    }
  }
  
  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: [200, 100, 200],
    data: notificationData.data,
    actions: [
      {
        action: 'open',
        title: 'Otwórz aplikację',
        icon: '/static/PKN.WA.D-192.png'
      },
      {
        action: 'close',
        title: 'Zamknij',
        icon: '/static/PKN.WA.D-192.png'
      }
    ],
    requireInteraction: true,
    tag: 'grafik-notification'
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Obsługa kliknięć w powiadomienia
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Kliknięto w powiadomienie:', event);
  
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
          icon: '/static/PKN.WA.D-192.png',
          badge: '/static/PKN.WA.D-192.png',
          tag: 'grafik-notification',
          data: { url: '/' }
        });
      }
    }
  } catch (error) {
    console.error('Service Worker: Błąd sprawdzania nowych próśb:', error);
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
    console.error('Service Worker: Błąd pobierania poprzednich statusów:', error);
  }
  return {};
}

async function savePreviousStatuses(statuses) {
  try {
    const cache = await caches.open('grafiksp4600-statuses');
    await cache.put('/statuses', new Response(JSON.stringify(statuses)));
  } catch (error) {
    console.error('Service Worker: Błąd zapisywania statusów:', error);
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