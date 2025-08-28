# 🚀 Przewodnik wdrożenia GRAFIKSP4600 na serwer produkcyjny

## 📋 Wymagania wstępne

### 1. **Serwer VPS**
- **System:** Ubuntu 22.04 LTS (zalecane)
- **Minimalne wymagania:** 1GB RAM, 1 CPU, 20GB SSD
- **Polecane dostawcy:** DigitalOcean, Linode, Vultr, Hetzner
- **Koszt:** ~$5-10/miesiąc

### 2. **Domena**
- **Polecane rejestry:** Namecheap, GoDaddy, OVH
- **Koszt:** ~$10-15/rok
- **Przykłady:** `grafiksp4600.pl`, `grafik4600.com`, `sp4600.pl`

### 3. **Google OAuth2**
- Konto Google Cloud Platform
- Skonfigurowany projekt z OAuth 2.0

## 🔧 Krok 1: Przygotowanie serwera

### Połączenie z serwerem
```bash
ssh root@twoj-serwer-ip
```

### Aktualizacja systemu
```bash
apt update && apt upgrade -y
```

### Utworzenie użytkownika z sudo
```bash
adduser grafiksp4600
usermod -aG sudo grafiksp4600
```

### Przejście na nowego użytkownika
```bash
su - grafiksp4600
```

## 🌐 Krok 2: Konfiguracja domeny

### 1. **W rejestrze domeny:**
- Dodaj rekord A: `@` → IP twojego serwera
- Dodaj rekord A: `www` → IP twojego serwera
- Dodaj rekord CNAME: `www` → `@` (opcjonalnie)

### 2. **Poczekaj na propagację DNS (15-60 minut)**

## 🚀 Krok 3: Automatyczne wdrożenie

### 1. **Sklonuj aplikację na serwer**
```bash
git clone https://github.com/twoj-username/grafiksp4600.git
cd grafiksp4600
```

### 2. **Uruchom skrypt wdrożenia**
```bash
chmod +x deployment/deploy_production.sh
./deployment/deploy_production.sh
```

### 3. **Postępuj zgodnie z instrukcjami skryptu:**
- Podaj nazwę domeny
- Podaj email administratora
- Potwierdź wdrożenie

## ⚙️ Krok 4: Konfiguracja Google OAuth2

### 1. **Idź do Google Cloud Console**
- [https://console.cloud.google.com/](https://console.cloud.google.com/)

### 2. **Wybierz swój projekt**

### 3. **W "APIs & Services" → "Credentials"**

### 4. **Edytuj istniejący OAuth 2.0 Client ID**

### 5. **Dodaj nowe "Authorized redirect URIs":**
```
https://twoja-domena.pl/authorize
https://www.twoja-domena.pl/authorize
```

### 6. **Skopiuj Client ID i Client Secret**

## 🔑 Krok 5: Konfiguracja aplikacji

### 1. **Edytuj plik .env**
```bash
sudo nano /opt/grafiksp4600/.env
```

### 2. **Uzupełnij konfigurację:**
```env
# Konfiguracja produkcyjna GRAFIKSP4600
FLASK_ENV=production
SECRET_KEY=wygenerowany-klucz
GOOGLE_CLIENT_ID=twoj-google-client-id
GOOGLE_CLIENT_SECRET=twoj-google-client-secret
SERVER_NAME=twoja-domena.pl
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=Lax
WHITELIST_EMAILS=official221team@gmail.com,nikodemboniecki1@gmail.com,bonieckinikodem0@gmail.com
```

### 3. **Uruchom ponownie aplikację**
```bash
sudo systemctl restart grafiksp4600
```

## ✅ Krok 6: Testowanie

### 1. **Sprawdź status aplikacji**
```bash
sudo systemctl status grafiksp4600
```

### 2. **Sprawdź logi**
```bash
sudo journalctl -u grafiksp4600 -f
```

### 3. **Test w przeglądarce**
- Otwórz `https://twoja-domena.pl`
- Spróbuj się zalogować przez Google

## 🔒 Bezpieczeństwo

### Firewall
```bash
sudo ufw status
```

### Fail2ban
```bash
sudo fail2ban-client status
```

### Logi bezpieczeństwa
```bash
sudo tail -f /var/log/auth.log
```

## 📱 Dostęp z telefonu

### 1. **Otwórz przeglądarkę na telefonie**
### 2. **Przejdź na `https://twoja-domena.pl`**
### 3. **Zaloguj się przez Google**
### 4. **Użyj aplikacji normalnie**

## 🛠️ Zarządzanie aplikacją

### Uruchomienie/zatrzymanie
```bash
sudo systemctl start grafiksp4600
sudo systemctl stop grafiksp4600
sudo systemctl restart grafiksp4600
```

### Status
```bash
sudo systemctl status grafiksp4600
```

### Logi
```bash
# Logi aplikacji
sudo journalctl -u grafiksp4600 -f

# Logi nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Backup bazy danych
```bash
sudo cp /opt/grafiksp4600/app.db /var/backups/grafiksp4600/app.db.backup.$(date +%Y%m%d_%H%M%S)
```

## 🔄 Aktualizacje

### 1. **Zatrzymaj aplikację**
```bash
sudo systemctl stop grafiksp4600
```

### 2. **Zaktualizuj kod**
```bash
cd /opt/grafiksp4600
git pull origin main
```

### 3. **Zaktualizuj zależności**
```bash
sudo -u grafiksp4600 /opt/grafiksp4600/venv/bin/pip install -r requirements.txt
```

### 4. **Uruchom ponownie**
```bash
sudo systemctl start grafiksp4600
```

## 🚨 Rozwiązywanie problemów

### Aplikacja nie uruchamia się
```bash
sudo systemctl status grafiksp4600
sudo journalctl -u grafiksp4600 -n 50
```

### Problem z SSL
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

### Problem z nginx
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Problem z bazą danych
```bash
sudo -u grafiksp4600 sqlite3 /opt/grafiksp4600/app.db ".tables"
```

## 📞 Wsparcie

### Logi systemowe
```bash
# Logi systemd
sudo journalctl -xe

# Logi nginx
sudo tail -f /var/log/nginx/error.log

# Logi aplikacji
sudo journalctl -u grafiksp4600 -f
```

### Sprawdzenie portów
```bash
sudo netstat -tlnp
sudo ss -tlnp
```

### Sprawdzenie procesów
```bash
ps aux | grep grafiksp4600
ps aux | grep nginx
```

## 🎯 Podsumowanie

Po wykonaniu wszystkich kroków będziesz mieć:

✅ **Aplikację działającą na HTTPS**  
✅ **Automatyczne SSL z Let's Encrypt**  
✅ **Firewall i fail2ban dla bezpieczeństwa**  
✅ **Dostęp z telefonu przez domenę**  
✅ **Logowanie przez Google OAuth2**  
✅ **Automatyczne uruchamianie po restarcie serwera**  
✅ **Monitoring i logi**  

Twoja aplikacja będzie dostępna pod adresem `https://twoja-domena.pl` i będzie działać na wszystkich urządzeniach, w tym na telefonie!
