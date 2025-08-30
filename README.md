# Grafik zmian pracowników - GRAFIKSP4600

Aplikacja webowa do zarządzania grafikiem zmian pracowników z systemem uwierzytelniania Google OAuth2.

## 🚀 Funkcjonalności

- **Zarządzanie grafikiem zmian** - edycja, przeglądanie i zarządzanie zmianami pracowników
- **System próśb o zamianę** - pracownicy mogą prosić o zamianę zmian
- **Uwierzytelnianie Google OAuth2** - bezpieczne logowanie przez Google
- **Zarządzanie pracownikami** - dodawanie, edycja i usuwanie pracowników
- **Role użytkowników** - administratorzy i zwykli użytkownicy
- **Responsywny interfejs** - działa na urządzeniach mobilnych i desktopowych
- **PWA Support** - Progressive Web App z offline caching

## 📋 Wymagania

- Python 3.8+
- Flask 2.3+
- SQLite3
- Konto Google Developer (dla OAuth2)

## 🛠️ Instalacja

### 1. Sklonuj repozytorium
```bash
git clone <repository-url>
cd grafiksp4600
```

### 2. Utwórz wirtualne środowisko
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# lub
venv\Scripts\activate  # Windows
```

### 3. Zainstaluj zależności
```bash
pip install -r requirements.txt
```

### 4. Skonfiguruj zmienne środowiskowe
Utwórz plik `.env` w głównym katalogu:
```env
# Konfiguracja Google OAuth2
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Klucz szyfrowania sesji (zmień w produkcji!)
SECRET_KEY=your-super-secret-key-change-in-production

# Lista dozwolonych emaili (opcjonalnie)
WHITELIST_EMAILS=user1@gmail.com,user2@gmail.com

# Środowisko (development/production)
FLASK_ENV=development
```

### 5. Skonfiguruj Google OAuth2
1. Przejdź do [Google Cloud Console](https://console.cloud.google.com/)
2. Utwórz nowy projekt lub wybierz istniejący
3. Włącz Google+ API
4. Utwórz poświadczenia OAuth2
5. Dodaj URI przekierowania: `http://localhost:5000/auth/callback`
6. Skopiuj Client ID i Client Secret do pliku `.env`

### 6. Zainicjalizuj bazę danych
```bash
flask init-db
```

### 7. Uruchom aplikację
```bash
python app.py
```

Aplikacja będzie dostępna pod adresem: http://localhost:5000

## 🔧 Użycie

### Logowanie
1. Przejdź do aplikacji
2. Kliknij "Zaloguj się przez Google"
3. Zaloguj się swoim kontem Google
4. Jeśli email jest na liście dozwolonych, zostaniesz zalogowany

### Zarządzanie grafikiem (tylko administratorzy)
1. Kliknij "2) ręczne wprowadzanie zmian"
2. Kliknij na komórkę w tabeli aby edytować
3. Wybierz typ zmiany (D - dzienna, N - nocna)
4. Kliknij "Zapisz" aby zapisać zmiany

### Składanie próśb o zamianę
1. Kliknij "5) wyślij prośbę o zamianę"
2. Wybierz swoją zmianę do oddania
3. Wybierz osobę i zmianę do przejęcia
4. Dodaj komentarz (opcjonalnie)
5. Kliknij "Wyślij prośbę"

### Oddawanie zmian
1. Kliknij "6) oddaj swoją zmianę"
2. Wybierz datę swojej zmiany
3. Wybierz osobę do której oddajesz zmianę
4. Dodaj komentarz (opcjonalnie)
5. Kliknij "Oddaj zmianę"

### Zarządzanie pracownikami (tylko administratorzy)
1. Kliknij "4) edycja pracowników"
2. Dodaj nowego pracownika lub edytuj istniejącego
3. Każdy pracownik musi mieć unikalny kod

## 🏗️ Architektura

### Backend (Flask)
- **app.py** - główny plik aplikacji z routingiem i logiką biznesową
- **config.py** - konfiguracja dla różnych środowisk
- **Baza danych SQLite** - przechowuje użytkowników, pracowników, zmiany i prośby

### Frontend
- **templates/index.html** - główny szablon HTML
- **static/app.js** - logika JavaScript (edycja, zarządzanie, API calls)
- **static/style.css** - style CSS

### API Endpoints
- `/api/save` - zapisywanie zmian w grafiku
- `/api/employees` - zarządzanie pracownikami
- `/api/swaps` - zarządzanie próśbami o zamianę
- `/api/swaps/inbox` - skrzynka próśb
- `/api/swaps/respond` - odpowiadanie na prośby
- `/api/swaps/boss` - zatwierdzanie próśb (tylko admin)

## 🔒 Bezpieczeństwo

- **Uwierzytelnianie OAuth2** - bezpieczne logowanie przez Google
- **Role użytkowników** - administratorzy i zwykli użytkownicy
- **Walidacja danych** - sprawdzanie poprawności danych wejściowych
- **Rate limiting** - ochrona przed nadużyciami
- **Bezpieczne sesje** - HTTPOnly cookies, SameSite protection
- **Whitelist emaili** - kontrola dostępu przez email

## 📱 Responsywny Design & PWA

Aplikacja została zoptymalizowana pod różne rozmiary ekranów i urządzenia:

### **Breakpointy**
- **Desktop** (1024px+): 3-kolumnowy layout z pełną funkcjonalnością
- **Tablet** (768-1024px): Zachowane proporcje, zoptymalizowane padding
- **Mobile** (≤768px): 1-kolumnowy layout, poziomy scroll tabeli
- **Small Mobile** (≤480px): Kompaktowy design, minimalne marginesy

### **PWA Features**
- **Manifest**: Aplikacja może być zainstalowana na urządzeniach
- **Service Worker**: Offline caching i network resilience
- **Offline Page**: Strona błędu połączenia z retry button
- **Touch Optimized**: Przyciski 44px+, gesty dotykowe

### **Responsywność**
- CSS Grid z automatycznym przełączaniem layoutu
- Tabela z poziomym scrollem na małych ekranach
- Edytory dostosowane do rozmiaru ekranu
- Automatyczne ukrywanie niepotrzebnych elementów

Szczegółowa dokumentacja w [RESPONSIVE_DESIGN.md](RESPONSIVE_DESIGN.md)

## 🚀 Wdrażanie produkcyjne

### 1. Zmień środowisko
```env
FLASK_ENV=production
```

### 2. Ustaw bezpieczny SECRET_KEY
```env
SECRET_KEY=your-super-long-random-secret-key
```

### 3. Włącz HTTPS
```env
SESSION_COOKIE_SECURE=true
```

### 4. Użyj produkcyjnego serwera WSGI
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

### 5. Skonfiguruj reverse proxy (nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🧪 Testowanie

### Uruchom testy
```bash
export FLASK_ENV=testing
python -m pytest tests/
```

### Testy jednostkowe
```bash
python -m pytest tests/test_api.py -v
```

## 📝 Logi

Aplikacja loguje wszystkie ważne zdarzenia:
- Logowania i wylogowania
- Zmiany w grafiku
- Próśb o zamianę
- Błędy i wyjątki

Logi są zapisywane w standardowym output i mogą być przekierowane do pliku lub systemu logowania.

## 🤝 Wsparcie

W przypadku problemów:
1. Sprawdź logi aplikacji
2. Sprawdź konfigurację Google OAuth2
3. Sprawdź czy wszystkie zależności są zainstalowane
4. Sprawdź czy baza danych jest zainicjalizowana

## 📄 Licencja

Ten projekt jest przeznaczony do użytku wewnętrznego firmy.

## 🔄 Aktualizacje

Aby zaktualizować aplikację:
1. Zatrzymaj aplikację
2. Pobierz najnowsze zmiany: `git pull`
3. Zaktualizuj zależności: `pip install -r requirements.txt`
4. Uruchom ponownie aplikację

---

**Uwaga**: Ta aplikacja jest przeznaczona do zarządzania grafikiem zmian w firmie. Upewnij się, że spełnia wszystkie wymagania prawne i organizacyjne Twojej firmy.
