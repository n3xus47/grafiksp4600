/**
 * Aplikacja do zarządzania grafikiem zmian pracowników
 * Główny plik JavaScript z funkcjonalnością edycji, zarządzania pracownikami i próśbami o zamianę
 * 
 * Ten plik zawiera całą logikę frontend - edycję grafików, zarządzanie pracownikami,
 * system wymian, powiadomienia PWA i inne funkcje interfejsu użytkownika.
 */

(function(){
  // Funkcja debounce - opóźnia wykonanie funkcji o określony czas
  // Używana żeby nie wykonywać funkcji zbyt często (np. przy wpisywaniu w pole tekstowe)
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Funkcja aktualizacji zegara - pokazuje aktualną datę i czas
  function updateClock() {
    const now = new Date();
    const tz = 'Europe/Warsaw';  // Strefa czasowa Polski
    
    // Sprawdź czy to telefon (szerokość < 600px) - na telefonach mniej miejsca
    const isMobile = window.innerWidth < 600;
    
    let datePart, timePart;
    
    if (isMobile) {
      // Krótka wersja dla telefonów - tylko dzień, miesiąc i godzina
      datePart = now.toLocaleDateString('pl-PL', {
        day: '2-digit', month: '2-digit', timeZone: tz
      });
      timePart = now.toLocaleTimeString('pl-PL', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
      });
    } else {
      // Pełna wersja dla większych ekranów - dzień tygodnia, data i godzina
      datePart = now.toLocaleDateString('pl-PL', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz
    });
      timePart = now.toLocaleTimeString('pl-PL', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
    });
    }
    
    // Znajdź element zegara na stronie i zaktualizuj go
    const clockElement = document.getElementById('clock');
    if (clockElement) {
      clockElement.textContent = `${datePart} ${timePart}`;
    }
  }
  
  // Inicjalizacja i aktualizacja zegara co sekundę
  updateClock();
  setInterval(updateClock, 1000);
  
  // Aktualizuj zegar przy zmianie rozmiaru okna
  window.addEventListener('resize', updateClock);
  
  // PWA Install Banner
  let deferredPrompt;
  let installBannerShown = false;

  // Wyświetl banner instalacji PWA
  function showInstallBanner() {
    if (installBannerShown || window.matchMedia('(display-mode: standalone)').matches) {
      return; // Nie pokazuj jeśli już pokazano lub aplikacja jest już zainstalowana
    }

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #d32f2f, #ff5722);
        color: white;
        padding: 16px;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      ">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="
            width: 48px;
            height: 48px;
            background: rgba(255,255,255,0.2);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
          ">📱</div>
          <div>
            <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">Zainstaluj aplikację</div>
            <div style="font-size: 14px; opacity: 0.9;">Dostęp offline i powiadomienia</div>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="pwa-install-dismiss" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
          ">Później</button>
          <button id="pwa-install-button" style="
            background: white;
            color: #d32f2f;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">Zainstaluj</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    installBannerShown = true;

    // Event listeners
    document.getElementById('pwa-install-button').addEventListener('click', () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('Użytkownik zaakceptował instalację PWA');
          }
          deferredPrompt = null;
          banner.remove();
        });
      }
    });

    document.getElementById('pwa-install-dismiss').addEventListener('click', () => {
      banner.remove();
    });

    // Auto-hide po 10 sekundach
    setTimeout(() => {
      if (banner.parentNode) {
        banner.remove();
      }
    }, 10000);
  }

  // Event listener dla beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  // Sprawdź czy aplikacja jest już zainstalowana
  window.addEventListener('appinstalled', () => {
    console.log('PWA zostało zainstalowane');
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.remove();
    }
    // Ukryj przycisk ręcznej instalacji
    const manualButton = document.getElementById('pwa-install-manual');
    if (manualButton) {
      manualButton.style.display = 'none';
    }
  });

  // Obsługa przycisku ręcznej instalacji
  document.addEventListener('DOMContentLoaded', () => {
    const manualButton = document.getElementById('pwa-install-manual');
    if (manualButton) {
      manualButton.addEventListener('click', () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              console.log('Użytkownik zaakceptował instalację PWA');
            }
            deferredPrompt = null;
          });
        } else {
          // Fallback - pokaż instrukcje
          alert('Aby zainstalować aplikację:\n\n1. Kliknij menu (3 kropki) w Chrome\n2. Wybierz "Zainstaluj aplikację"\n3. Kliknij "Zainstaluj"');
        }
      });
    }
  });

  // Pokaż przycisk ręcznej instalacji jeśli banner się nie pojawił
  setTimeout(() => {
    if (!installBannerShown && !window.matchMedia('(display-mode: standalone)').matches) {
      const manualButton = document.getElementById('pwa-install-manual');
      if (manualButton) {
        manualButton.style.display = 'block';
      }
    }
  }, 5000);
  
  // Funkcja podświetlenia dzisiejszego dnia w kolumnach DATA i DZIEŃ
  function highlightToday() {
    const now = new Date();
    const todayDay = now.getDate().toString().padStart(2, '0'); // Format DD
    
    // Mapowanie dni tygodnia - Python używa 'Czw', JavaScript 'czw'
    const dayNames = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];
    const todayDayName = dayNames[now.getDay() - 1]; // getDay() zwraca 1-7, ale array ma 0-6
    
    console.log('Szukam dnia:', todayDay, 'i nazwy:', todayDayName);
    
    // Usuń klasy 'today', 'dniowka', 'nocka' ze wszystkich elementów
    document.querySelectorAll('.col-date, .col-day, .slot').forEach(element => {
      element.classList.remove('today', 'dniowka', 'nocka');
    });
    
    // Znajdź wiersze z dzisiejszą datą i podświetl tylko te kolumny
    const table = document.querySelector('.table');
    if (table) {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const dateCell = row.querySelector('.col-date');
        const dayCell = row.querySelector('.col-day');
        
        if (dateCell && dayCell && dateCell.textContent.trim() === todayDay) {
          // To jest wiersz z dzisiejszą datą - podświetl WSZYSTKIE kolumny DATA, DZIEŃ i PODSUMOWANIE w tym wierszu
          const allDateCells = row.querySelectorAll('.col-date');
          const allDayCells = row.querySelectorAll('.col-day');
          const summaryCell = row.querySelector('.col-summary');
          
          allDateCells.forEach(cell => cell.classList.add('today'));
          allDayCells.forEach(cell => cell.classList.add('today'));
          if (summaryCell) summaryCell.classList.add('today');
          
          console.log('Podświetlono dzisiejszy wiersz - data:', dateCell.textContent.trim(), 'dzień:', dayCell.textContent.trim());
          
          // Podświetl komórki z pracownikami w tym wierszu
          const slots = row.querySelectorAll('.slot');
          slots.forEach(slot => {
            slot.classList.add('today');
            
            // Sprawdź czy komórka zawiera D, N lub międzyzmianę i dodaj odpowiednią klasę
            const content = slot.textContent.trim();
            if (content === 'D') {
              slot.classList.add('dniowka');
              console.log('Podświetlono D (dniówka) dla:', slot.getAttribute('data-employee'));
            } else if (content === 'N') {
              slot.classList.add('nocka');
              console.log('Podświetlono N (nocka) dla:', slot.getAttribute('data-employee'));
            } else if (content && content.startsWith('P ')) {
              // Międzyzmiana w formacie "P 10-22"
              slot.classList.add('poludniowka');
              console.log('Podświetlono międzyzmianę:', content, 'dla:', slot.getAttribute('data-employee'));
            } else if (content && content.length > 0) {
              // Własny napis - dodaj klasę custom
              slot.classList.add('custom-shift');
              console.log('Podświetlono własny napis:', content, 'dla:', slot.getAttribute('data-employee'));
            }
          });
        }
      });
    }
  }
  
  // Funkcja wyróżnienia zalogowanej osoby
  function highlightCurrentUser() {
    const table = document.querySelector('.table');
    if (table) {
      const currentUserName = table.getAttribute('data-current-user');
      console.log('Zalogowana osoba:', currentUserName);
      
      if (currentUserName) {
        // Znajdź nagłówek z imieniem zalogowanej osoby
        const headers = table.querySelectorAll('th.col-emp');
        headers.forEach(header => {
          if (header.textContent.trim() === currentUserName) {
            header.classList.add('current-user');
            console.log('Wyróżniono nagłówek dla:', currentUserName);
          }
        });
        
        // Znajdź wszystkie komórki z danymi zalogowanej osoby
        const slots = table.querySelectorAll('.slot');
        slots.forEach(slot => {
          const employeeName = slot.getAttribute('data-employee');
          if (employeeName === currentUserName) {
            slot.classList.add('current-user');
          }
        });
      }
    }
  }
  
  // Funkcja aktualizacji licznika zmian (tylko dla adminów)
  function updateSummary() {
    const table = document.querySelector('.table');
    if (table) {
      // Sprawdź czy użytkownik jest adminem (czy kolumna licznika istnieje)
      const summaryHeader = table.querySelector('.col-summary');
      if (!summaryHeader) return; // Nie jest adminem, nie aktualizuj
      
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const slots = row.querySelectorAll('.slot');
        let dniowkaCount = 0;
        let nockaCount = 0;
        let poludniowkaCount = 0;
        
        slots.forEach(slot => {
          const content = slot.textContent.trim();
          if (content === 'D') {
            dniowkaCount++;
          } else if (content === 'N') {
            nockaCount++;
          } else if (content && content.startsWith('P ')) {
            // Międzyzmiana w formacie "P 10-22"
            poludniowkaCount++;
          }
        });
        
        // Aktualizuj licznik w wierszu
        const dniowkaElement = row.querySelector('.dniowka-count');
        const nockaElement = row.querySelector('.nocka-count');
        const poludniowkaElement = row.querySelector('.poludniowka-count');
        
        if (dniowkaElement) dniowkaElement.textContent = dniowkaCount;
        if (nockaElement) nockaElement.textContent = nockaCount;
        if (poludniowkaElement) poludniowkaElement.textContent = poludniowkaCount;
      });
    }
  }
  
  // Uruchom podświetlenie
  highlightToday();
  highlightCurrentUser();
  updateSummary();
  setInterval(highlightToday, 60000); // Aktualizuj co minutę
})();

// Funkcja wymuszenia odświeżenia strony (z cache busting)
function forcePageRefresh() {
  console.log('Wymuszanie odświeżenia strony...');
  
  // Metoda 1: Wyczyść cache przeglądarki
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
    });
  }
  
  // Metoda 2: Wyczyść localStorage i sessionStorage
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) {
    console.warn('Nie udało się wyczyścić storage:', e);
  }
  
  // Metoda 3: Wymuszone odświeżenie z wyczyszczeniem cache
  if (window.location.reload) {
    window.location.reload(true);
  } else {
    // Metoda 4: Alternatywa dla starszych przeglądarek
    const separator = window.location.href.includes('?') ? '&' : '?';
    window.location.href = window.location.href + separator + 'refresh=' + new Date().getTime();
  }
}

// Funkcja do odświeżania danych w czasie rzeczywistym została usunięta
// Używamy prostszej metody - forcePageRefresh()

// Funkcja do wykrywania rozmiaru ekranu i dostosowywania interfejsu
function handleResponsiveDesign() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = width <= 768;
  const isTablet = width <= 1024 && width > 768;
  const isLandscape = width > height;
  
  console.log(`Ekran: ${width}x${height}, Mobile: ${isMobile}, Tablet: ${isTablet}, Landscape: ${isLandscape}`);
  
  // Dostosuj interfejs dla urządzeń mobilnych
  if (isMobile) {
    document.body.classList.add('mobile-view');
    
    // Na bardzo wąskich ekranach (poniżej 360px) ukryj boki, na szerszych zostaw
    if (width < 360) {
      const headerLeft = document.querySelector('.header-left');
      const headerRight = document.querySelector('.header-right');
      
      if (headerLeft) headerLeft.style.display = 'none';
      if (headerRight) headerRight.style.display = 'none';
    } else {
      // Na szerszych ekranach mobilnych pokaż wszystkie elementy
      const headerLeft = document.querySelector('.header-left');
      const headerRight = document.querySelector('.header-right');
      
      if (headerLeft) headerLeft.style.display = 'flex';
      if (headerRight) headerRight.style.display = 'flex';
    }
    
    // Dostosuj rozmiar przycisków dla dotyku
    const buttons = document.querySelectorAll('.btn, .nav-btn');
    buttons.forEach(btn => {
      btn.style.minHeight = '44px';
      btn.style.minWidth = '44px';
    });
    
    // Dostosuj tabelę dla małych ekranów
    const table = document.getElementById('grafik');
    if (table) {
      table.style.fontSize = '11px';
    }
    
  } else if (isTablet) {
    document.body.classList.add('tablet-view');
    document.body.classList.remove('mobile-view');
    
    // Przywróć elementy na tabletach
    const headerLeft = document.querySelector('.header-left');
    const headerRight = document.querySelector('.header-right');
    
    if (headerLeft) headerLeft.style.display = 'flex';
    if (headerRight) headerRight.style.display = 'flex';
    
  } else {
    document.body.classList.remove('mobile-view', 'tablet-view');
    
    // Przywróć wszystkie elementy na desktop
    const headerLeft = document.querySelector('.header-left');
    const headerRight = document.querySelector('.header-right');
    
    if (headerLeft) headerLeft.style.display = 'flex';
    if (headerRight) headerRight.style.display = 'flex';
  }
  
  // Dostosuj orientację landscape
  if (isLandscape && isMobile) {
    document.body.classList.add('landscape-mode');
  } else {
    document.body.classList.remove('landscape-mode');
  }
}

// Nasłuchuj zmian rozmiaru okna
window.addEventListener('resize', handleResponsiveDesign);
window.addEventListener('orientationchange', handleResponsiveDesign);

// ===== SYSTEM PWA I WEB PUSH NOTIFICATIONS =====

// Rejestracja Service Worker dla PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js')
      .then(registration => {
        console.log('Service Worker zarejestrowany:', registration);
        // Inicjalizuj Web Push po rejestracji Service Worker TYLKO jeśli użytkownik jest zalogowany
        // Sprawdź czy użytkownik jest zalogowany (sprawdź czy są elementy admin)
        const isLoggedIn = document.querySelector('[data-current-user]') !== null;
        if (isLoggedIn) {
          console.log('✅ Użytkownik jest zalogowany, inicjalizuję Web Push...');
          initializeWebPush();
        } else {
          console.log('⏳ Użytkownik nie jest zalogowany, pomijam inicjalizację Web Push');
        }
      })
      .catch(error => {
        console.log('Błąd rejestracji Service Worker:', error);
      });
  });
} else {
  console.log('Service Worker nie jest obsługiwany w tej przeglądarce');
}

// Przechwyć event instalacji PWA (jeśli dostępny)
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  console.log('PWA może być zainstalowana automatycznie');
  // Zapobiegaj automatycznemu wyświetleniu promptu
  e.preventDefault();
  // Zapisz event do późniejszego użycia
  deferredPrompt = e;
});

// Uniwersalna funkcja instalacji PWA
function installPWA() {
  // Sprawdź czy mamy dostęp do automatycznej instalacji
  if (deferredPrompt) {
    // Automatyczna instalacja (Chrome/Edge)
    deferredPrompt.prompt();
    
    // Czekaj na odpowiedź użytkownika
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Użytkownik zaakceptował instalację PWA');
      } else {
        console.log('Użytkownik odrzucił instalację PWA');
      }
      // Wyczyść deferredPrompt
      deferredPrompt = null;
    });
    return;
  }
  
  // Fallback - instrukcje dla urządzeń bez automatycznej instalacji
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  if (isIOS) {
    // Instrukcje dla iOS
    alert('Aby zainstalować aplikację na iPhone/iPad:\n\n1. Kliknij przycisk "Udostępnij" (kwadrat ze strzałką)\n2. Wybierz "Dodaj do ekranu głównego"\n3. Potwierdź dodanie\n\nAplikacja pojawi się na ekranie głównym!');
  } else if (isAndroid) {
    // Instrukcje dla Android
    alert('Aby zainstalować aplikację na Android:\n\n1. Kliknij menu Chrome (trzy kropki)\n2. Wybierz "Dodaj do ekranu głównego" lub "Zainstaluj aplikację"\n3. Potwierdź instalację\n\nAplikacja pojawi się na ekranie głównym!');
  } else {
    // Instrukcje dla desktop
    alert('Aby zainstalować aplikację na komputerze:\n\n1. Kliknij ikonę instalacji w pasku adresu przeglądarki\n2. LUB użyj menu przeglądarki → "Zainstaluj aplikację"\n3. Potwierdź instalację\n\nAplikacja zostanie zainstalowana jak zwykły program!');
  }
}

// ===== WEB PUSH NOTIFICATIONS =====

// Inicjalizacja Web Push Notifications
async function initializeWebPush() {
  console.log('🚀 Inicjalizacja Web Push Notifications...');
  
  // Sprawdź czy przeglądarka obsługuje powiadomienia
  if (!('Notification' in window)) {
    console.log('❌ Ta przeglądarka nie obsługuje powiadomień');
    return;
  }
  
  // Sprawdź czy service worker jest dostępny
  if (!('serviceWorker' in navigator)) {
    console.log('❌ Service Worker nie jest obsługiwany');
    return;
  }
  
  // Sprawdź czy Push API jest dostępne
  if (!('PushManager' in window)) {
    console.log('❌ Push API nie jest obsługiwane');
    return;
  }
  
  try {
    console.log('📡 Pobieranie klucza VAPID z serwera...');
    // Pobierz klucz publiczny VAPID z serwera
    const response = await fetch('/api/push/vapid-key');
    const data = await response.json();
    
    if (!data.public_key) {
      console.error('❌ Brak klucza VAPID z serwera');
      return;
    }
    console.log('✅ Klucz VAPID pobrany:', data.public_key.substring(0, 20) + '...');
    
    // Sprawdź czy powiadomienia są dozwolone
    console.log('🔔 Sprawdzanie uprawnień do powiadomień...');
    console.log('Aktualny status uprawnień:', Notification.permission);
    
    if (Notification.permission === 'default') {
      console.log('📝 Prośba o uprawnienia do powiadomień...');
      const permission = await Notification.requestPermission();
      console.log('📝 Uprawnienie do powiadomień:', permission);
      
      if (permission !== 'granted') {
        console.log('❌ Użytkownik nie zezwolił na powiadomienia');
        alert('❌ Powiadomienia zostały odrzucone!\n\nAby otrzymywać powiadomienia o zmianach w grafiku, musisz zezwolić na powiadomienia w przeglądarce.\n\nOdśwież stronę i kliknij "Zezwól" gdy przeglądarka zapyta.');
        return;
      }
    } else if (Notification.permission === 'denied') {
      console.log('❌ Powiadomienia są zablokowane');
      alert('❌ Powiadomienia są zablokowane!\n\nAby otrzymywać powiadomienia o zmianach w grafiku, musisz włączyć powiadomienia w ustawieniach przeglądarki.');
      return;
    }
    
    console.log('✅ Uprawnienia do powiadomień są włączone');
    
    // Sprawdź czy już mamy subskrypcję
    console.log('🔍 Sprawdzanie istniejącej subskrypcji...');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('🆕 Tworzenie nowej subskrypcji push...');
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(data.public_key)
      });
      console.log('✅ Subskrypcja push utworzona:', subscription);
      
      // Zapisz subskrypcję na serwerze
      console.log('💾 Zapisuję subskrypcję na serwerze...');
      await saveSubscriptionToServer(subscription);
    } else {
      console.log('✅ Subskrypcja push już istnieje:', subscription);
    }
    
    // Uruchom background sync
    if ('sync' in window.ServiceWorkerRegistration.prototype) {
      console.log('🔄 Rejestruję background sync...');
      registration.sync.register('check-notifications');
    }
    
    // Sprawdź nowe prośby co 30 sekund
    console.log('⏰ Uruchamiam sprawdzanie nowych prośb co 30 sekund...');
    setInterval(checkForNewRequests, 30000);
    
    console.log('🎉 Web Push Notifications zainicjalizowane pomyślnie!');
    alert('✅ Powiadomienia push zostały włączone!\n\nTeraz będziesz otrzymywać powiadomienia o zmianach w grafiku, nawet gdy aplikacja jest zamknięta.');
    
  } catch (error) {
    console.error('❌ Błąd inicjalizacji Web Push:', error);
    alert(`❌ Błąd inicjalizacji powiadomień: ${error.message}\n\nSprawdź konsolę przeglądarki (F12) aby zobaczyć szczegóły.`);
  }
}

// Funkcja do konwersji VAPID public key z base64 na Uint8Array
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Zapisanie subskrypcji na serwerze
async function saveSubscriptionToServer(subscription) {
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
      console.log('Subskrypcja zapisana na serwerze:', result);
      return result;
    } else {
      console.error('Błąd zapisywania subskrypcji:', response.status);
    }
  } catch (error) {
    console.error('Błąd podczas zapisywania subskrypcji:', error);
  }
}

// Sprawdzanie nowych próśb i zmian statusu
async function checkForNewRequests() {
  try {
    const response = await fetch('/api/swaps/inbox');
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      // Pobierz poprzednie statusy z localStorage
      const previousStatuses = JSON.parse(localStorage.getItem('previousStatuses') || '{}');
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
      localStorage.setItem('previousStatuses', JSON.stringify(currentStatuses));
      
      // Wyślij powiadomienie jeśli są zmiany
      if (hasChanges && notificationMessage) {
        showLocalNotification('Grafik SP4600', notificationMessage);
      }
    }
  } catch (error) {
    console.error('Błąd sprawdzania nowych próśb:', error);
  }
}

// Funkcja do wyświetlania lokalnych powiadomień
function showLocalNotification(title, body) {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body: body,
      icon: '/static/PKN.WA.D-192.png',
      badge: '/static/PKN.WA.D-192.png',
      tag: 'grafik-notification'
    });
    
    // Automatycznie zamknij powiadomienie po 5 sekundach
    setTimeout(() => {
      notification.close();
    }, 5000);
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

// Funkcja do testowania powiadomień (tylko dla adminów)
async function testPushNotification() {
  try {
    console.log('Rozpoczynam test powiadomień push...');
    
    const response = await fetch('/api/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Test powiadomienia',
        body: 'To jest testowe powiadomienie push'
      }),
    });
    
    console.log('Odpowiedź serwera:', response.status, response.statusText);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Test powiadomienia:', result);
      alert('✅ Powiadomienie testowe wysłane pomyślnie!');
    } else {
      const errorData = await response.json().catch(() => ({ error: 'Nieznany błąd' }));
      console.error('Błąd wysyłania testowego powiadomienia:', response.status, errorData);
      
      if (response.status === 400 && errorData.error === 'Brak subskrypcji push') {
        alert('❌ Błąd: Brak subskrypcji push!\n\nMusisz najpierw zaakceptować powiadomienia w przeglądarce.\n\n1. Odśwież stronę\n2. Zaakceptuj powiadomienia gdy przeglądarka zapyta\n3. Spróbuj ponownie');
      } else if (response.status === 302) {
        alert('❌ Błąd: Nie jesteś zalogowany!\n\nZaloguj się ponownie i spróbuj jeszcze raz.');
      } else {
        alert(`❌ Błąd wysyłania powiadomienia (${response.status}):\n${errorData.error || 'Nieznany błąd'}`);
      }
    }
  } catch (error) {
    console.error('Błąd podczas testowania powiadomień:', error);
    alert(`❌ Błąd połączenia: ${error.message}\n\nSprawdź połączenie internetowe i spróbuj ponownie.`);
  }
}

// Główna funkcja aplikacji
document.addEventListener('DOMContentLoaded', function() {
  console.log('Aplikacja została załadowana');
  
  // Inicjalizuj responsywny design
  handleResponsiveDesign();
  
  // Inicjalizuj Web Push jeśli użytkownik jest zalogowany
  const isLoggedIn = document.querySelector('[data-current-user]') !== null;
  if (isLoggedIn) {
    console.log('✅ Użytkownik jest zalogowany w DOMContentLoaded, inicjalizuję Web Push...');
    // Poczekaj chwilę żeby Service Worker się zarejestrował
    setTimeout(() => {
      initializeWebPush();
    }, 1000);
  } else {
    console.log('⏳ Użytkownik nie jest zalogowany w DOMContentLoaded');
  }
  
  // Pobierz wszystkie potrzebne elementy DOM
  const table = document.getElementById('grafik');
  const btnToggle = document.getElementById('btn-edit');
  const editor = document.getElementById('slot-editor');
  const todayActions = document.getElementById('today-actions');
  const input = document.getElementById('opt-custom');
  const btnSaveToday = document.getElementById('save-today');
  const btnCancelToday = document.getElementById('cancel-today');
  const pHoursPanel = document.getElementById('p-hours-panel');
  const pStartHour = document.getElementById('p-start-hour');
  const pEndHour = document.getElementById('p-end-hour');
  const pConfirm = document.getElementById('p-confirm');
  const btnEmps = document.getElementById('btn-emps');
  const empEditor = document.getElementById('emp-editor');
  const empList = document.getElementById('emp-list');
  const empName = document.getElementById('emp-name');
  const empCode = document.getElementById('emp-code');
  const empAddBtn = document.getElementById('emp-add-btn');
  const empClose = document.getElementById('emp-close');
  const btnSwaps = document.getElementById('btn-swaps-admin') || document.getElementById('btn-swaps-user');
  const swapEditor = document.getElementById('swap-editor');
  const swapClose = document.getElementById('swap-close');
  const swapList = document.getElementById('swap-list');
  const swapClear = document.getElementById('swap-clear');
  // Elementy dla zunifikowanego panelu zmian
  const btnShifts = document.getElementById('btn-shifts');
  const shiftsEditor = document.getElementById('shifts-editor');
  const shiftsClose = document.getElementById('shifts-close');
  const shiftsCancel = document.getElementById('shifts-cancel');
  const shiftsSend = document.getElementById('shifts-send');
  const shiftsComment = document.getElementById('shifts-comment');
  
  // Elementy formularza zamiany
  const shiftsFromName = document.getElementById('shifts-from-name');
  const shiftsFromDate = document.getElementById('shifts-from-date');
  const shiftsToName = document.getElementById('shifts-to-name');
  const shiftsToDate = document.getElementById('shifts-to-date');
  
  // Elementy formularza oddania
  const shiftsGiveFromName = document.getElementById('shifts-give-from-name');
  const shiftsGiveFromDate = document.getElementById('shifts-give-from-date');
  const shiftsGiveToName = document.getElementById('shifts-give-to-name');
  
  // Elementy formularza zabrania
  const shiftsTakeFromName = document.getElementById('shifts-take-from-name');
  const shiftsTakeFromDate = document.getElementById('shifts-take-from-date');
  
  // Radio buttons dla wyboru typu operacji
  const shiftTypeRadios = document.querySelectorAll('input[name="shift-type"]');
  
  // Stare elementy (dla kompatybilności wstecznej)
  const composeFromName = null;
  const composeFromDate = null;
  const composeToName = null;
  const composeToDate = null;
  const composeComment = null;
  const composeEditor = null;
  const giveFromName = null;
  const giveFromDate = null;
  const giveToName = null;
  const giveComment = null;
  const giveEditor = null;

  const swapCompose = document.getElementById('swap-compose');
  const swapCommentInline = document.getElementById('swap-comment-inline');
  const swapSendInline = document.getElementById('swap-send-inline');

  // Zmienne stanu aplikacji
  let editMode = false;
  const pending = new Map();
  const todayD = document.getElementById('list-d');
  const todayN = document.getElementById('list-n');
  
  // Zmienne dla wielokrotnego wyboru
  let selectedCells = new Set();
  let isMultiSelect = false;
  let justDeleted = false; // Flaga żeby nie pokazywać pomarańczowego po usunięciu

  // Funkcje pomocnicze
  function showEditorAt(cell) {
    const rect = cell.getBoundingClientRect();
    const wrapRect = table.getBoundingClientRect();
    editor.style.left = `${rect.left - wrapRect.left + rect.width/2 - 44}px`;
    editor.style.top = `${rect.top - wrapRect.top + rect.height + 4}px`;
    editor.classList.add('show');
    input.value = '';
    editor.dataset.target = `${cell.dataset.date}|${cell.dataset.employee}`;
    
    // Usuń pomarańczowe świecenie ze wszystkich innych komórek
    const allEditingCells = table.querySelectorAll('.slot.editing');
    allEditingCells.forEach(otherCell => {
      if (otherCell !== cell) {
        otherCell.classList.remove('editing');
      }
    });
    
    // Dodaj pomarańczowe pulsowanie tylko do tej komórki, ale NIE jeśli właśnie usunęliśmy zmianę
    if (!justDeleted) {
      cell.classList.add('editing');
    }
  }
  
  function hideEditor() { 
    editor.classList.remove('show');
    
    // Usuń pulsowanie ze wszystkich komórek
    const editingCells = table.querySelectorAll('.slot.editing');
    editingCells.forEach(cell => cell.classList.remove('editing'));
    
    // Wyczyść wielokrotny wybór
    clearMultiSelect();
  }
  
  function setCellValue(cell, value) { 
    cell.textContent = value; 
    cell.dataset.value = value;
    
    // Usuń pulsowanie i dodaj odpowiednią animację
    cell.classList.remove('editing');
    
    // Usuń wszystkie klasy typów zmian
    cell.classList.remove('dniowka', 'nocka', 'custom-shift', 'poludniowka');
    
    if (value === '') {
      // Czerwone mryganie po usunięciu
      cell.classList.add('deleted');
      setTimeout(() => cell.classList.remove('deleted'), 800);
      // Ustaw flagę żeby nie pokazywać pomarańczowego
      justDeleted = true;
      setTimeout(() => justDeleted = false, 2000); // Resetuj flagę po 2s
    } else {
      // Dodaj odpowiednią klasę dla stylowania
      if (value === 'D') {
        cell.classList.add('dniowka');
      } else if (value === 'N') {
        cell.classList.add('nocka');
      } else if (value.startsWith('P ')) {
        cell.classList.add('poludniowka');
      } else if (value.length > 0) {
        cell.classList.add('custom-shift');
      }
      
      // Zielone mryganie po zapisaniu
      cell.classList.add('saved');
      setTimeout(() => cell.classList.remove('saved'), 800);
    }
  }
  
  // Funkcja do czyszczenia wielokrotnego wyboru
  function clearMultiSelect() {
    selectedCells.forEach(cell => {
      cell.classList.remove('selected');
    });
    selectedCells.clear();
    isMultiSelect = false;
  }
  
  // Funkcja do dodawania/usuwa komórki z wyboru
  function toggleCellSelection(cell) {
    if (selectedCells.has(cell)) {
      selectedCells.delete(cell);
      cell.classList.remove('selected');
    } else {
      selectedCells.add(cell);
      cell.classList.add('selected');
    }
    
    // Aktualizuj target edytora dla wielokrotnego wyboru
    if (selectedCells.size > 0) {
      const firstCell = Array.from(selectedCells)[0];
      editor.dataset.target = `${firstCell.dataset.date}|${firstCell.dataset.employee}`;
      editor.dataset.multiSelect = 'true';
    }
  }
  
  function k(date, name) { 
    return `${date}|${name}` 
  }

  // Główna funkcja obsługi kliknięć w komórki
  function onCellClick(e) {
    const cell = e.target.closest('.slot');
    if (!cell) return;
    
    const currentUser = (table.getAttribute('data-current-user') || '').trim();
    
    // Jeśli w trybie edycji -> zachowanie edycyjne
    if (editMode) {
      // Sprawdź czy trzymany jest Ctrl (wielokrotny wybór)
      if (e.ctrlKey || e.metaKey) {
        toggleCellSelection(cell);
        
        // Jeśli to pierwsza komórka, pokaż edytor
        if (selectedCells.size === 1) {
          showEditorAt(cell);
        }
        return;
      }
      
      // Pojedynczy wybór - wyczyść poprzedni wielokrotny wybór
      clearMultiSelect();
      
      // Sprawdź czy klikamy na inną komórkę niż obecnie edytowana
      const currentlyEditing = table.querySelector('.slot.editing');
      if (currentlyEditing && currentlyEditing !== cell) {
        // Zamykamy poprzednią edycję
        hideEditor();
        currentlyEditing.classList.remove('editing');
      }
      
      const cur = (cell.dataset.value || '').trim();
      if (cur) {
        // Pierwsze kliknięcie - usuń zawartość ale NIE pokazuj edytora
        setCellValue(cell, '');
        pending.set(k(cell.dataset.date, cell.dataset.employee), '');
        return;
      }
      
      // Drugie kliknięcie na pustą komórkę - pokaż edytor
      if (!justDeleted) {
        showEditorAt(cell);
      } else {
        // Jeśli właśnie usunęliśmy, tylko pokaż małe okienko bez pomarańczowego
        const rect = cell.getBoundingClientRect();
        const wrapRect = table.getBoundingClientRect();
        editor.style.left = `${rect.left - wrapRect.left + rect.width/2 - 44}px`;
        editor.style.top = `${rect.top - wrapRect.top + rect.height + 4}px`;
        editor.classList.add('show');
        input.value = '';
        editor.dataset.target = `${cell.dataset.date}|${cell.dataset.employee}`;
        // NIE dodawaj klasy 'editing' (brak pomarańczowego)
      }
      
      // Dla własnej komórki pokaż składanie prośby inline
      const isOwn = currentUser && currentUser === cell.dataset.employee;
      swapCompose.classList.toggle('show', !!isOwn);
      if (isOwn) {
        swapCommentInline.value = '';
        swapSendInline.onclick = () => {
          const from_date = cell.dataset.date;
          const from_employee = cell.dataset.employee;
          const to_date = prompt('Data do zamiany (YYYY-MM-DD):');
          const to_employee = prompt('Imię osoby do zamiany:');
          if (!to_date || !to_employee) return;
          const comment = (swapCommentInline.value || '').trim();
          
          // Walidacja formatu daty
          if (!/^\d{4}-\d{2}-\d{2}$/.test(to_date)) {
            alert('Nieprawidłowy format daty. Użyj YYYY-MM-DD');
            return;
          }
          
          fetch('/api/swaps', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ from_date, from_employee, to_date, to_employee, comment }),
            credentials: 'include'
          })
          .then(r => r.json())
          .then(data => { 
            if (data.error) {
              alert('Błąd: ' + data.error);
            } else {
              swapCompose.classList.remove('show');
              alert('Prośba o zamianę została wysłana!');
            }
          })
          .catch(error => {
            console.error('Błąd podczas wysyłania prośby:', error);
            alert('Wystąpił błąd podczas wysyłania prośby');
          });
        };
      }
      return;
    }
    
    // Poza trybem edycji: umożliw tylko składanie prośby dla swojej komórki
    const isOwn = currentUser && currentUser === cell.dataset.employee;
    swapCompose.classList.toggle('show', !!isOwn);
    if (isOwn) {
      swapCommentInline.value = '';
      swapSendInline.onclick = () => {
        const from_date = cell.dataset.date;
        const from_employee = cell.dataset.employee;
        const to_date = prompt('Data do zamiany (YYYY-MM-DD):');
        const to_employee = prompt('Imię osoby do zamiany:');
        if (!to_date || !to_employee) return;
        const comment = (swapCommentInline.value || '').trim();
        
        // Walidacja formatu daty
        if (!/^\d{4}-\d{2}-\d{2}$/.test(to_date)) {
          alert('Nieprawidłowy format daty. Użyj YYYY-MM-DD');
          return;
        }
        
        fetch('/api/swaps', { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ from_date, from_employee, to_date, to_employee, comment }),
          credentials: 'include'
        })
        .then(r => r.json())
        .then(data => { 
          if (data.error) {
            alert('Błąd: ' + data.error);
          } else {
            swapCompose.classList.remove('show');
            alert('Prośba o zamianę została wysłana!');
          }
        })
        .catch(error => {
          console.error('Błąd podczas wysyłania prośby:', error);
          alert('Wystąpił błąd podczas wysyłania prośby');
        });
      };
    }
  }

  // Funkcja wyboru wartości w edytorze
  function choose(value) {
    const target = editor.dataset.target || '';
    const [date, name] = target.split('|');
    if (!date || !name) return;
    
    // Sprawdź czy to wielokrotny wybór
    const isMultiSelect = editor.dataset.multiSelect === 'true';
    
    if (isMultiSelect && selectedCells.size > 0) {
      // Wielokrotny wybór - zastosuj wartość do wszystkich zaznaczonych komórek
      selectedCells.forEach(cell => {
        setCellValue(cell, value);
        pending.set(k(cell.dataset.date, cell.dataset.employee), value);
      });
      
      // Wyczyść wielokrotny wybór
      clearMultiSelect();
    } else {
      // Pojedynczy wybór - standardowe zachowanie
      const cell = table.querySelector(`.slot[data-date="${date}"][data-employee="${name}"]`);
      if (!cell) return;
      setCellValue(cell, value);
      pending.set(k(date, name), value);
    }
    
    // Ukryj panel godzin międzyzmiany jeśli był otwarty
    if (pHoursPanel) {
      pHoursPanel.classList.add('hidden');
      pStartHour.value = '';
      pEndHour.value = '';
    }
    
    hideEditor();

    // Aktualizacja panelu "Dzisiejsza zmiana" jeśli edytujemy dzisiejszą datę i wartość D/N
    try {
      const tblYear = parseInt(table.getAttribute('data-year'), 10);
      const tblMonth = parseInt(table.getAttribute('data-month'), 10);
      const [y, m, d] = date.split('-').map(x => parseInt(x, 10));
      const now = new Date();
      const isToday = (y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate());
      
      if (isToday && (value === 'D' || value === 'N' || (value && value.length > 0))) {
        let wrap;
        if (value === 'D') {
          wrap = todayD;
        } else if (value === 'N') {
          wrap = todayN;
        } else {
          // Własny napis - dodaj do dniówki
          wrap = todayD;
        }
        if (wrap) {
          let list = wrap.querySelector('ul');
          let empty = wrap.querySelector('p.muted');
          if (!list) { 
            list = document.createElement('ul'); 
            wrap.innerHTML = ''; 
            wrap.appendChild(list); 
          }
          if (empty) { 
            empty.remove(); 
          }
          
          // Traktuj "Ania i Bożena" jako jedną pozycję
          const names = [name];
          for (const nm of names) {
            const li = document.createElement('li');
            li.textContent = value === 'D' || value === 'N' ? nm : `${nm} (${value})`;
            list.appendChild(li);
          }
          
          // Sortuj alfabetycznie
          const items = Array.from(list.querySelectorAll('li'))
            .map(li => li.textContent)
            .sort((a, b) => a.localeCompare(b, 'pl'));
          list.innerHTML = '';
          for (const text of items) { 
            const li = document.createElement('li'); 
            li.textContent = text; 
            list.appendChild(li); 
          }
        }
      }
    } catch (error) {
      console.warn('Błąd podczas aktualizacji panelu dzisiejszych zmian:', error);
    }
  }

  // Event listeners dla edytora
  editor.addEventListener('click', (e) => {
    const b = e.target.closest('button.opt');
    if (b) {
      const value = b.dataset.value;
      if (value === 'P') {
        // Pokaż panel wyboru godzin dla międzyzmiany
        pHoursPanel.classList.remove('hidden');
        pStartHour.focus();
      } else {
        choose(value);
      }
    }
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      choose(input.value.trim());
    }
  });

  // Walidacja pól godzin - tylko cyfry
  pStartHour.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });
  
  pEndHour.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  });

  // Obsługa potwierdzenia godzin międzyzmiany
  pConfirm.addEventListener('click', () => {
    const startHour = parseInt(pStartHour.value);
    const endHour = parseInt(pEndHour.value);
    
    if (isNaN(startHour) || isNaN(endHour)) {
      alert('Proszę podać prawidłowe godziny');
      return;
    }
    
    if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23) {
      alert('Godziny muszą być w zakresie 0-23');
      return;
    }
    
    if (startHour >= endHour) {
      alert('Godzina końca musi być późniejsza niż godzina startu');
      return;
    }
    
    // Utwórz wartość międzyzmiany w formacie "P 10-22"
    const pValue = `P ${startHour}-${endHour}`;
    choose(pValue);
  });

  // Funkcje trybu edycji
  function toggleEdit() {
    // Użyj requestAnimationFrame dla lepszej wydajności
    requestAnimationFrame(() => {
      editMode = !editMode;
      if (todayActions) todayActions.classList.toggle('hidden', !editMode);
      
      // Dodaj/usuń klasę edit-mode na body dla delikatnego mrygania
      document.body.classList.toggle('edit-mode', editMode);
      
      if (!editMode) { 
        pending.clear(); 
        hideEditor(); 
      }
    });
  }

  function save() {
    const finish = () => {
      pending.clear();
      editMode = false;
      if (todayActions) todayActions.classList.add('hidden');
      document.body.classList.remove('edit-mode'); // Usuń klasę edit-mode
      hideEditor();
    };
    
    if (!pending.size) {
      // Brak zmian – tylko wyjdź z trybu edycji
      finish();
      return;
    }
    
    const changes = Array.from(pending, ([kk, v]) => {
      const [date, name] = kk.split('|');
      return { date, name, value: v };
    });
    
    fetch('/api/save', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes }),
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        alert('Błąd podczas zapisywania: ' + data.error);
      } else {
        finish();
        if (data.status === 'partial') {
          alert(`Zapisano ${data.saved_count} zmian z ${data.errors.length} błędami`);
        } else {
          alert('Zmiany zostały zapisane pomyślnie!');
        }
      }
    })
    .catch(error => {
      console.error('Błąd podczas zapisywania:', error);
      alert('Wystąpił błąd podczas zapisywania zmian');
    });
  }
  
  function cancel() {
    editMode = false;
    if (todayActions) todayActions.classList.add('hidden');
    document.body.classList.remove('edit-mode'); // Usuń klasę edit-mode
    hideEditor();
    location.reload();
  }

  // Event listeners dla przycisków edycji
  console.log('Debug - btnToggle:', btnToggle);
  console.log('Debug - btnEmps:', btnEmps);
  console.log('Debug - btnSwaps:', btnSwaps);
  console.log('Debug - btnShifts:', btnShifts);
  console.log('Debug - shiftsEditor:', shiftsEditor);
  console.log('Debug - btn-shifts element:', document.getElementById('btn-shifts'));
  console.log('Debug - shifts-editor element:', document.getElementById('shifts-editor'));
  
  // Sprawdź czy wszystkie przyciski funkcji są znalezione
  console.log('Debug - btn-swaps-admin:', document.getElementById('btn-swaps-admin'));
  console.log('Debug - btn-swaps-user:', document.getElementById('btn-swaps-user'));
  console.log('Debug - btn-edit:', document.getElementById('btn-edit'));
  console.log('Debug - btn-shifts:', document.getElementById('btn-shifts'));
  
  if (btnToggle) btnToggle.addEventListener('click', toggleEdit);
  if (table) table.addEventListener('click', onCellClick);
  if (btnSaveToday) btnSaveToday.addEventListener('click', save);
  if (btnCancelToday) btnCancelToday.addEventListener('click', cancel);
  
  document.addEventListener('click', (e) => {
    if (!editor.classList.contains('show')) return;
    if (!e.target.closest('#slot-editor') && !e.target.closest('.slot')) hideEditor();
  });

  // --- Zarządzanie pracownikami ---
  function renderEmployees(items) {
    // Użyj requestAnimationFrame dla lepszej wydajności
    requestAnimationFrame(() => {
      // Użyj DocumentFragment dla lepszej wydajności
      const fragment = document.createDocumentFragment();
      
      for (const emp of items) {
        const row = document.createElement('div');
        row.className = 'emp-row';
        row.innerHTML = `
          <div>${emp.name} <span class="meta">(${emp.code || '-'})</span></div>
          <div class="emp-actions">
            <button data-id="${emp.id}" class="btn btn-edit">Edytuj</button>
            <button data-id="${emp.id}" class="btn">Usuń</button>
          </div>
        `;
        
        // Przycisk edycji
        row.querySelector('.btn-edit').addEventListener('click', () => {
          showEditEmployeeDialog(emp);
        });
        
        // Przycisk usuwania
        row.querySelector('.btn:not(.btn-edit)').addEventListener('click', () => {
          if (confirm(`Czy na pewno chcesz usunąć pracownika "${emp.name}"?`)) {
            fetch(`/api/employees/${emp.id}`, { method: 'DELETE' })
              .then(response => response.json())
              .then(data => {
                if (data.error) {
                  alert('Błąd podczas usuwania: ' + data.error);
                } else {
                  // Zaktualizuj cache
                  employeesCache = employeesCache.filter(e => e.id !== emp.id);
                  employeesCacheTime = Date.now();
                  loadEmployees();
                  alert('Pracownik został usunięty');
                }
              })
              .catch(error => {
                console.error('Błąd podczas usuwania pracownika:', error);
                alert('Wystąpił błąd podczas usuwania pracownika');
              });
          }
        });
        
        fragment.appendChild(row);
      }
      
      // Wyczyść i dodaj wszystkie elementy jednocześnie
      empList.innerHTML = '';
      empList.appendChild(fragment);
    });
  }
  
  function showEditEmployeeDialog(emp) {
    // Utwórz dialog edycji
    const dialog = document.createElement('div');
    dialog.className = 'emp-editor show';
    dialog.innerHTML = `
      <div class="emp-container">
        <button type="button" class="emp-close" aria-label="Zamknij">✕</button>
        <div class="emp-head">Edytuj pracownika</div>
        <div class="emp-edit-form">
          <div class="emp-add">
            <input id="edit-emp-name" placeholder="imię" value="${emp.name}" />
            <input id="edit-emp-code" placeholder="id" value="${emp.code || ''}" />
          </div>
          <div class="emp-edit-actions">
            <button id="edit-emp-save" class="btn">Zapisz</button>
            <button id="edit-emp-cancel" class="btn">Anuluj</button>
          </div>
        </div>
      </div>
    `;
    
    // Dodaj do body
    document.body.appendChild(dialog);
    
    // Event listeners
    const closeBtn = dialog.querySelector('.emp-close');
    const cancelBtn = dialog.querySelector('#edit-emp-cancel');
    const saveBtn = dialog.querySelector('#edit-emp-save');
    const nameInput = dialog.querySelector('#edit-emp-name');
    const codeInput = dialog.querySelector('#edit-emp-code');
    
    function closeDialog() {
      dialog.remove();
    }
    
    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeDialog();
    });
    
    // Zapisz zmiany
    saveBtn.addEventListener('click', () => {
      const newName = nameInput.value.trim();
      const newCode = codeInput.value.trim();
      
      if (!newName || !newCode) {
        alert('Imię i ID są wymagane');
        return;
      }
      
      fetch(`/api/employees/${emp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, code: newCode })
      })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(data.error || 'Błąd podczas edycji');
        }
        return data;
      })
      .then(() => {
        closeDialog();
        loadEmployees(); // Odśwież listę
        alert('Pracownik został zaktualizowany!');
      })
      .catch((err) => {
        alert('Błąd: ' + err.message);
      });
    });
    
    // Enter w polach
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
    });
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
    });
  }
  
  function loadEmployees() {
    fetch('/api/employees', { credentials: 'include' })
      .then(response => response.json())
      .then(data => { 
        if (data.error) {
          throw new Error(data.error);
        }
        // Zaktualizuj cache
        employeesCache = data.employees || [];
        employeesCacheTime = Date.now();
        renderEmployees(employeesCache); 
      })
      .catch(error => {
        console.error('Błąd podczas ładowania pracowników:', error);
        alert('Błąd podczas ładowania listy pracowników');
      });
  }
  
  // Cache dla pracowników
  let employeesCache = null;
  let employeesCacheTime = 0;
  const CACHE_DURATION = 30000; // 30 sekund

  function toggleEmps() {
    if (!empEditor) return;
    const show = !empEditor.classList.contains('show');
    
    if (show) {
      // Pokaż modal najpierw
      empEditor.classList.add('show');
      
      // Użyj requestAnimationFrame dla lepszej wydajności
      requestAnimationFrame(() => {
        // Użyj cache jeśli jest świeży
        const now = Date.now();
        if (employeesCache && (now - employeesCacheTime) < CACHE_DURATION) {
          renderEmployees(employeesCache);
        } else {
          loadEmployees();
        }
      });
    } else {
      empEditor.classList.remove('show');
    }
  }
  
  function closeEmps() { 
    if (empEditor) empEditor.classList.remove('show') 
  }
  
  function addEmp() {
    if (!empName || !empCode) return;
    const name = (empName.value || '').trim();
    const code = (empCode.value || '').trim();
    if (!code || !name) return;
    
    fetch('/api/employees', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ code, name }),
      credentials: 'include'
    })
    .then(async r => { 
      const data = await r.json().catch(() => ({})); 
      if (!r.ok) throw data; 
      return data; 
    })
    .then(() => { 
      empName.value = ''; 
      empCode.value = ''; 
      loadEmployees(); 
      alert('Pracownik został dodany!');
    })
    .catch((err) => { 
      console.warn('Dodawanie pracownika nie powiodło się', err);
      alert('Błąd podczas dodawania pracownika: ' + (err.error || 'Nieznany błąd'));
    });
  }
  
  // Event listeners dla zarządzania pracownikami
  if (empName) empName.addEventListener('keydown', (e) => { if (e.key == 'Enter') addEmp(); });
  if (empCode) empCode.addEventListener('keydown', (e) => { if (e.key == 'Enter') addEmp(); });
  if (btnEmps) btnEmps.addEventListener('click', toggleEmps);
  if (empAddBtn) empAddBtn.addEventListener('click', addEmp);
  if (empClose) empClose.addEventListener('click', closeEmps);
  if (empEditor) empEditor.addEventListener('click', (e) => { if (e.target === empEditor) closeEmps(); });

  // --- Skrzynka próśb o zamianę ---
  function getStatusClass(finalStatus) {
    switch(finalStatus) {
      case 'ZATWIERDZONE': return 'status-approved';
      case 'WSTEPNIE_ZATWIERDZONE': return 'status-pending';
      case 'ODRZUCONE': return 'status-rejected';
      case 'ODRZUCONE_PRZEZ_SZEFA': return 'status-rejected';
      case 'OCZEKUJACE': return 'status-waiting';
      default: return 'status-waiting';
    }
  }
  
  function getStatusText(finalStatus) {
    switch(finalStatus) {
      case 'ZATWIERDZONE': return '✅ Zatwierdzone';
      case 'WSTEPNIE_ZATWIERDZONE': return '⏳ Wstępnie zatwierdzone';
      case 'ODRZUCONE': return '❌ Odrzucone';
      case 'ODRZUCONE_PRZEZ_SZEFA': return '❌ Odrzucone przez szefa';
      case 'OCZEKUJACE': return '⏳ Oczekujące';
      default: return '⏳ Oczekujące';
    }
  }

  function loadSwaps() {
    // Ładuj zarówno prośby o zamianę jak i niedyspozycje
    Promise.all([
      fetch('/api/swaps/inbox', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/unavailability/inbox', { credentials: 'include' }).then(r => r.json())
    ])
    .then(([swapsData, unavailData]) => {
      if (swapsData.error) {
        throw new Error(swapsData.error);
      }
      if (unavailData.error) {
        throw new Error(unavailData.error);
      }
        
        const swapItems = swapsData.items || []; 
        const unavailItems = unavailData.items || [];
        const isBoss = !!swapsData.is_boss;
        
        if (swapList) swapList.innerHTML = '';
        if (swapClear) swapClear.style.display = isBoss ? 'inline-flex' : 'none';
        
        const me = (table && table.getAttribute('data-current-user')) || '';
        
        // Połącz wszystkie elementy z odpowiednimi typami
        const allItems = [
          ...swapItems.map(item => ({...item, type: 'swap'})),
          ...unavailItems.map(item => ({...item, type: 'unavailability'}))
        ];
        
        // Sortuj po dacie utworzenia (najnowsze na górze)
        allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        for (const item of allItems) {
          const row = document.createElement('div');
          row.className = 'emp-row';
          const title = document.createElement('div');
          
          // Sprawdź typ zgłoszenia i wyświetl odpowiednio
          if (item.type === 'unavailability') {
            // Zgłoszenie niedyspozycji
            const days = JSON.parse(item.selected_days || '[]');
            const daysText = days.length > 0 ? days.join(', ') : 'Brak dni';
            title.innerHTML = `📅 <strong>Niedyspozycja:</strong> ${item.employee_name} - ${item.month_year}<br>
                              <small>Dni: ${daysText}</small>`;
          } else {
            // Prośba o zamianę
            const fromS = item.from_shift ? ` (${item.from_shift})` : '';
            const toS = item.to_shift ? ` (${item.to_shift})` : '';
            
            if (item.is_give_request) {
              // Prośba o oddanie zmiany
              title.textContent = `🔄 ${item.from_employee} oddaje zmianę ${item.from_date}${fromS} → ${item.to_employee}`;
            } else {
              // Regularna zamiana
              title.textContent = `🔄 ${item.from_employee} ${item.from_date}${fromS} ⇄ ${item.to_employee} ${item.to_date}${toS}`;
            }
          }
          
          // Dodaj wyświetlanie finalnego statusu
          if (item.final_status) {
            const status = document.createElement('div');
            status.className = getStatusClass(item.final_status);
            status.textContent = getStatusText(item.final_status);
            title.appendChild(document.createElement('br'));
            title.appendChild(status);
          } else if (item.recipient_status === 'ACCEPTED' && item.to_employee === me) {
            // Pokaż "Zaakceptowano" dla odbiorców którzy zaakceptowali prośbę
            const status = document.createElement('div');
            status.className = 'status-approved';
            status.textContent = 'Zaakceptowano';
            title.appendChild(document.createElement('br'));
            title.appendChild(status);
          }
          
          // Dodaj wyświetlanie komentarza - zawsze pokazuj pole komentarza
          const commentDiv = document.createElement('div');
          commentDiv.className = 'swap-comment';
          if (item.comment_requester && item.comment_requester.trim()) {
            commentDiv.innerHTML = `<span class="comment-label">💬</span> <strong>Komentarz:</strong> ${item.comment_requester}`;
          } else {
            commentDiv.innerHTML = `<span class="comment-label">💬</span> <strong>Komentarz:</strong> <em>Brak komentarza</em>`;
          }
          title.appendChild(document.createElement('br'));
          title.appendChild(commentDiv);
          
          const actions = document.createElement('div');
          
          if (item.type === 'unavailability') {
            // Obsługa niedyspozycji - tylko szef może zatwierdzać
            if (isBoss && item.status === 'PENDING') {
              const ap = document.createElement('button'); 
              ap.className = 'btn'; 
              ap.textContent = 'Zatwierdź'; 
              ap.onclick = () => respondUnavailability(item.id, 'APPROVED');
              const rj = document.createElement('button'); 
              rj.className = 'btn'; 
              rj.textContent = 'Odrzuć'; 
              rj.onclick = () => respondUnavailability(item.id, 'REJECTED');
              actions.appendChild(ap); 
              actions.appendChild(rj);
            }
          } else {
            // Obsługa regularnych próśb o zamianę - tylko konkretny odbiorca może odpowiedzieć
            if (item.recipient_status === 'PENDING' && item.to_employee === me) {
              const acc = document.createElement('button'); 
              acc.className = 'btn'; 
              acc.textContent = 'Akceptuj'; 
              acc.onclick = () => respondSwap(item.id, 'ACCEPTED');
              const dec = document.createElement('button'); 
              dec.className = 'btn'; 
              dec.textContent = 'Odrzuć'; 
              dec.onclick = () => respondSwap(item.id, 'DECLINED');
              actions.appendChild(acc); 
              actions.appendChild(dec);
            }
            
            if (isBoss && item.recipient_status !== 'PENDING' && item.boss_status === 'PENDING') {
              const ap = document.createElement('button'); 
              ap.className = 'btn'; 
              ap.textContent = 'Zatwierdź'; 
              ap.onclick = () => bossSwap(item.id, 'APPROVED');
              const rj = document.createElement('button'); 
              rj.className = 'btn'; 
              rj.textContent = 'Odrzuć'; 
              rj.onclick = () => bossSwap(item.id, 'REJECTED');
              actions.appendChild(ap); 
              actions.appendChild(rj);
            }
          }
          
          row.appendChild(title); 
          row.appendChild(actions);
          if (swapList) swapList.appendChild(row);
        }
        
        // Odśwież listy dat w formularzu jeśli jest otwarty
        if (shiftsEditor && shiftsEditor.classList.contains('show')) {
          populateOwnShifts('shifts-from-date');
          populateOwnShifts('shifts-give-from-date');
        }
      })
      .catch(error => {
        console.error('Błąd podczas ładowania próśb o zamianę:', error);
        alert('Błąd podczas ładowania skrzynki próśb: ' + error.message);
      });
  }
  
  function respondSwap(id, status) { 
    fetch('/api/swaps/respond', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ id, status }),
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        alert('Błąd: ' + data.error);
      } else {
        loadSwaps();
        alert(data.message || 'Odpowiedź została wysłana');
      }
    })
    .catch(error => {
      console.error('Błąd podczas odpowiadania na prośbę:', error);
      alert('Wystąpił błąd podczas wysyłania odpowiedzi');
    });
  }
  
  function bossSwap(id, status) { 
    fetch('/api/swaps/boss', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ id, status }),
      credentials: 'include'
    })
    .then(async r => { 
      let data = {};
      try {
        data = await r.json();
      } catch (e) {
        console.error('Nie udało się sparsować JSON:', e);
      }
      
      if (!r.ok) { 
        const errorMsg = data.error || `HTTP ${r.status}: ${r.statusText}` || 'Nieznany błąd';
        alert('Błąd: ' + errorMsg); 
        throw new Error(errorMsg); 
      } 
      return data; 
    })
    .then(() => {
      loadSwaps();
      
      if (status === 'APPROVED') {
        alert('Prośba została zatwierdzona! Grafik zostanie odświeżony.');
        // Wymuszone odświeżenie strony
        forcePageRefresh();
      } else if (status === 'REJECTED') {
        alert('Prośba została odrzucona.');
      }
    })
    .catch((error) => {
      console.error('Błąd podczas zatwierdzania:', error);
      alert('Błąd podczas zatwierdzania: ' + (error.message || error));
    });
  }
  
  function toggleSwaps() {
    if (!swapEditor) return;
    const show = !swapEditor.classList.contains('show');
    swapEditor.classList.toggle('show', show);
    if (show) loadSwaps();
  }
  
  function closeSwaps() { 
    if (swapEditor) swapEditor.classList.remove('show') 
  }
  
  // Event listeners dla skrzynki próśb
  if (btnSwaps) btnSwaps.addEventListener('click', toggleSwaps);
  if (swapClose) swapClose.addEventListener('click', closeSwaps);
  if (swapEditor) swapEditor.addEventListener('click', (e) => { if (e.target === swapEditor) closeSwaps(); });
  if (swapClear) swapClear.addEventListener('click', () => { 
    if (confirm('Czy na pewno chcesz wyczyścić wszystkie prośby o zamianę?')) {
      fetch('/api/swaps/clear', { method: 'POST', credentials: 'include' })
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            alert('Błąd podczas czyszczenia: ' + data.error);
          } else {
            loadSwaps();
            alert(`Wyczyszczono ${data.deleted} próśb o zamianę`);
          }
        })
        .catch(error => {
          console.error('Błąd podczas czyszczenia próśb:', error);
          alert('Wystąpił błąd podczas czyszczenia próśb');
        });
    }
  });

  // --- Zunifikowany panel zmian ---
  function toggleShifts() { 
    console.log('toggleShifts called');
    console.log('shiftsEditor:', shiftsEditor);
    if (shiftsEditor) {
      console.log('Adding show class to shiftsEditor');
      shiftsEditor.classList.add('show');
      // Wypełnij listę własnych zmian dla wszystkich formularzy
      populateOwnShifts('shifts-from-date');
      populateOwnShifts('shifts-give-from-date');
      // Ustaw domyślny formularz na zamianę
      switchShiftForm();
    } else {
      console.error('shiftsEditor not found!');
    }
  }
  
  function closeShifts() { 
    if (shiftsEditor) shiftsEditor.classList.remove('show');
    // Wyczyść formularze
    clearShiftForms();
  }
  
  function switchShiftForm() {
    const selectedType = document.querySelector('input[name="shift-type"]:checked').value;
    
    // Ukryj wszystkie formularze
    document.querySelectorAll('.shift-form').forEach(form => {
      form.classList.remove('active');
    });
    
    // Pokaż odpowiedni formularz
    const targetForm = document.getElementById(selectedType + '-form');
    if (targetForm) {
      targetForm.classList.add('active');
    }
    
    // Zaktualizuj tekst przycisku
    const sendButton = document.getElementById('shifts-send');
    if (sendButton) {
      switch(selectedType) {
        case 'swap':
          sendButton.textContent = 'Wyślij prośbę o zamianę';
          break;
        case 'give':
          sendButton.textContent = 'Oddaj zmianę';
          break;
        case 'take':
          sendButton.textContent = 'Poproś o zmianę';
          break;
      }
    }
  }
  
  function clearShiftForms() {
    // Wyczyść wszystkie pola formularzy
    const forms = ['shifts-from-date', 'shifts-to-name', 'shifts-to-date', 
                   'shifts-give-from-date', 'shifts-give-to-name',
                   'shifts-take-from-name', 'shifts-take-from-date', 'shifts-comment'];
    
    forms.forEach(formId => {
      const element = document.getElementById(formId);
      if (element) {
        if (element.tagName === 'SELECT') {
          element.selectedIndex = 0;
        } else {
          element.value = '';
        }
      }
    });
    
    // Ustaw domyślny typ na zamianę
    const swapRadio = document.querySelector('input[name="shift-type"][value="swap"]');
    if (swapRadio) {
      swapRadio.checked = true;
    }
  }
  
  // Funkcja do wypełniania listy własnych zmian dla oddawania
  function populateGiveShifts() {
    const fromDateSelect = document.getElementById('give-from-date');
    if (!fromDateSelect) return;
    
    const currentUser = (table && table.getAttribute('data-current-user')) || '';
    
    // Wyczyść listę
    fromDateSelect.innerHTML = '<option value="" disabled selected>Wybierz datę swojej zmiany</option>';
    
    // Pobierz wszystkie komórki użytkownika z tabelki grafiku
    const userCells = table.querySelectorAll(`.slot[data-employee="${currentUser}"]`);
    const shifts = [];
    
    userCells.forEach(cell => {
      const date = cell.dataset.date;
      const value = cell.textContent.trim();
      
      if (value === 'D' || value === 'N' || (value && value.startsWith('P '))) {
        const dateObj = new Date(date);
        shifts.push({
          date: date,
          dateObj: dateObj,
          shiftType: value
        });
      }
    });
    
    // Sortuj od najbliższej do najdalszej daty
    shifts.sort((a, b) => a.dateObj - b.dateObj);
    
    // Dodaj posortowane zmiany do listy
    shifts.forEach(shift => {
      const formattedDate = shift.dateObj.toLocaleDateString('pl-PL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      
      const option = document.createElement('option');
      option.value = shift.date;
      option.textContent = `${formattedDate} (${shift.shiftType})`;
      
      // Sprawdź czy data nie jest zajęta przez inne prośby
      if (isDateOccupied(shift.date, currentUser)) {
        option.textContent += ' (zajęta)';
        option.disabled = true;
        option.style.color = '#999';
      }
      
      fromDateSelect.appendChild(option);
    });
  }
  
  // Funkcja sprawdzająca czy data jest zajęta przez inne prośby
  function isDateOccupied(date, employeeName) {
    // Pobierz aktualne prośby ze skrzynki
    if (!swapList) return false;
    
    // Sprawdź czy w skrzynce są prośby z tą datą i pracownikiem
    const swapItems = swapList.querySelectorAll('.emp-row');
    for (const item of swapItems) {
      const title = item.querySelector('div:first-child');
      if (title && title.textContent.includes(date) && title.textContent.includes(employeeName)) {
        return true;
      }
    }
    
    return false;
  }
  
  // Funkcja do wypełniania listy własnych zmian
  function populateOwnShifts(selectId = 'compose-from-date') {
    const fromDateSelect = document.getElementById(selectId);
    if (!fromDateSelect) return;
    
    const currentUser = (table && table.getAttribute('data-current-user')) || '';
    
    // Wyczyść listę
    fromDateSelect.innerHTML = '<option value="" disabled selected>Wybierz datę swojej zmiany</option>';
    
    // Pobierz wszystkie komórki użytkownika z tabelki grafiku
    const userCells = table.querySelectorAll(`.slot[data-employee="${currentUser}"]`);
    const shifts = [];
    
    userCells.forEach(cell => {
      const date = cell.dataset.date;
      const value = cell.textContent.trim();
      
      if (value === 'D' || value === 'N' || (value && value.startsWith('P '))) {
        const dateObj = new Date(date);
        shifts.push({
          date: date,
          dateObj: dateObj,
          shiftType: value
        });
      }
    });
    
    // Sortuj od najbliższej do najdalszej daty
    shifts.sort((a, b) => a.dateObj - b.dateObj);
    
    // Dodaj posortowane zmiany do listy
    shifts.forEach(shift => {
      const formattedDate = shift.dateObj.toLocaleDateString('pl-PL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      
      const option = document.createElement('option');
      option.value = shift.date;
      option.textContent = `${formattedDate} (${shift.shiftType})`;
      
      // Sprawdź czy data nie jest zajęta przez inne prośby
      if (isDateOccupied(shift.date, currentUser)) {
        option.textContent += ' (zajęta)';
        option.disabled = true;
        option.style.color = '#999';
      }
      
      fromDateSelect.appendChild(option);
    });
  }
  
  // Funkcja do wypełniania listy zmian wybranej osoby
  function populateOtherShifts(employeeName, selectId = 'compose-to-date') {
    const toDateSelect = document.getElementById(selectId);
    if (!toDateSelect) return;
    
    // Wyczyść listę
    toDateSelect.innerHTML = '<option value="" disabled selected>Wybierz datę</option>';
    
    // Pobierz wszystkie komórki wybranej osoby z tabelki grafiku
    const employeeCells = table.querySelectorAll(`.slot[data-employee="${employeeName}"]`);
    const shifts = [];
    
    employeeCells.forEach(cell => {
      const date = cell.dataset.date;
      const value = cell.textContent.trim();
      
      if (value === 'D' || value === 'N' || (value && value.startsWith('P '))) {
        const dateObj = new Date(date);
        shifts.push({
          date: date,
          dateObj: dateObj,
          shiftType: value
        });
      }
    });
    
    // Sortuj od najbliższej do najdalszej daty
    shifts.sort((a, b) => a.dateObj - b.dateObj);
    
    // Dodaj posortowane zmiany do listy
    shifts.forEach(shift => {
      const formattedDate = shift.dateObj.toLocaleDateString('pl-PL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
      
      const option = document.createElement('option');
      option.value = shift.date;
      option.textContent = `${formattedDate} (${shift.shiftType})`;
      
      // Sprawdź czy data nie jest zajęta przez inne prośby
      if (isDateOccupied(shift.date, employeeName)) {
        option.textContent += ' (zajęta)';
        option.disabled = true;
        option.style.color = '#999';
      }
      
      toDateSelect.appendChild(option);
    });
    
    // Włącz select
    toDateSelect.disabled = false;
  }
  
  // --- Funkcje wysyłania próśb ---
  function sendCompose() {
    if (!composeFromName || !composeFromDate || !composeToDate || !composeToName || !composeComment) return;
    const from_date = (composeFromDate.value || '').trim();
    
    // Automatycznie pobierz typ zmiany z wybranej daty
    let from_shift = null;
    let to_shift = null;
    
    if (from_date) {
      // Znajdź komórkę z własną zmianą i pobierz jej typ
      const ownCell = table.querySelector(`.slot[data-date="${from_date}"][data-employee="${composeFromName.value}"]`);
      if (ownCell) {
        from_shift = ownCell.textContent.trim();
      }
    }
    
    // Znajdź komórkę z zmianą do przejęcia i pobierz jej typ
    const toCell = table.querySelector(`.slot[data-date="${composeToDate.value}"][data-employee="${composeToName.value}"]`);
    if (toCell) {
      to_shift = toCell.textContent.trim();
    }
    
    const payload = {
      from_date: from_date,
      from_employee: (composeFromName.value || '').trim(),
      to_date: (composeToDate.value || '').trim(),
      to_employee: (composeToName.value || '').trim(),
      from_shift: from_shift,
      to_shift: to_shift,
      comment: (composeComment.value || '').trim()
    };
    
    // Walidacja
    if (payload.from_employee === payload.to_employee) { 
      alert('Nie możesz wysłać prośby do siebie.'); 
      return; 
    }
    if (!payload.from_date) { 
      alert('Wybierz datę swojej zmiany'); 
      return; 
    }
    if (!payload.to_date || !payload.to_employee) { 
      alert('Wybierz osobę i datę zmiany którą chcesz przejąć'); 
      return; 
    }
    
    // Sprawdź czy daty nie są już zajęte przez inne prośby
    if (isDateOccupied(payload.from_date, payload.from_employee)) {
      alert('Twoja zmiana w tym dniu jest już zaangażowana w inną prośbę o zamianę');
      return;
    }
    if (isDateOccupied(payload.to_date, payload.to_employee)) {
      alert(`Zmiana ${payload.to_employee} w tym dniu jest już zaangażowana w inną prośbę o zamianę`);
      return;
    }
    
    fetch('/api/swaps', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify(payload),
      credentials: 'include'
    })
    .then(async r => { 
      const data = await r.json().catch(() => ({})); 
      if (!r.ok) { 
        alert('Błąd: ' + (data.error || 'Nieznany błąd')); 
        throw data; 
      } 
      return data; 
    })
    .then(() => { 
      closeCompose(); 
      if (composeFromDate) composeFromDate.selectedIndex = 0; 
      if (composeToDate) composeToDate.selectedIndex = 0; 
      if (composeComment) composeComment.value = ''; 
      if (composeToName) composeToName.selectedIndex = 0; 
      alert('Prośba została wysłana!'); 
    })
    .catch(error => {
      console.error('Błąd podczas wysyłania prośby o zamianę:', error);
    });
  }
  
  // Funkcja do wysyłania prośby o oddanie zmiany
  function sendGive() {
    if (!giveFromName || !giveFromDate || !giveToName || !giveComment) return;
    const from_date = (giveFromDate.value || '').trim();
    
    // Automatycznie pobierz typ zmiany z wybranej daty
    let from_shift = null;
    
    if (from_date) {
      // Znajdź komórkę z własną zmianą i pobierz jej typ
      const ownCell = table.querySelector(`.slot[data-date="${from_date}"][data-employee="${giveFromName.value}"]`);
      if (ownCell) {
        from_shift = ownCell.textContent.trim();
      }
    }
    
    const payload = {
      from_date: from_date,
      from_employee: (giveFromName.value || '').trim(),
      to_date: null,  // Brak daty docelowej - oddajemy zmianę
      to_employee: (giveToName.value || '').trim(),
      from_shift: from_shift,
      to_shift: null,  // Brak zmiany docelowej
      comment: (giveComment.value || '').trim(),
      is_give_request: true  // Oznaczamy jako prośbę o oddanie
    };
    
    // Walidacja
    if (payload.from_employee === payload.to_employee) { 
      alert('Nie możesz oddać zmiany do siebie.'); 
      return; 
    }
    if (!payload.from_date) { 
      alert('Wybierz datę swojej zmiany'); 
      return; 
    }
    if (!payload.to_employee) { 
      alert('Wybierz osobę do której oddajesz zmianę'); 
      return; 
    }
    
    // Sprawdź czy data nie jest już zajęta przez inne prośby
    if (isDateOccupied(payload.from_date, payload.from_employee)) {
      alert('Twoja zmiana w tym dniu jest już zaangażowana w inną prośbę o zamianę');
      return;
    }
    
    // Sprawdź czy docelowa osoba nie ma już zmiany w tym dniu
    const targetCell = table.querySelector(`.slot[data-date="${from_date}"][data-employee="${payload.to_employee}"]`);
    if (targetCell && targetCell.textContent.trim()) {
      alert(`${payload.to_employee} ma już zmianę w tym dniu. Nie możesz oddać swojej zmiany do osoby która już pracuje.`);
      return;
    }
    
    fetch('/api/swaps', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify(payload),
      credentials: 'include'
    })
    .then(async r => { 
      let data = {};
      try {
        data = await r.json();
      } catch (e) {
        console.error('Nie udało się sparsować JSON:', e);
        data = {};
      }
      
      if (!r.ok) { 
        const errorMsg = data.error || `HTTP ${r.status}: ${r.statusText}` || 'Nieznany błąd';
        alert('Błąd: ' + errorMsg); 
        throw new Error(errorMsg); 
      } 
      
      return data; 
    })
    .then(() => { 
      closeGive(); 
      if (giveFromDate) giveFromDate.selectedIndex = 0; 
      if (giveComment) giveComment.value = ''; 
      if (giveToName) giveToName.selectedIndex = 0; 
      alert('Prośba o oddanie zmiany została wysłana!'); 
    })
    .catch((error) => {
      console.error('Błąd podczas wysyłania prośby o oddanie zmiany:', error);
      alert('Wystąpił błąd podczas wysyłania prośby: ' + error.message);
    });
  }

  // Funkcja do wysyłania prośby o zmianę (zunifikowana)
  function sendShifts() {
    const selectedType = document.querySelector('input[name="shift-type"]:checked').value;
    
    switch(selectedType) {
      case 'swap':
        sendSwapRequest();
        break;
      case 'give':
        sendGiveRequest();
        break;
      case 'take':
        sendTakeRequest();
        break;
    }
  }
  
  function sendSwapRequest() {
    if (!shiftsFromName || !shiftsFromDate || !shiftsToDate || !shiftsToName || !shiftsComment) return;
    const from_date = (shiftsFromDate.value || '').trim();
    const to_date = (shiftsToDate.value || '').trim();
    
    // Automatycznie pobierz typ zmiany z wybranej daty
    let from_shift = null;
    let to_shift = null;
    
    if (from_date) {
      const ownCell = table.querySelector(`.slot[data-date="${from_date}"][data-employee="${shiftsFromName.value}"]`);
      if (ownCell) {
        from_shift = ownCell.textContent.trim();
      }
    }
    
    if (to_date) {
      const otherCell = table.querySelector(`.slot[data-date="${to_date}"][data-employee="${shiftsToName.value}"]`);
      if (otherCell) {
        to_shift = otherCell.textContent.trim();
      }
    }
    
    const payload = {
      from_date: from_date,
      from_employee: (shiftsFromName.value || '').trim(),
      to_date: to_date,
      to_employee: (shiftsToName.value || '').trim(),
      from_shift: from_shift,
      to_shift: to_shift,
      comment: (shiftsComment.value || '').trim(),
      is_give_request: false,
      is_ask_request: false
    };
    
    // Walidacja
    if (payload.from_employee === payload.to_employee) { 
      alert('Nie możesz zamienić zmiany z samym sobą.'); 
      return; 
    }
    if (!payload.from_date) { 
      alert('Wybierz datę swojej zmiany'); 
      return; 
    }
    if (!payload.to_date) { 
      alert('Wybierz datę zmiany do przejęcia'); 
      return; 
    }
    
    // Sprawdź czy daty nie są już zajęte przez inne prośby
    if (isDateOccupied(payload.from_date, payload.from_employee)) {
      alert('Twoja zmiana w tym dniu jest już zaangażowana w inną prośbę o zamianę');
      return;
    }
    if (isDateOccupied(payload.to_date, payload.to_employee)) {
      alert('Zmiana którą chcesz przejąć jest już zaangażowana w inną prośbę o zamianę');
      return;
    }
    
    fetch('/api/swaps', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify(payload),
      credentials: 'include'
    })
    .then(async r => { 
      let data = {};
      try {
        data = await r.json();
      } catch (e) {
        console.warn('Odpowiedź nie jest JSON:', e);
      }
      
      if (r.ok) {
        alert('Prośba o zamianę została wysłana');
        closeShifts();
        if (swapEditor && swapEditor.classList.contains('show')) {
          loadSwaps();
        }
      } else {
        alert(data.error || 'Wystąpił błąd podczas wysyłania prośby');
      }
    })
    .catch((error) => {
      console.error('Błąd podczas wysyłania prośby o zamianę:', error);
      alert('Wystąpił błąd podczas wysyłania prośby: ' + error.message);
    });
  }
  
  function sendGiveRequest() {
    if (!shiftsGiveFromName || !shiftsGiveFromDate || !shiftsGiveToName || !shiftsComment) return;
    const from_date = (shiftsGiveFromDate.value || '').trim();
    
    // Automatycznie pobierz typ zmiany z wybranej daty
    let from_shift = null;
    
    if (from_date) {
      const ownCell = table.querySelector(`.slot[data-date="${from_date}"][data-employee="${shiftsGiveFromName.value}"]`);
      if (ownCell) {
        from_shift = ownCell.textContent.trim();
      }
    }
    
    const payload = {
      from_date: from_date,
      from_employee: (shiftsGiveFromName.value || '').trim(),
      to_date: null,
      to_employee: (shiftsGiveToName.value || '').trim(),
      from_shift: from_shift,
      to_shift: null,
      comment: (shiftsComment.value || '').trim(),
      is_give_request: true,
      is_ask_request: false
    };
    
    // Walidacja
    if (payload.from_employee === payload.to_employee) { 
      alert('Nie możesz oddać zmiany do siebie.'); 
      return; 
    }
    if (!payload.from_date) { 
      alert('Wybierz datę swojej zmiany'); 
      return; 
    }
    if (!payload.to_employee) { 
      alert('Wybierz osobę do której oddajesz zmianę'); 
      return; 
    }
    
    // Sprawdź czy data nie jest już zajęta przez inne prośby
    if (isDateOccupied(payload.from_date, payload.from_employee)) {
      alert('Twoja zmiana w tym dniu jest już zaangażowana w inną prośbę o zamianę');
      return;
    }
    
    // Sprawdź czy docelowa osoba nie ma już zmiany w tym dniu
    const targetCell = table.querySelector(`.slot[data-date="${from_date}"][data-employee="${payload.to_employee}"]`);
    if (targetCell && targetCell.textContent.trim()) {
      alert(`${payload.to_employee} ma już zmianę w tym dniu. Nie możesz oddać swojej zmiany do osoby która już pracuje.`);
      return;
    }
    
    fetch('/api/swaps', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify(payload),
      credentials: 'include'
    })
    .then(async r => { 
      let data = {};
      try {
        data = await r.json();
      } catch (e) {
        console.warn('Odpowiedź nie jest JSON:', e);
      }
      
      if (r.ok) {
        alert('Prośba o oddanie zmiany została wysłana');
        closeShifts();
        if (swapEditor && swapEditor.classList.contains('show')) {
          loadSwaps();
        }
      } else {
        alert(data.error || 'Wystąpił błąd podczas wysyłania prośby');
      }
    })
    .catch((error) => {
      console.error('Błąd podczas wysyłania prośby o oddanie zmiany:', error);
      alert('Wystąpił błąd podczas wysyłania prośby: ' + error.message);
    });
  }
  
  function sendTakeRequest() {
    if (!shiftsTakeFromName || !shiftsTakeFromDate || !shiftsComment) return;
    const to_date = (shiftsTakeFromDate.value || '').trim();
    
    // Automatycznie pobierz typ zmiany z wybranej daty
    let to_shift = null;
    
    if (to_date) {
      const otherCell = table.querySelector(`.slot[data-date="${to_date}"][data-employee="${shiftsTakeFromName.value}"]`);
      if (otherCell) {
        to_shift = otherCell.textContent.trim();
      }
    }
    
    const currentUser = (table && table.getAttribute('data-current-user')) || '';
    
    const payload = {
      from_date: '',  // Pusty string zamiast null dla zabrania zmiany
      from_employee: currentUser,
      to_date: to_date,
      to_employee: (shiftsTakeFromName.value || '').trim(),
      from_shift: '',  // Pusty string zamiast null
      to_shift: to_shift,
      comment: (shiftsComment.value || '').trim(),
      is_give_request: false,
      is_ask_request: true
    };
    
    // Walidacja
    if (payload.from_employee === payload.to_employee) { 
      alert('Nie możesz poprosić o zmianę od siebie.'); 
      return; 
    }
    if (!payload.to_date) { 
      alert('Wybierz datę zmiany którą chcesz przejąć'); 
      return; 
    }
    if (!payload.to_employee) { 
      alert('Wybierz osobę od której chcesz przejąć zmianę'); 
      return; 
    }
    
    // Sprawdź czy data nie jest już zajęta przez inne prośby
    if (isDateOccupied(payload.to_date, payload.to_employee)) {
      alert('Zmiana którą chcesz przejąć jest już zaangażowana w inną prośbę o zamianę');
      return;
    }
    
    // Sprawdź czy nie masz już zmiany w tym dniu
    const ownCell = table.querySelector(`.slot[data-date="${to_date}"][data-employee="${currentUser}"]`);
    if (ownCell && ownCell.textContent.trim()) {
      alert('Masz już zmianę w tym dniu. Nie możesz przejąć dodatkowej zmiany.');
      return;
    }
    
    fetch('/api/swaps', { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify(payload),
      credentials: 'include'
    })
    .then(async r => { 
      let data = {};
      try {
        data = await r.json();
      } catch (e) {
        console.warn('Odpowiedź nie jest JSON:', e);
      }
      
      if (r.ok) {
        alert('Prośba o przejęcie zmiany została wysłana');
        closeShifts();
        if (swapEditor && swapEditor.classList.contains('show')) {
          loadSwaps();
        }
      } else {
        alert(data.error || 'Wystąpił błąd podczas wysyłania prośby');
      }
    })
    .catch((error) => {
      console.error('Błąd podczas wysyłania prośby o przejęcie zmiany:', error);
      alert('Wystąpił błąd podczas wysyłania prośby: ' + error.message);
    });
  }

  // --- Event listeners dla zunifikowanego panelu zmian ---
  if (btnShifts) btnShifts.addEventListener('click', toggleShifts);
  if (shiftsClose) shiftsClose.addEventListener('click', closeShifts);
  if (shiftsCancel) shiftsCancel.addEventListener('click', closeShifts);
  if (shiftsEditor) shiftsEditor.addEventListener('click', (e) => { if (e.target === shiftsEditor) closeShifts(); });
  if (shiftsSend) shiftsSend.addEventListener('click', sendShifts);
  
  // Event listeners dla radio buttons
  shiftTypeRadios.forEach(radio => {
    radio.addEventListener('change', switchShiftForm);
  });

  // Event listeners dla nowych formularzy
  if (shiftsToName) {
    shiftsToName.addEventListener('change', (e) => {
      const selectedEmployee = e.target.value;
      if (selectedEmployee) {
        populateOtherShifts(selectedEmployee, 'shifts-to-date');
      } else {
        if (shiftsToDate) {
          shiftsToDate.innerHTML = '<option value="" disabled selected>Najpierw wybierz osobę</option>';
        }
      }
    });
  }
  
  if (shiftsTakeFromName) {
    shiftsTakeFromName.addEventListener('change', (e) => {
      const selectedEmployee = e.target.value;
      if (selectedEmployee) {
        populateOtherShifts(selectedEmployee, 'shifts-take-from-date');
      } else {
        if (shiftsTakeFromDate) {
          shiftsTakeFromDate.innerHTML = '<option value="" disabled selected>Najpierw wybierz osobę</option>';
        }
      }
    });
  }
  
  // Funkcja do odświeżania list w formularzu gdy zmienia się grafik
  function refreshComposeLists() {
    // Sprawdź czy formularz jest otwarty
    if (shiftsEditor && shiftsEditor.classList.contains('show')) {
      // Odśwież listę własnych zmian
      populateOwnShifts('shifts-from-date');
      populateOwnShifts('shifts-give-from-date');
      
      // Odśwież listę zmian wybranej osoby (jeśli jest wybrana)
      const selectedEmployee = shiftsToName ? shiftsToName.value : '';
      if (selectedEmployee) {
        populateOtherShifts(selectedEmployee, 'shifts-to-date');
      }
      
      const selectedTakeEmployee = shiftsTakeFromName ? shiftsTakeFromName.value : '';
      if (selectedTakeEmployee) {
        populateOtherShifts(selectedTakeEmployee, 'shifts-take-from-date');
      }
    }
  }
  
  // Event listener dla zmian w tabelce grafiku (gdy szef edytuje)
  if (table) {
    // Używamy MutationObserver żeby wykryć zmiany w tabelce
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          // Sprawdź czy zmiana dotyczy komórki z datą
          const target = mutation.target;
          if (target.closest && target.closest('.slot')) {
            // Odśwież listy w formularzu
            refreshComposeLists();
          }
        }
      });
    });
    
    // Obserwuj zmiany w tabelce
    observer.observe(table, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }



  // ===== FUNKCJONALNOŚĆ NIEDYSPOZYCJI =====
  
  let selectedDays = [];
  let currentMonth = null;
  
  // Inicjalizacja modala niedyspozycji
  function initUnavailabilityModal() {
    const modal = document.getElementById('unavailability-modal');
    const openBtn = document.getElementById('btn-unavailability');
    const closeBtn = document.getElementById('unavailability-close');
    const cancelBtn = document.getElementById('unavailability-cancel');
    const submitBtn = document.getElementById('unavailability-submit');
    const monthInput = document.getElementById('unavailability-month');
    const prevMonthBtn = document.getElementById('unavailability-prev-month');
    const nextMonthBtn = document.getElementById('unavailability-next-month');
    const monthLabel = document.getElementById('unavailability-month-label');
    
    if (!modal || !openBtn) return;
    
    // Otwórz modal
    openBtn.addEventListener('click', () => {
      const now = new Date();
      const currentMonthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      monthInput.value = currentMonthStr;
      monthInput.readOnly = true; // Upewnij się, że pole jest tylko do odczytu
      selectedDays = [];
      currentMonth = null;
      updateCalendar();
      updateSelectedDaysList();
      updateMonthLabel();
      modal.classList.add('show');
      // Ustaw fokus na modal, żeby obsługa klawiatury działała
      setTimeout(() => modal.focus(), 100);
    });
    
    // Zamknij modal
    [closeBtn, cancelBtn].forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          modal.classList.remove('show');
        });
      }
    });
    
    // Nawigacja miesiącami
    if (prevMonthBtn) {
      prevMonthBtn.addEventListener('click', () => {
        navigateMonth(-1);
      });
    }
    
    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => {
        navigateMonth(1);
      });
    }
    
    // Zmiana miesiąca przez input (ukryty)
    monthInput.addEventListener('change', () => {
      selectedDays = [];
      updateCalendar();
      updateSelectedDaysList();
      updateMonthLabel();
    });
    
    // Wyślij zgłoszenie
    if (submitBtn) {
      submitBtn.addEventListener('click', submitUnavailability);
    }
    
    // Obsługa klawiatury dla nawigacji miesiącami
    modal.addEventListener('keydown', (e) => {
      if (modal.classList.contains('show')) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigateMonth(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigateMonth(1);
        }
      }
    });
    
    // Funkcja nawigacji miesiącami
    function navigateMonth(direction) {
      if (!currentMonth) {
        const now = new Date();
        currentMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
      }
      
      let newMonth = currentMonth.month + direction;
      let newYear = currentMonth.year;
      
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      } else if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      
      currentMonth = { year: newYear, month: newMonth };
      monthInput.value = `${newYear}-${String(newMonth).padStart(2, '0')}`;
      selectedDays = [];
      updateCalendar();
      updateSelectedDaysList();
      updateMonthLabel();
    }
    
    // Aktualizuj etykietę miesiąca
    function updateMonthLabel() {
      if (!monthLabel || !currentMonth) return;
      
      const monthNames = ['', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
                        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
      monthLabel.textContent = `${monthNames[currentMonth.month]} ${currentMonth.year}`;
    }
  }
  
  // Aktualizuj mini-kalendarz
  function updateCalendar() {
    const monthInput = document.getElementById('unavailability-month');
    const calendar = document.getElementById('unavailability-calendar');
    
    if (!monthInput || !calendar) return;
    
    const monthYear = monthInput.value;
    if (!monthYear) return;
    
    const [year, month] = monthYear.split('-').map(Number);
    currentMonth = { year, month };
    
    // Wyczyść kalendarz
    calendar.innerHTML = '';
    
    // Nagłówki dni
    const dayHeaders = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie'];
    dayHeaders.forEach(day => {
      const header = document.createElement('div');
      header.className = 'day-header';
      header.textContent = day;
      calendar.appendChild(header);
    });
    
    // Pobierz pierwszy dzień miesiąca i ile dni ma miesiąc
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = (firstDay.getDay() + 6) % 7; // Poniedziałek = 0
    
    // Dodaj puste komórki na początku
    for (let i = 0; i < startDay; i++) {
      const empty = document.createElement('div');
      empty.className = 'day-cell other-month';
      calendar.appendChild(empty);
    }
    
    // Dodaj dni miesiąca
    for (let day = 1; day <= daysInMonth; day++) {
      const dayCell = document.createElement('div');
      dayCell.className = 'day-cell';
      dayCell.textContent = day;
      dayCell.dataset.day = day;
      
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dayCell.dataset.date = dateStr;
      
      // Sprawdź czy dzień jest już wybrany
      if (selectedDays.includes(dateStr)) {
        dayCell.classList.add('selected');
      }
      
      // Kliknięcie na dzień
      dayCell.addEventListener('click', () => {
        if (dayCell.classList.contains('other-month')) return;
        
        const dateStr = dayCell.dataset.date;
        
        if (selectedDays.includes(dateStr)) {
          // Usuń z wybranych
          selectedDays = selectedDays.filter(d => d !== dateStr);
          dayCell.classList.remove('selected');
        } else {
          // Dodaj do wybranych
          selectedDays.push(dateStr);
          dayCell.classList.add('selected');
        }
        
        updateSelectedDaysList();
      });
      
      calendar.appendChild(dayCell);
    }
  }
  
  // Aktualizuj listę wybranych dni
  function updateSelectedDaysList() {
    const list = document.getElementById('selected-days-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    selectedDays.sort().forEach(dateStr => {
      const tag = document.createElement('div');
      tag.className = 'selected-day-tag';
      
      const date = new Date(dateStr);
      const dayName = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'][date.getDay()];
      const dayNumber = date.getDate();
      
      tag.innerHTML = `
        ${dayName} ${dayNumber}
        <span class="remove-day" data-date="${dateStr}">×</span>
      `;
      
      // Usuń dzień po kliknięciu na ×
      tag.querySelector('.remove-day').addEventListener('click', (e) => {
        e.stopPropagation();
        const dateToRemove = e.target.dataset.date;
        selectedDays = selectedDays.filter(d => d !== dateToRemove);
        updateCalendar();
        updateSelectedDaysList();
      });
      
      list.appendChild(tag);
    });
  }
  
  // Wyślij zgłoszenie niedyspozycji
  async function submitUnavailability() {
    const monthInput = document.getElementById('unavailability-month');
    const submitBtn = document.getElementById('unavailability-submit');
    
    if (!monthInput || !submitBtn) return;
    
    if (selectedDays.length === 0) {
      alert('Wybierz przynajmniej jeden dzień niedyspozycji');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wysyłanie...';
    
    try {
      const response = await fetch('/api/unavailability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month_year: monthInput.value,
          selected_days: selectedDays,
          comment: ''
        }),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert('Zgłoszenie niedyspozycji zostało wysłane!');
        document.getElementById('unavailability-modal').style.display = 'none';
        selectedDays = [];
        updateCalendar();
        updateSelectedDaysList();
      } else {
        alert('Błąd: ' + (result.error || 'Nieznany błąd'));
      }
    } catch (error) {
      console.error('Błąd podczas wysyłania zgłoszenia:', error);
      alert('Wystąpił błąd podczas wysyłania zgłoszenia');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Wyślij zgłoszenie';
    }
  }
  
  // Funkcja do odpowiadania na niedyspozycje
  async function respondUnavailability(id, status) {
    try {
      const response = await fetch('/api/unavailability/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id,
          status: status,
          boss_comment: ''
        }),
        credentials: 'include'
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert(`Zgłoszenie niedyspozycji zostało ${status === 'APPROVED' ? 'zatwierdzone' : 'odrzucone'}!`);
        loadSwaps(); // Odśwież skrzynkę
      } else {
        alert('Błąd: ' + (result.error || 'Nieznany błąd'));
      }
    } catch (error) {
      console.error('Błąd podczas odpowiadania na niedyspozycję:', error);
      alert('Wystąpił błąd podczas przetwarzania zgłoszenia');
    }
  }
  
  // Inicjalizuj funkcjonalność niedyspozycji
  initUnavailabilityModal();
  
  // Inicjalizuj powiadomienia
  initializeNotifications();

  console.log('Aplikacja została w pełni załadowana i jest gotowa do użycia');
});

// ===== SYSTEM POWIADOMIEŃ PWA =====

// Inicjalizacja powiadomień
async function initializeNotifications() {
  // Sprawdź czy przeglądarka obsługuje powiadomienia
  if (!('Notification' in window)) {
    console.log('Ta przeglądarka nie obsługuje powiadomień');
    return;
  }
  
  // Sprawdź czy service worker jest dostępny
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker nie jest obsługiwany');
    return;
  }
  
  // Zarejestruj service worker
  try {
    const registration = await navigator.serviceWorker.register('/static/sw.js');
    console.log('Service Worker zarejestrowany:', registration);
    
    // Sprawdź czy powiadomienia są dozwolone
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Uprawnienie do powiadomień:', permission);
    }
    
    // Uruchom background sync
    if ('sync' in window.ServiceWorkerRegistration.prototype) {
      registration.sync.register('check-notifications');
    }
    
    // Sprawdź nowe prośby co 30 sekund
    setInterval(checkForNewRequests, 30000);
    
  } catch (error) {
    console.error('Błąd rejestracji Service Worker:', error);
  }
}

// Sprawdzanie nowych próśb i zmian statusu
async function checkForNewRequests() {
  try {
    // Sprawdź prośby o zamianę
    const swapsResponse = await fetch('/api/swaps/inbox', { credentials: 'include' });
    const swapsData = await swapsResponse.json();
    
    // Sprawdź niedyspozycje
    const unavailabilityResponse = await fetch('/api/unavailability/inbox', { credentials: 'include' });
    const unavailabilityData = await unavailabilityResponse.json();
    
    // Sprawdź zmiany w grafiku
    const scheduleResponse = await fetch('/api/schedule/changes', { credentials: 'include' });
    const scheduleData = await scheduleResponse.json();
    
    let hasChanges = false;
    let notificationMessage = '';
    
    // Sprawdź prośby o zamianę
    if (swapsData.items && swapsData.items.length > 0) {
      const changes = await checkSwapsChanges(swapsData.items);
      if (changes.hasChanges) {
        hasChanges = true;
        notificationMessage += changes.message;
      }
    }
    
    // Sprawdź niedyspozycje
    if (unavailabilityData.items && unavailabilityData.items.length > 0) {
      const changes = await checkUnavailabilityChanges(unavailabilityData.items);
      if (changes.hasChanges) {
        hasChanges = true;
        if (notificationMessage) {
          notificationMessage += `, ${changes.message}`;
        } else {
          notificationMessage = changes.message;
        }
      }
    }
    
    // Sprawdź zmiany w grafiku
    if (scheduleData.changes && scheduleData.changes.length > 0) {
      const changes = await checkScheduleChanges(scheduleData.changes, scheduleData.current_user_name);
      if (changes.hasChanges) {
        hasChanges = true;
        if (notificationMessage) {
          notificationMessage += `, ${changes.message}`;
        } else {
          notificationMessage = changes.message;
        }
      }
    }
    
    // Wyślij powiadomienie jeśli są zmiany
    if (hasChanges && notificationMessage) {
      showNotification(notificationMessage);
    }
  } catch (error) {
    console.error('Błąd sprawdzania nowych próśb:', error);
  }
}

// Sprawdzanie zmian w prośbach o zamianę
async function checkSwapsChanges(items) {
  const previousStatuses = JSON.parse(localStorage.getItem('previousRequestStatuses') || '{}');
  const currentStatuses = {};
  let hasChanges = false;
  let message = '';
  
  items.forEach(item => {
    currentStatuses[item.id] = item.final_status;
    
    // Sprawdź czy status się zmienił
    if (previousStatuses[item.id] && previousStatuses[item.id] !== item.final_status) {
      hasChanges = true;
      const statusText = getStatusText(item.final_status);
      
      if (!message) {
        message = `Status prośby o zamianę: ${statusText}`;
      } else {
        message += `, ${statusText}`;
      }
      
      console.log(`Status zmieniony dla prośby ${item.id}: ${previousStatuses[item.id]} → ${item.final_status}`);
    }
    
    // Sprawdź nowe prośby
    if (!previousStatuses[item.id] && (item.final_status === 'OCZEKUJACE' || item.final_status === 'WSTEPNIE_ZATWIERDZONE')) {
      hasChanges = true;
      if (!message) {
        message = `Nowa prośba o zamianę w skrzynce`;
      } else {
        message += `, nowa prośba`;
      }
    }
  });
  
  // Zapisz aktualne statusy
  localStorage.setItem('previousRequestStatuses', JSON.stringify(currentStatuses));
  
  return { hasChanges, message };
}

// Sprawdzanie zmian w niedyspozycjach
async function checkUnavailabilityChanges(items) {
  const previousStatuses = JSON.parse(localStorage.getItem('previousUnavailabilityStatuses') || '{}');
  const currentStatuses = {};
  let hasChanges = false;
  let message = '';
  
  items.forEach(item => {
    const status = item.status || 'PENDING';
    currentStatuses[item.id] = status;
    
    // Sprawdź czy status się zmienił
    if (previousStatuses[item.id] && previousStatuses[item.id] !== status) {
      hasChanges = true;
      const statusText = getUnavailabilityStatusText(status);
      
      if (!message) {
        message = `Status niedyspozycji: ${statusText}`;
      } else {
        message += `, ${statusText}`;
      }
      
      console.log(`Status zmieniony dla niedyspozycji ${item.id}: ${previousStatuses[item.id]} → ${status}`);
    }
    
    // Sprawdź nowe niedyspozycje
    if (!previousStatuses[item.id] && status === 'PENDING') {
      hasChanges = true;
      if (!message) {
        message = `Nowa niedyspozycja w skrzynce`;
      } else {
        message += `, nowa niedyspozycja`;
      }
    }
  });
  
  // Zapisz aktualne statusy
  localStorage.setItem('previousUnavailabilityStatuses', JSON.stringify(currentStatuses));
  
  return { hasChanges, message };
}

// Funkcja pomocnicza do mapowania statusów niedyspozycji
function getUnavailabilityStatusText(status) {
  switch (status) {
    case 'PENDING': return 'Oczekujące';
    case 'APPROVED': return 'Zatwierdzone';
    case 'REJECTED': return 'Odrzucone';
    default: return status;
  }
}

// Sprawdzanie zmian w grafiku
async function checkScheduleChanges(changes, currentUserName) {
  const previousChanges = JSON.parse(localStorage.getItem('previousScheduleChanges') || '{}');
  const currentChanges = {};
  let hasChanges = false;
  let message = '';
  
  // Użyj nazwy użytkownika z API
  const currentUser = currentUserName || getCurrentUserName();
  
  changes.forEach(change => {
    const changeKey = `${change.id}_${change.changed_at}`;
    currentChanges[change.id] = change;
    
    // Sprawdź czy to nowa zmiana
    if (!previousChanges[change.id]) {
      hasChanges = true;
      
      // Sprawdź czy zmiana dotyczy aktualnego użytkownika
      if (change.employee_name === currentUser) {
        const actionText = getScheduleActionText(change.action);
        const shiftText = change.shift_type || 'brak zmiany';
        
        if (!message) {
          message = `Zmiana w grafiku: ${actionText} ${shiftText} na ${change.date}`;
        } else {
          message += `, ${actionText} ${shiftText}`;
        }
        
        console.log(`Nowa zmiana w grafiku dla ${change.employee_name}: ${change.action} ${change.shift_type} na ${change.date}`);
      }
    }
  });
  
  // Zapisz aktualne zmiany
  localStorage.setItem('previousScheduleChanges', JSON.stringify(currentChanges));
  
  return { hasChanges, message };
}

// Funkcja pomocnicza do mapowania akcji w grafiku
function getScheduleActionText(action) {
  switch (action) {
    case 'DODANO': return 'Dodano';
    case 'ZMIENIONO': return 'Zmieniono';
    case 'USUNIETO': return 'Usunięto';
    default: return action;
  }
}

// Funkcja pomocnicza do pobrania nazwy aktualnego użytkownika
function getCurrentUserName() {
  // Spróbuj pobrać z elementu na stronie lub z localStorage
  const userElement = document.querySelector('[data-user-name]');
  if (userElement) {
    return userElement.getAttribute('data-user-name');
  }
  
  // Fallback - pobierz z localStorage lub użyj domyślnej wartości
  return localStorage.getItem('currentUserName') || 'Nieznany użytkownik';
}

// Funkcja pomocnicza do określenia typu prośby
function getRequestTypeText(item) {
  if (item.is_ask_request) return 'zabranie';
  if (item.is_give_request) return 'oddanie';
  return 'zamiana';
}

// Wyświetlanie powiadomienia
function showNotification(message, requestData = null) {
  if (Notification.permission === 'granted') {
    const notification = new Notification('Grafik SP4600', {
      body: message,
      icon: '/static/PKN.WA.D.png',
      badge: '/static/PKN.WA.D.png',
      tag: 'grafik-notification',
      data: requestData,
      requireInteraction: true
    });
    
    notification.onclick = function() {
      window.focus();
      notification.close();
      
      // Otwórz skrzynkę jeśli jest dostępna
      const swapsBtn = document.getElementById('btn-swaps-user') || document.getElementById('btn-swaps-admin');
      if (swapsBtn) {
        swapsBtn.click();
      }
    };
    
    // Automatycznie zamknij po 10 sekundach
    setTimeout(() => {
      notification.close();
    }, 10000);
  }
}

// Test powiadomień (do testowania)
function testNotification() {
  showNotification('To jest test powiadomienia!');
}

// Funkcja do ręcznego testowania subskrypcji push
async function testPushSubscription() {
  console.log('🧪 Testowanie subskrypcji push...');
  
  try {
    // Sprawdź czy użytkownik jest zalogowany
    const isLoggedIn = document.querySelector('[data-current-user]') !== null;
    if (!isLoggedIn) {
      alert('❌ Nie jesteś zalogowany! Zaloguj się najpierw.');
      return;
    }
    
    console.log('✅ Użytkownik jest zalogowany');
    
    // Sprawdź czy przeglądarka obsługuje powiadomienia
    if (!('Notification' in window)) {
      alert('❌ Ta przeglądarka nie obsługuje powiadomień');
      return;
    }
    
    // Sprawdź uprawnienia
    console.log('Aktualny status uprawnień:', Notification.permission);
    
    if (Notification.permission === 'default') {
      console.log('📝 Prośba o uprawnienia...');
      const permission = await Notification.requestPermission();
      console.log('Wynik prośby o uprawnienia:', permission);
      
      if (permission !== 'granted') {
        alert('❌ Powiadomienia zostały odrzucone!');
        return;
      }
    } else if (Notification.permission === 'denied') {
      alert('❌ Powiadomienia są zablokowane!');
      return;
    }
    
    console.log('✅ Uprawnienia do powiadomień są włączone');
    
    // Sprawdź Service Worker
    if (!('serviceWorker' in navigator)) {
      alert('❌ Service Worker nie jest obsługiwany');
      return;
    }
    
    // Sprawdź Push API
    if (!('PushManager' in window)) {
      alert('❌ Push API nie jest obsługiwane');
      return;
    }
    
    console.log('✅ Wszystkie wymagania spełnione');
    
    // Pobierz klucz VAPID
    console.log('📡 Pobieranie klucza VAPID...');
    const response = await fetch('/api/push/vapid-key');
    const data = await response.json();
    
    if (!data.public_key) {
      alert('❌ Brak klucza VAPID z serwera');
      return;
    }
    
    console.log('✅ Klucz VAPID pobrany:', data.public_key.substring(0, 20) + '...');
    
    // Sprawdź Service Worker
    console.log('🔧 Sprawdzanie Service Worker...');
    
    if (!navigator.serviceWorker) {
      throw new Error('Service Worker nie jest obsługiwany w tej przeglądarce');
    }
    
    console.log('🔧 Service Worker jest obsługiwany, czekam na gotowość...');
    
    // Sprawdź czy Service Worker jest już zarejestrowany
    const existingRegistrations = await navigator.serviceWorker.getRegistrations();
    console.log('📋 Istniejące rejestracje Service Worker:', existingRegistrations.length);
    
    if (existingRegistrations.length > 0) {
      console.log('ℹ️ Znaleziono istniejące rejestracje:', existingRegistrations);
      
      // Sprawdź status każdej rejestracji
      for (let i = 0; i < existingRegistrations.length; i++) {
        const reg = existingRegistrations[i];
        console.log(`📋 Rejestracja ${i}:`, {
          scope: reg.scope,
          installing: reg.installing,
          waiting: reg.waiting,
          active: reg.active,
          state: reg.active ? reg.active.state : 'brak aktywnego'
        });
      }
    }
    
    let registration;
    try {
      // Dodaj timeout dla Service Worker
      const swPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Service Worker timeout - nie odpowiedział w ciągu 10 sekund')), 10000)
      );
      
      console.log('⏱️ Czekam na Service Worker z timeout 10s...');
      registration = await Promise.race([swPromise, timeoutPromise]);
      console.log('✅ Service Worker gotowy:', registration);
    } catch (swError) {
      console.error('❌ Błąd Service Worker ready:', swError);
      
      // Spróbuj użyć istniejącej rejestracji jako fallback
      if (existingRegistrations.length > 0) {
        console.log('🔄 Próbuję użyć istniejącej rejestracji jako fallback...');
        registration = existingRegistrations[0];
        console.log('✅ Używam istniejącej rejestracji:', registration);
      } else {
        throw swError;
      }
    }
    
    // Sprawdź istniejącą subskrypcję
    console.log('🔍 Sprawdzanie istniejącej subskrypcji...');
    let subscription = await registration.pushManager.getSubscription();
    console.log('Istniejąca subskrypcja:', subscription);
    
    if (!subscription) {
      console.log('🆕 Tworzenie nowej subskrypcji...');
      console.log('Klucz VAPID do konwersji:', data.public_key.substring(0, 20) + '...');
      
      try {
        const applicationServerKey = urlB64ToUint8Array(data.public_key);
        console.log('✅ Klucz VAPID skonwertowany:', applicationServerKey.length, 'bajtów');
        
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
        console.log('✅ Subskrypcja utworzona:', subscription);
      } catch (subscribeError) {
        console.error('❌ Błąd tworzenia subskrypcji:', subscribeError);
        throw subscribeError;
      }
    } else {
      console.log('ℹ️ Używam istniejącej subskrypcji');
    }
    
    // Zapisz subskrypcję na serwerze
    console.log('💾 Zapisuję subskrypcję na serwerze...');
    const saveResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });
    
    console.log('Odpowiedź serwera:', saveResponse.status, saveResponse.statusText);
    
    if (saveResponse.ok) {
      const result = await saveResponse.json();
      console.log('✅ Subskrypcja zapisana:', result);
      alert('✅ Subskrypcja push została pomyślnie zarejestrowana!\n\nTeraz możesz testować powiadomienia.');
    } else {
      const errorData = await saveResponse.json().catch(() => ({ error: 'Nieznany błąd' }));
      console.error('❌ Błąd zapisywania subskrypcji:', errorData);
      alert(`❌ Błąd zapisywania subskrypcji: ${errorData.error || 'Nieznany błąd'}`);
    }
    
  } catch (error) {
    console.error('❌ Błąd testowania subskrypcji:', error);
    alert(`❌ Błąd testowania subskrypcji: ${error.message}`);
  }
}

// Funkcja do ręcznego sprawdzenia statusów (np. po odświeżeniu strony)
async function checkStatusChanges() {
  console.log('Sprawdzam zmiany statusów...');
  await checkForNewRequests();
}

// Funkcja eksportu do Excel (tylko dla adminów)
function exportToExcel(event) {
  console.log('Rozpoczynam eksport do Excel...');
  
  // Pokaż loading
  const button = event ? event.target : document.querySelector('button[onclick*="exportToExcel"]');
  if (!button) {
    console.error('Nie znaleziono przycisku eksportu');
    return;
  }
  
  const originalText = button.textContent;
  button.textContent = '⏳ EKSPORTUJĘ...';
  button.disabled = true;
  
  // Pobierz aktualny miesiąc i rok z URL lub użyj bieżący miesiąc
  const urlParams = new URLSearchParams(window.location.search);
  const year = urlParams.get('year') ? parseInt(urlParams.get('year')) : new Date().getFullYear();
  const month = urlParams.get('month') ? parseInt(urlParams.get('month')) : new Date().getMonth() + 1;
  
  console.log(`Eksportuję dla roku: ${year}, miesiąca: ${month}`);
  
  // Wywołaj API eksportu z parametrami miesiąca
  fetch(`/api/export/excel?year=${year}&month=${month}`, {
    method: 'GET',
    credentials: 'include',  // Wysyłaj cookies sesji
    headers: {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  })
    .then(response => {
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      
      if (!response.ok) {
        return response.text().then(text => {
          console.error('Error response body:', text);
          throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
        });
      }
      
      // Sprawdź czy to jest plik Excel
      const contentType = response.headers.get('Content-Type');
      console.log('Content-Type:', contentType);
      
      if (!contentType || !contentType.includes('spreadsheetml')) {
        return response.text().then(text => {
          console.error('Unexpected content type:', contentType);
          console.error('Response body:', text);
          throw new Error(`Oczekiwano pliku Excel, otrzymano: ${contentType}`);
        });
      }
      
      // Pobierz nazwę pliku z nagłówka Content-Disposition
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `grafik_sp4600_${year}_${month}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      console.log('Nazwa pliku:', filename);
      
      return response.blob().then(blob => {
        console.log('Rozmiar blob:', blob.size, 'bytes');
        return { blob, filename };
      });
    })
    .then(({ blob, filename }) => {
      if (blob.size === 0) {
        throw new Error('Pobrany plik jest pusty');
      }
      
      // Utwórz link do pobrania
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Wyczyść
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
      
      console.log('Eksport do Excel zakończony pomyślnie, plik:', filename);
      alert(`Plik ${filename} został pobrany pomyślnie!`);
    })
    .catch(error => {
      console.error('Błąd podczas eksportu do Excel:', error);
      alert(`Wystąpił błąd podczas eksportu do Excel: ${error.message}`);
    })
    .finally(() => {
      // Przywróć przycisk
      button.textContent = originalText;
      button.disabled = false;
    });
}

// Sprawdź zmiany statusów po załadowaniu strony
document.addEventListener('DOMContentLoaded', function() {
  // Poczekaj 2 sekundy po załadowaniu, żeby dane się załadowały
  setTimeout(checkStatusChanges, 2000);
});
