# ✅ Checklista wdrożenia GRAFIKSP4600

## 📋 **Przed rozpoczęciem**

- [ ] **Masz konto Google Cloud Platform**
- [ ] **Masz skonfigurowany Google OAuth2**
- [ ] **Masz kartę kredytową do płatności**
- [ ] **Masz podstawową wiedzę o SSH**

## 🖥️ **Krok 1: Serwer VPS**

### Wybór dostawcy
- [ ] **DigitalOcean** (rekomendowany dla początkujących)
- [ ] **Linode** (dla profesjonalistów)
- [ ] **Vultr** (dla oszczędnych)
- [ ] **Hetzner** (najtańszy w Europie)

### Konfiguracja serwera
- [ ] **System:** Ubuntu 22.04 LTS
- [ ] **Plan:** 1GB RAM, 1 CPU, 20GB+ SSD
- [ ] **Lokalizacja:** Europa (dla lepszego pinga)
- [ ] **Backup:** Włączony (jeśli dostępny)

### Połączenie
- [ ] **SSH key** dodany do serwera
- [ ] **Połączenie SSH** działa
- [ ] **IP serwera** zapisane

## 🌐 **Krok 2: Domena**

### Wybór rejestra
- [ ] **Namecheap** (rekomendowany)
- [ ] **GoDaddy**
- [ ] **OVH**

### Konfiguracja DNS
- [ ] **Rekord A:** `@` → IP serwera
- [ ] **Rekord A:** `www` → IP serwera
- [ ] **Propagacja DNS** (poczekaj 15-60 minut)

## 🚀 **Krok 3: Wdrożenie aplikacji**

### Przygotowanie serwera
- [ ] **Użytkownik grafiksp4600** utworzony
- [ ] **Uprawnienia sudo** nadane
- [ ] **Przejście na użytkownika** grafiksp4600

### Instalacja aplikacji
- [ ] **Git** zainstalowany
- [ ] **Aplikacja** sklonowana
- [ ] **Skrypt wdrożenia** uruchomiony
- [ ] **Domena** podana w skrypcie
- [ ] **Email** podany w skrypcie

### Automatyczne wdrożenie
- [ ] **System** zaktualizowany
- [ ] **Pakiety** zainstalowane
- [ ] **Firewall** skonfigurowany
- [ ] **Fail2ban** skonfigurowany
- [ ] **Nginx** skonfigurowany
- [ ] **SSL** skonfigurowany
- [ ] **Aplikacja** uruchomiona

## ⚙️ **Krok 4: Google OAuth2**

### Konfiguracja Google Cloud
- [ ] **Google Cloud Console** otwarte
- [ ] **Projekt** wybrany
- [ ] **OAuth 2.0 Client ID** edytowany
- [ ] **Redirect URI** dodany: `https://twoja-domena.pl/authorize`
- [ ] **Client ID** skopiowany
- [ ] **Client Secret** skopiowany

### Konfiguracja aplikacji
- [ ] **Plik .env** edytowany
- [ ] **GOOGLE_CLIENT_ID** uzupełniony
- [ ] **GOOGLE_CLIENT_SECRET** uzupełniony
- [ ] **Aplikacja** zrestartowana

## ✅ **Krok 5: Testowanie**

### Testy techniczne
- [ ] **Status aplikacji:** `sudo systemctl status grafiksp4600`
- [ ] **HTTPS działa:** `https://twoja-domena.pl`
- [ ] **Health check:** `https://twoja-domena.pl/healthz`
- [ ] **Logi aplikacji:** `sudo journalctl -u grafiksp4600 -f`

### Testy funkcjonalne
- [ ] **Strona główna** ładuje się
- [ ] **Logowanie Google** działa
- [ ] **Aplikacja** działa po zalogowaniu
- [ ] **Dostęp z telefonu** działa

## 🔒 **Krok 6: Bezpieczeństwo**

### Firewall
- [ ] **UFW** włączony
- [ ] **Port 22** (SSH) otwarty
- [ ] **Port 80** (HTTP) otwarty
- [ ] **Port 443** (HTTPS) otwarty
- [ ] **Inne porty** zamknięte

### Monitoring
- [ ] **Fail2ban** działa
- [ ] **Logi** są zapisywane
- [ ] **Backup** skonfigurowany

## 📱 **Krok 7: Test mobilny**

### Test na telefonie
- [ ] **Przeglądarka** otwarta
- [ ] **Domena** wpisana
- [ ] **HTTPS** działa
- [ ] **Logowanie** działa
- [ ] **Aplikacja** działa
- [ ] **Responsywność** OK

## 🎯 **Krok 8: Finalizacja**

### Dokumentacja
- [ ] **IP serwera** zapisane
- [ ] **Domena** zapisana
- [ ] **Dane logowania** zapisane
- [ ] **Backup** wykonany

### Monitoring
- [ ] **Uptime** sprawdzony
- [ ] **Logi** sprawdzone
- [ ] **Wydajność** OK

## 🚨 **Rozwiązywanie problemów**

### Jeśli aplikacja nie uruchamia się
- [ ] **Logi systemd:** `sudo journalctl -u grafiksp4600 -n 50`
- [ ] **Status:** `sudo systemctl status grafiksp4600`
- [ ] **Porty:** `sudo netstat -tlnp | grep 8000`

### Jeśli SSL nie działa
- [ ] **Certbot:** `sudo certbot certificates`
- [ ] **Nginx:** `sudo nginx -t`
- [ ] **Firewall:** `sudo ufw status`

### Jeśli Google OAuth2 nie działa
- [ ] **Redirect URI** poprawny
- [ ] **Client ID** poprawny
- [ ] **Client Secret** poprawny
- [ ] **Plik .env** zaktualizowany

## 🎉 **Gratulacje!**

Jeśli wszystkie punkty są zaznaczone, Twoja aplikacja działa poprawnie!

### Co masz teraz:
- ✅ **Profesjonalną stronę z domeną**
- ✅ **Bezpieczny HTTPS**
- ✅ **Dostęp z telefonu**
- ✅ **Logowanie przez Google**
- ✅ **Automatyczne uruchamianie**
- ✅ **Monitoring i bezpieczeństwo**

### Następne kroki:
- [ ] **Dodaj więcej użytkowników** do whitelist
- [ ] **Skonfiguruj backup** bazy danych
- [ ] **Dodaj monitoring** (opcjonalnie)
- [ **Użyj aplikacji** na co dzień! 📱💻
