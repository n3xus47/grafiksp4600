/**
 * Aplikacja do zarządzania grafikiem zmian pracowników
 * Główny plik JavaScript z funkcjonalnością edycji, zarządzania pracownikami i próśbami o zamianę
 */

(function(){
  // Debouncing utility
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

  // Funkcja aktualizacji zegara
  function updateClock() {
    const now = new Date();
    const tz = 'Europe/Warsaw';
    const datePart = now.toLocaleDateString('pl-PL', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz
    });
    const timePart = now.toLocaleTimeString('pl-PL', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
    });
    const clockElement = document.getElementById('clock');
    if (clockElement) {
      clockElement.textContent = `${datePart} ${timePart}`;
    }
  }
  
  // Inicjalizacja i aktualizacja zegara co sekundę
  updateClock();
  setInterval(updateClock, 1000);
  
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
            
            // Sprawdź czy komórka zawiera D lub N i dodaj odpowiednią klasę
            const content = slot.textContent.trim();
            if (content === 'D') {
              slot.classList.add('dniowka');
              console.log('Podświetlono D (dniówka) dla:', slot.getAttribute('data-employee'));
            } else if (content === 'N') {
              slot.classList.add('nocka');
              console.log('Podświetlono N (nocka) dla:', slot.getAttribute('data-employee'));
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
        
        slots.forEach(slot => {
          const content = slot.textContent.trim();
          if (content === 'D') dniowkaCount++;
          if (content === 'N') nockaCount++;
        });
        
        // Aktualizuj licznik w wierszu
        const dniowkaElement = row.querySelector('.dniowka-count');
        const nockaElement = row.querySelector('.nocka-count');
        
        if (dniowkaElement) dniowkaElement.textContent = dniowkaCount;
        if (nockaElement) nockaElement.textContent = nockaCount;
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

// Rejestracja Service Worker dla PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/static/sw.js')
      .then(registration => {
        console.log('Service Worker zarejestrowany:', registration);
      })
      .catch(error => {
        console.log('Błąd rejestracji Service Worker:', error);
      });
  });
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

// Główna funkcja aplikacji
document.addEventListener('DOMContentLoaded', function() {
  console.log('Aplikacja została załadowana');
  
  // Inicjalizuj responsywny design
  handleResponsiveDesign();
  
  // Pobierz wszystkie potrzebne elementy DOM
  const table = document.getElementById('grafik');
  const btnToggle = document.getElementById('btn-edit');
  const editor = document.getElementById('slot-editor');
  const actions = document.getElementById('actions');
  const input = document.getElementById('opt-custom');
  const btnSave = document.getElementById('save');
  const btnCancel = document.getElementById('cancel');
  const btnEmps = document.getElementById('btn-emps');
  const empEditor = document.getElementById('emp-editor');
  const empList = document.getElementById('emp-list');
  const empName = document.getElementById('emp-name');
  const empCode = document.getElementById('emp-code');
  const empAddBtn = document.getElementById('emp-add-btn');
  const empClose = document.getElementById('emp-close');
  const btnSwaps = document.getElementById('btn-swaps');
  const swapEditor = document.getElementById('swap-editor');
  const swapClose = document.getElementById('swap-close');
  const swapList = document.getElementById('swap-list');
  const swapClear = document.getElementById('swap-clear');
  const btnCompose = document.getElementById('btn-compose');
  const composeEditor = document.getElementById('compose-editor');
  const composeClose = document.getElementById('compose-close');
  const composeFromName = document.getElementById('compose-from-name');
  const composeFromDate = document.getElementById('compose-from-date');
  const composeToName = document.getElementById('compose-to-name');
  const composeToDate = document.getElementById('compose-to-date');
  const composeComment = document.getElementById('compose-comment');
  const composeSend = document.getElementById('compose-send');
  
  // Elementy dla oddawania zmian
  const btnGive = document.getElementById('btn-give');
  const giveEditor = document.getElementById('give-editor');
  const giveClose = document.getElementById('give-close');
  const giveFromName = document.getElementById('give-from-name');
  const giveFromDate = document.getElementById('give-from-date');
  const giveToName = document.getElementById('give-to-name');
  const giveComment = document.getElementById('give-comment');
  const giveSend = document.getElementById('give-send');

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
    
    if (value === '') {
      // Czerwone mryganie po usunięciu
      cell.classList.add('deleted');
      setTimeout(() => cell.classList.remove('deleted'), 800);
      // Ustaw flagę żeby nie pokazywać pomarańczowego
      justDeleted = true;
      setTimeout(() => justDeleted = false, 2000); // Resetuj flagę po 2s
    } else {
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
            body: JSON.stringify({ from_date, from_employee, to_date, to_employee, comment }) 
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
          body: JSON.stringify({ from_date, from_employee, to_date, to_employee, comment }) 
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
    if (b) choose(b.dataset.value);
  });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      choose(input.value.trim());
    }
  });

  // Funkcje trybu edycji
  function toggleEdit() {
    // Użyj requestAnimationFrame dla lepszej wydajności
    requestAnimationFrame(() => {
      editMode = !editMode;
      if (actions) actions.classList.toggle('show', editMode);
      
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
      if (actions) actions.classList.remove('show');
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
      body: JSON.stringify({ changes })
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
    if (actions) actions.classList.remove('show');
    document.body.classList.remove('edit-mode'); // Usuń klasę edit-mode
    hideEditor();
    location.reload();
  }

  // Event listeners dla przycisków edycji
  if (btnToggle) btnToggle.addEventListener('click', toggleEdit);
  if (table) table.addEventListener('click', onCellClick);
  if (btnSave) btnSave.addEventListener('click', save);
  if (btnCancel) btnCancel.addEventListener('click', cancel);
  
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
    fetch('/api/employees')
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
      body: JSON.stringify({ code, name }) 
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
  function loadSwaps() {
    fetch('/api/swaps/inbox')
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          throw new Error(data.error);
        }
        
        const items = data.items || []; 
        const isBoss = !!data.is_boss;
        
        if (swapList) swapList.innerHTML = '';
        if (swapClear) swapClear.style.display = isBoss ? 'inline-flex' : 'none';
        
        const me = (table && table.getAttribute('data-current-user')) || '';
        
        for (const item of items) {
          const row = document.createElement('div');
          row.className = 'emp-row';
          const title = document.createElement('div');
          const fromS = item.from_shift ? ` (${item.from_shift})` : '';
          const toS = item.to_shift ? ` (${item.to_shift})` : '';
          
          // Sprawdź typ prośby i wyświetl odpowiednio
          if (item.is_give_request) {
            // Prośba o oddanie zmiany
            title.textContent = `${item.from_employee} oddaje zmianę ${item.from_date}${fromS} → ${item.to_employee}`;
          } else {
            // Regularna zamiana
            title.textContent = `${item.from_employee} ${item.from_date}${fromS} ⇄ ${item.to_employee} ${item.to_date}${toS}`;
          }
          
          // Dodaj wyświetlanie statusu
          if (item.boss_status === 'APPROVED') {
            const status = document.createElement('div');
            status.className = 'status-approved';
            status.textContent = 'Zatwierdzone';
            title.appendChild(document.createElement('br'));
            title.appendChild(status);
          } else if (item.boss_status === 'REJECTED') {
            const status = document.createElement('div');
            status.className = 'status-rejected';
            status.textContent = 'Odrzucone';
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
          
          row.appendChild(title); 
          row.appendChild(actions);
          if (swapList) swapList.appendChild(row);
        }
        
        // Odśwież listy dat w formularzu jeśli jest otwarty
        if (composeEditor && composeEditor.classList.contains('show')) {
          populateOwnShifts();
          if (composeToName && composeToName.value) {
            populateOtherShifts(composeToName.value);
          }
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
      body: JSON.stringify({ id, status }) 
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
      body: JSON.stringify({ id, status }) 
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
      fetch('/api/swaps/clear', { method: 'POST' })
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

  // --- Compose dialog (składanie próśb o zamianę) ---
  function toggleCompose() { 
    if (composeEditor) {
      composeEditor.classList.toggle('show', true);
      // Wypełnij listę własnych zmian
      populateOwnShifts();
      // Odśwież listę zmian wybranej osoby jeśli jest wybrana
      if (composeToName && composeToName.value) {
        populateOtherShifts(composeToName.value);
      }
    }
  }
  
  function closeCompose() { 
    if (composeEditor) composeEditor.classList.remove('show') 
  }
  
  // --- Give shift functions (oddawanie zmian) ---
  function toggleGive() { 
    if (giveEditor) {
      giveEditor.classList.toggle('show', true);
      // Wypełnij listę własnych zmian
      populateGiveShifts();
    }
  }
  
  function closeGive() { 
    if (giveEditor) giveEditor.classList.remove('show') 
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
      
      if (value === 'D' || value === 'N') {
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
  function populateOwnShifts() {
    const fromDateSelect = document.getElementById('compose-from-date');
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
      
      if (value === 'D' || value === 'N') {
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
  function populateOtherShifts(employeeName) {
    const toDateSelect = document.getElementById('compose-to-date');
    if (!toDateSelect) return;
    
    // Wyczyść listę
    toDateSelect.innerHTML = '<option value="" disabled selected>Wybierz datę</option>';
    
    // Pobierz wszystkie komórki wybranej osoby z tabelki grafiku
    const employeeCells = table.querySelectorAll(`.slot[data-employee="${employeeName}"]`);
    const shifts = [];
    
    employeeCells.forEach(cell => {
      const date = cell.dataset.date;
      const value = cell.textContent.trim();
      
      if (value === 'D' || value === 'N') {
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
      body: JSON.stringify(payload) 
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
      body: JSON.stringify(payload) 
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

  // --- Event listeners dla formularzy ---
  if (btnCompose) btnCompose.addEventListener('click', toggleCompose);
  if (composeClose) composeClose.addEventListener('click', closeCompose);
  if (composeEditor) composeEditor.addEventListener('click', (e) => { if (e.target === composeEditor) closeCompose(); });
  if (composeSend) composeSend.addEventListener('click', sendCompose);
  
  // Give shift event listeners
  if (btnGive) btnGive.addEventListener('click', toggleGive);
  if (giveClose) giveClose.addEventListener('click', closeGive);
  if (giveEditor) giveEditor.addEventListener('click', (e) => { if (e.target === giveEditor) closeGive(); });
  if (giveSend) giveSend.addEventListener('click', sendGive);

  // Event listener dla zmiany osoby w formularzu compose
  if (composeToName) {
    composeToName.addEventListener('change', (e) => {
      const selectedEmployee = e.target.value;
      if (selectedEmployee) {
        populateOtherShifts(selectedEmployee);
      } else {
        // Resetuj listę dat gdy nie wybrano osoby
        const toDateSelect = document.getElementById('compose-to-date');
        if (toDateSelect) {
          toDateSelect.innerHTML = '<option value="" disabled selected>Najpierw wybierz osobę</option>';
          toDateSelect.disabled = true;
        }
      }
    });
  }
  
  // Funkcja do odświeżania list w formularzu gdy zmienia się grafik
  function refreshComposeLists() {
    // Sprawdź czy formularz jest otwarty
    if (composeEditor && composeEditor.classList.contains('show')) {
      // Odśwież listę własnych zmian
      populateOwnShifts();
      
      // Odśwież listę zmian wybranej osoby (jeśli jest wybrana)
      const selectedEmployee = composeToName ? composeToName.value : '';
      if (selectedEmployee) {
        populateOtherShifts(selectedEmployee);
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

  console.log('Aplikacja została w pełni załadowana i jest gotowa do użycia');
});
