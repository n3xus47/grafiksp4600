/**
 * Aplikacja do zarządzania grafikiem zmian pracowników
 * Główny plik JavaScript z funkcjonalnością edycji, zarządzania pracownikami i próśbami o zamianę
 * 
 * Ten plik zawiera całą logikę frontend - edycję grafików, zarządzanie pracownikami,
 * system wymian, powiadomienia PWA i inne funkcje interfejsu użytkownika.
 */

(function(){
  // Funkcja do escapowania HTML (ochrona przed XSS)
  function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

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

  // Debounced fetch helper for API calls
  const debouncedFetch = debounce(async (url, options = {}) => {
    try {
      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, 300); // 300ms debounce for API calls

  // Cache DOM elements for better performance
  const clockElement = document.getElementById('clock');
  let lastMinute = -1; // Track last minute to avoid unnecessary updates
  
  // Funkcja aktualizacji zegara - pokazuje aktualną datę i czas
  function updateClock() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    
    // Only update if minute changed or it's the first call
    if (currentMinute === lastMinute && lastMinute !== -1) {
      return;
    }
    lastMinute = currentMinute;
    
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
    
    // Update cached element
    if (clockElement) {
      clockElement.textContent = `${datePart} ${timePart}`;
    }
  }
  
  // Inicjalizacja i aktualizacja zegara co minutę (zamiast co sekundę)
  updateClock();
  setInterval(updateClock, 60000); // Update every minute instead of every second
  
  // Aktualizuj zegar przy zmianie rozmiaru okna (z debouncing) - OPTYMALIZOWANE
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(updateClock, 200); // Increased from 100ms to 200ms for better performance
  }, { passive: true });
  
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
  }, { passive: false });

  // Sprawdź czy aplikacja jest już zainstalowana
  window.addEventListener('appinstalled', () => {
    console.log('PWA zostało zainstalowane');
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.remove();
    }
  }, { passive: true });

  
  // Cache DOM elements for better performance
  const table = document.querySelector('.table');
  let lastHighlightedDate = null;
  let cachedTodayElements = null;
  
  // Funkcja podświetlenia dzisiejszego dnia w kolumnach DATA i DZIEŃ
  function highlightToday() {
    const now = new Date();
    const todayISO = now.toISOString().split('T')[0]; // Format YYYY-MM-DD
    
    // Skip if already highlighted for today
    if (lastHighlightedDate === todayISO) {
      return;
    }
    
    // Remove 'today' class from all elements efficiently
    if (cachedTodayElements) {
      cachedTodayElements.forEach(element => {
        element.classList.remove('today', 'dniowka', 'nocka', 'poludniowka', 'custom-shift');
      });
    } else {
      // First time - cache all elements
      cachedTodayElements = Array.from(document.querySelectorAll('.col-date, .col-day, .slot'));
      cachedTodayElements.forEach(element => {
        element.classList.remove('today', 'dniowka', 'nocka', 'poludniowka', 'custom-shift');
      });
    }
    
    // Find and highlight today's row efficiently
    if (table) {
      const todayRow = table.querySelector(`tr:has([data-date="${todayISO}"])`);
      if (todayRow) {
        // Highlight all cells in today's row
        const rowDateCells = todayRow.querySelectorAll('.col-date');
        const rowDayCells = todayRow.querySelectorAll('.col-day');
        const rowSlots = todayRow.querySelectorAll('.slot');
        const rowSummaryCell = todayRow.querySelector('.col-summary');
        
        rowDateCells.forEach(cell => cell.classList.add('today'));
        rowDayCells.forEach(cell => cell.classList.add('today'));
        rowSlots.forEach(slot => {
          slot.classList.add('today');
          
          // Add shift-specific classes
          const content = slot.textContent.trim();
          if (content === 'D') {
            slot.classList.add('dniowka');
          } else if (content === 'N') {
            slot.classList.add('nocka');
          } else if (content && content.startsWith('P ')) {
            slot.classList.add('poludniowka');
          } else if (content && content.length > 0) {
            slot.classList.add('custom-shift');
          }
        });
        if (rowSummaryCell) rowSummaryCell.classList.add('today');
      }
    }
    
    lastHighlightedDate = todayISO;
  }
  
  // Cache current user elements for better performance
  let cachedCurrentUserElements = null;
  let lastCurrentUser = null;
  
  // Funkcja wyróżnienia zalogowanej osoby
  function highlightCurrentUser() {
    if (!table) return;
    
    const currentUserName = table.getAttribute('data-current-user');
    
    // Skip if already highlighted for this user
    if (lastCurrentUser === currentUserName) {
      return;
    }
    
    // Remove current-user class from all elements efficiently
    if (cachedCurrentUserElements) {
      cachedCurrentUserElements.forEach(element => {
        element.classList.remove('current-user');
      });
    } else {
      // First time - cache all elements
      cachedCurrentUserElements = Array.from(table.querySelectorAll('th.col-emp, .slot'));
    }
    
    if (currentUserName) {
      // Find and highlight current user elements efficiently
      cachedCurrentUserElements.forEach(element => {
        if (element.tagName === 'TH' && element.textContent.trim() === currentUserName) {
          element.classList.add('current-user');
        } else if (element.classList.contains('slot') && element.getAttribute('data-employee') === currentUserName) {
          element.classList.add('current-user');
        }
      });
    }
    
    lastCurrentUser = currentUserName;
  }
  
  // Cache summary elements for better performance
  let cachedSummaryElements = null;
  let lastSummaryData = null;
  
  // Funkcja aktualizacji licznika zmian (tylko dla adminów)
  function updateSummary() {
    if (!table) return;
    
    // Sprawdź czy użytkownik jest adminem (czy kolumna licznika istnieje)
    const summaryHeader = table.querySelector('.col-summary');
    if (!summaryHeader) return; // Nie jest adminem, nie aktualizuj
    
    // Cache summary elements on first run
    if (!cachedSummaryElements) {
      cachedSummaryElements = Array.from(table.querySelectorAll('tbody tr')).map(row => ({
        row,
        dniowkaElement: row.querySelector('.dniowka-count'),
        nockaElement: row.querySelector('.nocka-count'),
        poludniowkaElement: row.querySelector('.poludniowka-count'),
        slots: Array.from(row.querySelectorAll('.slot'))
      }));
    }
    
    // Calculate summary data
    const summaryData = cachedSummaryElements.map(({ slots }) => {
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
          poludniowkaCount++;
        }
      });
      
      return { dniowkaCount, nockaCount, poludniowkaCount };
    });
    
    // Skip if data hasn't changed
    if (JSON.stringify(summaryData) === JSON.stringify(lastSummaryData)) {
      return;
    }
    
    // Update summary elements
    cachedSummaryElements.forEach(({ dniowkaElement, nockaElement, poludniowkaElement }, index) => {
      const data = summaryData[index];
      if (dniowkaElement) dniowkaElement.textContent = data.dniowkaCount;
      if (nockaElement) nockaElement.textContent = data.nockaCount;
      if (poludniowkaElement) poludniowkaElement.textContent = data.poludniowkaCount;
    });
    
    lastSummaryData = summaryData;
  }
  
  // Uruchom podświetlenie
  highlightToday();
  highlightCurrentUser();
  updateSummary();
  setInterval(highlightToday, 60000); // Aktualizuj co minutę - OPTYMALIZOWANE


})();

// ============================================================================
// SPOTIFY-STYLE FUNCTION PANEL
// ============================================================================

function initializeHamburgerMenu() {
  console.log('🎵 Inicjalizuję Spotify-style function panel...');
  
  const hamburgerBtn = document.getElementById('hamburger-menu');
  const hamburgerPanel = document.getElementById('hamburger-menu-panel');
  
  console.log('🔍 Elementy function panel:', {
    hamburgerBtn: !!hamburgerBtn,
    hamburgerPanel: !!hamburgerPanel
  });
  
  if (!hamburgerBtn || !hamburgerPanel) {
    console.warn('⚠️ Nie znaleziono elementów function panel');
    return;
  }
  
  // Toggle panel (otwórz/zamknij)
  hamburgerBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (hamburgerPanel.classList.contains('hidden')) {
      openHamburgerMenu();
    } else {
      closeHamburgerMenu();
    }
  });
  
  // Panel można zamknąć tylko przyciskiem X lub klawiszem Escape
  
  // Zamknij panel po naciśnięciu Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !hamburgerPanel.classList.contains('hidden')) {
      closeHamburgerMenu();
    }
  }, { passive: true });
  
  // Dodaj obsługę przycisków menu
  setupMenuButtons();
  
  // Dodaj obsługę filtrów Spotify
  setupSpotifyFilters();
  
  console.log('✅ Spotify-style function panel zainicjalizowany');
}

function setupMenuButtons() {
  console.log('🔧 Konfiguruję przyciski hamburger menu...');
  
  // Obsługa wszystkich przycisków menu
  const menuButtons = [
    'menu-btn-employees',
    'menu-btn-swaps-admin', 
    'menu-btn-swaps-user',
    'menu-btn-whitelist',
    'menu-btn-edit',
    'menu-btn-unavailability',
    'menu-btn-shifts',
    'menu-btn-export',
    'menu-btn-refresh'
  ];
  
  console.log('🔍 Sprawdzam przyciski menu:', menuButtons);
  
  menuButtons.forEach(menuButtonId => {
    const menuButton = document.getElementById(menuButtonId);
    console.log(`🔍 Przycisk ${menuButtonId}:`, !!menuButton);
    if (menuButton) {
      menuButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🍔 Kliknięto przycisk menu: ${menuButtonId}`);
        
        closeHamburgerMenu();
        
        // Uruchom odpowiednią funkcję po zamknięciu menu
        setTimeout(() => {
          console.log(`🎯 Uruchamiam funkcję dla: ${menuButtonId}`);
          
          // Bezpośrednie wywołanie funkcji
          if (menuButtonId === 'menu-btn-employees') {
            console.log('👥 Uruchamiam toggleEmps');
            if (typeof toggleEmps === 'function') {
              toggleEmps();
            } else {
              console.error('❌ toggleEmps nie jest funkcją!');
            }
          } else if (menuButtonId === 'menu-btn-swaps-admin' || menuButtonId === 'menu-btn-swaps-user') {
            console.log('🔄 Uruchamiam toggleSwaps');
            if (typeof toggleSwaps === 'function') {
              toggleSwaps();
            } else {
              console.error('❌ toggleSwaps nie jest funkcją!');
            }
          } else if (menuButtonId === 'menu-btn-edit') {
            console.log('✏️ Uruchamiam toggleEdit');
            if (typeof toggleEdit === 'function') {
              toggleEdit();
            } else {
              console.error('❌ toggleEdit nie jest funkcją!');
            }
          } else if (menuButtonId === 'menu-btn-unavailability') {
            console.log('❌ Otwieramy modal niedyspozycji');
            const modal = document.getElementById('unavailability-modal');
            if (modal) {
              modal.style.display = 'flex';
              // Inicjalizuj kalendarz z aktualnym miesiącem
              const monthInput = document.getElementById('unavailability-month');
              if (monthInput) {
                const now = new Date();
                const currentMonthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
                monthInput.value = currentMonthStr;
                monthInput.readOnly = true;
                
                // Ustaw currentMonth globalnie
                currentMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
                console.log('📅 Ustawiono currentMonth:', currentMonth);
              }
              
              // Wyczyść wybrane dni
              selectedDays = [];
              
              // Wywołaj updateCalendar
              if (typeof updateCalendar === 'function') {
                updateCalendar();
              } else {
                console.error('❌ updateCalendar nie jest funkcją!');
              }
              
              // Zaktualizuj listę wybranych dni i etykietę miesiąca
              if (typeof updateSelectedDaysList === 'function') {
                updateSelectedDaysList();
              }
              if (typeof updateMonthLabel === 'function') {
                updateMonthLabel();
              }
            } else {
              console.error('❌ Modal niedyspozycji nie znaleziony!');
            }
          } else if (menuButtonId === 'menu-btn-shifts') {
            console.log('⏰ Uruchamiam toggleShifts');
            if (typeof toggleShifts === 'function') {
              toggleShifts();
            } else {
              console.error('❌ toggleShifts nie jest funkcją!');
            }
          } else if (menuButtonId === 'menu-btn-export') {
            console.log('📊 Uruchamiam eksport do Excel');
            console.log('📊 Sprawdzam czy funkcja exportToExcel istnieje...');
            console.log('📊 typeof exportToExcel:', typeof exportToExcel);
            if (typeof exportToExcel === 'function') {
              console.log('✅ Funkcja exportToExcel istnieje, wywołuję...');
              // Znajdź przycisk i przekaż go do funkcji
              const button = document.querySelector('#menu-btn-export');
              if (button) {
                console.log('✅ Znaleziono przycisk, przekazuję go do funkcji');
                exportToExcel({ target: button });
              } else {
                console.error('❌ Nie znaleziono przycisku eksportu');
              }
            } else {
              console.error('❌ exportToExcel nie jest funkcją!');
              console.error('❌ Dostępne funkcje:', Object.keys(window).filter(key => typeof window[key] === 'function'));
            }
          } else if (menuButtonId === 'menu-btn-refresh') {
            console.log('🔄 Uruchamiam odświeżanie cache');
            if (typeof forcePageRefresh === 'function') {
              forcePageRefresh();
            } else {
              console.error('❌ forcePageRefresh nie jest funkcją!');
            }
          }
        }, 350);
      });
    } else {
      console.warn(`⚠️ Nie znaleziono przycisku menu: ${menuButtonId}`);
    }
  });
  
  console.log('✅ Przyciski hamburger menu skonfigurowane');
}

function openHamburgerMenu() {
  console.log('🍔 Otwieram hamburger menu...');
  
  const hamburgerPanel = document.getElementById('hamburger-menu-panel');
  const hamburgerBtn = document.getElementById('hamburger-menu');
  
  if (!hamburgerPanel || !hamburgerBtn) return;
  
  // Dodaj klasę active do przycisku (zmiana burger → X)
  hamburgerBtn.classList.add('active');
  
  // Reset animacji - usuń klasy animacji i dodaj je ponownie
  const title = hamburgerPanel.querySelector('.spotify-panel-title');
  const icon = hamburgerPanel.querySelector('.spotify-functions-icon');
  const buttons = hamburgerPanel.querySelectorAll('.spotify-function-card');
  
  // Reset animacji
  if (title) {
    title.style.animation = 'none';
    title.style.opacity = '0';
    title.style.transform = 'translateY(20px)';
  }
  if (icon) {
    icon.style.animation = 'none';
    icon.style.opacity = '0';
    icon.style.transform = 'translateY(20px)';
  }
  buttons.forEach(button => {
    button.style.animation = 'none';
    button.style.opacity = '0';
    button.style.transform = 'translateY(20px)';
  });
  
  // Usuń klasę hidden - animacja zadziała przez transition
  hamburgerPanel.classList.remove('hidden');
  
  // Przywróć animacje po krótkim opóźnieniu
  setTimeout(() => {
    if (title) {
      title.style.animation = 'fadeInUpTitle 0.6s ease 0.2s forwards';
    }
    if (icon) {
      icon.style.animation = 'fadeInUpIcon 0.6s ease 0.1s forwards';
    }
    buttons.forEach((button, index) => {
      button.style.animation = `fadeInUpButton 0.5s ease ${0.3 + index * 0.1}s forwards`;
    });
  }, 50);
  
  // Focus na pierwszy element menu po animacji
  setTimeout(() => {
    const firstButton = hamburgerPanel.querySelector('.spotify-function-card');
    if (firstButton) {
      firstButton.focus();
    }
  }, 800); // Po zakończeniu wszystkich animacji
  
  console.log('✅ Hamburger menu otwarte');
}

function closeHamburgerMenu() {
  console.log('🍔 Zamykam hamburger menu...');
  
  const hamburgerPanel = document.getElementById('hamburger-menu-panel');
  const hamburgerBtn = document.getElementById('hamburger-menu');
  
  if (!hamburgerPanel || !hamburgerBtn) return;
  
  // Usuń klasę active z przycisku (zmiana X → burger)
  hamburgerBtn.classList.remove('active');
  
  // Dodaj klasę hidden - animacja zadziała przez transition
  hamburgerPanel.classList.add('hidden');
  
  // Nie trzeba przywracać scroll - nie był blokowany
  
  console.log('✅ Hamburger menu zamknięte');
}

// ============================================================================
// SPOTIFY-STYLE PANEL FUNCTIONS
// ============================================================================

// Funkcje Spotify panel zostały usunięte - używamy hamburger menu

// Nowa funkcja dla filtrów Spotify
function setupSpotifyFilters() {
  console.log('🎵 Konfiguruję filtry Spotify...');
  
  const chips = document.querySelectorAll('.spotify-chip');
  
  chips.forEach(chip => {
    chip.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const filter = this.getAttribute('data-filter');
      console.log('🎵 Wybrano filtr:', filter);
      
      // Usuń aktywną klasę z wszystkich chipów
      chips.forEach(c => c.classList.remove('active'));
      
      // Dodaj aktywną klasę do wybranego chipu
      this.classList.add('active');
      
      // Pokaż odpowiednią sekcję
      showSpotifySection(filter);
    });
  });
  
  console.log('✅ Filtry Spotify skonfigurowane');
}

function showSpotifySection(filter) {
  console.log('🎵 Pokazuję sekcję:', filter);
  
  const sections = document.querySelectorAll('.spotify-section');
  
  sections.forEach(section => {
    const sectionFilter = section.getAttribute('data-section');
    if (sectionFilter === filter) {
      section.classList.remove('hidden');
    } else {
      section.classList.add('hidden');
    }
  });
}

// Funkcja pomocnicza do obsługi kliknięć w elementy menu
function handleMenuItemClick(buttonId, callback) {
  const button = document.getElementById(buttonId);
  if (button) {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      closeHamburgerMenu();
      if (callback) {
        setTimeout(callback, 350); // Poczekaj aż menu się zamknie
      }
    });
  }
}

// Inicjalizuj hamburger menu po załadowaniu DOM
document.addEventListener('DOMContentLoaded', function() {
  initializeHamburgerMenu();
  initializeUnavailabilityModal();
});

// ============================================================================
// INICJALIZACJA MODALA NIEDYSPOZYCJI
// ============================================================================

// Funkcja inicjalizacji modala niedyspozycji - przeniesiona z IIFE
function initializeUnavailabilityModal() {
  console.log('🔧 Inicjalizuję modal niedyspozycji...');
  
  const modal = document.getElementById('unavailability-modal');
  const closeBtn = document.getElementById('unavailability-close');
  const cancelBtn = document.getElementById('unavailability-cancel');
  const submitBtn = document.getElementById('unavailability-submit');
  const monthInput = document.getElementById('unavailability-month');
  const prevMonthBtn = document.getElementById('unavailability-prev-month');
  const nextMonthBtn = document.getElementById('unavailability-next-month');
  const monthLabel = document.getElementById('unavailability-month-label');
  
  console.log('🔍 Elementy modala niedyspozycji:', {
    modal: !!modal,
    closeBtn: !!closeBtn,
    cancelBtn: !!cancelBtn,
    submitBtn: !!submitBtn,
    monthInput: !!monthInput,
    prevMonthBtn: !!prevMonthBtn,
    nextMonthBtn: !!nextMonthBtn,
    monthLabel: !!monthLabel
  });
  
  if (!modal) {
    console.warn('⚠️ Modal niedyspozycji nie znaleziony');
    return;
  }
  
  console.log('✅ Modal niedyspozycji znaleziony, dodaję event listenery...');
  
  // Zamknij modal
  [closeBtn, cancelBtn].forEach((btn, index) => {
    if (btn) {
      console.log(`🔧 Dodaję event listener do przycisku ${index === 0 ? 'close' : 'cancel'}`);
      btn.addEventListener('click', (e) => {
        console.log('❌ Zamykam modal niedyspozycji', e.target);
        modal.classList.remove('show');
        modal.style.display = 'none';
        console.log('✅ Modal ukryty, display: none');
      });
    } else {
      console.warn(`⚠️ Przycisk ${index === 0 ? 'close' : 'cancel'} nie znaleziony`);
    }
  });
  
  // Nawigacja miesiącami
  if (prevMonthBtn) {
    console.log('🔧 Dodaję event listener do przycisku poprzedni miesiąc');
    prevMonthBtn.addEventListener('click', () => {
      console.log('⬅️ Poprzedni miesiąc');
      navigateMonth(-1);
    });
  } else {
    console.warn('⚠️ Przycisk poprzedni miesiąc nie znaleziony');
  }
  
  if (nextMonthBtn) {
    console.log('🔧 Dodaję event listener do przycisku następny miesiąc');
    nextMonthBtn.addEventListener('click', () => {
      console.log('➡️ Następny miesiąc');
      navigateMonth(1);
    });
  } else {
    console.warn('⚠️ Przycisk następny miesiąc nie znaleziony');
  }
  
  // Zmiana miesiąca przez input (ukryty)
  if (monthInput) {
    monthInput.addEventListener('change', () => {
      console.log('📅 Zmiana miesiąca przez input');
      if (typeof selectedDays !== 'undefined') {
        selectedDays = [];
      }
      if (typeof updateCalendar === 'function') {
        updateCalendar();
      }
      if (typeof updateSelectedDaysList === 'function') {
        updateSelectedDaysList();
      }
      updateMonthLabel();
    });
  }
  
  // Wyślij zgłoszenie
  if (submitBtn) {
    console.log('🔧 Dodaję event listener do przycisku submit');
    submitBtn.addEventListener('click', () => {
      console.log('📤 Wysyłanie zgłoszenia niedyspozycji');
      if (typeof submitUnavailability === 'function') {
        submitUnavailability();
      } else {
        console.error('❌ submitUnavailability nie jest funkcją!');
      }
    });
  } else {
    console.warn('⚠️ Przycisk submit nie znaleziony');
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
  
  
  console.log('✅ Modal niedyspozycji zainicjalizowany');
}

// ============================================================================
// GLOBALNE ZMIENNE I FUNKCJE
// ============================================================================

// Globalne zmienne dla niedyspozycji
let selectedDays = [];
let currentMonth = null;

// ============================================================================
// FUNKCJE NAWIGACJI MIESIĄCAMI - PRZENIESIONE Z IIFE
// ============================================================================

// Funkcja nawigacji miesiącami
function navigateMonth(direction) {
  console.log('🔄 Nawigacja miesiącami:', direction);
  
  if (typeof currentMonth === 'undefined' || !currentMonth) {
    console.warn('⚠️ currentMonth nie jest zdefiniowany');
    return;
  }
  
  currentMonth.month += direction;
  if (currentMonth.month > 12) {
    currentMonth.month = 1;
    currentMonth.year++;
  } else if (currentMonth.month < 1) {
    currentMonth.month = 12;
    currentMonth.year--;
  }
  
  const newMonthStr = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;
  const monthInput = document.getElementById('unavailability-month');
  if (monthInput) {
    monthInput.value = newMonthStr;
  }
  
  if (typeof selectedDays !== 'undefined') {
    selectedDays = [];
  }
  
  if (typeof updateCalendar === 'function') {
    updateCalendar();
  }
  
  if (typeof updateSelectedDaysList === 'function') {
    updateSelectedDaysList();
  }
  
  updateMonthLabel();
  console.log('✅ Miesiąc zmieniony na:', newMonthStr);
}

// Aktualizuj etykietę miesiąca
function updateMonthLabel() {
  const monthLabel = document.getElementById('unavailability-month-label');
  
  if (!monthLabel || typeof currentMonth === 'undefined' || !currentMonth) {
    console.warn('⚠️ monthLabel lub currentMonth nie jest dostępny');
    return;
  }
  
  const monthNames = ['', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
                    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
  monthLabel.textContent = `${monthNames[currentMonth.month]} ${currentMonth.year}`;
  console.log('✅ Etykieta miesiąca zaktualizowana:', monthLabel.textContent);
}

// Aktualizuj listę wybranych dni
function updateSelectedDaysList() {
  const list = document.getElementById('selected-days-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (typeof selectedDays === 'undefined' || !selectedDays) {
    selectedDays = [];
  }
  
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

// ============================================================================
// FUNKCJA SUBMIT NIEDYSPOZYCJI - PRZENIESIONA Z IIFE
// ============================================================================

// Wyślij zgłoszenie niedyspozycji
async function submitUnavailability() {
  console.log('📤 Wywołuję submitUnavailability...');
  
  const monthInput = document.getElementById('unavailability-month');
  const submitBtn = document.getElementById('unavailability-submit');
  
  if (!monthInput || !submitBtn) {
    console.error('❌ Brak monthInput lub submitBtn');
    return;
  }
  
  if (typeof selectedDays === 'undefined' || selectedDays.length === 0) {
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
      const modal = document.getElementById('unavailability-modal');
      modal.classList.remove('show');
      modal.style.display = 'none';
      if (typeof selectedDays !== 'undefined') {
        selectedDays = [];
      }
      if (typeof updateCalendar === 'function') {
        updateCalendar();
      }
      if (typeof updateSelectedDaysList === 'function') {
        updateSelectedDaysList();
      }
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

// ============================================================================
// GLOBALNE FUNKCJE DLA HAMBURGER MENU
// ============================================================================

// Funkcja toggleSwaps - przeniesiona z IIFE
function toggleSwaps() {
  // Użyj nowej funkcji toggleSwap
  toggleSwap();
}

// Funkcja updateCalendar - przeniesiona z IIFE
function updateCalendar() {
  const monthInput = document.getElementById('unavailability-month');
  const calendar = document.getElementById('unavailability-calendar');
  
  if (!monthInput || !calendar) return;
  
  const monthYear = monthInput.value;
  if (!monthYear) return;
  
  const [year, month] = monthYear.split('-').map(Number);
  // currentMonth musi być globalna zmienna
  if (typeof currentMonth !== 'undefined') {
    currentMonth = { year, month };
  }
  
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
    
    // Sprawdź czy dzień jest już wybrany (selectedDays musi być globalna)
    if (typeof selectedDays !== 'undefined' && selectedDays.includes(dateStr)) {
      dayCell.classList.add('selected');
    }
    
    // Kliknięcie na dzień
    dayCell.addEventListener('click', () => {
      if (dayCell.classList.contains('other-month')) return;
      
      const dateStr = dayCell.dataset.date;
      
      if (typeof selectedDays !== 'undefined') {
        if (selectedDays.includes(dateStr)) {
          // Usuń z wybranych
          selectedDays = selectedDays.filter(d => d !== dateStr);
          dayCell.classList.remove('selected');
        } else {
          // Dodaj do wybranych
          selectedDays.push(dateStr);
          dayCell.classList.add('selected');
        }
        
        // Wywołaj updateSelectedDaysList jeśli istnieje
        if (typeof updateSelectedDaysList === 'function') {
          updateSelectedDaysList();
        }
      }
    });
    
    calendar.appendChild(dayCell);
  }
}

// Funkcja toggleShifts - przeniesiona z IIFE
function toggleShifts() {
  console.log('toggleShifts called');
  const shiftsEditor = document.getElementById('shifts-editor');
  console.log('shiftsEditor:', shiftsEditor);
  if (shiftsEditor) {
    console.log('Adding show class to shiftsEditor');
    shiftsEditor.classList.add('show');
    // Wywołaj funkcje pomocnicze jeśli istnieją
    if (typeof populateOwnShifts === 'function') {
      populateOwnShifts('shifts-from-date');
      populateOwnShifts('shifts-give-from-date');
    }
    if (typeof switchShiftForm === 'function') {
      switchShiftForm();
    }
  } else {
    console.error('shiftsEditor not found!');
  }
}

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

// Nasłuchuj zmian rozmiaru okna - OPTYMALIZOWANE z throttling
let resizeThrottle;
window.addEventListener('resize', function() {
  clearTimeout(resizeThrottle);
  resizeThrottle = setTimeout(handleResponsiveDesign, 150); // Throttle resize events
}, { passive: true });
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
          initializePushSubscription();
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
        // Ukryj przycisk po instalacji
        hideInstallButton();
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

// Funkcja ukrywania przycisku instalacji PWA
function hideInstallButton() {
  const pwaBtn = document.querySelector('.pwa-btn');
  if (pwaBtn) {
    pwaBtn.style.display = 'none';
    console.log('Przycisk PWA ukryty po instalacji');
  }
}

// Sprawdź czy PWA jest już zainstalowane
function checkIfPWAInstalled() {
  // Sprawdź czy aplikacja działa w trybie standalone (zainstalowana)
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true) {
    console.log('PWA jest już zainstalowane - ukrywam przycisk');
    hideInstallButton();
    return true;
  }
  return false;
}

// ===== WEB PUSH NOTIFICATIONS =====

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
        'X-CSRFToken': window.csrfToken
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

// Inicjalizacja subskrypcji push
async function initializePushSubscription() {
  try {
    console.log('🚀 Inicjalizacja Web Push Notifications...');
    
    // Pobierz klucz VAPID z serwera
    console.log('📡 Pobieranie klucza VAPID z serwera...');
    const response = await fetch('/api/push/vapid-key');
    const data = await response.json();
    console.log('✅ Klucz VAPID pobrany:', data.public_key.substring(0, 20) + '...');
    
    // Sprawdź uprawnienia do powiadomień
    console.log('🔔 Sprawdzanie uprawnień do powiadomień...');
    console.log('Aktualny status uprawnień:', Notification.permission);
    
    if (Notification.permission !== 'granted') {
      console.log('❌ Uprawnienia do powiadomień nie są włączone');
      return;
    }
    
    console.log('✅ Uprawnienia do powiadomień są włączone');
    
    // Sprawdź czy Service Worker jest gotowy
    if (!('serviceWorker' in navigator)) {
      console.log('❌ Service Worker nie jest obsługiwany');
      return;
    }
    
    console.log('🔧 Sprawdzanie Service Worker...');
    console.log('🔧 Service Worker jest obsługiwany, czekam na gotowość...');
    
    // Sprawdź istniejące rejestracje
    const existingRegistrations = await navigator.serviceWorker.getRegistrations();
    console.log('📋 Istniejące rejestracje Service Worker:', existingRegistrations.length);
    
    if (existingRegistrations.length > 0) {
      console.log('ℹ️ Znaleziono istniejące rejestracje:', existingRegistrations);
      for (let i = 0; i < existingRegistrations.length; i++) {
        const reg = existingRegistrations[i];
        console.log(`📋 Rejestracja ${i}:`, {
          scope: reg.scope,
          installing: reg.installing,
          waiting: reg.waiting,
          active: reg.active,
          state: reg.active ? reg.active.state : 'unknown'
        });
      }
    }
    
    // Czekaj na gotowość Service Worker z timeout
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Service Worker timeout - nie odpowiedział w ciągu 10 sekund')), 10000)
    );
    
    console.log('⏱️ Czekam na Service Worker z timeout 10s...');
    let registration;
    try {
      registration = await Promise.race([readyPromise, timeoutPromise]);
      console.log('✅ Service Worker gotowy:', registration);
    } catch (error) {
      console.log('❌ Błąd Service Worker ready:', error);
      console.log('🔄 Próbuję użyć istniejącej rejestracji jako fallback...');
      
      if (existingRegistrations.length > 0) {
        registration = existingRegistrations[0];
        console.log('✅ Używam istniejącej rejestracji:', registration);
      } else {
        console.log('❌ Brak dostępnych rejestracji Service Worker');
        return;
      }
    }
    
    // Sprawdź istniejącą subskrypcję
    console.log('🔍 Sprawdzanie istniejącej subskrypcji...');
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('Istniejąca subskrypcja:', subscription);
      console.log('ℹ️ Używam istniejącej subskrypcji');
    } else {
      console.log('🆕 Tworzenie nowej subskrypcji push...');
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
        return;
      }
    }
    
    // Zapisz subskrypcję na serwerze
    console.log('💾 Zapisuję subskrypcję na serwerze...');
    const saveResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': window.csrfToken
      },
      body: JSON.stringify(subscription),
      credentials: 'include'
    });
    
    console.log('Odpowiedź serwera:', saveResponse.status);
    
    if (saveResponse.ok) {
      const result = await saveResponse.json();
      console.log('✅ Subskrypcja zapisana pomyślnie:', result);
      
      // Uruchom background sync
      if ('sync' in window.ServiceWorkerRegistration.prototype) {
        console.log('🔄 Rejestruję background sync...');
        registration.sync.register('check-notifications');
      }
      
      // Sprawdź nowe prośby co 30 sekund
      console.log('⏰ Uruchamiam sprawdzanie nowych prośb co 30 sekund...');
      startNotificationChecking();
      
      console.log('🎉 Web Push Notifications zainicjalizowane pomyślnie!');
    } else {
      const error = await saveResponse.json();
      console.error('❌ Błąd zapisywania subskrypcji:', error);
    }
    
  } catch (error) {
    console.error('❌ Błąd inicjalizacji subskrypcji push:', error);
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

// ===== SYSTEM MOTYWÓW =====

// Inicjalizacja systemu motywów
function initializeThemeSystem() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const body = document.body;
  
  if (!themeToggle || !themeIcon) {
    console.warn('Elementy przełącznika motywu nie zostały znalezione');
    return;
  }
  
  // Wczytaj zapisany motyw z localStorage
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // Ustaw domyślny motyw
  let currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  // Zastosuj motyw
  applyTheme(currentTheme);
  
  // Event listener dla przełącznika
  themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    
    // Zapisz preferencję
    localStorage.setItem('theme', currentTheme);
    
    // Animacja ikony
    themeToggle.classList.add('rotating');
    setTimeout(() => {
      themeToggle.classList.remove('rotating');
    }, 500);
  });
  
  // Nasłuchuj zmian preferencji systemu
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!savedTheme) { // Tylko jeśli użytkownik nie ustawił własnej preferencji
      currentTheme = e.matches ? 'dark' : 'light';
      applyTheme(currentTheme);
    }
  });
}

// Zastosuj motyw do strony
function applyTheme(theme) {
  const body = document.body;
  const themeIcon = document.getElementById('theme-icon');
  
  if (theme === 'light') {
    body.classList.add('light-mode');
    // Zmień ikonę na słońce
    themeIcon.innerHTML = `
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39.39 1.03.39 1.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41z"/>
    `;
  } else {
    body.classList.remove('light-mode');
    // Zmień ikonę na księżyc
    themeIcon.innerHTML = `
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
    `;
  }
  
  console.log(`Motyw zmieniony na: ${theme}`);
}

// Główna funkcja aplikacji
document.addEventListener('DOMContentLoaded', function() {
  console.log('Aplikacja została załadowana');
  
  // Inicjalizuj system motywów
  initializeThemeSystem();
  
  // Sprawdź czy PWA jest już zainstalowane
  checkIfPWAInstalled();
  
  // Inicjalizuj responsywny design
  handleResponsiveDesign();
  
  // Inicjalizuj Web Push jeśli użytkownik jest zalogowany
  const isLoggedIn = document.querySelector('[data-current-user]') !== null;
  if (isLoggedIn) {
    console.log('✅ Użytkownik jest zalogowany w DOMContentLoaded, inicjalizuję Web Push...');
    // Poczekaj chwilę żeby Service Worker się zarejestrował
    setTimeout(() => {
      initializePushSubscription();
    }, 1000);
  } else {
    console.log('⏳ Użytkownik nie jest zalogowany w DOMContentLoaded');
  }
  
  // Pobierz wszystkie potrzebne elementy DOM
  const table = document.getElementById('grafik');
  const btnToggle = document.getElementById('btn-edit');
  const editor = document.getElementById('slot-editor');
  const todayActions = document.getElementById('shifts-actions');
  const input = document.getElementById('opt-custom');
  const btnSaveToday = document.getElementById('save-shifts');
  const btnCancelToday = document.getElementById('cancel-shifts');
  const pHoursPanel = document.getElementById('p-hours-panel');
  const pStartHour = document.getElementById('p-start-hour');
  const pEndHour = document.getElementById('p-end-hour');
  const pConfirm = document.getElementById('p-confirm');
  const btnEmps = document.getElementById('btn-emps');
  const empEditor = document.getElementById('emp-editor');
  const empList = document.getElementById('emp-list');
  const empName = document.getElementById('emp-name');
  const empCode = document.getElementById('emp-code');
  const empEmail = document.getElementById('emp-email');
  const empClose = document.getElementById('emp-close');
  const btnSwaps = document.getElementById('btn-swaps-admin') || document.getElementById('btn-swaps-user');
  const btnWhitelist = document.getElementById('btn-whitelist');
  const whitelistEditor = document.getElementById('whitelist-editor');
  const whitelistClose = document.getElementById('whitelist-close');
  const whitelistList = document.getElementById('whitelist-list');
  const whitelistEmail = document.getElementById('whitelist-email');
  const whitelistAddBtn = document.getElementById('whitelist-add-btn');
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
  
  // Synchronizuj z globalnymi zmiennymi
  globalEditMode = editMode;
  globalPending = pending;
  
  // Udostępnij lokalną zmienną globalnie
  window.localEditMode = editMode;
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
    if (editMode || globalEditMode || window.localEditMode) {
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

  // Funkcje trybu edycji - synchronizuj z globalnymi zmiennymi
  function toggleEdit() {
    // Użyj requestAnimationFrame dla lepszej wydajności
    requestAnimationFrame(() => {
      editMode = !editMode;
      globalEditMode = editMode; // Synchronizuj z globalną zmienną
      window.localEditMode = editMode; // Synchronizuj z window
      if (todayActions) todayActions.classList.toggle('hidden', !editMode);
      
      // Dodaj/usuń klasę edit-mode na body dla delikatnego mrygania
      document.body.classList.toggle('edit-mode', editMode);
      
      if (!editMode) { 
        pending.clear(); 
        globalPending.clear(); // Synchronizuj z globalną zmienną
        hideEditor(); 
      }
    });
  }

  function save() {
    const finish = () => {
      pending.clear();
      globalPending.clear(); // Synchronizuj z globalną zmienną
      editMode = false;
      globalEditMode = false; // Synchronizuj z globalną zmienną
      window.localEditMode = false; // Synchronizuj z window
      if (todayActions) todayActions.classList.add('hidden');
      document.body.classList.remove('edit-mode'); // Usuń klasę edit-mode
      hideEditor();
      // Odśwież stronę natychmiast
      window.location.reload();
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
    
    // Walidacja danych przed wysłaniem
    const validationErrors = [];
    changes.forEach((change, index) => {
      if (!change.date || change.date.length !== 10) {
        validationErrors.push(`Zmiana ${index + 1}: Nieprawidłowa data`);
      }
      if (!change.name || change.name.trim().length === 0) {
        validationErrors.push(`Zmiana ${index + 1}: Nazwa pracownika nie może być pusta`);
      }
      if (change.name && change.name.length > 255) {
        validationErrors.push(`Zmiana ${index + 1}: Nazwa pracownika zbyt długa`);
      }
      if (change.value && change.value.length > 100) {
        validationErrors.push(`Zmiana ${index + 1}: Typ zmiany zbyt długi`);
      }
    });
    
    if (validationErrors.length > 0) {
      alert('Błędy walidacji:\n' + validationErrors.join('\n'));
      return;
    }
    
    fetch('/api/save', {
      method: 'POST', 
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': window.csrfToken
      },
      body: JSON.stringify({ changes }),
      credentials: 'include'
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        alert('Błąd podczas zapisywania: ' + data.error);
      } else {
        finish();
        // Zmiany zapisują się cicho bez komunikatu
      }
    })
    .catch(error => {
      console.error('Błąd podczas zapisywania:', error);
      alert('Wystąpił błąd podczas zapisywania zmian');
    });
  }
  
  function cancel() {
    editMode = false;
    globalEditMode = false; // Synchronizuj z globalną zmienną
    window.localEditMode = false; // Synchronizuj z window
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
  
  // Event delegation dla przycisków save/cancel (dla dynamicznie tworzonych przycisków)
  const shiftsActions = document.getElementById('shifts-actions');
  if (shiftsActions) {
    shiftsActions.addEventListener('click', function(e) {
      if (e.target && e.target.id === 'save-shifts') {
        e.preventDefault();
        if (typeof save === 'function') {
          save();
        }
      } else if (e.target && e.target.id === 'cancel-shifts') {
        e.preventDefault();
        if (typeof cancel === 'function') {
          cancel();
        }
      }
    });
  }
  
  // Event listener dla przycisku publikacji draft
  const btnPublishDraft = document.getElementById('publish-draft-shifts');
  if (btnPublishDraft) btnPublishDraft.addEventListener('click', publishDraftChanges);
  
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
          <div>
            <div class="emp-name-code-line">
              <div class="emp-name-edit">
                <input type="text" class="emp-name-input" value="${emp.name}" data-id="${emp.id}" data-field="name" style="display: none;">
                <span class="emp-name-display">${emp.name}</span>
              </div>
              <div class="emp-code-edit">
                <input type="text" class="emp-code-input" value="${emp.code || ''}" data-id="${emp.id}" data-field="code" style="display: none;">
                <span class="emp-code-display">(${emp.code || '-'})</span>
              </div>
            </div>
            <div class="emp-email-edit">
              <input type="email" class="emp-email-input" value="${emp.email || ''}" data-id="${emp.id}" data-field="email" style="display: none;">
              <small class="emp-email-display" style="${emp.email ? '' : 'display: none;'}">${emp.email || ''}</small>
            </div>
          </div>
          <div class="emp-actions">
            <button data-id="${emp.id}" class="btn btn-edit">
              Edytuj
            </button>
            <button data-id="${emp.id}" class="btn btn-save" style="display: none;">
              Zapisz
            </button>
            <button data-id="${emp.id}" class="btn btn-cancel" style="display: none;">
              Anuluj
            </button>
            <button data-id="${emp.id}" class="btn">
              Usuń
            </button>
          </div>
        `;
        
        // Przycisk edycji
        row.querySelector('.btn-edit').addEventListener('click', () => {
          startInlineEdit(row, emp);
        });
        
        // Przycisk zapisz
        row.querySelector('.btn-save').addEventListener('click', () => {
          saveInlineEdit(row, emp);
        });
        
        // Przycisk anuluj
        row.querySelector('.btn-cancel').addEventListener('click', () => {
          cancelInlineEdit(row, emp);
        });
        
        // Przycisk usuwania
        const deleteBtn = Array.from(row.querySelectorAll('.btn')).find(btn => btn.textContent.trim() === 'Usuń');
        console.log('🔍 Znaleziony przycisk usuwania:', deleteBtn);
        if (deleteBtn) deleteBtn.addEventListener('click', () => {
          fetch(`/api/employees/${emp.id}`, { 
            method: 'DELETE',
            headers: { 'X-CSRFToken': window.csrfToken },
            credentials: 'include'
          })
              .then(response => response.json())
              .then(data => {
                if (data.error) {
                  console.error('Błąd podczas usuwania:', data.error);
                } else {
                  // Zaktualizuj cache
                  window.employeesCache = window.employeesCache.filter(e => e.id !== emp.id);
                  window.employeesCacheTime = Date.now();
                  loadEmployees();
                }
              })
              .catch(error => {
                console.error('Błąd podczas usuwania pracownika:', error);
              });
        });
        
        fragment.appendChild(row);
      }
      
      // Wyczyść i dodaj wszystkie elementy jednocześnie
      empList.innerHTML = '';
      empList.appendChild(fragment);
    });
  }
  
  
  

  
  function closeEmps() { 
    if (empEditor) empEditor.classList.remove('show') 
  }
  
  function addEmp() {
    if (!empName) return;
    const name = (empName.value || '').trim();
    const code = (empCode.value || '').trim();
    const email = (empEmail.value || '').trim();
    
    // Walidacja
    if (!name) {
      alert('Imię pracownika jest wymagane');
      empName.focus();
      return;
    }
    
    if (email && !isValidEmail(email)) {
      alert('Podaj prawidłowy adres email');
      empEmail.focus();
      return;
    }
    
    // Pokaż loading state
    const addBtn = document.getElementById('emp-add-btn');
    const originalText = addBtn.textContent;
    addBtn.textContent = 'Dodawanie...';
    addBtn.disabled = true;
    
    fetch('/api/employees', { 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': window.csrfToken
      }, 
      body: JSON.stringify({ code, name, email }),
      credentials: 'include'
    })
    .then(async r => { 
      let data;
      try {
        data = await r.json();
      } catch (e) {
        data = { error: 'Błąd parsowania odpowiedzi serwera' };
      }
      if (!r.ok) throw data; 
      return data; 
    })
    .then(() => { 
      empName.value = ''; 
      empCode.value = ''; 
      empEmail.value = ''; 
      loadEmployees(); 
      showNotification('Pracownik został dodany!', 'success');
    })
    .catch((err) => { 
      console.error('Dodawanie pracownika nie powiodło się', err);
      const errorMessage = err.error || err.message || 'Nieznany błąd serwera';
      showNotification('Błąd podczas dodawania pracownika: ' + errorMessage, 'error');
    })
    .finally(() => {
      // Przywróć przycisk
      addBtn.textContent = originalText;
      addBtn.disabled = false;
    });
  }
  
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  function showNotification(message, type = 'info') {
    // Utwórz element powiadomienia
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style powiadomienia
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 20px',
      borderRadius: '8px',
      color: 'white',
      fontWeight: '500',
      zIndex: '10003',
      maxWidth: '300px',
      wordWrap: 'break-word',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease'
    });
    
    // Kolory w zależności od typu
    const colors = {
      success: '#28a745',
      error: '#dc3545',
      info: '#17a2b8',
      warning: '#ffc107'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Dodaj do DOM
    document.body.appendChild(notification);
    
    // Animacja wejścia
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Usuń po 3 sekundach
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
  
  // Event listeners dla zarządzania pracownikami
  if (empName) empName.addEventListener('keydown', (e) => { if (e.key == 'Enter') addEmp(); });
  if (empCode) empCode.addEventListener('keydown', (e) => { if (e.key == 'Enter') addEmp(); });
  if (empEmail) empEmail.addEventListener('keydown', (e) => { if (e.key == 'Enter') addEmp(); });
  if (btnEmps) btnEmps.addEventListener('click', toggleEmps);
  
  // Event listener dla przycisku dodawania
  const empAddBtn = document.getElementById('emp-add-btn');
  if (empAddBtn) empAddBtn.addEventListener('click', addEmp);
  if (empClose) empClose.addEventListener('click', closeEmps);
  if (empEditor) empEditor.addEventListener('click', (e) => { if (e.target === empEditor) closeEmps(); });

  // Event listenery dla skrzynki
  const swapClose = document.getElementById('swap-close');
  const swapAddBtn = document.getElementById('swap-add-btn');
  const swapHistoryBtn = document.getElementById('swap-history-btn');
  const swapEditor = document.getElementById('swap-editor');
  
  function closeSwap() { 
    if (swapEditor) swapEditor.classList.remove('show');
  }
  
  if (swapClose) swapClose.addEventListener('click', closeSwap);
  if (swapAddBtn) swapAddBtn.addEventListener('click', addSwapRequest);
  if (swapHistoryBtn) swapHistoryBtn.addEventListener('click', () => {
    // TODO: Implementacja historii skrzynki
    alert('Historia skrzynki - funkcja w trakcie implementacji');
  });
  if (swapEditor) swapEditor.addEventListener('click', (e) => { if (e.target === swapEditor) closeSwap(); });

  // --- Zarządzanie whitelistą ---
  function toggleWhitelist() {
    if (!whitelistEditor) return;
    const show = !whitelistEditor.classList.contains('show');
    
    if (show) {
      whitelistEditor.classList.add('show');
      loadWhitelist();
    } else {
      whitelistEditor.classList.remove('show');
    }
  }
  
  function closeWhitelist() { 
    if (whitelistEditor) whitelistEditor.classList.remove('show'); 
  }
  
  function loadWhitelist() {
    fetch('/api/whitelist', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          alert('Błąd podczas ładowania whitelisty: ' + data.error);
          return;
        }
        renderWhitelist(data.emails);
      })
      .catch(err => {
        console.error('Błąd podczas ładowania whitelisty:', err);
        alert('Wystąpił błąd podczas ładowania whitelisty');
      });
  }
  
  function renderWhitelist(whitelistData) {
    if (!whitelistList) return;
    
    const fragment = document.createDocumentFragment();
    
    // Sprawdź czy dane to tablica emaili czy obiektów z kontami
    const items = Array.isArray(whitelistData) ? whitelistData : whitelistData.emails || [];
    
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'emp-row';
      
      // Jeśli item to obiekt z kontem, pokaż szczegóły
      if (typeof item === 'object' && item.email) {
        let accountInfo;
        if (item.has_account) {
          if (item.employee_name) {
            accountInfo = `👤 ${item.employee_name} (ID: ${item.employee_id || 'N/A'})`;
          } else if (item.user_name) {
            accountInfo = `👤 ${item.user_name} (użytkownik)`;
          } else {
            accountInfo = '👤 Konto użytkownika (brak danych)';
          }
        } else {
          accountInfo = '❌ Brak konta w systemie';
        }
        
        row.innerHTML = `
          <div>
            <div class="emp-name-code-line">
              <div class="emp-name-display">📧 ${item.email}</div>
            </div>
            <div class="emp-email-edit">
              <small class="emp-email-display">${accountInfo}</small>
            </div>
          </div>
          <div class="emp-actions">
            <button data-email="${item.email}" class="btn btn-remove">Usuń</button>
          </div>
        `;
      } else {
        // Jeśli item to tylko email (stary format)
        row.innerHTML = `
          <div>
            <div class="emp-name-code-line">
              <div class="emp-name-display">📧 ${item}</div>
            </div>
            <div class="emp-email-edit">
              <small class="emp-email-display">❓ Brak informacji o koncie</small>
            </div>
          </div>
          <div class="emp-actions">
            <button data-email="${item}" class="btn btn-remove">Usuń</button>
          </div>
        `;
      }
      
      // Przycisk usuwania
      const email = typeof item === 'object' ? item.email : item;
      row.querySelector('.btn-remove').addEventListener('click', () => {
        if (confirm(`Czy na pewno chcesz usunąć email "${email}" z whitelisty?`)) {
          removeFromWhitelist(email);
        }
      });
      
      fragment.appendChild(row);
    }
    
    whitelistList.innerHTML = '';
    whitelistList.appendChild(fragment);
  }
  
  function addToWhitelist() {
    if (!whitelistEmail) return;
    const email = whitelistEmail.value.trim();
    if (!email) return;
    
    fetch('/api/whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include'
    })
    .then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw data;
      return data;
    })
    .then(() => {
      whitelistEmail.value = '';
      loadWhitelist();
      alert('Email został dodany do whitelisty!');
    })
    .catch(err => {
      console.warn('Dodawanie do whitelisty nie powiodło się', err);
      alert('Błąd podczas dodawania do whitelisty: ' + (err.error || 'Nieznany błąd'));
    });
  }
  
  function removeFromWhitelist(email) {
    fetch('/api/whitelist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include'
    })
    .then(async r => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw data;
      return data;
    })
    .then(() => {
      loadWhitelist();
      alert('Email został usunięty z whitelisty!');
    })
    .catch(err => {
      console.warn('Usuwanie z whitelisty nie powiodło się', err);
      alert('Błąd podczas usuwania z whitelisty: ' + (err.error || 'Nieznany błąd'));
    });
  }
  
  // Event listeners dla zarządzania whitelistą
  if (btnWhitelist) btnWhitelist.addEventListener('click', toggleWhitelist);
  if (whitelistClose) whitelistClose.addEventListener('click', closeWhitelist);
  if (whitelistAddBtn) whitelistAddBtn.addEventListener('click', addToWhitelist);
  if (whitelistEmail) whitelistEmail.addEventListener('keydown', (e) => { if (e.key == 'Enter') addToWhitelist(); });
  if (whitelistEditor) whitelistEditor.addEventListener('click', (e) => { if (e.target === whitelistEditor) closeWhitelist(); });

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
        // Przycisk "Wyczyść" został usunięty - zastąpiony systemem historii
        
        // Dodaj przycisk "Historia" dla adminów
        if (isBoss && !document.getElementById('swap-history-btn')) {
          const historyBtn = document.createElement('button');
          historyBtn.id = 'swap-history-btn';
          historyBtn.className = 'btn btn-secondary';
          historyBtn.innerHTML = '📋 Historia';
          historyBtn.style.marginLeft = '10px';
          
          if (swapEditor) {
            const header = swapEditor.querySelector('.emp-header');
            if (header) {
              header.appendChild(historyBtn);
            }
          }
          
          historyBtn.addEventListener('click', () => {
            loadRequestHistory();
          });
        }
        
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
            title.innerHTML = `📅 <strong>Niedyspozycja:</strong> ${escapeHtml(item.employee_name)} - ${escapeHtml(item.month_year)}<br>
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
            commentDiv.innerHTML = `<span class="comment-label">💬</span> <strong>Komentarz:</strong> ${escapeHtml(item.comment_requester)}`;
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
  
  
  function closeSwaps() { 
    if (swapEditor) swapEditor.classList.remove('show') 
  }
  
  // Event listeners dla skrzynki próśb
  if (btnSwaps) btnSwaps.addEventListener('click', toggleSwaps);
  if (swapClose) swapClose.addEventListener('click', closeSwaps);
  if (swapEditor) swapEditor.addEventListener('click', (e) => { if (e.target === swapEditor) closeSwaps(); });
  // Przycisk "Wyczyść" został usunięty - zastąpiony systemem historii

  // --- Zunifikowany panel zmian ---
  
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
  // (Funkcja initUnavailabilityModal została przeniesiona do globalnego scope)
  
  
  
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
  // (initUnavailabilityModal jest już wywoływana globalnie)
  
  // Inicjalizuj powiadomienia
  initializeNotifications();

  console.log('Aplikacja została w pełni załadowana i jest gotowa do użycia');
});

// ===== GLOBALNE FUNKCJE DLA HAMBURGER MENU =====

// Globalne funkcje dla hamburger menu - muszą być dostępne poza DOMContentLoaded
function toggleEmps() {
  const empEditor = document.getElementById('emp-editor');
  if (!empEditor) return;
  const show = !empEditor.classList.contains('show');
  
  if (show) {
    // Pokaż modal najpierw
    empEditor.classList.add('show');
    
    // Użyj requestAnimationFrame dla lepszej wydajności
    requestAnimationFrame(() => {
      // Użyj cache jeśli jest świeży
      const now = Date.now();
      if (window.employeesCache && (now - window.employeesCacheTime) < 30000) {
        renderEmployees(window.employeesCache);
      } else {
        loadEmployees();
      }
    });
  } else {
    empEditor.classList.remove('show');
  }
}

// Funkcja do otwierania/zamykania modala skrzynki
function toggleSwap() {
  const swapEditor = document.getElementById('swap-editor');
  if (!swapEditor) return;
  const show = !swapEditor.classList.contains('show');
  
  if (show) {
    // Pokaż modal najpierw
    swapEditor.classList.add('show');
    
    // Użyj requestAnimationFrame dla lepszej wydajności
    requestAnimationFrame(() => {
      // Użyj cache jeśli jest świeży
      const now = Date.now();
      if (window.swapCache && (now - window.swapCacheTime) < 30000) {
        console.log('📦 Używam cache skrzynki');
        renderSwap(window.swapCache);
      } else {
        console.log('🌐 Ładuję skrzynkę z serwera');
        loadSwap();
      }
    });
  } else {
    swapEditor.classList.remove('show');
  }
}


// Globalne zmienne cache dla pracowników
window.employeesCache = null;
window.employeesCacheTime = 0;

// Globalne zmienne cache dla skrzynki
window.swapCache = null;
window.swapCacheTime = 0;
const CACHE_DURATION = 30000; // 30 sekund

// Globalne funkcje pomocnicze
function loadEmployees() {
  fetch('/api/employees', { credentials: 'include' })
    .then(response => response.json())
    .then(data => { 
      if (data.error) {
        throw new Error(data.error);
      }
      // Zaktualizuj cache
      window.employeesCache = data.employees || [];
      window.employeesCacheTime = Date.now();
      renderEmployees(window.employeesCache); 
    })
    .catch(error => {
      console.error('Błąd podczas ładowania pracowników:', error);
      alert('Błąd podczas ładowania listy pracowników');
    });
}

function renderEmployees(items) {
  const empList = document.getElementById('emp-list');
  if (!empList) return;
  
  // Użyj requestAnimationFrame dla lepszej wydajności
  requestAnimationFrame(() => {
    // Użyj DocumentFragment dla lepszej wydajności
    const fragment = document.createDocumentFragment();
    
    for (const emp of items) {
      const row = document.createElement('div');
      row.className = 'emp-row';
      row.innerHTML = `
        <div>
          <div class="emp-name-code-line">
            <div class="emp-name-edit">
              <input type="text" class="emp-name-input" value="${emp.name}" data-id="${emp.id}" data-field="name" style="display: none;">
              <span class="emp-name-display">${emp.name}</span>
            </div>
            <div class="emp-code-edit">
              <input type="text" class="emp-code-input" value="${emp.code || ''}" data-id="${emp.id}" data-field="code" style="display: none;">
              <span class="emp-code-display">(${emp.code || '-'})</span>
            </div>
          </div>
          <div class="emp-email-edit">
            <input type="email" class="emp-email-input" value="${emp.email || ''}" data-id="${emp.id}" data-field="email" style="display: none;">
            <small class="emp-email-display" style="${emp.email ? '' : 'display: none;'}">${emp.email || ''}</small>
          </div>
        </div>
        <div class="emp-actions">
          <button data-id="${emp.id}" class="btn btn-edit">
            Edytuj
          </button>
          <button data-id="${emp.id}" class="btn btn-save" style="display: none;">
            Zapisz
          </button>
          <button data-id="${emp.id}" class="btn btn-cancel" style="display: none;">
            Anuluj
          </button>
          <button data-id="${emp.id}" class="btn">
            Usuń
          </button>
        </div>
      `;
      
      // Przycisk edycji
      row.querySelector('.btn-edit').addEventListener('click', () => {
        startInlineEdit(row, emp);
      });
      
      // Przycisk zapisz
      row.querySelector('.btn-save').addEventListener('click', () => {
        saveInlineEdit(row, emp);
      });
      
      // Przycisk anuluj
      row.querySelector('.btn-cancel').addEventListener('click', () => {
        cancelInlineEdit(row, emp);
      });
      
      // Przycisk usuwania
      const deleteBtn = Array.from(row.querySelectorAll('.btn')).find(btn => btn.textContent.trim() === 'Usuń');
      console.log('🔍 Znaleziony przycisk usuwania (funkcja 2):', deleteBtn);
      if (deleteBtn) deleteBtn.addEventListener('click', () => {
        const originalText = deleteBtn.textContent;
        deleteBtn.textContent = 'Usuwanie...';
        deleteBtn.disabled = true;
        
        fetch(`/api/employees/${emp.id}`, { 
          method: 'DELETE',
          headers: { 'X-CSRFToken': window.csrfToken },
          credentials: 'include'
        })
          .then(response => response.json())
          .then(data => {
            if (data.error) {
              console.error('Błąd podczas usuwania:', data.error);
            } else {
              // Zaktualizuj cache
              window.employeesCache = window.employeesCache.filter(e => e.id !== emp.id);
              window.employeesCacheTime = Date.now();
              loadEmployees();
            }
          })
          .catch(error => {
            console.error('Błąd podczas usuwania pracownika:', error);
          })
          .finally(() => {
            // Przywróć przycisk
            deleteBtn.textContent = originalText;
            deleteBtn.disabled = false;
          });
      });
      
      fragment.appendChild(row);
    }
    
    // Wyczyść i dodaj wszystkie elementy jednocześnie
    empList.innerHTML = '';
    empList.appendChild(fragment);
    
    // Zaktualizuj statystyki
    updateEmployeeStats(items);
  });
}

function updateEmployeeStats(employees) {
  const totalCount = document.getElementById('emp-total-count');
  const withEmailCount = document.getElementById('emp-with-email-count');
  const withCodeCount = document.getElementById('emp-with-code-count');
  
  if (totalCount) totalCount.textContent = employees.length;
  if (withEmailCount) withEmailCount.textContent = employees.filter(emp => emp.email).length;
  if (withCodeCount) withCodeCount.textContent = employees.filter(emp => emp.code).length;
}


// Funkcje edycji inline
function startInlineEdit(row, emp) {
  // Ukryj przycisk edycji, pokaż zapisz/anuluj
  row.querySelector('.btn-edit').style.display = 'none';
  row.querySelector('.btn-save').style.display = 'inline-block';
  row.querySelector('.btn-cancel').style.display = 'inline-block';
  
  // Ukryj wyświetlane wartości, pokaż inputy
  row.querySelector('.emp-name-display').style.display = 'none';
  row.querySelector('.emp-code-display').style.display = 'none';
  row.querySelector('.emp-email-display').style.display = 'none';
  
  row.querySelector('.emp-name-input').style.display = 'inline-block';
  row.querySelector('.emp-code-input').style.display = 'inline-block';
  row.querySelector('.emp-email-input').style.display = 'inline-block';
  
  // Skup się na pierwszym polu
  row.querySelector('.emp-name-input').focus();
}

function saveInlineEdit(row, emp) {
  const nameInput = row.querySelector('.emp-name-input');
  const codeInput = row.querySelector('.emp-code-input');
  const emailInput = row.querySelector('.emp-email-input');
  
  const newName = nameInput.value.trim();
  const newCode = codeInput.value.trim();
  const newEmail = emailInput.value.trim();
  
  if (!newName) {
    alert('Imię jest wymagane');
    nameInput.focus();
    return;
  }
  
  // Walidacja emaila
  if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    alert('Podaj prawidłowy adres email');
    emailInput.focus();
    return;
  }
  
  // Pokaż loading
  const saveBtn = row.querySelector('.btn-save');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Zapisywanie...';
  saveBtn.disabled = true;
  
  
  fetch(`/api/employees/${emp.id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'X-CSRFToken': window.csrfToken
    },
    body: JSON.stringify({ name: newName, code: newCode, email: newEmail }),
    credentials: 'include'
  })
  .then(async r => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(data.error || 'Błąd podczas edycji');
    }
    return data;
  })
  .then(() => {
    // Zaktualizuj wyświetlane wartości
    row.querySelector('.emp-name-display').textContent = newName;
    row.querySelector('.emp-code-display').textContent = `(${newCode || '-'})`;
    
    const emailDisplay = row.querySelector('.emp-email-display');
    if (newEmail) {
      emailDisplay.textContent = newEmail;
      emailDisplay.style.display = 'block';
    } else {
      emailDisplay.style.display = 'none';
    }
    
    // Zaktualizuj obiekt emp
    emp.name = newName;
    emp.code = newCode;
    emp.email = newEmail;
    
    // Zaktualizuj cache
    if (window.employeesCache) {
      const empIndex = window.employeesCache.findIndex(e => e.id === emp.id);
      if (empIndex !== -1) {
        window.employeesCache[empIndex] = { ...emp, name: newName, code: newCode, email: newEmail };
      }
    }
    
    // Wyjdź z trybu edycji
    cancelInlineEdit(row, emp);
  })
  .catch(error => {
    console.error('Błąd podczas edycji pracownika:', error);
    alert('Wystąpił błąd podczas edycji pracownika');
  })
  .finally(() => {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  });
}

function cancelInlineEdit(row, emp) {
  // Przywróć oryginalne wartości
  const nameInput = row.querySelector('.emp-name-input');
  const codeInput = row.querySelector('.emp-code-input');
  const emailInput = row.querySelector('.emp-email-input');
  
  nameInput.value = emp.name;
  codeInput.value = emp.code || '';
  emailInput.value = emp.email || '';
  
  // Ukryj inputy, pokaż wyświetlane wartości
  nameInput.style.display = 'none';
  codeInput.style.display = 'none';
  emailInput.style.display = 'none';
  
  row.querySelector('.emp-name-display').style.display = 'inline';
  row.querySelector('.emp-code-display').style.display = 'inline';
  row.querySelector('.emp-email-display').style.display = emp.email ? 'block' : 'none';
  
  // Ukryj zapisz/anuluj, pokaż edytuj
  row.querySelector('.btn-edit').style.display = 'inline-block';
  row.querySelector('.btn-save').style.display = 'none';
  row.querySelector('.btn-cancel').style.display = 'none';
}

// Funkcje dla skrzynki
function loadSwap() {
  // Sprawdź czy mamy świeże dane w cache
  const now = Date.now();
  if (window.swapCache && (now - window.swapCacheTime) < 30000) {
    console.log('📦 Używam cache skrzynki');
    renderSwap(window.swapCache);
    return;
  }
  
  // Jeśli nie ma API endpointu, użyj przykładowych danych
  console.log('🌐 Ładuję przykładowe dane skrzynki');
  renderSwap([]); // Pusty array spowoduje załadowanie przykładowych danych
}

function renderSwap(requests) {
  const swapList = document.getElementById('swap-list');
  if (!swapList) return;
  
  if (!requests || requests.length === 0) {
    swapList.innerHTML = '<div class="no-requests">Brak próśb w skrzynce</div>';
    updateSwapStats([]);
    return;
  }
  
  // Sortuj według daty (najnowsze na górze)
  const sortedRequests = requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  swapList.innerHTML = sortedRequests.map(req => `
    <div class="emp-row">
      <div>
        <div class="emp-name-code-line">
          <div class="emp-name-edit">
            <span class="emp-name-display">${req.type === 'swap' ? 'Zamiana' : req.type === 'unavailability' ? 'Niedyspozycja' : 'Inne'}</span>
          </div>
          <div class="emp-code-edit">
            <span class="emp-code-display">(${new Date(req.created_at).toLocaleDateString()})</span>
          </div>
        </div>
        <div class="emp-email-edit">
          <small class="emp-email-display">${req.message || 'Brak wiadomości'}</small>
        </div>
      </div>
      <div class="emp-actions">
        <button data-id="${req.id}" class="btn btn-edit">Edytuj</button>
        <button data-id="${req.id}" class="btn btn-save" style="display: none;">Zapisz</button>
        <button data-id="${req.id}" class="btn btn-cancel" style="display: none;">Anuluj</button>
        <button data-id="${req.id}" class="btn">Usuń</button>
      </div>
    </div>
  `).join('');
  
  // Dodaj event listenery
  swapList.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const requestId = e.target.dataset.id;
      const request = requests.find(r => r.id == requestId);
      if (request) startSwapEdit(e.target.closest('.emp-row'), request);
    });
  });
  
  // Event listenery dla przycisków Zapisz i Anuluj
  swapList.querySelectorAll('.btn-save').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const requestId = e.target.dataset.id;
      const request = requests.find(r => r.id == requestId);
      if (request) saveSwapEdit(e.target.closest('.emp-row'), request);
    });
  });
  
  swapList.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const requestId = e.target.dataset.id;
      const request = requests.find(r => r.id == requestId);
      if (request) cancelSwapEdit(e.target.closest('.emp-row'), request);
    });
  });
  
  // Event listenery dla przycisków Usuń
  swapList.querySelectorAll('.btn:not(.btn-edit):not(.btn-save):not(.btn-cancel)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const requestId = e.target.dataset.id;
      deleteSwapRequest(requestId);
    });
  });
  
  updateSwapStats(requests);
}

function updateSwapStats(requests) {
  const totalCount = document.getElementById('swap-total-count');
  if (totalCount) totalCount.textContent = requests.length;
}

function addSwapRequest() {
  const type = document.getElementById('swap-type').value;
  const date = document.getElementById('swap-date').value;
  const message = document.getElementById('swap-message').value;
  
  if (!type || !date) {
    alert('Proszę wypełnić wszystkie wymagane pola');
    return;
  }
  
  const addBtn = document.getElementById('swap-add-btn');
  const originalText = addBtn.textContent;
  addBtn.textContent = 'Dodawanie...';
  addBtn.disabled = true;
  
  fetch('/api/swap-requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': window.csrfToken
    },
    body: JSON.stringify({ type, date, message }),
    credentials: 'include'
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      alert('Błąd podczas dodawania prośby: ' + data.error);
    } else {
      // Wyczyść formularz
      document.getElementById('swap-type').value = 'swap';
      document.getElementById('swap-date').value = '';
      document.getElementById('swap-message').value = '';
      
      // Odśwież listę
      loadSwap();
    }
  })
  .catch(error => {
    console.error('Błąd podczas dodawania prośby:', error);
    alert('Błąd podczas dodawania prośby');
  })
  .finally(() => {
    addBtn.textContent = originalText;
    addBtn.disabled = false;
  });
}

function deleteSwapRequest(requestId) {
  fetch(`/api/swap-requests/${requestId}`, {
    method: 'DELETE',
    headers: { 'X-CSRFToken': window.csrfToken },
    credentials: 'include'
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      console.error('Błąd podczas usuwania:', data.error);
    } else {
      // Zaktualizuj cache
      window.swapCache = window.swapCache.filter(r => r.id != requestId);
      window.swapCacheTime = Date.now();
      loadSwap();
    }
  })
  .catch(error => {
    console.error('Błąd podczas usuwania:', error);
  });
}

function startSwapEdit(row, request) {
  // Ukryj przycisk edycji, pokaż zapisz/anuluj
  row.querySelector('.btn-edit').style.display = 'none';
  row.querySelector('.btn-save').style.display = 'inline-block';
  row.querySelector('.btn-cancel').style.display = 'inline-block';
  
  // Ukryj wyświetlane wartości, pokaż inputy
  row.querySelector('.emp-name-display').style.display = 'none';
  row.querySelector('.emp-code-display').style.display = 'none';
  row.querySelector('.emp-email-display').style.display = 'none';
  
  // Dodaj inputy do edycji
  const nameEdit = row.querySelector('.emp-name-edit');
  const codeEdit = row.querySelector('.emp-code-edit');
  const emailEdit = row.querySelector('.emp-email-edit');
  
  // Usuń istniejące inputy
  const existingInputs = row.querySelectorAll('.emp-name-input, .emp-code-input, .emp-email-input');
  existingInputs.forEach(input => input.remove());
  
  // Dodaj nowe inputy
  nameEdit.innerHTML = `
    <input type="text" class="emp-name-input" value="${request.type === 'swap' ? 'Zamiana' : request.type === 'unavailability' ? 'Niedyspozycja' : 'Inne'}" data-id="${request.id}" data-field="type" style="display: inline-block;">
    <span class="emp-name-display" style="display: none;">${request.type === 'swap' ? 'Zamiana' : request.type === 'unavailability' ? 'Niedyspozycja' : 'Inne'}</span>
  `;
  
  codeEdit.innerHTML = `
    <input type="text" class="emp-code-input" value="${new Date(request.created_at).toLocaleDateString()}" data-id="${request.id}" data-field="date" style="display: inline-block;">
    <span class="emp-code-display" style="display: none;">(${new Date(request.created_at).toLocaleDateString()})</span>
  `;
  
  emailEdit.innerHTML = `
    <textarea class="emp-email-input" data-id="${request.id}" data-field="message" style="display: inline-block;">${request.message || ''}</textarea>
    <small class="emp-email-display" style="display: none;">${request.message || 'Brak wiadomości'}</small>
  `;
  
  // Fokus na pierwszy input
  row.querySelector('.emp-name-input').focus();
}

function saveSwapEdit(row, request) {
  const newType = row.querySelector('.emp-name-input').value;
  const newDate = row.querySelector('.emp-code-input').value;
  const newMessage = row.querySelector('.emp-email-input').value;
  
  if (!newType || !newDate) {
    alert('Proszę wypełnić wszystkie wymagane pola');
    return;
  }
  
  const saveBtn = row.querySelector('.btn-save');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Zapisywanie...';
  saveBtn.disabled = true;
  
  // Symulacja zapisu (w rzeczywistości tutaj byłby API call)
  setTimeout(() => {
    // Aktualizuj obiekt request
    request.type = newType.toLowerCase();
    request.message = newMessage;
    request.created_at = new Date(newDate).toISOString();
    
    // Aktualizuj cache
    const index = window.swapCache.findIndex(r => r.id === request.id);
    if (index !== -1) {
      window.swapCache[index] = request;
    }
    
    // Zakończ edycję
    cancelSwapEdit(row, request);
    
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }, 500);
}

function cancelSwapEdit(row, request) {
  // Przywróć oryginalne wartości
  const nameInput = row.querySelector('.emp-name-input');
  const codeInput = row.querySelector('.emp-code-input');
  const emailInput = row.querySelector('.emp-email-input');
  
  if (nameInput) nameInput.value = request.type === 'swap' ? 'Zamiana' : request.type === 'unavailability' ? 'Niedyspozycja' : 'Inne';
  if (codeInput) codeInput.value = new Date(request.created_at).toLocaleDateString();
  if (emailInput) emailInput.value = request.message || '';
  
  // Ukryj inputy, pokaż wyświetlane wartości
  if (nameInput) nameInput.style.display = 'none';
  if (codeInput) codeInput.style.display = 'none';
  if (emailInput) emailInput.style.display = 'none';
  
  row.querySelector('.emp-name-display').style.display = 'inline';
  row.querySelector('.emp-code-display').style.display = 'inline';
  row.querySelector('.emp-email-display').style.display = request.message ? 'block' : 'none';
  
  // Ukryj zapisz/anuluj, pokaż edytuj
  row.querySelector('.btn-edit').style.display = 'inline-block';
  row.querySelector('.btn-save').style.display = 'none';
  row.querySelector('.btn-cancel').style.display = 'none';
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
          <input id="edit-emp-email" placeholder="email" type="email" value="${emp.email || ''}" />
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
  const emailInput = dialog.querySelector('#edit-emp-email');
  
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
    const newEmail = emailInput.value.trim();
    
    // Walidacja
    if (!newName) {
      showNotification('Imię jest wymagane', 'error');
      nameInput.focus();
      return;
    }
    
    if (newEmail && !isValidEmail(newEmail)) {
      showNotification('Podaj prawidłowy adres email', 'error');
      emailInput.focus();
      return;
    }
    
    // Pokaż loading state
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Zapisywanie...';
    saveBtn.disabled = true;
    
    fetch(`/api/employees/${emp.id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': window.csrfToken
      },
      body: JSON.stringify({ name: newName, code: newCode, email: newEmail }),
      credentials: 'include'
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
      showNotification('Pracownik został zaktualizowany!', 'success');
    })
    .catch((err) => {
      showNotification('Błąd: ' + err.message, 'error');
    })
    .finally(() => {
      // Przywróć przycisk
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    });
  });
  
  // Enter w polach
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
  emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });
}

// ===== SYSTEM POWIADOMIEŃ PWA =====

// Globalna zmienna dla interwału powiadomień
let notificationInterval = null;

// Funkcja do zarządzania sprawdzaniem powiadomień
function startNotificationChecking() {
  // Wyczyść istniejący interwał jeśli istnieje
  if (notificationInterval) {
    clearInterval(notificationInterval);
  }
  
  // Uruchom nowy interwał
  notificationInterval = setInterval(checkForNewRequests, 30000);
  console.log('🔔 Sprawdzanie powiadomień uruchomione co 30 sekund');
}

// Funkcja do zatrzymania sprawdzania powiadomień
function stopNotificationChecking() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
    console.log('🔔 Sprawdzanie powiadomień zatrzymane');
  }
}

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
    
    // Jeśli powiadomienia są dozwolone, utwórz subskrypcję push
    if (Notification.permission === 'granted') {
      console.log('🔔 Powiadomienia są dozwolone, inicjalizuję subskrypcję push...');
      await initializePushSubscription();
    }
    
    // Uruchom background sync
    if ('sync' in window.ServiceWorkerRegistration.prototype) {
      registration.sync.register('check-notifications');
    }
    
    // Sprawdź nowe prośby co 30 sekund
    startNotificationChecking();
    
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
function showNotification(message, type = 'info') {
  // Wyświetl powiadomienie w konsoli dla debugowania
  console.log(`🔔 [NOTIFICATION] ${type.toUpperCase()}: ${message}`);
  
  // Jeśli to push notification i mamy pozwolenie
  if (type === 'push' && Notification.permission === 'granted') {
    const notification = new Notification('Grafik SP4600', {
      body: message,
      icon: '/static/PKN.WA.D.png',
      badge: '/static/PKN.WA.D.png',
      tag: 'grafik-notification',
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
  } else {
    // Dla innych typów powiadomień, wyświetl alert (tymczasowo)
    if (type === 'error') {
      alert('❌ ' + message);
    } else if (type === 'success') {
      alert('✅ ' + message);
    } else {
      alert('ℹ️ ' + message);
    }
  }
}

// Test powiadomień (do testowania)
function testNotification() {
  showNotification('To jest test powiadomienia!');
}

// Funkcja do ręcznego testowania subskrypcji push

// Funkcja do ręcznego sprawdzenia statusów (np. po odświeżeniu strony)
async function checkStatusChanges() {
  console.log('Sprawdzam zmiany statusów...');
  await checkForNewRequests();
}

// Funkcja do ładowania historii próśb
async function loadRequestHistory() {
  try {
    console.log('📋 Ładuję historię próśb...');
    
    const response = await fetch('/api/requests/history', { 
      credentials: 'include' 
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      alert('Błąd: ' + data.error);
      return;
    }
    
    // Wyświetl historię w modalu
    showHistoryModal(data.items);
    
  } catch (error) {
    console.error('Błąd podczas ładowania historii:', error);
    alert('Wystąpił błąd podczas ładowania historii');
  }
}

// Funkcja do wyświetlania modalu z historią
function showHistoryModal(historyItems) {
  // Utwórz modal historii
  const modal = document.createElement('div');
  modal.id = 'history-modal';
  modal.className = 'emp-editor show';
  modal.innerHTML = `
    <div class="emp-container">
      <div class="emp-header">
        <h3>📋 Historia Próśb</h3>
        <button type="button" id="history-close" class="emp-close" aria-label="Zamknij">✕</button>
      </div>
      <div class="emp-list-section">
        <div class="emp-list" id="history-list"></div>
      </div>
    </div>
  `;
  
  // Dodaj do body
  document.body.appendChild(modal);
  
  // Wypełnij listę historią
  const historyList = document.getElementById('history-list');
  if (historyItems.length === 0) {
    historyList.innerHTML = '<div class="no-requests">Brak historii próśb</div>';
  } else {
    historyList.innerHTML = historyItems.map(item => `
      <div class="emp-row">
        <div>
          <div class="emp-name-code-line">
            <div class="emp-name-display">
              ${item.type === 'swap' ? '🔄 Zamiana' : '📅 Niedyspozycja'}
            </div>
            <div class="emp-code-display">
              (${new Date(item.archived_at).toLocaleDateString()})
            </div>
          </div>
          <div class="emp-email-edit">
            <small class="emp-email-display">
              ${item.type === 'swap' 
                ? `${item.from_employee} → ${item.to_employee} (${item.from_date} ⇄ ${item.to_date})`
                : `${item.from_employee} - ${item.month_year}`
              }
            </small>
          </div>
          <div class="status-display ${getStatusClass(item.final_status)}">
            ${getStatusText(item.final_status)}
          </div>
          ${item.comment_requester ? `<div class="comment-display">💬 ${escapeHtml(item.comment_requester)}</div>` : ''}
        </div>
      </div>
    `).join('');
  }
  
  // Event listeners
  const closeBtn = document.getElementById('history-close');
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Funkcja eksportu do Excel (tylko dla adminów)
function exportToExcel(event) {
  console.log('🚀 Rozpoczynam eksport do Excel...');
  console.log('Event:', event);
  
  // Pokaż loading
  const button = event ? event.target : document.querySelector('#menu-btn-export');
  console.log('Znaleziony przycisk:', button);
  console.log('Wszystkie przyciski z ID menu-btn-export:', document.querySelectorAll('#menu-btn-export'));
  console.log('Wszystkie przyciski menu:', document.querySelectorAll('[id^="menu-btn-"]'));
  console.log('HTML hamburger menu:', document.querySelector('.hamburger-menu-items')?.innerHTML);
  
  if (!button) {
    console.error('❌ Nie znaleziono przycisku eksportu');
    console.error('❌ Sprawdzam czy hamburger menu jest otwarte...');
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    console.log('❌ Hamburger menu element:', hamburgerMenu);
    console.log('❌ Hamburger menu visible:', hamburgerMenu?.style.display);
    return;
  }
  
  const originalText = button.textContent;
  button.innerHTML = '⏳ EKSPORTUJĘ...';
  button.disabled = true;
  
  // Pobierz aktualny miesiąc i rok z URL lub użyj bieżący miesiąc
  const urlParams = new URLSearchParams(window.location.search);
  const year = urlParams.get('year') ? parseInt(urlParams.get('year')) : new Date().getFullYear();
  const month = urlParams.get('month') ? parseInt(urlParams.get('month')) : new Date().getMonth() + 1;
  
  console.log(`📅 Eksportuję dla roku: ${year}, miesiąca: ${month}`);
  console.log(`🌐 URL: /api/export/excel?year=${year}&month=${month}`);
  
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
      console.error('❌ Błąd podczas eksportu do Excel:', error);
      console.error('❌ Szczegóły błędu:', error.message);
      console.error('❌ Stack trace:', error.stack);
      alert(`❌ Wystąpił błąd podczas eksportu do Excel: ${error.message}\n\nSprawdź konsolę przeglądarki (F12) dla szczegółów.`);
    })
    .finally(() => {
      // Przywróć przycisk z oryginalnym HTML
      button.innerHTML = `
        <span>
          <div class="spotify-function-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
              <path d="M8,12H16V14H8V12M8,16H13V18H8V16Z"/>
            </svg>
          </div>
          <div class="spotify-function-text">EKSPORT</div>
        </span>
      `;
      button.disabled = false;
    });
}

// Funkcja do podświetlania zalogowanego użytkownika
function highlightCurrentUser() {
  const table = document.getElementById('grafik');
  if (!table) return;
  
  const currentUser = table.getAttribute('data-current-user');
  if (!currentUser) return;
  
  // Znajdź nagłówek kolumny dla zalogowanego użytkownika
  const headers = table.querySelectorAll('th.col-emp');
  let userColumnIndex = -1;
  
  headers.forEach((header, index) => {
    const headerText = header.textContent.trim();
    // Sprawdź czy to kolumna zalogowanego użytkownika
    if (headerText.includes(currentUser) || headerText === currentUser) {
      header.classList.add('current-user');
      userColumnIndex = index + 2; // +2 bo mamy kolumny data i dzień przed pracownikami
    }
  });
  
  // Podświetl wszystkie komórki w kolumnie zalogowanego użytkownika
  if (userColumnIndex > 0) {
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells[userColumnIndex]) {
        cells[userColumnIndex].classList.add('current-user');
      }
    });
  }
}

// ===== NAWIGACJA ZMIAN DZIENNYCH =====
let currentShiftDate = new Date(); // Aktualnie wyświetlana data

function formatDateForDisplay(date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  
  if (isToday) {
    return {
      label: 'DZISIAJ',
      date: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    };
  } else {
    // Sprawdź czy to jutro, pojutrze, wczoraj, przedwczoraj
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const dayBeforeYesterday = new Date(today);
    dayBeforeYesterday.setDate(today.getDate() - 2);
    
    if (date.toDateString() === tomorrow.toDateString()) {
      return {
        label: 'JUTRO',
        date: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    } else if (date.toDateString() === dayAfterTomorrow.toDateString()) {
      return {
        label: 'POJUTRZE',
        date: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    } else if (date.toDateString() === yesterday.toDateString()) {
      return {
        label: 'WCZORAJ',
        date: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    } else if (date.toDateString() === dayBeforeYesterday.toDateString()) {
      return {
        label: 'PRZEDWCZORAJ',
        date: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    } else {
      // Dla innych dat wyświetl tylko datę
      return {
        label: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        date: date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    }
  }
}

function updateShiftDateDisplay(date) {
  const dateInfo = formatDateForDisplay(date);
  const labelElement = document.getElementById('shift-date-label');
  const dateElement = document.getElementById('shift-date-display');
  
  // Wyświetl datę na środku
  if (labelElement) {
    // Dla dzisiaj, jutro, wczoraj itp. wyświetl label + datę pod spodem
    if (dateInfo.label === 'DZISIAJ' || dateInfo.label === 'JUTRO' || 
        dateInfo.label === 'POJUTRZE' || dateInfo.label === 'WCZORAJ' || 
        dateInfo.label === 'PRZEDWCZORAJ') {
      labelElement.innerHTML = `${dateInfo.label}<br><small style="font-size: 0.7em; opacity: 0.8;">${dateInfo.date}</small>`;
      labelElement.style.display = 'block';
    } else {
      // Dla innych dat wyświetl tylko datę
      labelElement.textContent = dateInfo.date;
      labelElement.style.display = 'block';
    }
  }
  
  // Ukryj element z datą, bo używamy tylko label
  if (dateElement) {
    dateElement.style.display = 'none';
  }
}

function loadShiftsForDate(date) {
  console.log('🚀 [SHIFTS] Rozpoczynam loadShiftsForDate z datą:', date);
  const dateString = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
  console.log('🔄 Ładowanie zmian dla daty:', dateString);
  console.log('🌐 URL API:', `/api/shifts/${dateString}`);
  
  fetch(`/api/shifts/${dateString}`, { credentials: 'include' })
    .then(response => {
      console.log('📡 Odpowiedź API:', response.status);
      return response.json();
    })
    .then(data => {
      console.log('📊 Dane zmian:', data);
      if (data.error) {
        throw new Error(data.error);
      }
      
      console.log('🎯 Wywołuję updateShiftsDisplay z danymi:', data);
      // Aktualizuj wyświetlane zmiany
      updateShiftsDisplay(data);
      console.log('✅ updateShiftsDisplay wywołane');
    })
    .catch(error => {
      console.error('❌ Błąd podczas ładowania zmian:', error);
      // W przypadku błędu wyświetl pustą listę
      updateShiftsDisplay({
        dniowka: [],
        popoludniowka: [],
        nocka: []
      });
    });
}

// Funkcja do escapowania HTML (ochrona przed XSS) - globalna
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

function updateShiftsDisplay(shiftsData) {
  console.log('🎯 Aktualizuję wyświetlanie zmian:', shiftsData);
  
  // Aktualizuj dniówkę
  const dniowkaElement = document.getElementById('shifts-dniowka');
  console.log('🔍 Element dniówki:', dniowkaElement);
  if (dniowkaElement) {
    if (shiftsData.dniowka && shiftsData.dniowka.length > 0) {
      console.log('✅ Dniówka - pracownicy:', shiftsData.dniowka);
      dniowkaElement.innerHTML = `<ul>${shiftsData.dniowka.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`;
    } else {
      console.log('❌ Dniówka - brak pracowników');
      dniowkaElement.innerHTML = '<p class="muted">brak przypisań</p>';
    }
  } else {
    console.log('❌ Nie znaleziono elementu shifts-dniowka');
  }
  
  // Aktualizuj popołudniówkę
  const popoludniowkaElement = document.getElementById('shifts-popoludniowka');
  if (popoludniowkaElement) {
    if (shiftsData.popoludniowka && shiftsData.popoludniowka.length > 0) {
      popoludniowkaElement.innerHTML = `<ul>${shiftsData.popoludniowka.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`;
    } else {
      popoludniowkaElement.innerHTML = '<p class="muted">brak przypisań</p>';
    }
  }
  
  // Aktualizuj nockę
  const nockaElement = document.getElementById('shifts-nocka');
  if (nockaElement) {
    if (shiftsData.nocka && shiftsData.nocka.length > 0) {
      nockaElement.innerHTML = `<ul>${shiftsData.nocka.map(name => `<li>${escapeHtml(name)}</li>`).join('')}</ul>`;
    } else {
      nockaElement.innerHTML = '<p class="muted">brak przypisań</p>';
    }
  }
}

function navigateToPreviousDay() {
  const newDate = new Date(currentShiftDate);
  newDate.setDate(newDate.getDate() - 1);
  currentShiftDate = newDate;
  
  updateShiftDateDisplay(currentShiftDate);
  loadShiftsForDate(currentShiftDate);
}

function navigateToNextDay() {
  const newDate = new Date(currentShiftDate);
  newDate.setDate(newDate.getDate() + 1);
  currentShiftDate = newDate;
  
  updateShiftDateDisplay(currentShiftDate);
  loadShiftsForDate(currentShiftDate);
}

function initializeShiftNavigation() {
  console.log('🚀 [SHIFTS] Inicjalizuję nawigację zmian...');
  
  // Ustaw początkową datę na dzisiaj
  currentShiftDate = new Date();
  console.log('📅 [SHIFTS] Ustawiam datę na:', currentShiftDate);
  updateShiftDateDisplay(currentShiftDate);
  
  // Załaduj dane dla dzisiejszego dnia
  console.log('🔄 [SHIFTS] Wywołuję loadShiftsForDate...');
  loadShiftsForDate(currentShiftDate);
  
  // Dodaj event listenery dla przycisków nawigacji
  const prevButton = document.getElementById('shift-prev-day');
  const nextButton = document.getElementById('shift-next-day');
  
  console.log('🔍 [SHIFTS] Przyciski nawigacji:', { prevButton: !!prevButton, nextButton: !!nextButton });
  
  if (prevButton) {
    prevButton.addEventListener('click', navigateToPreviousDay);
  }
  
  if (nextButton) {
    nextButton.addEventListener('click', navigateToNextDay);
  }
  
  console.log('✅ [SHIFTS] Nawigacja zmian zainicjalizowana');
}

// Globalne zmienne i funkcje dla trybu edycji
let globalEditMode = false;
let globalPending = new Map();

// Globalna funkcja toggleEdit dostępna dla menu
function toggleEdit() {
  // Użyj requestAnimationFrame dla lepszej wydajności
  requestAnimationFrame(() => {
    globalEditMode = !globalEditMode;
    const todayActions = document.getElementById('shifts-actions');
    if (todayActions) todayActions.classList.toggle('hidden', !globalEditMode);
    
    // Dodaj/usuń klasę edit-mode na body dla delikatnego mrygania
    document.body.classList.toggle('edit-mode', globalEditMode);
    
    // Synchronizuj z lokalną zmienną editMode jeśli jest dostępna
    window.localEditMode = globalEditMode;
    
    if (globalEditMode) {
      console.log('🔧 [EDIT] Włączam tryb edycji - globalEditMode:', globalEditMode);
      
      // Zaktualizuj interfejs trybu roboczego
      updateDraftUI();
    }
    
    if (!globalEditMode) { 
      globalPending.clear();
      // Wyczyść zmiany draft gdy wyłączamy tryb edycji
      if (isDraftMode) {
        draftChanges.clear();
        isDraftMode = false;
      }
      // Wywołaj hideEditor jeśli istnieje
      if (typeof hideEditor === 'function') {
        hideEditor();
      }
    }
  });
}

// ============================================================================
// PROSTY SYSTEM TRYBU ROBOCZEGO
// ============================================================================

// Zmienne globalne dla trybu roboczego
let isDraftMode = false;
let draftChanges = new Map();

// Prosta funkcja włączania/wyłączania trybu roboczego
async function toggleDraftMode() {
  console.log('🔄 [DRAFT] Toggle draft mode - current state:', isDraftMode);
  
  // Sprawdź czy użytkownik jest adminem
  const isAdmin = document.body.classList.contains('admin-user');
  if (!isAdmin) {
    console.log('🔧 [DRAFT] Użytkownik nie jest adminem - tryb roboczy niedostępny');
    showNotification('Tryb roboczy dostępny tylko dla administratorów', 'warning');
    return;
  }
  
  if (isDraftMode) {
    console.log('🔄 [DRAFT] Wyłączam tryb roboczy...');
    await exitDraftMode();
  } else {
    console.log('🔄 [DRAFT] Włączam tryb roboczy...');
    await enterDraftMode();
  }
}

// Włącz tryb roboczy
async function enterDraftMode() {
  console.log('🔄 [DRAFT] Włączam tryb roboczy...');
  isDraftMode = true;
  updateDraftUI();
  
  try {
    // NAJPIERW: Załaduj oficjalny grafik i ustaw data-official-value
    console.log('🔄 [DRAFT] Ładuję oficjalny grafik jako punkt odniesienia...');
    await loadOfficialScheduleForDraft();
    
    // TERAZ: Załaduj zapisane wersje robocze
    await loadDraftData();
    
    // Upewnij się że UI jest poprawnie zaktualizowany po wszystkich operacjach
    updateDraftUI();
    console.log('🔧 [DRAFT] UI zaktualizowane - isDraftMode:', isDraftMode);
  } catch (error) {
    console.error('Błąd podczas włączania trybu roboczego:', error);
    showNotification('Błąd podczas włączania trybu roboczego', 'error');
    
    // Wyłącz tryb roboczy w przypadku błędu
    isDraftMode = false;
    updateDraftUI();
  }
}

// Wyłącz tryb roboczy
async function exitDraftMode() {
  console.log('🔄 [DRAFT] Wyłączam tryb roboczy...');
  
  try {
    // Usuń zapisane zmiany draft z serwera (bez potwierdzenia)
    await discardDraftChanges(false);
    
    // Przywróć oficjalny grafik
    await restoreOfficialSchedule();
    
    console.log('🔄 [DRAFT] Tryb roboczy wyłączony pomyślnie');
  } catch (error) {
    console.error('Błąd podczas wyłączania trybu roboczego:', error);
    showNotification('Błąd podczas wyłączania trybu roboczego', 'error');
  } finally {
    // Zawsze ustaw tryb na normalny i wyczyść zmiany (nawet w przypadku błędu)
    isDraftMode = false;
    draftChanges.clear();
    
    // Zaktualizuj UI na końcu
    updateDraftUI();
  }
}

// Załaduj oficjalny grafik dla trybu draft (ustawia data-official-value)
async function loadOfficialScheduleForDraft() {
  console.log('🔄 [DRAFT] Ładuję oficjalny grafik jako punkt odniesienia...');
  
  // Pobierz parametry roku i miesiąca z tabeli
  const grafikTable = document.getElementById('grafik');
  const year = grafikTable.getAttribute('data-year');
  const month = grafikTable.getAttribute('data-month');
  
  if (!year || !month) {
    console.error('Brak parametrów roku/miesiąca w tabeli');
    return Promise.resolve();
  }
  
  // Załaduj oficjalny grafik z serwera dla całego miesiąca
  return fetch(`/?year=${year}&month=${month}`, { credentials: 'include' })
    .then(response => response.text())
    .then(html => {
      // Parsuj HTML aby wyciągnąć dane shifts_by_date
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const scriptTags = doc.querySelectorAll('script');
      
      let shiftsData = {};
      let dataFound = false;
      
      for (const script of scriptTags) {
        const content = script.textContent;
        if (content.includes('shiftsData = ')) {
          try {
            // Wyciągnij dane z JavaScript
            const match = content.match(/const shiftsData = (.*?);/s);
            if (match) {
              shiftsData = JSON.parse(match[1]);
              dataFound = true;
              break;
            }
          } catch (e) {
            console.error('Błąd parsowania shiftsData:', e);
          }
        }
      }
      
      if (!dataFound) {
        console.error('Nie znaleziono danych shiftsData w HTML');
        throw new Error('Nie znaleziono danych shiftsData w HTML');
      }
      
      // Ustaw data-official-value na oficjalne wartości (bez zmiany wyświetlania)
      Object.keys(shiftsData).forEach(date => {
        if (date === '_timestamp') return; // Pomiń klucz timestamp
        
        Object.keys(shiftsData[date]).forEach(employeeName => {
          const shiftType = shiftsData[date][employeeName];
          
          // Znajdź odpowiednią komórkę w tabeli
          const cell = document.querySelector(`[data-date="${date}"][data-employee="${employeeName}"]`);
          if (cell) {
            // Ustaw tylko data-official-value (nie zmieniaj wyświetlania)
            cell.dataset.officialValue = shiftType;
            console.log(`🔄 [DRAFT] Ustawiono data-official-value: ${date} - ${employeeName} = ${shiftType}`);
          }
        });
      });
      
      console.log('🔄 [DRAFT] Oficjalne wartości ustawione jako punkt odniesienia');
    })
    .catch(error => {
      console.error('Błąd ładowania oficjalnego grafiku:', error);
    });
}

// Przywróć oficjalny grafik
function restoreOfficialSchedule() {
  console.log('🔄 [DRAFT] Przywracam oficjalny grafik...');
  
  // Wyczyść wszystkie sloty (NIE czyść data-official-value - to jest potrzebne do porównywania)
  document.querySelectorAll('.slot[data-date][data-employee]').forEach(slot => {
    slot.setAttribute('data-value', '');
    slot.textContent = '';
    slot.classList.remove('draft-slot');
  });
  
  // Pobierz parametry roku i miesiąca z tabeli
  const grafikTable = document.getElementById('grafik');
  const year = grafikTable.getAttribute('data-year');
  const month = grafikTable.getAttribute('data-month');
  
  if (!year || !month) {
    console.error('Brak parametrów roku/miesiąca w tabeli');
    return Promise.resolve();
  }
  
  // Załaduj oficjalny grafik z serwera dla całego miesiąca
  return fetch(`/?year=${year}&month=${month}`, { credentials: 'include' })
    .then(response => response.text())
    .then(html => {
      // Parsuj HTML aby wyciągnąć dane shifts_by_date
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const scriptTags = doc.querySelectorAll('script');
      
      let shiftsData = {};
      let dataFound = false;
      
      for (const script of scriptTags) {
        const content = script.textContent;
        if (content.includes('shiftsData = ')) {
          try {
            // Wyciągnij dane z JavaScript
            const match = content.match(/const shiftsData = (.*?);/s);
            if (match) {
              shiftsData = JSON.parse(match[1]);
              dataFound = true;
              break;
            }
          } catch (e) {
            console.error('Błąd parsowania shiftsData:', e);
          }
        }
      }
      
      if (!dataFound) {
        console.error('Nie znaleziono danych shiftsData w HTML');
        showNotification('Błąd ładowania oficjalnego grafiku', 'error');
        throw new Error('Nie znaleziono danych shiftsData w HTML');
      }
      
      // Zastosuj oficjalny grafik
      Object.keys(shiftsData).forEach(date => {
        if (date === '_timestamp') return; // Pomiń klucz timestamp
        
        Object.keys(shiftsData[date]).forEach(employeeName => {
          const shiftType = shiftsData[date][employeeName];
          
          // Znajdź odpowiednią komórkę w tabeli
          const cell = document.querySelector(`[data-date="${date}"][data-employee="${employeeName}"]`);
          if (cell) {
            // Zaktualizuj komórkę typem zmiany
            const displayValue = shiftType === 'DNIOWKA' ? 'D' : shiftType === 'NOCKA' ? 'N' : shiftType;
            cell.textContent = displayValue;
            cell.dataset.value = shiftType;
            cell.dataset.officialValue = shiftType; // Ustaw pełną nazwę jako oficjalną wartość
            
            // Dodaj odpowiednią klasę dla stylowania
            cell.classList.remove('dniowka', 'nocka', 'custom-shift', 'poludniowka');
            if (shiftType === 'DNIOWKA') {
              cell.classList.add('dniowka');
            } else if (shiftType === 'NOCKA') {
              cell.classList.add('nocka');
            } else if (shiftType && shiftType.startsWith('P ')) {
              cell.classList.add('poludniowka');
            } else if (shiftType && shiftType.length > 0) {
              cell.classList.add('custom-shift');
            }
          }
        });
      });
      
      console.log('🔄 [DRAFT] Oficjalny grafik przywrócony dla całego miesiąca');
    })
    .catch(error => {
      console.error('Błąd ładowania oficjalnego grafiku:', error);
      throw error; // Rzuć błąd dalej dla obsługi w exitDraftMode
    });
}

// Aktualizuj interfejs trybu roboczego
function updateDraftUI() {
  const toggleBtn = document.getElementById('toggle-draft-mode');
  const exitDraftBtn = document.getElementById('exit-draft-mode');
  const saveDraftBtn = document.getElementById('save-draft-version');
  const normalSaveBtn = document.getElementById('save-shifts');
  const cancelBtn = document.getElementById('cancel-shifts');
  const publishBtn = document.getElementById('publish-draft-shifts');
  
  // Znajdź komórki układu 2x2
  const rightTopCell = document.querySelector('.cell.right-top');
  const leftBottomCell = document.querySelector('.cell.left-bottom');
  const rightBottomCell = document.querySelector('.cell.right-bottom');
  
  console.log('🔍 [DRAFT] Komórki UI:', {
    rightTopCell: !!rightTopCell,
    leftBottomCell: !!leftBottomCell,
    rightBottomCell: !!rightBottomCell,
    toggleBtn: !!toggleBtn,
    exitDraftBtn: !!exitDraftBtn,
    normalSaveBtn: !!normalSaveBtn,
    cancelBtn: !!cancelBtn
  });
  
  if (isDraftMode) {
    // TRYB ROBOCZY - zmień przyciski w układzie 2x2
    
    // Prawy górny: Wyłącz tryb roboczy
    if (rightTopCell) {
      console.log('🧹 [DRAFT] Czyśzczę rightTopCell przed włączeniem trybu roboczego');
      
      // Wyczyść CAŁKOWICIE komórkę
      rightTopCell.innerHTML = '';
      console.log('🧹 [DRAFT] Wyczyściłem rightTopCell całkowicie');
      
      // Dodaj przycisk "Wyłącz tryb roboczy"
      if (exitDraftBtn) {
        // Usuń przycisk z kontenera hidden
        exitDraftBtn.remove();
        
        // Styl przycisku dla widoczności
        exitDraftBtn.style.display = 'block';
        exitDraftBtn.style.visibility = 'visible';
        exitDraftBtn.style.position = 'relative';
        exitDraftBtn.classList.remove('hidden');
        
        // Dodaj do komórki
        rightTopCell.appendChild(exitDraftBtn);
        console.log('🔧 [DRAFT] Przeniosłem exit-draft-btn do rightTopCell');
      }
    }
    
    // Lewy dolny: Zapisz wersję roboczą
    if (leftBottomCell) {
      console.log('🧹 [DRAFT] Czyśzczę leftBottomCell przed włączeniem trybu roboczego');
      
      // Wyczyść CAŁKOWICIE komórkę
      leftBottomCell.innerHTML = '';
      console.log('🧹 [DRAFT] Wyczyściłem leftBottomCell całkowicie');
      
      // Dodaj przycisk "Zapisz wersję roboczą"
      if (saveDraftBtn) {
        // Usuń przycisk z kontenera hidden
        saveDraftBtn.remove();
        
        // Styl przycisku dla widoczności
        saveDraftBtn.style.display = 'block';
        saveDraftBtn.style.visibility = 'visible';
        saveDraftBtn.style.position = 'relative';
        saveDraftBtn.classList.remove('hidden');
        
        // Dodaj do komórki
        leftBottomCell.appendChild(saveDraftBtn);
        console.log('🔧 [DRAFT] Przeniosłem save-draft-btn do leftBottomCell');
      }
    }
    
    // Prawy dolny: Prześlij zmiany
    if (rightBottomCell) {
      console.log('🧹 [DRAFT] Czyśzczę rightBottomCell przed włączeniem trybu roboczego');
      
      // Wyczyść CAŁKOWICIE komórkę
      rightBottomCell.innerHTML = '';
      console.log('🧹 [DRAFT] Wyczyściłem rightBottomCell całkowicie');
      
      // Dodaj przycisk "Prześlij zmiany"
      if (publishBtn) {
        // Usuń przycisk z kontenera hidden
        publishBtn.remove();
        
        // Styl przycisku dla widoczności
        publishBtn.style.display = 'block';
        publishBtn.style.visibility = 'visible';
        publishBtn.style.position = 'relative';
        publishBtn.classList.remove('hidden');
        
        // Dodaj do komórki
        rightBottomCell.appendChild(publishBtn);
        console.log('🔧 [DRAFT] Przeniosłem publish-draft-btn do rightBottomCell');
      }
    }
    
  } else {
    // TRYB NORMALNY - przywróć oryginalne przyciski
    console.log('🔄 [DRAFT] Przywracam oryginalne przyciski...');
    
    // Prawy górny: Włącz tryb roboczy
    if (rightTopCell) {
      console.log('🧹 [DRAFT] Przywracam normalne przyciski dla rightTopCell');
      
      // Usuń przycisk draft z komórki
      const exitDraftBtn = rightTopCell.querySelector('#exit-draft-mode');
      if (exitDraftBtn) {
        exitDraftBtn.remove();
        // Znajdź kontener ukryty i dodaj z powrotem
        const draftControls = document.querySelector('.draft-mode-controls');
        if (draftControls) {
          draftControls.appendChild(exitDraftBtn);
          exitDraftBtn.style.display = '';
          console.log('🔙 [DRAFT] Przywróciłem exit-draft-btn do kontenera ukrytego');
        }
      }
      
      // Wyczyść komórkę i przywróć oryginalny przycisk
      rightTopCell.innerHTML = `
        <button id="toggle-draft-mode" class="btn btn-secondary">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
          </svg>
          tryb<br>roboczy
        </button>
      `;
      console.log('🔧 [DRAFT] Przywróciłem toggleBtn');
    }
    
    // Lewy dolny: Zapisz
    if (leftBottomCell) {
      console.log('🧹 [DRAFT] Przywracam normalne przyciski dla leftBottomCell');
      
      // Usuń przycisk draft z komórki
      const saveDraftBtn = leftBottomCell.querySelector('#save-draft-version');
      if (saveDraftBtn) {
        saveDraftBtn.remove();
        // Znajdź kontener ukryty i dodaj z powrotem
        const draftControls = document.querySelector('.draft-mode-controls');
        if (draftControls) {
          draftControls.appendChild(saveDraftBtn);
          saveDraftBtn.style.display = '';
          console.log('🔙 [DRAFT] Przywróciłem save-draft-btn do kontenera ukrytego');
        }
      }
      
      // Wyczyść komórkę i przywróć oryginalny przycisk
      leftBottomCell.innerHTML = `
        <button id="save-shifts" class="btn">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
          </svg>
          Zapisz
        </button>
      `;
      console.log('🔧 [DRAFT] Przywróciłem saveBtn');
      
      // Ponownie przypisz event listener do nowego przycisku
      const newSaveBtn = document.getElementById('save-shifts');
      if (newSaveBtn && typeof save === 'function') {
        newSaveBtn.addEventListener('click', save);
        console.log('🔧 [DRAFT] Przypisałem event listener do nowego saveBtn');
      }
    }
    
    // Prawy dolny: Anuluj
    if (rightBottomCell) {
      console.log('🧹 [DRAFT] Przywracam normalne przyciski dla rightBottomCell');
      
      // Usuń przycisk draft z komórki
      const publishBtn = rightBottomCell.querySelector('#publish-draft-shifts');
      if (publishBtn) {
        publishBtn.remove();
        // Znajdź kontener ukryty i dodaj z powrotem
        const draftControls = document.querySelector('.draft-mode-controls');
        if (draftControls) {
          draftControls.appendChild(publishBtn);
          publishBtn.style.display = '';
          console.log('🔙 [DRAFT] Przywróciłem publish-draft-btn do kontenera ukrytego');
        }
      }
      
      // Wyczyść komórkę i przywróć oryginalny przycisk
      rightBottomCell.innerHTML = `
        <button id="cancel-shifts" class="btn">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
          Anuluj
        </button>
      `;
      console.log('🔧 [DRAFT] Przywróciłem cancelBtn');
      
      // Ponownie przypisz event listener do nowego przycisku
      const newCancelBtn = document.getElementById('cancel-shifts');
      if (newCancelBtn && typeof cancel === 'function') {
        newCancelBtn.addEventListener('click', cancel);
        console.log('🔧 [DRAFT] Przypisałem event listener do nowego cancelBtn');
      }
    }
  }
  
  console.log('🔧 [DRAFT] UI zaktualizowane - isDraftMode:', isDraftMode);
  
  // Sprawdź czy istnieją zapisane wersje robocze
  checkDraftStatus();
}

// Zapisz wersję roboczą
function saveDraftVersion() {
  console.log('💾 [DRAFT] Zapisuję wersję roboczą...');
  
  // Zbierz wszystkie zmiany z interfejsu
  const changes = collectDraftChanges();
  console.log('💾 [DRAFT] Zebrano', changes.length, 'zmian do zapisania');
  console.log('💾 [DRAFT] Szczegóły zmian:', changes);
  
  if (changes.length === 0) {
    showNotification('Brak zmian do zapisania', 'info');
    return;
  }
  
  // Wyłącz przyciski podczas zapisywania
  const saveBtn = document.getElementById('save-draft-version');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Zapisywanie...';
  }
  
  // Wyślij dane do API
  fetch('/api/draft/save', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-CSRFToken': window.csrfToken
    },
    credentials: 'include',
    body: JSON.stringify({ changes })
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      showNotification('Błąd zapisywania: ' + data.error, 'error');
      return;
    }
    
    showNotification(`Wersja robocza zapisana! (${changes.length} zmian)`, 'success');
    console.log('💾 [DRAFT] Wersja robocza zapisana pomyślnie');
    // Odśwież status draft
    checkDraftStatus();
  })
  .catch(error => {
    console.error('Błąd zapisywania wersji roboczej:', error);
    showNotification('Błąd zapisywania wersji roboczej', 'error');
  })
  .finally(() => {
    // Przywróć przyciski
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Zapisz wersję roboczą';
    }
  });
}

// Sprawdź status wersji roboczej
function checkDraftStatus() {
  fetch('/api/draft/status', { credentials: 'include' })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        console.error('Błąd sprawdzania statusu draft:', data.error);
        return;
      }
      
      // Status draft jest teraz tylko w trybie edycji
      console.log('📊 [DRAFT] Status draft:', data);
      
      // Pokaż/ukryj przycisk publikacji w zależności od tego czy istnieją drafty
      const publishBtn = document.getElementById('publish-draft-shifts');
      if (publishBtn) {
        if (data.has_draft && isDraftMode) {
          publishBtn.classList.remove('hidden');
          publishBtn.disabled = false;
        } else {
          publishBtn.classList.add('hidden');
        }
      }
    })
    .catch(error => {
      console.error('Błąd sprawdzania statusu draft:', error);
    });
}

// Opublikuj zmiany z draft
function publishDraftChanges() {
  console.log('🚀 [DRAFT] Publikuję zmiany z draft...');
  
  // Przycisk publikacji jest teraz w trybie edycji
  
  fetch('/api/draft/publish', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-CSRFToken': window.csrfToken
    },
    credentials: 'include'
  })
  .then(response => response.json())
  .then(data => {
    if (data.error) {
      showNotification('Błąd publikacji: ' + data.error, 'error');
    } else {
      showNotification('Zmiany zostały opublikowane pomyślnie', 'success');
      // Odśwież status draft
      checkDraftStatus();
      // Odśwież stronę aby pokazać nowe zmiany
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  })
  .catch(error => {
    console.error('Błąd publikacji draft:', error);
    showNotification('Błąd publikacji zmian', 'error');
  })
  .finally(() => {
    // Przycisk publikacji jest teraz w trybie edycji
  });
}

// Odrzuć wersję roboczą
function discardDraftChanges(showConfirmation = true) {
  console.log('🗑️ [DRAFT] Odrzucam wersję roboczą...');
  
  if (showConfirmation && !confirm('Czy na pewno chcesz odrzucić wszystkie zmiany w wersji roboczej?')) {
    return Promise.resolve();
  }
  
  // Przycisk odrzucania jest teraz w trybie edycji
  
  return fetch('/api/draft/discard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    if (data.error) {
      if (showConfirmation) {
        showNotification('Błąd odrzucania: ' + data.error, 'error');
      }
      console.error('Błąd odrzucania draft:', data.error);
    } else {
      if (showConfirmation) {
        showNotification('Wersja robocza została odrzucona', 'success');
        // Odśwież status draft
        checkDraftStatus();
      }
      console.log('🗑️ [DRAFT] Wersja robocza została odrzucona');
    }
  })
  .catch(error => {
    console.error('Błąd odrzucania draft:', error);
    if (showConfirmation) {
      showNotification('Błąd odrzucania wersji roboczej: ' + error.message, 'error');
    }
  });
}

// Załaduj zapisane wersje robocze
async function loadDraftData() {
  console.log('📥 [DRAFT] Ładowanie zapisanych wersji roboczych...');
  
  try {
    const response = await fetch('/api/draft/load', { credentials: 'include' });
    const data = await response.json();
    
    if (data.error) {
      console.error('Błąd ładowania draft:', data.error);
      showNotification('Błąd ładowania wersji roboczej: ' + data.error, 'error');
      return;
    }
    
    if (data.changes && data.changes.length > 0) {
      console.log('📥 [DRAFT] Znaleziono', data.changes.length, 'zapisanych zmian');
      applyDraftChanges(data.changes);
      showNotification(`Załadowano ${data.changes.length} zapisanych zmian`, 'info');
    } else {
      console.log('📥 [DRAFT] Brak zapisanych wersji roboczych');
    }
  } catch (error) {
    console.error('Błąd ładowania draft:', error);
    showNotification('Błąd ładowania wersji roboczej: ' + error.message, 'error');
    throw error; // Rzuć błąd dalej dla obsługi w enterDraftMode
  }
}

// Zastosuj zmiany draft do interfejsu
function applyDraftChanges(changes) {
  console.log('🎨 [DRAFT] Zastosowuję zapisane zmiany...');
  
  // NAJPIERW: Wyczyść wszystkie sloty (usuń oficjalny grafik)
  document.querySelectorAll('.slot[data-date][data-employee]').forEach(slot => {
    slot.setAttribute('data-value', '');
    // NIE czyść data-official-value - to jest potrzebne do porównywania zmian
    slot.textContent = '';
    slot.classList.remove('draft-slot');
  });
  
  // Mapowanie pełnych nazw na skróty
  const shiftTypeMapping = {
    'DNIOWKA': 'D',
    'NOCKA': 'N',
    'POPOLUDNIOWKA': 'P',
    'P ': 'P',  // Obsługa międzyzmiany z spacją
    'P': 'P'    // Obsługa międzyzmiany bez spacji
  };
  
  // TERAZ: Zastosuj tylko zmiany z wersji roboczej
  changes.forEach(change => {
    const slot = document.querySelector(`[data-date="${change.date}"][data-employee="${change.employee}"]`);
    if (slot) {
      // Mapuj pełną nazwę na skrót
      const displayValue = shiftTypeMapping[change.shift_type] || change.shift_type;
      
      slot.setAttribute('data-value', displayValue || '');
      slot.textContent = displayValue || '';
      
      // Dodaj klasę draft-slot tylko jeśli jest wartość
      if (displayValue && displayValue.trim()) {
        slot.classList.add('draft-slot');
      } else {
        slot.classList.remove('draft-slot');
      }
      
      // NIE aktualizuj data-official-value - to powinno pozostać jako oryginalna wartość
      
      console.log('🎨 [DRAFT] Zastosowano:', change.date, change.employee, change.shift_type, '->', displayValue || 'PUSTE');
    }
  });
  
  console.log('🎨 [DRAFT] Wersja robocza zastąpiła oficjalny grafik');
}

// Zbierz zmiany z interfejsu (TYLKO wersja robocza)
function collectDraftChanges() {
  console.log('🔍 [DRAFT] Zbieram zmiany z interfejsu...');
  const changes = [];
  const slots = document.querySelectorAll('.slot[data-date][data-employee]');
  console.log(`🔍 [DRAFT] Znaleziono ${slots.length} slotów do sprawdzenia`);
  
  // Mapowanie skrótów na pełne nazwy
  const reverseShiftTypeMapping = {
    'D': 'DNIOWKA',
    'N': 'NOCKA',
    'P': 'POPOLUDNIOWKA'
  };
  
  slots.forEach((slot, index) => {
    const date = slot.getAttribute('data-date');
    const employee = slot.getAttribute('data-employee');
    const currentValue = slot.getAttribute('data-value') || '';
    const officialValue = slot.getAttribute('data-official-value') || '';
    
    // Loguj pierwsze 5 slotów dla debugowania
    if (index < 5) {
      console.log(`🔍 [DRAFT] Slot ${index}: ${date} - ${employee} - current:"${currentValue}" official:"${officialValue}"`);
    }
    
    if (date && employee) {
      // Sprawdź czy jest różnica między oficjalną a aktualną wartością
      if (currentValue !== officialValue) {
        // Mapuj skrót na pełną nazwę przed zapisaniem
        const fullShiftType = reverseShiftTypeMapping[currentValue] || currentValue;
        
        // Zapisuj zmianę (może być pusta jeśli usuwamy zmianę)
        changes.push({ 
          date, 
          employee, 
          shift_type: fullShiftType || '' // Upewnij się że puste wartości są zapisywane jako pusty string
        });
        
        console.log(`💾 [DRAFT] Zmiana wykryta: ${date} - ${employee} - "${officialValue}" -> "${currentValue}" (${fullShiftType || 'PUSTE'})`);
      }
    }
  });
  
  console.log('💾 [DRAFT] Zebrano', changes.length, 'zmian z wersji roboczej');
  
  // Dodatkowe debugowanie - policz sloty z różnymi wartościami
  let differentSlots = 0;
  let emptySlots = 0;
  let officialSlots = 0;
  
  slots.forEach(slot => {
    const currentValue = slot.getAttribute('data-value') || '';
    const officialValue = slot.getAttribute('data-official-value') || '';
    
    if (currentValue !== officialValue) {
      differentSlots++;
    }
    if (currentValue === '') {
      emptySlots++;
    }
    if (officialValue !== '') {
      officialSlots++;
    }
  });
  
  console.log(`🔍 [DRAFT] Statystyki: ${differentSlots} różnych slotów, ${emptySlots} pustych slotów, ${officialSlots} slotów z oficjalnymi wartościami`);
  
  return changes;
}

// Inicjalizacja prostego systemu draft
function initializeDraftSystem() {
  console.log('🔧 [DRAFT] Inicjalizacja prostego systemu draft...');
  
  // Sprawdź czy użytkownik jest adminem
  const isAdmin = document.body.classList.contains('admin-user');
  if (!isAdmin) {
    console.log('🔧 [DRAFT] Użytkownik nie jest adminem - tryb roboczy niedostępny');
    return;
  }
  
  // Dodaj event listener dla przycisku zapisu w trybie edycji
  const saveBtn = document.getElementById('save-draft-version');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveDraftVersion);
    console.log('🔧 [DRAFT] Event listener dla zapisu wersji roboczej dodany');
  }
  
  // Przyciski panelu kontrolnego zostały usunięte - funkcjonalność tylko w trybie edycji
  
  // Sprawdź status draft przy inicjalizacji
  checkDraftStatus();
  
  console.log('🔧 [DRAFT] Prosty system draft zainicjalizowany');
}

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Stare funkcje usunięte - zastąpione przez DraftManager

// Sprawdź zmiany statusów po załadowaniu strony
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 [APP] DOM załadowany - inicjalizacja aplikacji...');
  
  // Podświetl zalogowanego użytkownika
  highlightCurrentUser();
  
  // Inicjalizuj nawigację zmian
  initializeShiftNavigation();
  
  // Inicjalizuj system draft
  console.log('🚀 [APP] Inicjalizuję system draft...');
  initializeDraftSystem();
  
  // Uniwersalny event listener dla przycisków draft mode
  document.addEventListener('click', function(e) {
    console.log('🔄 [DRAFT] Kliknięto element:', e.target.id, e.target);
    if (e.target && e.target.id === 'toggle-draft-mode') {
      console.log('🔄 [DRAFT] Kliknięto przycisk toggle-draft-mode');
      toggleDraftMode();
    } else if (e.target && e.target.id === 'exit-draft-mode') {
      console.log('🔄 [DRAFT] Kliknięto przycisk exit-draft-mode');
      exitDraftMode();
    } else if (e.target && e.target.closest && e.target.closest('#exit-draft-mode')) {
      console.log('🔄 [DRAFT] Kliknięto element wewnątrz exit-draft-mode');
      exitDraftMode();
    }
  });
  
  // Poczekaj 2 sekundy po załadowaniu, żeby dane się załadowały
  setTimeout(checkStatusChanges, 2000);
});

