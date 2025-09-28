"""
Główna aplikacja Flask - Grafik SP4600
Refaktoryzowana wersja z modularną strukturą
Zachowuje pełną kompatybilność z istniejącą funkcjonalnością
"""

import os
import logging
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Ładowanie zmiennych środowiskowych
load_dotenv()

# Konfiguracja logowania
import os
os.makedirs('logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def create_app():
    """Factory function do tworzenia aplikacji Flask"""
    app = Flask(__name__)
    
    # Podstawowa konfiguracja
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    app.config['DATABASE_PATH'] = os.path.join(os.path.dirname(__file__), "app.db")
    
    # Konfiguracja VAPID dla Web Push Notifications (z zmiennych środowiskowych)
    app.config['VAPID_PUBLIC_KEY'] = os.environ.get("VAPID_PUBLIC_KEY", "")
    app.config['VAPID_PRIVATE_KEY'] = os.environ.get("VAPID_PRIVATE_KEY", "")
    app.config['VAPID_CLAIM_EMAIL'] = os.environ.get("VAPID_CLAIM_EMAIL", "admin@grafik4600.com")
    
    # Import modułów po utworzeniu aplikacji
    from app import database
    from app import auth
    from app.routes import main, api, auth_routes, admin
    
    # Inicjalizacja bazy danych
    database.init_app(app)
    
    # Inicjalizacja OAuth
    auth_routes.init_auth_routes(app)
    
    # Rejestracja blueprintów
    app.register_blueprint(main.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(auth_routes.bp)
    app.register_blueprint(admin.bp)
    
    # Middleware dla cache control
    @app.after_request
    def after_request(response):
        # Wyłącz cache dla plików statycznych (CSS, JS) - zawsze pobieraj najnowsze wersje
        if request.path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response
    
    # Dodaj endpointy systemowe bez prefiksu
    @app.get("/healthz")
    def healthz():
        """Health check endpoint"""
        import datetime
        return jsonify({"status": "ok", "timestamp": datetime.datetime.now().isoformat()})
    
    # Debug endpoint tylko w trybie development
    if app.config.get('DEBUG', False):
        @app.get("/debug/env")
        def debug_env():
            """Debug endpoint - informacje o środowisku (tylko w development)"""
            return jsonify({
                "environment": "development",
                "has_client_id": bool(os.environ.get('GOOGLE_CLIENT_ID')),
                "has_client_secret": bool(os.environ.get('GOOGLE_CLIENT_SECRET')),
                "has_secret_key": bool(os.environ.get('SECRET_KEY'))
            })
    
    # Inicjalizacja bazy danych przy starcie
    with app.app_context():
        try:
            database.init_db()
            logger.info("Aplikacja zainicjalizowana pomyślnie")
        except Exception as e:
            logger.error(f"Błąd podczas inicjalizacji aplikacji: {e}")
    
    return app

# Utwórz aplikację
app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
