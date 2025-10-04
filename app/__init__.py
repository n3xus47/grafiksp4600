"""
Główna aplikacja Flask - Grafik SP4600
Modularna struktura z zachowaniem pełnej kompatybilności
"""

import os
import logging
import gzip
from flask import Flask, request, Response
from flask_wtf.csrf import CSRFProtect
from dotenv import load_dotenv

# Ładowanie zmiennych środowiskowych
load_dotenv()

# Konfiguracja logowania
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Factory function do tworzenia aplikacji Flask"""
    app = Flask(__name__, 
                template_folder=os.path.join(os.path.dirname(__file__), "..", "templates"),
                static_folder=os.path.join(os.path.dirname(__file__), "..", "static"))
    
    # Podstawowa konfiguracja
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "5G5_hLlJRHaOAwQH-YvDcrQhp7T7TQ6rxtQdI07x9k")
    app.config['DATABASE_PATH'] = os.path.join(os.path.dirname(__file__), "..", "app.db")
    
    # Konfiguracja VAPID dla Web Push Notifications
    app.config['VAPID_PUBLIC_KEY'] = os.environ.get("VAPID_PUBLIC_KEY", "")
    app.config['VAPID_PRIVATE_KEY'] = os.environ.get("VAPID_PRIVATE_KEY", "")
    app.config['VAPID_CLAIM_EMAIL'] = os.environ.get("VAPID_CLAIM_EMAIL", "admin@grafik4600.com")
    
    # CSRF Protection
    csrf = CSRFProtect()
    csrf.init_app(app)
    
    # Dodaj csrf_token do kontekstu szablonów
    @app.context_processor
    def inject_csrf_token():
        from flask_wtf.csrf import generate_csrf
        return dict(csrf_token=generate_csrf())
    
    # Import modułów po utworzeniu aplikacji
    from . import database
    from . import auth
    from .routes import main, api, auth_routes, admin
    
    # Inicjalizacja bazy danych
    database.init_app(app)
    
    # Inicjalizuj trasy autoryzacji
    auth_routes.init_auth_routes(app)
    
    # Rejestracja blueprintów
    app.register_blueprint(main.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(auth_routes.bp)
    app.register_blueprint(admin.bp)
    
    # Middleware dla cache control i compression
    @app.after_request
    def after_request(response):
        # Wyłącz cache dla plików statycznych (CSS, JS) - zawsze pobieraj najnowsze wersje
        if request.path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            
            # Add compression for static files
            if (request.path.endswith(('.css', '.js', '.html')) and 
                'gzip' in request.headers.get('Accept-Encoding', '')):
                
                # Check if compressed version exists
                compressed_path = f"{request.path}.gz"
                if os.path.exists(os.path.join(app.static_folder, compressed_path.lstrip('/'))):
                    response.headers['Content-Encoding'] = 'gzip'
                    response.headers['Content-Type'] = response.headers.get('Content-Type', '')
        
        return response
    
    return app

# Utwórz instancję aplikacji
app = create_app()
