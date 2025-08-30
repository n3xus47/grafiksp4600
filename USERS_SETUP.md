# Konfiguracja użytkowników GRAFIKSP4600

## System logowania

Aplikacja obsługuje dwa sposoby logowania:

1. **Email + Hasło** - prosty system logowania z listą użytkowników
2. **Google OAuth2** - logowanie przez Google (wymaga konfiguracji)

## Konfiguracja użytkowników email/password

### Opcja 1: Plik users.json (zalecane)

Stwórz plik `users.json` w głównym katalogu aplikacji:

```json
{
  "users": [
    {
      "email": "official221team@gmail.com",
      "password": "szef123",
      "role": "ADMIN"
    },
    {
      "email": "nikodemboniecki1@gmail.com",
      "password": "nikodem123",
      "role": "USER"
    },
    {
      "email": "bonieckinikodem0@gmail.com",
      "password": "weronika123",
      "role": "USER"
    }
  ]
}
```

### Opcja 2: Zmienna środowiskowa USERS

Dodaj do pliku `.env`:

```bash
USERS=official221team@gmail.com:szef123,nikodemboniecki1@gmail.com:nikodem123,bonieckinikodem0@gmail.com:weronika123
```

## Role użytkowników

- **ADMIN** - pełny dostęp do wszystkich funkcji
- **USER** - podstawowy dostęp do grafiku

## Domyślne konta

Jeśli nie skonfigurujesz żadnych użytkowników, automatycznie zostanie utworzone:

- **Email:** admin@grafik4600.com
- **Hasło:** admin123
- **Rola:** ADMIN

## Konta odpowiadające Google OAuth2

Aplikacja ma skonfigurowane konta email/password, które odpowiadają istniejącym kontom Google:

- **SZEF (ADMIN):** official221team@gmail.com / szef123
- **NIKODEM (USER):** nikodemboniecki1@gmail.com / nikodem123  
- **WERONIKA (USER):** bonieckinikodem0@gmail.com / weronika123

## Bezpieczeństwo

⚠️ **UWAGA:** 
- Plik `users.json` jest dodany do `.gitignore` - nie będzie commitowany
- Zmień domyślne hasła w produkcji
- Używaj silnych haseł
- Regularnie aktualizuj listę użytkowników

## Testowanie

1. Uruchom aplikację
2. Przejdź do `/signin`
3. Zaloguj się używając email i hasło
4. Sprawdź czy masz odpowiednie uprawnienia

## Google OAuth2 (opcjonalnie)

Aby włączyć logowanie przez Google:

1. Skonfiguruj Google Cloud Console
2. Dodaj `GOOGLE_CLIENT_ID` i `GOOGLE_CLIENT_SECRET` do `.env`
3. Dodaj redirect URI: `https://grafik4600.com/authorize`
4. Dodaj dozwolone emaile w `WHITELIST_EMAILS`
