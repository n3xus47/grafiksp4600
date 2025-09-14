"""
Konfiguracja aplikacji Flask dla różnych środowisk (development, production, testing).
Każde środowisko ma swoje ustawienia bezpieczeństwa, wydajności i funkcjonalności.
"""

import os
from datetime import timedelta


class Config:
    """
    Podstawowa konfiguracja aplikacji - wspólne ustawienia dla wszystkich środowisk.
    Te ustawienia są używane jako domyślne i mogą być nadpisywane w klasach dziedziczących.
    """
    # Podstawowe ustawienia Flask - klucz do szyfrowania sesji i cookies
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # Ustawienia sesji - jak długo użytkownik pozostaje zalogowany
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)  # 7 dni - rozsądny kompromis między bezpieczeństwem a wygodą
    SESSION_COOKIE_HTTPONLY = True  # Cookies nie są dostępne przez JavaScript (ochrona przed XSS)
    SESSION_COOKIE_SAMESITE = 'Lax'  # Ochrona przed atakami CSRF
    
    # Konfiguracja bazy danych - ścieżka do pliku SQLite
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), "app.db")
    
    # Rate limiting - ograniczenie liczby żądań od jednego użytkownika
    RATELIMIT_DEFAULT = "100 per minute"  # 100 żądań na minutę
    RATELIMIT_STORAGE_URL = "memory://"  # Przechowywanie limitów w pamięci
    
    # Logowanie - poziom szczegółowości logów
    LOG_LEVEL = "INFO"
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Bezpieczeństwo - nagłówki HTTP dla ochrony przeglądarki
    HSTS_MAX_AGE = 31536000  # 1 rok - zmusza przeglądarkę do używania HTTPS
    CSP_POLICY = "upgrade-insecure-requests; block-all-mixed-content"  # Content Security Policy


class DevelopmentConfig(Config):
    """
    Konfiguracja dla środowiska deweloperskiego - mniej restrykcyjna, łatwiejsza do debugowania.
    Używana gdy pracujesz lokalnie na swoim komputerze.
    """
    DEBUG = True  # Włącza tryb debugowania - pokazuje szczegółowe błędy
    SESSION_COOKIE_SECURE = False  # Nie wymaga HTTPS (localhost nie ma SSL)
    LOG_LEVEL = "DEBUG"  # Bardziej szczegółowe logi
    
    # Mniej restrykcyjne rate limiting w development - łatwiej testować
    RATELIMIT_DEFAULT = "1000 per minute"


class ProductionConfig(Config):
    """
    Konfiguracja dla środowiska produkcyjnego - maksymalne bezpieczeństwo i wydajność.
    Używana na serwerze gdzie aplikacja jest dostępna publicznie.
    """
    DEBUG = False  # Wyłącz tryb debugowania - nie pokazuj szczegółów błędów użytkownikom
    SESSION_COOKIE_SECURE = True  # Wymaga HTTPS - cookies tylko przez szyfrowane połączenie
    SESSION_COOKIE_HTTPONLY = True  # Cookies nie są dostępne przez JavaScript
    SESSION_COOKIE_SAMESITE = 'Lax'  # Ochrona przed atakami CSRF
    
    # Konfiguracja dla HTTPS - wszystkie URL-e będą zaczynać się od https://
    PREFERRED_URL_SCHEME = 'https'
    
    # Bardziej restrykcyjne rate limiting w produkcji - ochrona przed atakami
    RATELIMIT_DEFAULT = "50 per minute"
    
    # Dłuższe sesje w produkcji (ale nadal bezpieczne) - użytkownicy nie muszą się często logować
    PERMANENT_SESSION_LIFETIME = timedelta(days=14)


class TestingConfig(Config):
    """
    Konfiguracja dla testów automatycznych - szybka i izolowana.
    Używana gdy uruchamiasz testy jednostkowe.
    """
    TESTING = True  # Tryb testowy - Flask wie że to testy
    DEBUG = True  # Włącz debugowanie dla testów
    SESSION_COOKIE_SECURE = False  # Nie wymaga HTTPS w testach
    
    # Użyj innej bazy danych dla testów - nie mieszaj danych testowych z prawdziwymi
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), "test.db")
    
    # Szybkie rate limiting dla testów - testy muszą być szybkie
    RATELIMIT_DEFAULT = "1000 per minute"


# Mapowanie nazw środowisk na klasy konfiguracyjne
# Każde środowisko ma swoją konfigurację dostosowaną do potrzeb
config = {
    'development': DevelopmentConfig,  # Lokalne programowanie
    'production': ProductionConfig,    # Serwer produkcyjny
    'testing': TestingConfig,         # Testy automatyczne
    'default': DevelopmentConfig      # Domyślne (jeśli nie podano środowiska)
}


def get_config():
    """
    Zwraca odpowiednią konfigurację na podstawie zmiennej środowiskowej FLASK_ENV.
    Jeśli nie podano środowiska, używa development (najbezpieczniejsze dla programowania).
    """
    env = os.environ.get('FLASK_ENV', 'development')
    return config.get(env, config['default'])
