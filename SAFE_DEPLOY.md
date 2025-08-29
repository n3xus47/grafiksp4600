# 🛡️ Bezpieczne wdrożenie PWA - gdy serwer ma lokalne zmiany

## ⚠️ Problem
Wersja na serwerze może mieć lokalne modyfikacje (np. inne ustawienia, hasła, konfiguracja), które mogą zostać nadpisane przez `git pull`.

## 🔍 Sprawdź różnice PRZED wdrożeniem

### 1. Zaloguj się na serwer i sprawdź status Git:
```bash
ssh root@46.101.144.141
cd /var/www/grafiksp4600

# Sprawdź czy są lokalne zmiany
git status

# Sprawdź różnice między wersją lokalną a GitHub
git diff HEAD origin/master

# Zobacz jakie pliki są zmienione lokalnie
git diff --name-only HEAD origin/master
```

### 2. Sprawdź co się zmieniło w ostatnich commitach:
```bash
# Pobierz najnowsze informacje z GitHub (bez mergowania)
git fetch origin

# Zobacz co się zmieniło w nowych commitach
git log HEAD..origin/master --oneline

# Zobacz szczegóły zmian
git diff HEAD..origin/master
```

## 🛡️ Bezpieczne metody wdrożenia

### Metoda 1: Backup + Selective Copy (NAJBEZPIECZNIEJSZA)

```bash
# 1. Utwórz pełny backup
cp -r /var/www/grafiksp4600 /var/www/grafiksp4600_backup_$(date +%Y%m%d_%H%M%S)

# 2. Pobierz najnowsze zmiany bez mergowania
cd /var/www/grafiksp4600
git fetch origin

# 3. Skopiuj TYLKO pliki PWA (ręcznie)
# Utwórz tymczasowy folder z nową wersją
git clone https://github.com/n3xus47/grafiksp4600.git /tmp/grafiksp4600_new

# 4. Skopiuj tylko pliki PWA
cp /tmp/grafiksp4600_new/static/manifest.json ./static/
cp /tmp/grafiksp4600_new/static/sw.js ./static/
cp /tmp/grafiksp4600_new/static/favicon.ico ./static/
cp -r /tmp/grafiksp4600_new/static/icons ./static/
cp /tmp/grafiksp4600_new/templates/offline.html ./templates/

# 5. Sprawdź różnice w app.py i templates/index.html
diff ./app.py /tmp/grafiksp4600_new/app.py
diff ./templates/index.html /tmp/grafiksp4600_new/templates/index.html
diff ./templates/signin.html /tmp/grafiksp4600_new/templates/signin.html

# 6. Ręcznie dodaj nowe fragmenty kodu PWA do istniejących plików
```

### Metoda 2: Stash + Pull + Pop

```bash
# 1. Zapisz lokalne zmiany
git stash push -m "Lokalne zmiany serwera przed PWA"

# 2. Pobierz zmiany PWA
git pull origin master

# 3. Przywróć lokalne zmiany (może być konflikt)
git stash pop

# 4. Rozwiąż konflikty jeśli są
# Git pokaże pliki z konfliktami - edytuj je ręcznie
```

### Metoda 3: Merge z rozwiązywaniem konfliktów

```bash
# 1. Commituj lokalne zmiany
git add -A
git commit -m "Lokalne zmiany serwera"

# 2. Merguj z GitHub
git pull origin master

# 3. Rozwiąż konflikty jeśli są
# Git pokaże pliki z konfliktami
```

## 📋 Lista plików PWA do skopiowania

Jeśli wybierasz metodę ręcznego kopiowania, skopiuj te pliki:

### Nowe pliki (bezpieczne do skopiowania):
```bash
static/manifest.json
static/sw.js  
static/favicon.ico
static/icons/ (cały folder)
templates/offline.html
PWA_GUIDE.md
DEPLOY_INSTRUCTIONS.md
SAFE_DEPLOY.md
```

### Zmodyfikowane pliki (OSTROŻNIE - sprawdź różnice):
```bash
app.py                 # Dodano route'y PWA
templates/index.html   # Dodano meta tagi PWA i skrypty
templates/signin.html  # Dodano meta tagi PWA  
static/style.css       # Dodano style PWA
```

## 🔧 Ręczne dodanie zmian PWA do istniejących plików

### 1. app.py - dodaj route'y PWA:
```python
# Dodaj przed "# --- Health check i debug"
# --- PWA Routes ---------------------------------------------------------------
@app.route('/manifest.json')
def manifest():
    """PWA Manifest endpoint"""
    return app.send_static_file('manifest.json')

@app.route('/sw.js')
def service_worker():
    """Service Worker endpoint"""
    response = make_response(app.send_static_file('sw.js'))
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/offline')
def offline():
    """Offline page for PWA"""
    return render_template("offline.html")
```

### 2. templates/index.html - dodaj meta tagi PWA:
```html
<!-- Dodaj w <head> po <title> -->
<!-- PWA Meta Tags -->
<meta name="theme-color" content="#d32f2f" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Grafik SP4600" />
<meta name="description" content="Aplikacja do zarządzania grafikiem zmian pracowników" />

<!-- Icons -->
<link rel="icon" type="image/png" sizes="32x32" href="/static/favicon.ico" />
<link rel="icon" type="image/png" sizes="192x192" href="/static/icons/icon-192x192.png" />
<link rel="apple-touch-icon" href="/static/icons/icon-192x192.png" />

<!-- PWA Manifest -->
<link rel="manifest" href="/static/manifest.json" />
```

### 3. Dodaj przycisk instalacji PWA:
```html
<!-- Dodaj w lewym panelu przed logout-area -->
<div class="pwa-install-area" style="margin-bottom: 1rem;">
  <button id="pwa-install-btn" class="btn w100" style="display: none;">
    📱 Zainstaluj aplikację
  </button>
</div>
```

### 4. Dodaj skrypty PWA przed </body>:
```html
<!-- Service Worker Registration -->
<script>
// [Cały kod z Service Worker registration - patrz templates/index.html]
</script>
```

## 🧪 Testowanie po wdrożeniu

```bash
# 1. Sprawdź czy aplikacja działa
curl https://grafik4600.com

# 2. Sprawdź pliki PWA
curl https://grafik4600.com/manifest.json
curl https://grafik4600.com/sw.js

# 3. Restartuj aplikację
systemctl restart grafiksp4600
systemctl status grafiksp4600

# 4. Sprawdź logi
tail -f /var/log/nginx/access.log
journalctl -u grafiksp4600 -f
```

## 🔄 Rollback jeśli coś pójdzie nie tak

```bash
# Przywróć backup
rm -rf /var/www/grafiksp4600
mv /var/www/grafiksp4600_backup_YYYYMMDD_HHMMSS /var/www/grafiksp4600

# Restartuj aplikację
systemctl restart grafiksp4600
```

## 💡 Rekomendacja

**Najbezpieczniejsza metoda:**
1. Utwórz backup
2. Skopiuj TYLKO nowe pliki PWA (manifest.json, sw.js, icons/, offline.html)
3. Ręcznie dodaj fragmenty kodu PWA do istniejących plików
4. Przetestuj każdy krok

To zajmie więcej czasu, ale nie ryzykujesz nadpisania ważnych lokalnych zmian.
