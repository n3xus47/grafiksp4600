# 🚀 Instrukcja wdrożenia aplikacji grafiksp4600 na produkcję

## 📋 Wymagania
- Serwer DigitalOcean: `46.101.144.141`
- Domena: `grafik4600.com`
- SSH dostęp do serwera

## 🔧 Krok 1: Konfiguracja DNS (Namecheap)

1. **Zaloguj się na Namecheap.com**
2. **Przejdź do Domain List → grafik4600.com → Manage**
3. **Advanced DNS → Add New Record:**
   - **Type:** A Record
   - **Host:** @
   - **Value:** 46.101.144.141
   - **TTL:** Automatic

4. **Dodaj drugi rekord:**
   - **Type:** A Record  
   - **Host:** www
   - **Value:** 46.101.144.141
   - **TTL:** Automatic

⏱️ **Czas propagacji DNS:** 5-30 minut

## 🔑 Krok 2: Przygotowanie klucza SSH

Jeśli nie masz jeszcze klucza SSH na serwerze:

```bash
# Generuj klucz SSH (jeśli nie masz)
ssh-keygen -t rsa -b 4096

# Skopiuj klucz na serwer
ssh-copy-id root@46.101.144.141
```

## 🚀 Krok 3: Deployment aplikacji

```bash
# Uruchom skrypt deployment
./deploy.sh
```

## 🔐 Krok 4: Konfiguracja Google OAuth

1. **Przejdź do Google Cloud Console:**
   - https://console.cloud.google.com/

2. **APIs & Services → Credentials**

3. **Edytuj swój OAuth 2.0 Client**

4. **Authorized JavaScript origins:**
   - Dodaj: `http://grafik4600.com`
   - Dodaj: `https://grafik4600.com`
   - Dodaj: `http://www.grafik4600.com`
   - Dodaj: `https://www.grafik4600.com`

5. **Authorized redirect URIs:**
   - Dodaj: `http://grafik4600.com/authorize`
   - Dodaj: `https://grafik4600.com/authorize`
   - Dodaj: `http://www.grafik4600.com/authorize`
   - Dodaj: `https://www.grafik4600.com/authorize`

6. **Skopiuj Client ID i Client Secret**

## ⚙️ Krok 5: Aktualizacja konfiguracji na serwerze

```bash
# Połącz się z serwerem
ssh root@46.101.144.141

# Edytuj plik konfiguracyjny
nano /opt/grafiksp4600/.env

# Zaktualizuj:
GOOGLE_CLIENT_ID=twoj_client_id_tutaj
GOOGLE_CLIENT_SECRET=twoj_client_secret_tutaj

# Restart aplikacji
cd /opt/grafiksp4600
docker-compose restart
```

## 🔒 Krok 6: Konfiguracja SSL (HTTPS)

```bash
# Na serwerze uruchom:
certbot --nginx -d grafik4600.com -d www.grafik4600.com

# Postępuj zgodnie z instrukcjami certbot
# Wybierz opcję przekierowania HTTP → HTTPS
```

## ✅ Krok 7: Test aplikacji

1. **Otwórz przeglądarkę i przejdź do:**
   - http://grafik4600.com (powinno przekierować na HTTPS)
   - https://grafik4600.com

2. **Przetestuj logowanie Google**

3. **Przetestuj na telefonie i innych urządzeniach**

## 🔧 Przydatne komendy

```bash
# Sprawdzenie statusu aplikacji
ssh root@46.101.144.141 "cd /opt/grafiksp4600 && docker-compose ps"

# Logi aplikacji
ssh root@46.101.144.141 "cd /opt/grafiksp4600 && docker-compose logs -f"

# Restart aplikacji
ssh root@46.101.144.141 "cd /opt/grafiksp4600 && docker-compose restart"

# Sprawdzenie statusu nginx
ssh root@46.101.144.141 "systemctl status nginx"

# Test DNS
nslookup grafik4600.com
```

## 🆘 Rozwiązywanie problemów

### Problem: DNS nie działa
```bash
# Sprawdź DNS
dig grafik4600.com
```

### Problem: SSL nie działa
```bash
# Sprawdź certyfikat
certbot certificates
# Odnów certyfikat
certbot renew --dry-run
```

### Problem: Aplikacja nie startuje
```bash
# Sprawdź logi
docker-compose logs app
```

### Problem: Google OAuth nie działa
- Sprawdź czy domeny są dodane w Google Console
- Sprawdź czy Client ID/Secret są prawidłowe
- Sprawdź logi aplikacji

## 📞 Po deployment

✅ **Aplikacja będzie dostępna na:** https://grafik4600.com  
✅ **Automatyczne przekierowanie HTTP → HTTPS**  
✅ **SSL certyfikat z Let's Encrypt**  
✅ **Automatyczny restart po reboot serwera**  

---

🎉 **Gratulacje! Twoja aplikacja jest teraz dostępna publicznie!**
