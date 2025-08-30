# 🚀 Szybki start - Wdrożenie GRAFIKSP4600

## ⚡ W 5 minut na serwerze

### 1. **Połącz się z serwerem**
```bash
ssh root@twoj-serwer-ip
```

### 2. **Utwórz użytkownika i przejdź na niego**
```bash
adduser grafiksp4600
usermod -aG sudo grafiksp4600
su - grafiksp4600
```

### 3. **Sklonuj i uruchom**
```bash
git clone https://github.com/twoj-username/grafiksp4600.git
cd grafiksp4600
chmod +x deployment/deploy_production.sh
./deployment/deploy_production.sh
```

### 4. **Podaj domenę i email**
- Domena: `twoja-domena.pl`
- Email: `twoj-email@gmail.com`

### 5. **Poczekaj na zakończenie (5-10 minut)**

## 🌐 Konfiguracja domeny

### W rejestrze domeny dodaj:
```
A    @     →    IP_serwera
A    www   →    IP_serwera
```

## 🔑 Google OAuth2

### Dodaj redirect URI:
```
https://twoja-domena.pl/authorize
```

### Edytuj plik .env:
```bash
sudo nano /opt/grafiksp4600/.env
```

### Uzupełnij:
```env
GOOGLE_CLIENT_ID=twoj-client-id
GOOGLE_CLIENT_SECRET=twoj-client-secret
```

### Restart:
```bash
sudo systemctl restart grafiksp4600
```

## ✅ Gotowe!

Twoja aplikacja działa na: **https://twoja-domena.pl**

Dostępna z telefonu, komputera, wszędzie! 📱💻
