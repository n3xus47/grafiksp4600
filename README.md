# Grafik SP4600 - System Zarządzania Grafikami

Prywatna aplikacja webowa do zarządzania grafikami zmian pracowników dla stacji Orlen SP4600.

## 🎯 Funkcjonalności

- **Zarządzanie grafikami** - tworzenie i edycja grafików zmian
- **System wymian** - zgłaszanie i zatwierdzanie wymian między pracownikami
- **Zgłaszanie niedyspozycji** - system zgłaszania nieobecności
- **PWA** - Progressive Web App z powiadomieniami
- **Responsywny design** - działa na wszystkich urządzeniach

## 🚀 Uruchomienie lokalne

```bash
# Uruchom aplikację lokalnie
./run_local.sh

# Aplikacja będzie dostępna na http://localhost:5000
```

## 📦 Wdrożenie na serwer

```bash
# Bezpieczne wdrożenie (sprawdza zmiany)
./safe_deploy.sh

# Standardowe wdrożenie
./deploy.sh
```

## 🛠️ Technologie

- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Baza danych**: SQLite3
- **Uwierzytelnianie**: Google OAuth2
- **PWA**: Service Worker, Manifest
- **Deployment**: Docker, Nginx

## 📁 Struktura projektu

```
├── app.py                 # Główna aplikacja Flask
├── config.py              # Konfiguracja
├── wsgi.py                # WSGI entry point
├── requirements.txt       # Zależności Python
├── templates/             # Szablony HTML
├── static/                # Pliki statyczne (CSS, JS, obrazy)
├── deployment/            # Konfiguracja wdrożenia
└── monitoring/            # System monitoringu
```

## 🔧 Konfiguracja

1. Skopiuj `local_config.env` do `.env`
2. Ustaw zmienne środowiskowe (Google OAuth, baza danych)
3. Uruchom `./run_local.sh`

## 📱 PWA

Aplikacja działa jako Progressive Web App:
- Instalacja na urządzenia mobilne
- Powiadomienia push
- Praca offline
- Responsywny design

## 🔒 Bezpieczeństwo

- Uwierzytelnianie Google OAuth2
- Whitelist emaili
- Rate limiting
- HTTPS w produkcji
- Security headers

## 📊 Monitoring

System monitoringu oparty na Prometheus + Grafana:
- Metryki aplikacji
- Metryki systemu
- Alerty
- Dashboardy

---

**Uwaga**: To jest prywatny projekt dla stacji Orlen SP4600. Nie jest przeznaczony do publicznego użytku.