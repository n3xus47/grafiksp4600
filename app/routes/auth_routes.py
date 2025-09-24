"""
Trasy uwierzytelniania - logowanie, wylogowanie, callback OAuth
Zachowuje pełną kompatybilność z Google OAuth2
"""

import os
import logging
import traceback
from flask import Blueprint, render_template, redirect, url_for, session, request
from ..auth import init_oauth

logger = logging.getLogger(__name__)

bp = Blueprint('auth', __name__)

# Inicjalizuj OAuth
google = None

def init_auth_routes(app):
    """Inicjalizuj trasy uwierzytelniania"""
    global google
    google = init_oauth(app)

@bp.get("/signin")
def signin():
    """Strona logowania"""
    return render_template("signin.html")

@bp.get("/login")
def login():
    """Przekierowanie do Google OAuth"""
    if not google:
        logger.error("Google OAuth nie jest zainicjalizowane")
        return render_template("signin.html", error="Błąd konfiguracji uwierzytelniania")
    
    try:
        # Sprawdź czy aplikacja jest w trybie HTTPS
        if request.headers.get('X-Forwarded-Proto') == 'https' or request.is_secure:
            # Wymuś HTTPS dla callback URL
            redirect_uri = url_for('auth.auth_callback', _external=True, _scheme='https')
            logger.info(f"🔒 HTTPS: Generated redirect_uri = {redirect_uri}")
        else:
            redirect_uri = url_for('auth.auth_callback', _external=True)
            logger.info(f"🔓 HTTP: Generated redirect_uri = {redirect_uri}")
        
        return google.authorize_redirect(redirect_uri)
        
    except Exception as e:
        logger.error(f"Błąd podczas inicjalizacji Google OAuth: {e}")
        return render_template("signin.html", error="Błąd połączenia z Google. Sprawdź połączenie internetowe.")

@bp.get("/auth/callback")
@bp.get("/authorize")  # Alternative route for compatibility
def auth_callback():
    """Callback OAuth - przetwarzanie odpowiedzi z Google"""
    try:
        logger.info(f"OAuth callback - query params: {request.args}")
        
        if not google:
            logger.error("Google OAuth nie jest zainicjalizowane")
            return render_template("signin.html", error="Błąd konfiguracji uwierzytelniania")
        
        # Pobierz token z Google
        try:
            token = google.authorize_access_token()
            logger.info(f"OAuth token otrzymany: {bool(token)}")
        except Exception as token_error:
            logger.error(f"Błąd podczas pobierania tokenu: {token_error}")
            return render_template("signin.html", error=f"Błąd autoryzacji: {str(token_error)}")
        
        if not token:
            logger.error("Nie otrzymano tokenu z Google")
            return render_template("signin.html", error="Błąd autoryzacji")
        
        # Pobierz informacje o użytkowniku
        try:
            user_info_response = google.get('userinfo', token=token)
            logger.info(f"User info response otrzymane: {bool(user_info_response)}")
            
            if not user_info_response:
                logger.error("Nie otrzymano informacji o użytkowniku z Google")
                return redirect(url_for('auth.signin'))
            
            # Sprawdź czy response jest prawidłowy
            if hasattr(user_info_response, 'json'):
                user_info = user_info_response.json()
            elif hasattr(user_info_response, 'get'):
                user_info = user_info_response
            else:
                logger.error(f"Nieprawidłowy typ response: {type(user_info_response)}")
                return render_template("signin.html", error="Błąd podczas pobierania danych użytkownika")
            
            logger.info(f"User info data: {user_info}")
            
        except Exception as user_info_error:
            logger.error(f"Błąd podczas pobierania user info: {user_info_error}")
            return render_template("signin.html", error=f"Błąd podczas pobierania danych użytkownika: {str(user_info_error)}")
        
        email = user_info.get('email', '').lower()
        name = user_info.get('name', '')
        google_sub = user_info.get('sub', '')
        
        # Jeśli brakuje sub, spróbuj użyć id lub utwórz z email
        if not google_sub:
            google_sub = user_info.get('id', '')
            if not google_sub:
                # Utwórz sub z email jako fallback
                google_sub = f"google_{email.replace('@', '_').replace('.', '_')}"
                logger.warning(f"Brak Google sub, używam fallback: {google_sub}")
        
        logger.info(f"User data - email: '{email}', name: '{name}', sub: '{google_sub}'")
        logger.info(f"User data types - email: {type(email)}, name: {type(name)}, sub: {type(google_sub)}")
        logger.info(f"User data lengths - email: {len(email) if email else 0}, name: {len(name) if name else 0}, sub: {len(google_sub) if google_sub else 0}")
        
        if not email or not name:
            logger.error(f"Niepełne dane użytkownika z Google - email: '{email}', name: '{name}', sub: '{google_sub}'")
            logger.error(f"Pełne dane użytkownika: {user_info}")
            return render_template("signin.html", error=f"Niepełne dane użytkownika: email='{email}', name='{name}', sub='{google_sub}'")
        
        # Sprawdź whitelistę emaili
        whitelist = os.environ.get('GOOGLE_WHITELIST', '').split(',')
        whitelist = [email.strip().lower() for email in whitelist if email.strip()]
        
        logger.info(f"Whitelist: {whitelist}, User email: {email}")
        
        if whitelist and email not in whitelist:
            logger.warning(f"Użytkownik {email} nie jest na liście dozwolonych")
            return render_template("signin.html", error="Twój email nie jest autoryzowany do korzystania z tej aplikacji")
        
        # Zapisz lub zaktualizuj użytkownika w bazie
        from ..database import get_db
        db = get_db()
        
        # Sprawdź czy użytkownik już istnieje
        existing_user = db.execute("SELECT id, role FROM users WHERE email = ?", (email,)).fetchone()
        
        if existing_user:
            # Aktualizuj istniejącego użytkownika
            db.execute("""
                UPDATE users 
                SET google_sub = ?, name = ?, role = COALESCE(role, 'USER')
                WHERE email = ?
            """, (google_sub, name, email))
            user_id = existing_user["id"]
            user_role = existing_user["role"]
        else:
            # Utwórz nowego użytkownika
            cursor = db.execute("""
                INSERT INTO users (google_sub, email, name, role) 
                VALUES (?, ?, ?, 'USER')
            """, (google_sub, email, name))
            user_id = cursor.lastrowid
            user_role = 'USER'
        
        db.commit()
        
        # Ustaw sesję użytkownika
        session['user_id'] = user_id
        session['user_email'] = email
        session['user_name'] = name
        session['user_role'] = user_role
        session.permanent = True
        
        logger.info(f"Użytkownik {email} zalogowany pomyślnie")
        return redirect(url_for('main.index'))
        
    except Exception as e:
        logger.error(f"Błąd podczas autoryzacji: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return render_template("signin.html", error=f"Wystąpił błąd podczas logowania: {str(e)}")

@bp.post("/logout")
def logout():
    """Wylogowanie użytkownika"""
    user_email = session.get('user_email', 'nieznany')
    session.clear()
    logger.info(f"Użytkownik {user_email} wylogowany")
    return redirect(url_for('auth.signin'))
