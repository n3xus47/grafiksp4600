"""
Aplikacja do zarządzania grafikiem zmian pracowników
System uwierzytelniania przez Google OAuth2
"""

import os
import sqlite3
import datetime as dt
import secrets
import logging
from typing import Optional, Dict, Any, List
from zoneinfo import ZoneInfo
from datetime import timedelta
from functools import wraps

from flask import Flask, g, render_template, jsonify, request, redirect, url_for, session, abort, make_response
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth
import calendar

# Konfiguracja logowania
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ładowanie zmiennych środowiskowych
load_dotenv()

# Inicjalizacja aplikacji
app = Flask(__name__)

# Wybierz odpowiednią konfigurację na podstawie środowiska
from config import get_config
app.config.from_object(get_config())

# Obsługa proxy headers (HTTPS przez nginx)
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Middleware do wymuszenia HTTPS w produkcji
@app.before_request
def before_request():
    """Middleware wykonywany przed każdym żądaniem"""
    if app.config.get('PREFERRED_URL_SCHEME') == 'https':
        # W produkcji wymuś HTTPS
        if request.headers.get('X-Forwarded-Proto') == 'http':
            url = request.url.replace('http://', 'https://', 1)
            return redirect(url, code=301)

# Initialize OAuth
oauth = OAuth(app)

# Configure Google OAuth
google = oauth.register(
    name='google',
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# Inicjalizacja bazy danych
db_path = app.config.get('DATABASE_PATH', os.path.join(os.path.dirname(__file__), "app.db"))

def get_db():
    """Pobiera połączenie z bazą danych"""
    if "db" not in g:
        try:
            g.db = sqlite3.connect(db_path)
            g.db.row_factory = sqlite3.Row
            # Włącz foreign keys
            g.db.execute("PRAGMA foreign_keys = ON")
        except sqlite3.Error as e:
            logger.error(f"Błąd połączenia z bazą danych: {e}")
            abort(500, "Błąd bazy danych")
    return g.db

def close_db(e=None):
    """Zamyka połączenie z bazą danych"""
    db = g.pop("db", None)
    if db is not None:
        try:
            db.close()
        except sqlite3.Error as e:
            logger.error(f"Błąd zamykania bazy danych: {e}")

app.teardown_appcontext(close_db)

# Authentication decorators
def login_required(view):
    """Dekorator wymagający zalogowania użytkownika"""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("signin"))
        return view(*args, **kwargs)
    return wrapper

def admin_required(view):
    """Dekorator wymagający uprawnień administratora"""
    @wraps(view)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("signin"))
        
        try:
            db = get_db()
            row = db.execute("SELECT role FROM users WHERE id=?", (session["user_id"],)).fetchone()
            role = row["role"] if row and row["role"] else "USER"
            
            if role != "ADMIN":
                logger.warning(f"Próba dostępu do funkcji admin przez użytkownika {session['user_id']}")
                abort(403, "Brak uprawnień administratora")
                
        except sqlite3.Error as e:
            logger.error(f"Błąd sprawdzania uprawnień: {e}")
            abort(500, "Błąd sprawdzania uprawnień")
            
        return view(*args, **kwargs)
    return wrapper

# Funkcje pomocnicze
def load_whitelist() -> Optional[set]:
    """Ładuje listę dozwolonych emaili z zmiennych środowiskowych"""
    raw = os.environ.get("WHITELIST_EMAILS", "").strip()
    if not raw:
        return None
    return {e.strip().lower() for e in raw.split(",") if e.strip()}

def get_bool_field(row: sqlite3.Row, field_name: str, default: bool = False) -> bool:
    """Bezpiecznie pobiera pole boolean z wiersza bazy danych"""
    try:
        return bool(row.get(field_name, default))
    except (KeyError, TypeError):
        return default

def validate_date_format(date_str: str) -> bool:
    """Waliduje format daty YYYY-MM-DD"""
    if not date_str:
        return False
    try:
        dt.datetime.strptime(date_str, "%Y-%m-%d")
        return True
    except ValueError:
        return False

def validate_shift_type(shift_type: str) -> bool:
    """Waliduje typ zmiany"""
    return shift_type in ("DNIOWKA", "NOCKA")

def safe_get_json() -> Dict[str, Any]:
    """Bezpiecznie pobiera JSON z request"""
    try:
        data = request.get_json(silent=True)
        return data if data else {}
    except Exception as e:
        logger.error(f"Błąd parsowania JSON: {e}")
        return {}

# Rate limiting (prosta implementacja)
from collections import defaultdict
import time

request_counts = defaultdict(list)

def check_rate_limit(identifier: str, max_requests: int = 100, window: int = 60) -> bool:
    """Prosty rate limiting - sprawdza czy użytkownik nie przekroczył limitu żądań"""
    now = time.time()
    user_requests = request_counts[identifier]
    
    # Usuń stare żądania
    user_requests[:] = [req_time for req_time in user_requests if now - req_time < window]
    
    if len(user_requests) >= max_requests:
        return False
    
    user_requests.append(now)
    return True

def rate_limit_required(max_requests: int = 100, window: int = 60):
    """Dekorator rate limiting"""
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            identifier = session.get("user_id", request.remote_addr)
            if not check_rate_limit(identifier, max_requests, window):
                logger.warning(f"Rate limit przekroczony dla {identifier}")
                return jsonify(error="Zbyt wiele żądań, spróbuj ponownie później"), 429
            return view(*args, **kwargs)
        return wrapper
    return decorator

# --- Kalendarz świąt PL --------------------------------------------------------
def _easter_sunday(year: int) -> dt.date:
    # Anonymous Gregorian algorithm
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return dt.date(year, month, day)


def polish_holidays(year: int) -> set:
    easter = _easter_sunday(year)
    easter_monday = easter + dt.timedelta(days=1)
    corpus_christi = easter + dt.timedelta(days=60)

    fixed = {
        dt.date(year, 1, 1),   # Nowy Rok
        dt.date(year, 1, 6),   # Trzech Króli
        dt.date(year, 5, 1),   # Święto Pracy
        dt.date(year, 5, 3),   # Święto Konstytucji 3 Maja
        dt.date(year, 8, 15),  # Wniebowzięcie NMP
        dt.date(year, 11, 1),  # Wszystkich Świętych
        dt.date(year, 11, 11), # Święto Niepodległości
        dt.date(year, 12, 25), # Boże Narodzenie (pierwszy dzień)
        dt.date(year, 12, 26), # Boże Narodzenie (drugi dzień)
    }

    moveable = {easter_monday, corpus_christi}
    return fixed | moveable | {easter}  # niedziela wielkanocna też dla pełnej informacji


# --- DB schema i proste CLI ---------------------------------------------------
@app.cli.command("init-db")
def init_db():
    db = get_db()
    db.executescript("""
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_sub TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      picture TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      shift_type TEXT NOT NULL CHECK(shift_type IN ('DNIOWKA','NOCKA')),
      employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(date, shift_type, employee_id)
    );
    """)
    db.commit()
    print("db ready:", db_path)
# --- Swap requests -------------------------------------------------------------
# --- Funkcje migracji bazy danych --------------------------------------------------------
def ensure_users_role_column():
    """Dodaje kolumnę role do tabeli users jeśli nie istnieje"""
    try:
        db = get_db()
        cols = db.execute("PRAGMA table_info(users)").fetchall()
        has_role = any(c[1] == 'role' for c in cols)
        
        if not has_role:
            db.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'USER'")
            db.commit()
            logger.info("Dodano kolumnę 'role' do tabeli users")
            
    except sqlite3.Error as e:
        logger.error(f"Błąd podczas dodawania kolumny role: {e}")
        db.rollback()
        raise

def ensure_employees_user_id_column():
    """Dodaje kolumnę user_id do tabeli employees jeśli nie istnieje"""
    try:
        db = get_db()
        cols = db.execute("PRAGMA table_info(employees)").fetchall()
        has_uid = any(c[1] == 'user_id' for c in cols)
        
        if not has_uid:
            # SQLite: nie można dodać kolumny z UNIQUE przez ALTER TABLE.
            # Dodajemy kolumnę bez ograniczenia, a unikalność wymuszamy indeksem.
            db.execute("ALTER TABLE employees ADD COLUMN user_id INTEGER REFERENCES users(id)")
            db.execute("CREATE UNIQUE INDEX IF NOT EXISTS employees_user_id_unique ON employees(user_id)")
            db.commit()
            logger.info("Dodano kolumnę 'user_id' do tabeli employees")
            
    except sqlite3.Error as e:
        logger.error(f"Błąd podczas dodawania kolumny user_id: {e}")
        db.rollback()
        raise

def ensure_employees_code_column():
    """Dodaje kolumnę code do tabeli employees jeśli nie istnieje"""
    try:
        db = get_db()
        cols = db.execute("PRAGMA table_info(employees)").fetchall()
        has_code = any(c[1] == 'code' for c in cols)
        
        if not has_code:
            # SQLite does not allow adding UNIQUE via ALTER TABLE ADD COLUMN reliably
            db.execute("ALTER TABLE employees ADD COLUMN code TEXT")
            db.execute("CREATE UNIQUE INDEX IF NOT EXISTS employees_code_idx ON employees(code)")
            db.commit()
            logger.info("Dodano kolumnę 'code' do tabeli employees")
            
    except sqlite3.Error as e:
        logger.error(f"Błąd podczas dodawania kolumny code: {e}")
        db.rollback()
        raise

def ensure_swaps_table():
    """Tworzy lub aktualizuje tabelę swap_requests"""
    try:
        db = get_db()
        
        # Sprawdź czy tabela istnieje
        table_exists = db.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='swap_requests'
        """).fetchone()
        
        if not table_exists:
            # Utwórz nową tabelę
            db.executescript("""
        CREATE TABLE swap_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          requester_user_id INTEGER NOT NULL,
          from_date TEXT NOT NULL,
          from_employee TEXT NOT NULL,
          to_date TEXT,  -- Allow NULL for give requests
          to_employee TEXT NOT NULL,
          comment_requester TEXT,
          recipient_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(recipient_status IN ('PENDING','ACCEPTED','DECLINED')),
          recipient_comment TEXT,
          boss_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(boss_status IN ('PENDING','APPROVED','REJECTED')),
          boss_comment TEXT,
          from_shift TEXT,
          to_shift TEXT,
          is_give_request BOOLEAN DEFAULT 0,
                  is_ask_request BOOLEAN DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
                
                -- Indeksy dla lepszej wydajności
                CREATE INDEX IF NOT EXISTS idx_swap_from_date ON swap_requests(from_date);
                CREATE INDEX IF NOT EXISTS idx_swap_to_date ON swap_requests(to_date);
                CREATE INDEX IF NOT EXISTS idx_swap_requester ON swap_requests(requester_user_id);
                CREATE INDEX IF NOT EXISTS idx_swap_recipient_status ON swap_requests(recipient_status);
                CREATE INDEX IF NOT EXISTS idx_swap_boss_status ON swap_requests(boss_status);
            """)
            db.commit()
            logger.info("Utworzono tabelę swap_requests z indeksami")
            return
        
        # Sprawdź istniejące kolumny
        cols = db.execute("PRAGMA table_info(swap_requests)").fetchall()
        existing_columns = {c[1] for c in cols}
        
        # Dodaj brakujące kolumny
        columns_to_add = []
        
        if 'from_shift' not in existing_columns:
            columns_to_add.append("ALTER TABLE swap_requests ADD COLUMN from_shift TEXT")
        if 'to_shift' not in existing_columns:
            columns_to_add.append("ALTER TABLE swap_requests ADD COLUMN to_shift TEXT")
        if 'is_give_request' not in existing_columns:
            columns_to_add.append("ALTER TABLE swap_requests ADD COLUMN is_give_request BOOLEAN DEFAULT 0")
        if 'is_ask_request' not in existing_columns:
            columns_to_add.append("ALTER TABLE swap_requests ADD COLUMN is_ask_request BOOLEAN DEFAULT 0")
        
        # Wykonaj ALTER TABLE dla każdej brakującej kolumny
        for alter_statement in columns_to_add:
            try:
                db.execute(alter_statement)
                logger.info(f"Wykonano: {alter_statement}")
            except sqlite3.Error as e:
                logger.warning(f"Nie udało się wykonać {alter_statement}: {e}")
        
        # Sprawdź czy indeksy istnieją
        indexes = db.execute("PRAGMA index_list(swap_requests)").fetchall()
        existing_indexes = {idx[1] for idx in indexes}
        
        # Dodaj brakujące indeksy
        if 'idx_swap_from_date' not in existing_indexes:
            db.execute("CREATE INDEX idx_swap_from_date ON swap_requests(from_date)")
        if 'idx_swap_to_date' not in existing_indexes:
            db.execute("CREATE INDEX idx_swap_to_date ON swap_requests(to_date)")
        if 'idx_swap_requester' not in existing_indexes:
            db.execute("CREATE INDEX idx_swap_requester ON swap_requests(requester_user_id)")
        if 'idx_swap_recipient_status' not in existing_indexes:
            db.execute("CREATE INDEX idx_swap_recipient_status ON swap_requests(recipient_status)")
        if 'idx_swap_boss_status' not in existing_indexes:
            db.execute("CREATE INDEX idx_swap_boss_status ON swap_requests(boss_status)")
    
        db.commit()
        logger.info("Tabela swap_requests zaktualizowana")
        
    except sqlite3.Error as e:
        logger.error(f"Błąd podczas aktualizacji tabeli swap_requests: {e}")
        db.rollback()
        raise


@app.post("/api/save")
@login_required
@rate_limit_required(max_requests=30, window=60)
def api_save():
    """Zapisuje zmiany w grafiku"""
    try:
        data = safe_get_json()
        changes = data.get("changes", [])
        
        if not changes:
            return jsonify(error="Brak zmian do zapisania"), 400
        
        db = get_db()
        logger.info(f"Przetwarzanie {len(changes)} zmian w api_save")
        
        # Process each change
        processed_count = 0
        for i, change in enumerate(changes):
            logger.info(f"Zmiana #{i+1}: {change}")
            
            date = change.get("date")
            employee_name = change.get("employee") or change.get("name")  # Support both formats
            shift_type_raw = change.get("shift_type") or change.get("value")  # Support both formats
            
            # Map abbreviated shift types to full names
            shift_type_mapping = {
                'D': 'DNIOWKA',
                'DNIOWKA': 'DNIOWKA',
                'N': 'NOCKA', 
                'NOCKA': 'NOCKA'
            }
            shift_type = shift_type_mapping.get(shift_type_raw, shift_type_raw)
            
            logger.info(f"Parsed - date: {date}, employee: {employee_name}, shift_raw: {shift_type_raw} -> shift: {shift_type}")
            
            if not all([date, employee_name]):
                logger.warning(f"Pominięto zmianę - brak date lub employee_name")
                continue
                
            # Get employee ID
            emp_row = db.execute("SELECT id FROM employees WHERE name=?", (employee_name,)).fetchone()
            if not emp_row:
                logger.warning(f"Nie znaleziono pracownika: {employee_name}")
                continue
                
            employee_id = emp_row["id"]
            logger.info(f"Employee ID: {employee_id}")
            
            # Delete existing shift for this date/employee
            delete_result = db.execute("DELETE FROM shifts WHERE date=? AND employee_id=?", (date, employee_id))
            logger.info(f"DELETE query wykonane dla {date}, {employee_id}")
            
            # Add new shift if shift_type is not empty
            if shift_type and shift_type in ('DNIOWKA', 'NOCKA'):
                db.execute("INSERT INTO shifts(date, shift_type, employee_id) VALUES (?,?,?)", 
                          (date, shift_type, employee_id))
                logger.info(f"INSERT wykonane: {date}, {shift_type}, {employee_id}")
                processed_count += 1
            else:
                logger.info(f"Brak shift_type lub nieprawidłowy: {shift_type_raw} -> {shift_type}")
        
        logger.info(f"Przetworzono {processed_count} zmian, wywołuję db.commit()")
        
        db.commit()
        logger.info(f"Zapisano {len(changes)} zmian w grafiku przez użytkownika {session.get('user_email')}")
        return jsonify(status="ok", message="Zmiany zostały zapisane")
        
    except Exception as e:
        logger.error(f"Błąd podczas zapisywania zmian: {e}")
        return jsonify(error="Wystąpił błąd podczas zapisywania"), 500

@app.get("/api/slot")
@login_required
def api_slot():
    date = request.args.get("date")
    name = request.args.get("employee")
    if not date or not name:
        return jsonify(error="missing"), 400
    db = get_db()
    emp = db.execute("SELECT id FROM employees WHERE name=?", (name,)).fetchone()
    st = None
    if emp:
        row = db.execute("SELECT shift_type FROM shifts WHERE date=? AND employee_id=?", (date, emp["id"]))
        row = row.fetchone()
        if row:
            st = row["shift_type"]
    return jsonify(shift_type=st)


@app.post("/api/swaps")
@login_required
@rate_limit_required(max_requests=20, window=60)  # Rate limiting dla swap requests
def api_swaps_create():
    """Tworzy nową prośbę o zamianę zmian"""
    try:
        ensure_swaps_table()
        data = safe_get_json()
        
        # Walidacja wymaganych pól
        from_employee = data.get("from_employee", "").strip()
        to_employee = data.get("to_employee", "").strip()
        comment = (data.get("comment") or "").strip()
        
        # Map abbreviated shift types to full names
        shift_type_mapping = {
            'D': 'DNIOWKA',
            'DNIOWKA': 'DNIOWKA',
            'N': 'NOCKA', 
            'NOCKA': 'NOCKA'
        }
        
        from_shift_raw = (data.get("from_shift") or "").strip().upper() or None
        to_shift_raw = (data.get("to_shift") or "").strip().upper() or None
        
        from_shift = shift_type_mapping.get(from_shift_raw, from_shift_raw) if from_shift_raw else None
        to_shift = shift_type_mapping.get(to_shift_raw, to_shift_raw) if to_shift_raw else None
        
        is_give_request = data.get("is_give_request", False)
        is_ask_request = data.get("is_ask_request", False)

        # Walidacja podstawowych pól
        if not from_employee:
            return jsonify(error="Brak informacji o pracowniku oddającym zmianę"), 400
        if not to_employee:
            return jsonify(error="Brak informacji o pracowniku przejmującym zmianę"), 400
        
        # Walidacja typów zmian
        if from_shift and not validate_shift_type(from_shift):
            return jsonify(error="Nieprawidłowy typ zmiany oddawanej"), 400
        if to_shift and not validate_shift_type(to_shift):
            return jsonify(error="Nieprawidłowy typ zmiany przejmowanej"), 400
        
        # Walidacja dat
        from_date = data.get("from_date")
        to_date = data.get("to_date")
        
        # Dla ask requests, from_date może być null
        if not is_ask_request and from_date:
            if not validate_date_format(from_date):
                return jsonify(error="Nieprawidłowy format daty oddawanej zmiany"), 400
        
        # Dla give requests, to_date może być null
        if not is_give_request and to_date:
            if not validate_date_format(to_date):
                return jsonify(error="Nieprawidłowy format daty przejmowanej zmiany"), 400
        
        # Sprawdź czy nie próbuje zamienić z samym sobą
        if from_employee == to_employee:
            return jsonify(error="Nie możesz zamienić zmiany z samym sobą"), 400
        
        # Sprawdź czy użytkownik może prosić o zamianę swojej zmiany
        db = get_db()
        me_emp = db.execute("SELECT name FROM employees WHERE user_id=?", (session.get("user_id"),)).fetchone()
        me_name = (me_emp["name"] if me_emp else (session.get("user_name") or "")).strip()
        
        if me_name != from_employee:
            logger.warning(f"Użytkownik {me_name} próbował prosić o zamianę zmiany {from_employee}")
            return jsonify(error="Możesz prosić tylko o zamianę swoich zmian"), 403
        
        # Walidacja że requester rzeczywiście ma zmianę na from_date (tylko dla give requests i regular swaps)
        if from_date and not is_ask_request:
            from_emp_id = db.execute("SELECT id FROM employees WHERE name=?", (from_employee,)).fetchone()
            if from_emp_id:
                from_shift_exists = db.execute(
                    "SELECT shift_type FROM shifts WHERE date=? AND employee_id=?", 
                    (from_date, from_emp_id["id"])
                ).fetchone()
                if not from_shift_exists:
                    return jsonify(error=f"Nie masz zmiany w dniu {from_date}"), 400
    
        # Walidacja że target person ma zmianę na to_date (tylko dla regular swaps)
        if not is_give_request and to_date:
            to_emp_id = db.execute("SELECT id FROM employees WHERE name=?", (to_employee,)).fetchone()
            if to_emp_id:
                to_shift_exists = db.execute(
                    "SELECT shift_type FROM shifts WHERE date=? AND employee_id=?", 
                    (to_date, to_emp_id["id"])
                ).fetchone()
                if not to_shift_exists:
                    return jsonify(error=f"{to_employee} nie ma zmiany w dniu {to_date}"), 400
    
        # Sprawdź czy daty nie są już zaangażowane w pending swap requests
        existing_conflicts = check_existing_conflicts(db, from_date, from_employee, to_date, to_employee, 
                                                   is_give_request, is_ask_request)
        if existing_conflicts:
            return jsonify(error=". ".join(existing_conflicts)), 400
        
        # Zapisz prośbę o zamianę
        db.execute("""
            INSERT INTO swap_requests(
                requester_user_id, from_date, from_employee, to_date, to_employee, 
                comment_requester, from_shift, to_shift, is_give_request, is_ask_request
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session["user_id"], from_date, from_employee, to_date, to_employee, 
            comment, from_shift, to_shift, is_give_request, is_ask_request
        ))
        db.commit()
        
        logger.info(f"Utworzono prośbę o zamianę: {from_employee} -> {to_employee}")
        return jsonify(status="ok", message="Prośba o zamianę została utworzona")
        
    except sqlite3.Error as e:
        logger.error(f"Błąd bazy danych podczas tworzenia prośby o zamianę: {e}")
        return jsonify(error="Błąd bazy danych"), 500
    except Exception as e:
        logger.error(f"Nieoczekiwany błąd podczas tworzenia prośby o zamianę: {e}")
        return jsonify(error="Wystąpił nieoczekiwany błąd"), 500

def check_existing_conflicts(db, from_date, from_employee, to_date, to_employee, is_give_request, is_ask_request):
    """Sprawdza czy daty nie są już zaangażowane w inne prośby o zamianę"""
    conflicts = []
    
    try:
        if is_give_request:
            # Dla give requests, sprawdź tylko from_date conflicts
            existing_requests = db.execute("""
                SELECT * FROM swap_requests 
                WHERE recipient_status IN ('PENDING', 'ACCEPTED') 
                AND boss_status IN ('PENDING', 'APPROVED')
                AND (
                    (from_date = ? AND from_employee = ?) OR
                    (to_date = ? AND to_employee = ?)
                )
            """, (from_date, from_employee, from_date, to_employee)).fetchall()
            
        elif is_ask_request:
            # Dla ask requests, sprawdź tylko to_date conflicts
            existing_requests = db.execute("""
                SELECT * FROM swap_requests 
                WHERE recipient_status IN ('PENDING', 'ACCEPTED') 
                AND boss_status IN ('PENDING', 'APPROVED')
                AND (to_date = ? AND to_employee = ?)
            """, (to_date, to_employee)).fetchall()
            
        else:
            # Dla regular swaps, sprawdź obie daty
            existing_requests = db.execute("""
                SELECT * FROM swap_requests 
                WHERE recipient_status IN ('PENDING', 'ACCEPTED') 
                AND boss_status IN ('PENDING', 'APPROVED')
                AND (
                    (from_date = ? AND from_employee = ?) OR
                    (to_date = ? AND to_employee = ?)
                )
                """, (from_date, from_employee, to_date, to_employee)).fetchall()
    
        # Znajdź konkretne konflikty
        for req in existing_requests:
            if is_give_request:
                if req["from_date"] == from_date and req["from_employee"] == from_employee:
                    conflicts.append(f"Twoja zmiana w dniu {from_date} jest już zaangażowana w prośbę o zamianę")
                elif req["to_date"] == from_date and req["to_employee"] == from_employee:
                    conflicts.append(f"Twoja zmiana w dniu {from_date} jest już zaangażowana w prośbę o zamianę")
            elif is_ask_request:
                if req["to_date"] == to_date and req["to_employee"] == to_employee:
                    conflicts.append(f"Zmiana {to_employee} w dniu {to_date} jest już zaangażowana w prośbę o zamianę")
            else:
                # Regular swap - sprawdź obie daty
                if req["from_date"] == from_date and req["from_employee"] == from_employee:
                    conflicts.append(f"Twoja zmiana w dniu {from_date} jest już zaangażowana w prośbę o zamianę")
                elif req["from_date"] == to_date and req["from_employee"] == to_employee:
                    conflicts.append(f"Zmiana {to_employee} w dniu {to_date} jest już zaangażowana w prośbę o zamianę")
                elif req["to_date"] == from_date and req["to_employee"] == from_employee:
                    conflicts.append(f"Twoja zmiana w dniu {from_date} jest już zaangażowana w prośbę o zamianę")
                elif req["to_date"] == to_date and req["to_employee"] == to_employee:
                    conflicts.append(f"Zmiana {to_employee} w dniu {to_date} jest już zaangażowana w prośbę o zamianę")
        
        return conflicts
        
    except sqlite3.Error as e:
        logger.error(f"Błąd podczas sprawdzania konfliktów: {e}")
        return [f"Błąd bazy danych: {e}"]

def process_regular_swap(db, from_emp_id, to_emp_id, from_date, to_date, from_employee, to_employee):
    """Przetwarza regularną zamianę zmian"""
    try:
        # Pobierz obecne zmiany obu pracowników
        from_shift = db.execute("SELECT shift_type FROM shifts WHERE date=? AND employee_id=?", (from_date, from_emp_id)).fetchone()
        to_shift = db.execute("SELECT shift_type FROM shifts WHERE date=? AND employee_id=?", (to_date, to_emp_id)).fetchone()
        
        if not from_shift:
            return False, f"{from_employee} nie ma zmiany w dniu {from_date}"
        if not to_shift:
            return False, f"{to_employee} nie ma zmiany w dniu {to_date}"
        
        from_shift_type = from_shift["shift_type"]
        to_shift_type = to_shift["shift_type"]
        
        # Wykonaj zamianę: pracownicy wymieniają się datami (nie typami zmian)
        # Usuń istniejące zmiany
        db.execute("DELETE FROM shifts WHERE date=? AND employee_id=?", (from_date, from_emp_id))
        db.execute("DELETE FROM shifts WHERE date=? AND employee_id=?", (to_date, to_emp_id))
        
        # Przypisz zamienione zmiany
        # from_employee dostaje zmianę to_employee na to_date
        db.execute("INSERT INTO shifts(date, shift_type, employee_id) VALUES (?,?,?)", (to_date, to_shift_type, from_emp_id))
        
        # to_employee dostaje zmianę from_employee na from_date
        db.execute("INSERT INTO shifts(date, shift_type, employee_id) VALUES (?,?,?)", (from_date, from_shift_type, to_emp_id))
        
        logger.info(f"Zamiana wykonana: {from_employee} <-> {to_employee}")
        return True, None
        
    except sqlite3.Error as e:
        logger.error(f"Błąd podczas przetwarzania regular swap: {e}")
        return False, f"Błąd bazy danych: {e}"

@app.get("/api/swaps/inbox")
@login_required
def api_swaps_inbox():
    """Pobiera prośby o zamianę dla zalogowanego użytkownika"""
    try:
        ensure_swaps_table()
        db = get_db()
        
        # Debug logging
        user_id = session.get("user_id")
        user_email = session.get("user_email", "")
        logger.info(f"api_swaps_inbox DEBUG - user_id: {user_id}, email: {user_email}")
        
        # Sprawdź czy użytkownik ma uprawnienia bossa
        user_role_row = db.execute("SELECT role FROM users WHERE id=?", (user_id,)).fetchone()
        user_role = user_role_row["role"] if user_role_row and user_role_row["role"] else "USER"
        is_boss = user_role.upper() == "ADMIN"
        logger.info(f"api_swaps_inbox DEBUG - user_role: {user_role}, is_boss: {is_boss}")
        
        if is_boss:
            # Szef widzi prośby zaakceptowane przez pracowników, czekające na jego decyzję
            requests = db.execute("""
                SELECT id, from_date, from_employee, to_date, to_employee, 
                       comment_requester, recipient_status, boss_status,
                       from_shift, to_shift, is_give_request, is_ask_request, created_at
                FROM swap_requests 
                WHERE recipient_status = 'ACCEPTED' AND boss_status = 'PENDING'
                ORDER BY created_at DESC
            """).fetchall()
            logger.info(f"api_swaps_inbox DEBUG - found {len(requests)} boss requests (recipient_status=ACCEPTED, boss_status=PENDING)")
        else:
            # Zwykli pracownicy widzą prośby skierowane do nich
            me_emp = db.execute("SELECT name FROM employees WHERE user_id=?", (user_id,)).fetchone()
            my_name = me_emp["name"] if me_emp else session.get("user_name", "")
            logger.info(f"api_swaps_inbox DEBUG - my_name: {my_name}")
            
            requests = db.execute("""
                SELECT id, from_date, from_employee, to_date, to_employee, 
                       comment_requester, recipient_status, boss_status,
                       from_shift, to_shift, is_give_request, is_ask_request, created_at
                FROM swap_requests 
                WHERE to_employee = ? AND recipient_status = 'PENDING'
                ORDER BY created_at DESC
            """, (my_name,)).fetchall()
            logger.info(f"api_swaps_inbox DEBUG - found {len(requests)} requests for {my_name}")
        
        response_data = {
            'items': [dict(r) for r in requests],
            'is_boss': is_boss
        }
        logger.info(f"api_swaps_inbox DEBUG - response data: {response_data}")
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Błąd podczas pobierania inbox: {e}")
        return jsonify(error="Wystąpił błąd podczas pobierania próśb"), 500

@app.post("/api/swaps/respond")
@login_required
def api_swaps_respond():
    """Odpowiada na prośbę o zamianę (ACCEPTED/DECLINED)"""
    try:
        data = safe_get_json()
        request_id = data.get("id")
        status = data.get("status")
        
        if not request_id or status not in ['ACCEPTED', 'DECLINED']:
            return jsonify(error="Nieprawidłowe dane"), 400
        
        db = get_db()
        
        # Update request status
        db.execute("""
            UPDATE swap_requests 
            SET recipient_status = ?, updated_at = datetime('now') 
            WHERE id = ?
        """, (status, request_id))
        
        db.commit()
        
        logger.info(f"Użytkownik {session.get('user_email')} odpowiedział {status} na prośbę {request_id}")
        return jsonify(status="ok", message=f"Odpowiedź {status} została zapisana")
        
    except Exception as e:
        logger.error(f"Błąd podczas odpowiadania na prośbę: {e}")
        return jsonify(error="Wystąpił błąd podczas odpowiadania"), 500

def process_give_request(db, from_emp_id, to_emp_id, from_date, from_employee, to_employee):
    """Przetwarzanie prośby 'oddaj zmianę' - usuń zmianę od żądającego, dodaj do docelowego"""
    # Pobierz zmianę żądającego z danej daty
    shift_row = db.execute(
        "SELECT shift_type FROM shifts WHERE date = ? AND employee_id = ?", 
        (from_date, from_emp_id)
    ).fetchone()
    
    if shift_row:
        shift_type = shift_row["shift_type"]
        
        # Usuń zmianę od żądającego
        db.execute("DELETE FROM shifts WHERE date = ? AND employee_id = ?", (from_date, from_emp_id))
        
        # Dodaj zmianę do docelowego (usuń istniejącą jeśli jest)
        db.execute("DELETE FROM shifts WHERE date = ? AND employee_id = ?", (from_date, to_emp_id))
        db.execute("INSERT INTO shifts (date, shift_type, employee_id) VALUES (?, ?, ?)", 
                  (from_date, shift_type, to_emp_id))
        
        logger.info(f"Give request: {from_employee} oddał zmianę {shift_type} na {from_date} do {to_employee}")
    else:
        logger.warning(f"Give request: Brak zmiany dla {from_employee} na {from_date}")

def process_ask_request(db, from_emp_id, to_emp_id, to_date, from_employee, to_employee):
    """Przetwarzanie prośby 'poproś o przejęcie' - usuń zmianę od docelowego, dodaj do żądającego"""
    # Pobierz zmianę docelowego z danej daty
    shift_row = db.execute(
        "SELECT shift_type FROM shifts WHERE date = ? AND employee_id = ?", 
        (to_date, to_emp_id)
    ).fetchone()
    
    if shift_row:
        shift_type = shift_row["shift_type"]
        
        # Usuń zmianę od docelowego
        db.execute("DELETE FROM shifts WHERE date = ? AND employee_id = ?", (to_date, to_emp_id))
        
        # Dodaj zmianę do żądającego (usuń istniejącą jeśli jest)
        db.execute("DELETE FROM shifts WHERE date = ? AND employee_id = ?", (to_date, from_emp_id))
        db.execute("INSERT INTO shifts (date, shift_type, employee_id) VALUES (?, ?, ?)", 
                  (to_date, shift_type, from_emp_id))
        
        logger.info(f"Ask request: {from_employee} przejął zmianę {shift_type} na {to_date} od {to_employee}")
    else:
        logger.warning(f"Ask request: Brak zmiany dla {to_employee} na {to_date}")

def process_regular_swap(db, from_emp_id, to_emp_id, from_date, to_date, from_employee, to_employee):
    """Przetwarzanie zwykłej zamiany - wymień zmiany między dwoma pracownikami"""
    # Pobierz obie zmiany
    from_shift_row = db.execute(
        "SELECT shift_type FROM shifts WHERE date = ? AND employee_id = ?", 
        (from_date, from_emp_id)
    ).fetchone()
    
    to_shift_row = db.execute(
        "SELECT shift_type FROM shifts WHERE date = ? AND employee_id = ?", 
        (to_date, to_emp_id)
    ).fetchone()
    
    from_shift_type = from_shift_row["shift_type"] if from_shift_row else None
    to_shift_type = to_shift_row["shift_type"] if to_shift_row else None
    
    # Usuń istniejące zmiany
    db.execute("DELETE FROM shifts WHERE date = ? AND employee_id = ?", (from_date, from_emp_id))
    db.execute("DELETE FROM shifts WHERE date = ? AND employee_id = ?", (to_date, to_emp_id))
    
    # Dodaj zamienione zmiany
    if to_shift_type:
        db.execute("INSERT INTO shifts (date, shift_type, employee_id) VALUES (?, ?, ?)", 
                  (from_date, to_shift_type, from_emp_id))
    
    if from_shift_type:
        db.execute("INSERT INTO shifts (date, shift_type, employee_id) VALUES (?, ?, ?)", 
                  (to_date, from_shift_type, to_emp_id))
    
    logger.info(f"Regular swap: {from_employee} ({from_shift_type} na {from_date}) ↔ {to_employee} ({to_shift_type} na {to_date})")

@app.post("/api/swaps/boss")
@admin_required
def api_swaps_boss():
    """Zatwierdza lub odrzuca prośbę o zamianę (tylko admin)"""
    try:
        data = safe_get_json()
        request_id = data.get("id")
        status = data.get("status")
        
        if not request_id or status not in ['APPROVED', 'REJECTED']:
            return jsonify(error="Nieprawidłowe dane"), 400
        
        db = get_db()
        
        # Get request details
        request_row = db.execute("SELECT * FROM swap_requests WHERE id = ?", (request_id,)).fetchone()
        if not request_row:
            return jsonify(error="Prośba nie została znaleziona"), 404
        
        # Update boss status
        db.execute("""
            UPDATE swap_requests 
            SET boss_status = ?, updated_at = datetime('now') 
            WHERE id = ?
        """, (status, request_id))
        
        # If approved, execute the swap
        if status == 'APPROVED' and request_row["recipient_status"] == 'ACCEPTED':
            from_employee = request_row["from_employee"]
            to_employee = request_row["to_employee"]
            from_date = request_row["from_date"]
            to_date = request_row["to_date"]
            is_give_request = request_row["is_give_request"]
            is_ask_request = request_row["is_ask_request"]
            
            # Get employee IDs
            from_emp_id = db.execute("SELECT id FROM employees WHERE name=?", (from_employee,)).fetchone()["id"]
            to_emp_id = db.execute("SELECT id FROM employees WHERE name=?", (to_employee,)).fetchone()["id"]
            
            if is_give_request:
                # Give request: transfer shift from requester to target
                process_give_request(db, from_emp_id, to_emp_id, from_date, from_employee, to_employee)
            elif is_ask_request:
                # Ask request: transfer shift from target to requester  
                process_ask_request(db, from_emp_id, to_emp_id, to_date, from_employee, to_employee)
            else:
                # Regular swap: exchange shifts
                process_regular_swap(db, from_emp_id, to_emp_id, from_date, to_date, from_employee, to_employee)
        
        db.commit()
        
        logger.info(f"Admin {session.get('user_email')} {status} prośbę {request_id}")
        return jsonify(status="ok", message=f"Prośba została {status}")
        
    except Exception as e:
        logger.error(f"Błąd podczas zatwierdzania prośby: {e}")
        return jsonify(error="Wystąpił błąd podczas zatwierdzania"), 500

@app.post("/api/swaps/clear")
@admin_required
def api_swaps_clear():
    ensure_swaps_table()
    db = get_db()
    cur = db.execute("DELETE FROM swap_requests")
    db.commit()
    return jsonify(status="ok", deleted=cur.rowcount)

# --- Employees API -------------------------------------------------------------
@app.get("/api/employees")
@admin_required
def api_employees_list():
    ensure_employees_code_column()
    db = get_db()
    rows = db.execute("SELECT id, name, code FROM employees ORDER BY name").fetchall()
    return jsonify(employees=[{"id": r["id"], "name": r["name"], "code": r["code"]} for r in rows])


@app.post("/api/employees")
@admin_required
def api_employees_add():
    ensure_employees_code_column()
    data = safe_get_json()
    code = (data.get("code") or "").strip()
    name = (data.get("name") or "").strip()
    if not code or not name:
        return jsonify(error="code and name required"), 400
    db = get_db()
    try:
        db.execute("INSERT INTO employees(name, code) VALUES (?,?)", (name, code))
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify(error="employee exists or code not unique"), 409
    row = db.execute("SELECT id, name, code FROM employees WHERE code=?", (code,)).fetchone()
    return jsonify(id=row["id"], name=row["name"], code=row["code"]) , 201


@app.delete("/api/employees/<int:emp_id>")
@admin_required
def api_employees_delete(emp_id: int):
    db = get_db()
    db.execute("DELETE FROM employees WHERE id=?", (emp_id,))
    db.commit()
    return jsonify(status="ok")

@app.put("/api/employees/<int:emp_id>")
@admin_required
def api_employees_update(emp_id: int):
    ensure_employees_code_column()
    data = safe_get_json()
    code = (data.get("code") or "").strip()
    name = (data.get("name") or "").strip()
    if not code or not name:
        return jsonify(error="code and name required"), 400
    
    db = get_db()
    try:
        # Sprawdź czy pracownik istnieje
        existing = db.execute("SELECT id FROM employees WHERE id=?", (emp_id,)).fetchone()
        if not existing:
            return jsonify(error="employee not found"), 404
        
        # Sprawdź czy nowy kod nie koliduje z innymi pracownikami
        conflict = db.execute("SELECT id FROM employees WHERE code=? AND id!=?", (code, emp_id)).fetchone()
        if conflict:
            return jsonify(error="code already exists"), 409
        
        # Aktualizuj pracownika
        db.execute("UPDATE employees SET name=?, code=? WHERE id=?", (name, code, emp_id))
        db.commit()
        
        # Zwróć zaktualizowane dane
        row = db.execute("SELECT id, name, code FROM employees WHERE id=?", (emp_id,)).fetchone()
        return jsonify(id=row["id"], name=row["name"], code=row["code"])
        
    except sqlite3.IntegrityError:
        return jsonify(error="database error"), 500

# users listing for mapping
@app.get("/api/users")
@admin_required
def api_users():
    ensure_users_role_column()
    db = get_db()
    rows = db.execute("SELECT id, email, name, role FROM users ORDER BY email").fetchall()
    return jsonify(users=[{"id":r["id"],"email":r["email"],"name":r["name"],"role":r["role"]} for r in rows])

# link employee to user
@app.post("/api/employees/link")
@admin_required
def api_employees_link():
    """Linkuje pracownika z użytkownikiem"""
    data = safe_get_json()
    employee_id = data.get("employee_id")
    user_id = data.get("user_id")
    
    if not employee_id or not user_id:
        return jsonify(error="employee_id and user_id required"), 400
    
    try:
        db = get_db()
        db.execute("UPDATE employees SET user_id=? WHERE id=?", (user_id, employee_id))
        db.commit()
        return jsonify(status="ok")
    except sqlite3.Error as e:
        logger.error(f"Błąd linkowania pracownika: {e}")
        return jsonify(error="database error"), 500

# Authentication routes
@app.get("/signin")
def signin():
    """Strona logowania"""
    return render_template("signin.html")

@app.get("/login")
def login():
    """Przekierowanie do Google OAuth"""
    # W produkcji używaj HTTPS, w development HTTP
    if app.config.get('PREFERRED_URL_SCHEME') == 'https':
        redirect_uri = url_for('auth_callback', _external=True, _scheme='https')
    else:
        redirect_uri = url_for('auth_callback', _external=True)
    
    app.logger.info(f"🔍 DEBUG: Generated redirect_uri = {redirect_uri}")
    return google.authorize_redirect(redirect_uri)

@app.get("/auth/callback")
@app.get("/authorize")  # Alternative route for compatibility
def auth_callback():
    """Callback po autoryzacji Google"""
    try:
        token = google.authorize_access_token()
        user_info = token.get('userinfo')
        
        if not user_info:
            logger.error("Nie otrzymano informacji o użytkowniku z Google")
            return redirect(url_for('signin'))
        
        email = user_info.get('email', '').lower()
        name = user_info.get('name', '')
        picture = user_info.get('picture', '')
        google_sub = user_info.get('sub', '')
        
        logger.info(f"Próba logowania użytkownika: {email}")
        
        # Sprawdź whitelist
        whitelist = load_whitelist()
        if whitelist and email not in whitelist:
            logger.warning(f"Użytkownik {email} nie jest na liście dozwolonych")
            return render_template("signin.html", error="Twój email nie jest autoryzowany do korzystania z tej aplikacji")
        
        # Zapisz lub zaktualizuj użytkownika w bazie
        ensure_users_role_column()
        db = get_db()
        
        # Sprawdź czy użytkownik już istnieje
        user = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
        
        if user:
            # Aktualizuj istniejącego użytkownika
            db.execute("""
                UPDATE users SET name=?, picture=?, google_sub=? WHERE email=?
            """, (name, picture, google_sub, email))
            user_id = user["id"]
        else:
            # Utwórz nowego użytkownika
            cursor = db.execute("""
                INSERT INTO users (email, name, picture, google_sub, role) 
                VALUES (?, ?, ?, ?, 'USER')
            """, (email, name, picture, google_sub))
            user_id = cursor.lastrowid
        
        db.commit()
        
        # Ustaw sesję
        session.permanent = True
        session["user_id"] = user_id
        session["user_email"] = email
        session["user_name"] = name
        
        logger.info(f"Użytkownik {email} zalogowany pomyślnie")
        return redirect(url_for('index'))
        
    except Exception as e:
        logger.error(f"Błąd podczas autoryzacji: {e}")
        return render_template("signin.html", error="Wystąpił błąd podczas logowania. Spróbuj ponownie.")

@app.post("/logout")
def logout():
    """Wylogowanie użytkownika"""
    user_email = session.get("user_email", "nieznany")
    session.clear()
    logger.info(f"Użytkownik {user_email} wylogowany")
    return redirect(url_for('signin'))

# Main page route
@app.get("/")
@login_required
def index():
    """Główna strona aplikacji - wymagane logowanie"""
    try:
        # Get current date for calendar
        year = int(request.args.get('year', dt.datetime.now().year))
        month = int(request.args.get('month', dt.datetime.now().month))
        
        # Calculate navigation dates
        if month == 1:
            prev_year, prev_month = year - 1, 12
        else:
            prev_year, prev_month = year, month - 1
            
        if month == 12:
            next_year, next_month = year + 1, 1
        else:
            next_year, next_month = year, month + 1
        
        # Create month label
        month_names = ['', 'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
                      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']
        month_label = f"{month_names[month]} {year}"
        
        # Get today's shifts
        today = dt.datetime.now().strftime('%Y-%m-%d')
        db = get_db()
        
        # Get employees
        employees = db.execute("SELECT id, name FROM employees ORDER BY name").fetchall()
        
        # Get today's shifts
        today_shifts = db.execute("""
            SELECT e.name, s.shift_type
            FROM shifts s 
            JOIN employees e ON s.employee_id = e.id 
            WHERE s.date = ?
        """, (today,)).fetchall()
        
        shifts_today = {"dniowka": [], "nocka": []}
        for shift in today_shifts:
            if shift["shift_type"] == "DNIOWKA":
                shifts_today["dniowka"].append(shift["name"])
            elif shift["shift_type"] == "NOCKA":
                shifts_today["nocka"].append(shift["name"])
        
        # Generate calendar days for the month with proper structure
        import datetime as dt_module
        
        # Polish holidays (basic ones - you can expand this)
        polish_holidays = {
            (1, 1): "Nowy Rok",
            (1, 6): "Święto Trzech Króli", 
            (5, 1): "Święto Pracy",
            (5, 3): "Święto Konstytucji",
            (8, 15): "Wniebowzięcie NMP",
            (11, 1): "Wszystkich Świętych",
            (11, 11): "Święto Niepodległości",
            (12, 25): "Boże Narodzenie",
            (12, 26): "Św. Szczepana"
        }
        
        # Day names in Polish
        day_names = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']
        
        calendar_days = []
        month_calendar = calendar.monthcalendar(year, month)
        
        for week in month_calendar:
            calendar_week = []
            for day in week:
                if day == 0:
                    calendar_week.append(None)
                else:
                    date_str = f"{year:04d}-{month:02d}-{day:02d}"
                    date_obj = dt_module.date(year, month, day)
                    
                    # Check if it's weekend or holiday
                    is_weekend = date_obj.weekday() >= 5  # Saturday=5, Sunday=6
                    is_holiday = (month, day) in polish_holidays
                    is_off = is_weekend or is_holiday
                    
                    # Get shifts for this day
                    day_shifts = db.execute("""
                        SELECT e.name, s.shift_type
                        FROM shifts s 
                        JOIN employees e ON s.employee_id = e.id 
                        WHERE s.date = ?
                    """, (date_str,)).fetchall()
                    
                    day_data = {
                        "day": day,
                        "dd": f"{day:02d}",  # Format as 01, 02, etc.
                        "date": date_str,
                        "iso": date_str,
                        "abbr": day_names[date_obj.weekday()],  # Mon=0, so day_names[0]='Pon'
                        "is_off": is_off,
                        "is_weekend": is_weekend,
                        "is_holiday": is_holiday,
                        "holiday_name": polish_holidays.get((month, day), ""),
                        "shifts": {"DNIOWKA": [], "NOCKA": []}
                    }
                    
                    for shift in day_shifts:
                        day_data["shifts"][shift["shift_type"]].append(shift["name"])
                    
                    calendar_week.append(day_data)
            calendar_days.append(calendar_week)

        # Get current employee name for this user
        me_emp = db.execute("SELECT name FROM employees WHERE user_id=?", (session.get("user_id"),)).fetchone()
        current_emp_name = me_emp["name"] if me_emp else session.get("user_name", "")
        
        # Check if user is admin
        user_role_row = db.execute("SELECT is_special FROM employees WHERE user_id=?", (session.get("user_id"),)).fetchone()
        is_admin = user_role_row and user_role_row["is_special"] == 1
        
        # Debug: sprawdź dane przed renderowaniem
        logger.info(f"Renderowanie strony - użytkownik: {session.get('user_name')}")
        logger.info(f"Liczba pracowników: {len(employees)}")
        logger.info(f"Liczba tygodni kalendarza: {len(calendar_days)}")
        
        # Konwertuj sqlite Row objects na dict żeby uniknąć problemów z serializacją
        employees_clean = []
        for e in employees:
            employees_clean.append({
                "id": int(e["id"]) if e["id"] is not None else 0,
                "name": str(e["name"]) if e["name"] is not None else ""
            })
        
        # Clean calendar_days and ensure proper types
        calendar_days_clean = []
        for week in calendar_days:
            week_clean = []
            for day in week:
                if day is None:
                    week_clean.append(None)
                else:
                    day_clean = {
                        "day": int(day["day"]) if day["day"] is not None else 0,
                        "dd": str(day["dd"]) if day["dd"] is not None else "",
                        "date": str(day["date"]) if day["date"] is not None else "",
                        "iso": str(day["iso"]) if day["iso"] is not None else "",
                        "abbr": str(day["abbr"]) if day["abbr"] is not None else "",
                        "is_off": bool(day["is_off"]) if day["is_off"] is not None else False,
                        "is_weekend": bool(day["is_weekend"]) if day["is_weekend"] is not None else False,
                        "is_holiday": bool(day["is_holiday"]) if day["is_holiday"] is not None else False,
                        "holiday_name": str(day["holiday_name"]) if day["holiday_name"] is not None else "",
                        "shifts": {
                            "DNIOWKA": [str(name) for name in day["shifts"]["DNIOWKA"]],
                            "NOCKA": [str(name) for name in day["shifts"]["NOCKA"]]
                        }
                    }
                    week_clean.append(day_clean)
            calendar_days_clean.append(week_clean)
        
        # Przygotuj schedule_rows - płaska lista dni z danymi
        schedule_rows = []
        for week in calendar_days_clean:
            for day in week:
                if day is not None:
                    schedule_rows.append(day)
        
        # Przygotuj shifts_by_date dla JavaScript
        shifts_by_date = {}
        for week in calendar_days_clean:
            for day in week:
                if day is not None:
                    date_str = day["date"]
                    shifts_by_date[date_str] = {}
                    for emp in employees_clean:
                        emp_name = emp["name"]
                        # Sprawdź czy pracownik ma zmianę tego dnia
                        has_dniowka = emp_name in day["shifts"]["DNIOWKA"]
                        has_nocka = emp_name in day["shifts"]["NOCKA"]
                        if has_dniowka:
                            shifts_by_date[date_str][emp_name] = "DNIOWKA"
                        elif has_nocka:
                            shifts_by_date[date_str][emp_name] = "NOCKA"
                        # else: brak zmiany dla tego pracownika
        
        response = make_response(render_template("index.html", 
            shifts_today=shifts_today,
            month_label=str(month_label),
            prev_year=int(prev_year), prev_month=int(prev_month),
            next_year=int(next_year), next_month=int(next_month),
            view_year=int(year), view_month=int(month),
            employees=employees_clean,
            calendar_days=calendar_days_clean,
            schedule_rows=schedule_rows,
            current_user=str(session.get("user_name", "Użytkownik")),
            current_emp_name=str(current_emp_name) if current_emp_name else "",
            shifts_by_date=shifts_by_date,
            is_admin=is_admin
        ))
        
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        
        logger.info(f"Główna strona załadowana dla użytkownika {session.get('user_email')}")
        return response

    except Exception as e:
        logger.error(f"Błąd podczas ładowania głównej strony: {e}")
        abort(500, "Błąd podczas ładowania strony")

# --- Health check i debug -----------------------------------------------------
@app.get("/healthz")
def healthz():
    """Health check endpoint"""
    return jsonify(status="ok", timestamp=dt.datetime.now().isoformat())

@app.get("/debug/env")
def debug_env():
    """Debug endpoint - sprawdza konfigurację środowiska"""
    return jsonify(
        has_client_id=bool(os.environ.get("GOOGLE_CLIENT_ID")),
        has_client_secret=bool(os.environ.get("GOOGLE_CLIENT_SECRET")),
        has_secret_key=bool(os.environ.get("SECRET_KEY")),
        environment=os.environ.get("FLASK_ENV", "development")
    )

# --- Main --------------------------------------------------------------------
if __name__ == "__main__":
    logger.info("Uruchamianie aplikacji Flask...")
    app.run(debug=False, host='localhost', port=5000)
