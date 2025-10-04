"""
Trasy uwierzytelniania - logowanie, wylogowanie, callback OAuth
Zachowuje pełną kompatybilność z Google OAuth2
"""

import os
import logging
import traceback
import re
from flask import Blueprint, render_template, redirect, url_for, session, request, flash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from ..auth import init_oauth
from ..database import get_db
from ..password_utils import hash_password, verify_password, validate_password_strength

logger = logging.getLogger(__name__)

bp = Blueprint('auth', __name__)

# Inicjalizuj OAuth
google = None

# Rate limiter - będzie zainicjalizowany w init_auth_routes
limiter = None

def init_auth_routes(app):
    """Inicjalizuj trasy uwierzytelniania"""
    global google, limiter
    google = init_oauth(app)
    
    # Inicjalizuj rate limiter
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=["2000 per day", "500 per hour"]
    )
    limiter.init_app(app)
    
    # Dodaj rate limiting do tras
    limiter.limit("5 per minute")(register)
    limiter.limit("10 per minute")(login_email)

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
        whitelist = os.environ.get('WHITELIST_EMAILS', '').split(',')
        whitelist = [email.strip().lower() for email in whitelist if email.strip()]
        
        logger.info(f"Whitelist: {whitelist}, User email: {email}")
        
        if whitelist and email not in whitelist:
            logger.warning(f"Użytkownik {email} nie jest na liście dozwolonych")
            return render_template("signin.html", error="Twój email nie jest autoryzowany do korzystania z tej aplikacji")
        
        # Zapisz lub zaktualizuj użytkownika w bazie
        from ..database import get_db
        db = get_db()
        
        # Sprawdź czy użytkownik już istnieje
        existing_user = db.execute("SELECT id, role, login_type FROM users WHERE email = ?", (email,)).fetchone()
        
        if existing_user:
            # Aktualizuj istniejącego użytkownika
            if existing_user['login_type'] == 'EMAIL':
                # Użytkownik ma konto email - połącz z Google
                db.execute("""
                    UPDATE users 
                    SET google_sub = ?, name = ?, login_type = 'BOTH', role = COALESCE(role, 'USER')
                    WHERE email = ?
                """, (google_sub, name, email))
                logger.info(f"Połączono konto email z Google dla {email}")
            else:
                # Użytkownik ma już konto Google lub BOTH - aktualizuj dane
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
                INSERT INTO users (google_sub, email, name, login_type, role) 
                VALUES (?, ?, ?, 'GOOGLE', 'USER')
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

@bp.post("/register")
def register():
    """Rejestracja nowego użytkownika przez email i hasło"""
    try:
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        name = request.form.get('name', '').strip()
        
        # Walidacja danych wejściowych
        if not email or not password or not name:
            flash("Wszystkie pola są wymagane", "error")
            return render_template("signin.html", error="Wszystkie pola są wymagane")
        
        # Walidacja długości pól
        if len(email) > 255:
            flash("Email jest zbyt długi", "error")
            return render_template("signin.html", error="Email jest zbyt długi")
        
        if len(name) > 255:
            flash("Imię i nazwisko jest zbyt długie", "error")
            return render_template("signin.html", error="Imię i nazwisko jest zbyt długie")
        
        if len(password) > 128:
            flash("Hasło jest zbyt długie", "error")
            return render_template("signin.html", error="Hasło jest zbyt długie")
        
        # Walidacja emaila
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            flash("Nieprawidłowy format adresu email", "error")
            return render_template("signin.html", error="Nieprawidłowy format adresu email")
        
        # Sprawdź czy hasła się zgadzają
        if password != confirm_password:
            flash("Hasła nie są identyczne", "error")
            return render_template("signin.html", error="Hasła nie są identyczne")
        
        # Sprawdź siłę hasła
        is_valid, error_msg = validate_password_strength(password)
        if not is_valid:
            flash(error_msg, "error")
            return render_template("signin.html", error=error_msg)
        
        # Sprawdź whitelistę emaili
        whitelist = os.environ.get('WHITELIST_EMAILS', '').split(',')
        whitelist = [email.strip().lower() for email in whitelist if email.strip()]
        
        if whitelist and email not in whitelist:
            logger.warning(f"Próba rejestracji użytkownika {email} nie na liście dozwolonych")
            flash("Twój email nie jest autoryzowany do korzystania z tej aplikacji", "error")
            return render_template("signin.html", error="Twój email nie jest autoryzowany do korzystania z tej aplikacji")
        
        db = get_db()
        
        # Sprawdź czy użytkownik już istnieje
        existing_user = db.execute("SELECT id, login_type FROM users WHERE email = ?", (email,)).fetchone()
        
        if existing_user:
            if existing_user['login_type'] in ['EMAIL', 'BOTH']:
                flash("Użytkownik z tym adresem email już istnieje", "error")
                return render_template("signin.html", error="Użytkownik z tym adresem email już istnieje")
            else:
                # Użytkownik ma konto Google - połącz konta
                password_hash = hash_password(password)
                db.execute("""
                    UPDATE users 
                    SET password_hash = ?, login_type = 'BOTH', name = ?
                    WHERE email = ?
                """, (password_hash, name, email))
                user_id = existing_user['id']
                logger.info(f"Połączono konto Google z rejestracją email dla {email}")
        else:
            # Utwórz nowego użytkownika
            password_hash = hash_password(password)
            cursor = db.execute("""
                INSERT INTO users (email, name, password_hash, login_type, role) 
                VALUES (?, ?, ?, 'EMAIL', 'USER')
            """, (email, name, password_hash))
            user_id = cursor.lastrowid
            logger.info(f"Utworzono nowe konto email dla {email}")
        
        db.commit()
        
        # Ustaw sesję użytkownika
        session['user_id'] = user_id
        session['user_email'] = email
        session['user_name'] = name
        session['user_role'] = 'USER'
        session.permanent = True
        
        logger.info(f"Użytkownik {email} zarejestrowany i zalogowany pomyślnie")
        return redirect(url_for('main.index'))
        
    except Exception as e:
        logger.error(f"Błąd podczas rejestracji: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return render_template("signin.html", error=f"Wystąpił błąd podczas rejestracji: {str(e)}")

@bp.post("/login-email")
def login_email():
    """Logowanie przez email i hasło"""
    try:
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        
        # Walidacja danych wejściowych
        if not email or not password:
            flash("Email i hasło są wymagane", "error")
            return render_template("signin.html", error="Email i hasło są wymagane")
        
        # Walidacja długości pól
        if len(email) > 255:
            flash("Email jest zbyt długi", "error")
            return render_template("signin.html", error="Email jest zbyt długi")
        
        if len(password) > 128:
            flash("Hasło jest zbyt długie", "error")
            return render_template("signin.html", error="Hasło jest zbyt długie")
        
        # Walidacja emaila
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, email):
            flash("Nieprawidłowy format adresu email", "error")
            return render_template("signin.html", error="Nieprawidłowy format adresu email")
        
        db = get_db()
        
        # Znajdź użytkownika
        user = db.execute("""
            SELECT id, email, name, password_hash, login_type, role 
            FROM users 
            WHERE email = ? AND login_type IN ('EMAIL', 'BOTH')
        """, (email,)).fetchone()
        
        if not user:
            flash("Nieprawidłowy email lub hasło", "error")
            return render_template("signin.html", error="Nieprawidłowy email lub hasło")
        
        # Sprawdź hasło
        if not verify_password(password, user['password_hash']):
            flash("Nieprawidłowy email lub hasło", "error")
            return render_template("signin.html", error="Nieprawidłowy email lub hasło")
        
        # Ustaw sesję użytkownika
        session['user_id'] = user['id']
        session['user_email'] = user['email']
        session['user_name'] = user['name']
        session['user_role'] = user['role']
        session.permanent = True
        
        logger.info(f"Użytkownik {email} zalogowany przez email pomyślnie")
        return redirect(url_for('main.index'))
        
    except Exception as e:
        logger.error(f"Błąd podczas logowania email: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return render_template("signin.html", error=f"Wystąpił błąd podczas logowania: {str(e)}")

@bp.post("/logout")
def logout():
    """Wylogowanie użytkownika"""
    user_email = session.get('user_email', 'nieznany')
    session.clear()
    logger.info(f"Użytkownik {user_email} wylogowany")
    return redirect(url_for('auth.signin'))
