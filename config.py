"""
Konfiguracja aplikacji Flask dla różnych środowisk
"""

import os
from datetime import timedelta


class Config:
    """Podstawowa konfiguracja aplikacji"""
    # Podstawowe ustawienia Flask
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # Ustawienia sesji
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)  # Zmniejszone z 30 do 7 dni
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Konfiguracja bazy danych
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), "app.db")
    
    # Rate limiting
    RATELIMIT_DEFAULT = "100 per minute"
    RATELIMIT_STORAGE_URL = "memory://"
    
    # Logowanie
    LOG_LEVEL = "INFO"
    LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


class DevelopmentConfig(Config):
    """Konfiguracja dla środowiska deweloperskiego"""
    DEBUG = True
    SESSION_COOKIE_SECURE = False
    LOG_LEVEL = "DEBUG"
    
    # Mniej restrykcyjne rate limiting w development
    RATELIMIT_DEFAULT = "1000 per minute"


class ProductionConfig(Config):
    """Konfiguracja dla środowiska produkcyjnego"""
    DEBUG = False
    SESSION_COOKIE_SECURE = True  # Wymaga HTTPS
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Konfiguracja dla HTTPS
    PREFERRED_URL_SCHEME = 'https'
    
    # Bardziej restrykcyjne rate limiting w produkcji
    RATELIMIT_DEFAULT = "50 per minute"
    
    # Dłuższe sesje w produkcji (ale nadal bezpieczne)
    PERMANENT_SESSION_LIFETIME = timedelta(days=14)


class TestingConfig(Config):
    """Konfiguracja dla testów"""
    TESTING = True
    DEBUG = True
    SESSION_COOKIE_SECURE = False
    
    # Użyj innej bazy danych dla testów
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), "test.db")
    
    # Szybkie rate limiting dla testów
    RATELIMIT_DEFAULT = "1000 per minute"


# Mapowanie nazw środowisk na klasy konfiguracyjne
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}


def get_config():
    """Zwraca odpowiednią konfigurację na podstawie zmiennej środowiskowej FLASK_ENV"""
    env = os.environ.get('FLASK_ENV', 'development')
    return config.get(env, config['default'])
