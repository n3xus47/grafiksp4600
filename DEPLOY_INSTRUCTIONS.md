# 🚀 Instrukcje wdrożenia PWA na serwer grafik4600.com

## ✅ Status PWA
- ✅ Manifest PWA utworzony
- ✅ Service Worker zaimplementowany  
- ✅ Ikony PWA wygenerowane (8 rozmiarów)
- ✅ Meta tagi PWA dodane
- ✅ HTTPS dostępne na grafik4600.com
- ✅ Zmiany wysłane do GitHub

## 🔧 Wdrożenie na serwer

### Metoda 1: Git Pull (Najłatwiejsza)

```bash
# 1. Zaloguj się na serwer
ssh root@46.101.144.141

# 2. Przejdź do katalogu aplikacji
cd /var/www/grafiksp4600  # lub gdzie masz aplikację

# 3. Pobierz najnowsze zmiany
git pull origin master

# 4. Restartuj aplikację
systemctl restart grafiksp4600  # lub jak nazywa się twoja usługa
# LUB jeśli używasz gunicorn:
# pkill -f "gunicorn.*grafiksp4600" 

# 5. Restartuj nginx (opcjonalnie)
nginx -t && systemctl reload nginx
```

### Metoda 2: Ręczne kopiowanie plików

Jeśli Git pull nie zadziała, użyj przygotowanego skryptu:

```bash
# Na lokalnej maszynie:
./deploy_pwa.sh

# Następnie wykonaj instrukcje z skryptu
```

## 🧪 Testowanie PWA

Po wdrożeniu sprawdź:

### 1. Podstawowe działanie
- Otwórz https://grafik4600.com w Chrome
- Sprawdź czy aplikacja się ładuje

### 2. Manifest PWA
- F12 → Application → Manifest
- Sprawdź czy manifest się ładuje bez błędów
- Ikony powinny być widoczne

### 3. Service Worker  
- F12 → Application → Service Workers
- Sprawdź czy SW jest zarejestrowany i aktywny

### 4. Przycisk instalacji
- Powinien pojawić się przycisk "📱 Zainstaluj aplikację"
- Jeśli nie - sprawdź console na błędy

### 5. Tryb offline
- F12 → Network → Offline
- Odśwież stronę - powinna działać offline

## 🔧 Konfiguracja Nginx dla PWA

Jeśli potrzebujesz dodać konfigurację Nginx:

```nginx
# Dodaj do /etc/nginx/sites-available/default

# Service Worker - no cache
location /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}

# Manifest - short cache
location /manifest.json {
    add_header Cache-Control "max-age=3600";
    add_header Content-Type "application/json";
}

# Static assets - long cache
location ~* \.(png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

Potem:
```bash
nginx -t && systemctl reload nginx
```

## 📱 Jak zainstalować PWA

### Android (Chrome):
1. Otwórz https://grafik4600.com
2. Kliknij przycisk "📱 Zainstaluj aplikację"
3. LUB Menu Chrome → "Dodaj do ekranu głównego"

### iPhone (Safari):
1. Otwórz https://grafik4600.com  
2. Przycisk "Udostępnij" → "Dodaj do ekranu głównego"

### Desktop (Chrome/Edge):
1. Otwórz https://grafik4600.com
2. Kliknij ikonę instalacji w pasku adresu
3. LUB przycisk "📱 Zainstaluj aplikację"

## 🐛 Rozwiązywanie problemów

### PWA nie działa:
- Sprawdź czy HTTPS działa: `curl -I https://grafik4600.com`
- Sprawdź logi nginx: `tail -f /var/log/nginx/error.log`
- Sprawdź logi aplikacji: `journalctl -u grafiksp4600 -f`

### Service Worker nie ładuje się:
- Sprawdź czy `/sw.js` jest dostępny: `curl https://grafik4600.com/sw.js`
- Sprawdź nagłówki cache w nginx

### Manifest nie ładuje się:
- Sprawdź czy `/manifest.json` jest dostępny: `curl https://grafik4600.com/manifest.json`
- Sprawdź Content-Type w nginx

### Przycisk instalacji nie pojawia się:
- PWA musi spełniać wszystkie kryteria (HTTPS, manifest, SW, ikony)
- Sprawdź DevTools → Application → Manifest na błędy
- Sprawdź Console na błędy JavaScript

## 📊 Weryfikacja PWA

Po wdrożeniu sprawdź w Chrome DevTools:
- **Application → Manifest**: Wszystkie pola wypełnione ✅
- **Application → Service Workers**: SW aktywny ✅  
- **Lighthouse → PWA**: Wszystkie testy przeszły ✅

## 🎉 Gotowe!

Po pomyślnym wdrożeniu:
- Aplikacja będzie dostępna jako PWA
- Użytkownicy mogą ją zainstalować na telefonie/komputerze
- Działa offline z podstawowymi funkcjami
- Automatycznie aktualizuje się w tle

**URL do testowania**: https://grafik4600.com
