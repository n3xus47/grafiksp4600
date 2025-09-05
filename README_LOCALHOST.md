# GRAFIKSP4600 - System Zarządzania Grafikiem Zmian

Aplikacja Flask do zarządzania grafikiem zmian pracowników z systemem uwierzytelniania Google OAuth2.

## 🚀 Szybki Start - Localhost

### Wymagania
- Python 3.8+
- pip
- Konto Google (dla OAuth)

### Instalacja i uruchomienie

1. **Sklonuj repozytorium:**
   ```bash
   git clone <url-repozytorium>
   cd grafiksp4600
   ```

2. **Uruchom automatyczny skrypt:**
   ```bash
   chmod +x run_local.sh
   ./run_local.sh
   ```

3. **Lub ręcznie:**
   ```bash
   # Utwórz środowisko wirtualne
   python3 -m venv venv
   source venv/bin/activate
   
   # Zainstaluj zależności
   pip install -r requirements.txt
   
   # Skopiuj konfigurację
   cp local_config.env .env
   
   # Uruchom aplikację
   python app.py
   ```

4. **Otwórz przeglądarkę:**
   ```
   http://localhost:5000
   ```

## 🔧 Konfiguracja

### Plik .env
Aplikacja używa pliku `.env` do konfiguracji. Skopiuj `local_config.env` jako `.env`:

```bash
cp local_config.env .env
```

### Google OAuth2
Aplikacja wymaga konfiguracji Google OAuth2:
1. Idź do [Google Cloud Console](https://console.cloud.google.com/)
2. Utwórz nowy projekt lub wybierz istniejący
3. Włącz Google+ API
4. Utwórz credentials (OAuth 2.0 Client ID)
5. Dodaj `http://localhost:5000/auth/callback` jako redirect URI
6. Skopiuj Client ID i Client Secret do pliku `.env`

### Dozwolone emaile
Dodaj swoje emaile do `WHITELIST_EMAILS` w pliku `.env`:
```
WHITELIST_EMAILS=twoj-email@gmail.com,inny-email@gmail.com
```

## 📊 Baza Danych

Aplikacja używa SQLite. Baza danych `app.db` zawiera:
- Użytkowników
- Pracowników
- Zmiany
- Prośby o zamianę zmian

## 🌐 Struktura Aplikacji

```
grafiksp4600/
├── app.py                 # Główna aplikacja Flask
├── config.py             # Konfiguracja środowisk
├── requirements.txt      # Zależności Python
├── run_local.sh         # Skrypt uruchamiający
├── local_config.env     # Szablon konfiguracji
├── static/              # Pliki statyczne (CSS, JS)
├── templates/           # Szablony HTML
├── deployment/          # Skrypty deployment
└── monitoring/          # Monitoring i health checks
```

## 🔐 Bezpieczeństwo

- **Sesje:** HTTPOnly, SameSite=Lax
- **Rate Limiting:** 100 żądań/minutę
- **Whitelist:** Tylko autoryzowane emaile
- **HTTPS:** Wymagane w produkcji

## 📱 Funkcje

- ✅ Kalendarz zmian pracowników
- ✅ System zamian zmian
- ✅ Uwierzytelnianie Google OAuth2
- ✅ Panel administratora
- ✅ Responsywny design
- ✅ PWA (Progressive Web App)

## 🚀 Deployment

### Lokalny development
```bash
python app.py
```

### Produkcja (Gunicorn)
```bash
gunicorn -c gunicorn.conf.py wsgi:application
```

### Docker
```bash
docker-compose up -d
```

## 📝 Logi

Logi aplikacji są zapisywane w folderze `logs/`:
- `app.log` - główne logi aplikacji
- `server.log` - logi serwera

## 🛠️ Rozwój

### Dodawanie nowych funkcji
1. Edytuj `app.py` dla nowych endpointów
2. Dodaj szablony w `templates/`
3. Zaktualizuj style w `static/style.css`
4. Przetestuj lokalnie

### Baza danych
```bash
# Inicjalizacja bazy
flask init-db

# Migracje (jeśli potrzebne)
# Dodaj nowe funkcje migracji w app.py
```

## 📞 Wsparcie

W przypadku problemów:
1. Sprawdź logi w `logs/app.log`
2. Upewnij się, że `.env` jest skonfigurowany
3. Sprawdź czy baza danych `app.db` istnieje
4. Sprawdź połączenie z Google OAuth

---

**Status:** ✅ Gotowe do użycia lokalnie
**Ostatnia aktualizacja:** 2025-09-05