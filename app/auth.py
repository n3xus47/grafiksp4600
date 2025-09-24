"""
Moduł uwierzytelniania i autoryzacji
Zachowuje pełną kompatybilność z Google OAuth2
"""

import os
import logging
from functools import wraps
from flask import session, redirect, url_for, request, render_template
from authlib.integrations.flask_client import OAuth

logger = logging.getLogger(__name__)

# Inicjalizacja OAuth
oauth = OAuth()

def init_oauth(app):
    """Inicjalizuj OAuth z aplikacją Flask"""
    oauth.init_app(app)
    
    # Konfiguracja Google OAuth2
    google = oauth.register(
        name='google',
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        },
        # Dodaj dodatkowe URL-e dla stabilności
        fetch_token_url='https://oauth2.googleapis.com/token',
        authorize_url='https://accounts.google.com/o/oauth2/v2/auth',
        api_base_url='https://www.googleapis.com/oauth2/v2/',
        access_token_url='https://oauth2.googleapis.com/token',
        # Konfiguracja dla development
        jwks_uri='https://www.googleapis.com/oauth2/v3/certs',
        issuer='https://accounts.google.com'
    )
    
    return google

def login_required(f):
    """Decorator wymagający zalogowania użytkownika"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Sprawdź czy w sesji jest user_id (oznacza że użytkownik jest zalogowany)
        if not session.get("user_id"):
            return redirect(url_for("auth.signin"))  # Przekieruj na stronę logowania
        return f(*args, **kwargs)  # Jeśli zalogowany, wykonaj funkcję
    return wrapper

def admin_required(f):
    """Decorator wymagający uprawnień administratora"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        # Najpierw sprawdź czy użytkownik jest zalogowany
        if not session.get("user_id"):
            return redirect(url_for("auth.signin"))
        
        try:
            from .database import get_db
            db = get_db()
            user_id = session.get("user_id")
            user_row = db.execute("SELECT role FROM users WHERE id=?", (user_id,)).fetchone()
            
            if not user_row or user_row["role"] != "ADMIN":
                return render_template("signin.html", error="Brak uprawnień administratora")
                
        except Exception as e:
            logger.error(f"Błąd podczas sprawdzania uprawnień admin: {e}")
            return render_template("signin.html", error="Błąd autoryzacji")
        
        return f(*args, **kwargs)
    return wrapper

def rate_limit_required(f):
    """Decorator dla rate limiting - placeholder na przyszłość"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        # TODO: Implementacja rate limiting
        return f(*args, **kwargs)
    return wrapper

def get_current_user():
    """Pobierz informacje o aktualnie zalogowanym użytkowniku"""
    if not session.get("user_id"):
        return None
    
    try:
        from .database import get_db
        db = get_db()
        user_id = session.get("user_id")
        user_row = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        if user_row:
            return dict(user_row)  # Konwertuj sqlite3.Row na słownik
        return None
    except Exception as e:
        logger.error(f"Błąd podczas pobierania użytkownika: {e}")
        return None

def is_admin_user():
    """Sprawdź czy aktualny użytkownik ma uprawnienia administratora"""
    user = get_current_user()
    return user and user["role"] == "ADMIN"
