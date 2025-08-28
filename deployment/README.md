# 🚀 Wdrożenie GRAFIKSP4600 na serwer produkcyjny

## 📖 Przegląd

Ten katalog zawiera wszystko, co potrzebujesz do wdrożenia aplikacji **GRAFIKSP4600** na serwer produkcyjny z domeną, SSL i dostępem z telefonu.

## 🎯 Co otrzymasz

Po wdrożeniu będziesz mieć:
- 🌐 **Profesjonalną stronę z domeną**
- 🔒 **Bezpieczny HTTPS (SSL)**
- 📱 **Dostęp z telefonu i komputera**
- 🔐 **Logowanie przez Google OAuth2**
- 🚀 **Automatyczne uruchamianie**
- 🔒 **Firewall i monitoring**

## 📁 Pliki wdrożenia

### 🚀 **Główne skrypty**
- **`deploy_production.sh`** - Automatyczny skrypt wdrożenia
- **`install.sh`** - Podstawowa instalacja systemowa

### 📚 **Dokumentacja**
- **`DEPLOYMENT_GUIDE.md`** - Szczegółowy przewodnik wdrożenia
- **`QUICK_START.md`** - Szybki start w 5 minut
- **`COSTS_AND_RECOMMENDATIONS.md`** - Koszty i rekomendacje
- **`DEPLOYMENT_CHECKLIST.md`** - Checklista wdrożenia

### ⚙️ **Konfiguracja**
- **`grafiksp4600.service`** - Systemd service
- **`gunicorn.conf.py`** - Konfiguracja Gunicorn
- **`env.example`** - Przykład zmiennych środowiskowych

## ⚡ Szybki start

### 1. **Kup serwer VPS** (~$6/miesiąc)
- [DigitalOcean](https://digitalocean.com) (rekomendowany)
- [Linode](https://linode.com)
- [Vultr](https://vultr.com)

### 2. **Kup domenę** (~$12/rok)
- [Namecheap](https://namecheap.com) (rekomendowany)
- [GoDaddy](https://godaddy.com)
- [OVH](https://ovh.com)

### 3. **Uruchom automatyczne wdrożenie**
```bash
# Na serwerze
git clone https://github.com/twoj-username/grafiksp4600.git
cd grafiksp4600
chmod +x deployment/deploy_production.sh
./deployment/deploy_production.sh
```

### 4. **Skonfiguruj Google OAuth2**
- Dodaj redirect URI: `https://twoja-domena.pl/authorize`
- Zaktualizuj plik `.env`

## 💰 Koszty

**Całkowity koszt: $84/rok (~$7/miesiąc)**
- Serwer VPS: $72/rok
- Domena: $12/rok

**To mniej niż kawa w Starbucks! ☕**

## 🔧 Wymagania techniczne

### Serwer
- **System:** Ubuntu 22.04 LTS
- **Minimalne:** 1GB RAM, 1 CPU, 20GB SSD
- **Zalecane:** 2GB RAM, 1 CPU, 25GB SSD

### Domena
- **Typ:** Dowolna (`.pl`, `.com`, `.eu`, etc.)
- **DNS:** Rekordy A wskazujące na IP serwera

### Google OAuth2
- Konto Google Cloud Platform
- Skonfigurowany projekt z OAuth 2.0

## 🚨 Ważne uwagi

### Bezpieczeństwo
- ✅ Firewall (UFW) automatycznie skonfigurowany
- ✅ Fail2ban dla ochrony przed atakami
- ✅ HTTPS/SSL z Let's Encrypt
- ✅ Automatyczne aktualizacje systemu

### Backup
- ✅ Automatyczne backupy (DigitalOcean)
- ✅ Backup bazy danych
- ✅ Konfiguracja systemu

### Monitoring
- ✅ Logi aplikacji
- ✅ Logi systemowe
- ✅ Health check endpoint

## 📱 Dostęp z telefonu

Po wdrożeniu:
1. Otwórz przeglądarkę na telefonie
2. Przejdź na `https://twoja-domena.pl`
3. Zaloguj się przez Google
4. Używaj aplikacji normalnie!

## 🛠️ Zarządzanie

### Podstawowe komendy
```bash
# Status aplikacji
sudo systemctl status grafiksp4600

# Uruchom/zatrzymaj
sudo systemctl start grafiksp4600
sudo systemctl stop grafiksp4600
sudo systemctl restart grafiksp4600

# Logi
sudo journalctl -u grafiksp4600 -f
```

### Aktualizacje
```bash
cd /opt/grafiksp4600
git pull origin main
sudo systemctl restart grafiksp4600
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

### Problem z Google OAuth2
- Sprawdź redirect URI w Google Cloud Console
- Sprawdź plik `.env`
- Sprawdź logi aplikacji

## 📞 Wsparcie

### Logi systemowe
```bash
# Systemd
sudo journalctl -xe

# Nginx
sudo tail -f /var/log/nginx/error.log

# Aplikacja
sudo journalctl -u grafiksp4600 -f
```

### Sprawdzenie portów
```bash
sudo netstat -tlnp
sudo ss -tlnp
```

## 🎉 Podsumowanie

**Wdrożenie zajmuje tylko 30 minut i kosztuje $7 miesięcznie!**

Po wdrożeniu będziesz mieć profesjonalną, bezpieczną aplikację dostępną z każdego urządzenia pod własną domeną.

### Następne kroki
1. **Przeczytaj** `DEPLOYMENT_GUIDE.md` dla szczegółów
2. **Użyj** `QUICK_START.md` dla szybkiego startu
3. **Sprawdź** `COSTS_AND_RECOMMENDATIONS.md` dla wyboru dostawców
4. **Użyj** `DEPLOYMENT_CHECKLIST.md` do kontroli postępu

---

**🚀 Gotowy do wdrożenia? Uruchom `./deployment/deploy_production.sh`!**
