#!/usr/bin/env python3
"""
Aplikacja Flask do zarządzania grafikiem zmian SP 4600
"""

import os
import sqlite3
import logging
import datetime as dt
import calendar
from datetime import timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Optional, Any
from functools import wraps
from collections import defaultdict
import time

from flask import Flask, g, render_template, jsonify, request, redirect, url_for, session, abort, make_response
from dotenv import load_dotenv
from authlib.integrations.flask_client import OAuth

# Ładuj zmienne środowiskowe
load_dotenv()

# Konfiguracja logowania
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Inicjalizacja aplikacji Flask
app = Flask(__name__)

# Konfiguracja aplikacji
class Config:
    """Konfiguracja aplikacji Flask"""
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    
    # Ustawienia bezpieczeństwa sesji
    SESSION_COOKIE_SECURE = os.environ.get("FLASK_ENV") == "production"
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Konfiguracja bazy danych
    DATABASE_PATH = os.path.join(os.path.dirname(__file__), "app.db")
    
    # Rate limiting
    RATELIMIT_DEFAULT = "100 per minute"
    RATELIMIT_STORAGE_URL = "memory://"
    
    # Konfiguracja serwera dla OAuth2
    SERVER_NAME = os.environ.get("SERVER_NAME", "grafiksp4600.loca.lt")

app.config.from_object(Config)

# Inicjalizacja OAuth
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    access_token_url='https://accounts.google.com/o/oauth2/token',
    access_token_params=None,
    authorize_url='https://accounts.google.com/o/oauth2/auth',
    authorize_params=None,
    api_base_url='https://www.googleapis.com/oauth2/v1/',
    userinfo_endpoint='https://www.googleapis.com/oauth2/v1/userinfo',
    client_kwargs={'scope': 'openid email profile'},
)

# --- Funkcje pomocnicze --------------------------------------------------------

def get_db():
    """Pobiera połączenie z bazą danych"""
    if "db" not in g:
        try:
            g.db = sqlite3.connect(app.config['DATABASE_PATH'])
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

# Dekoratory uwierzytelniania
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
request_counts = defaultdict(list)

def check_rate_limit(key: str, max_requests: int = 10, window: int = 60) -> bool:
    """Sprawdza rate limiting dla danego klucza"""
    now = time.time()
    # Usuń stare żądania
    request_counts[key] = [t for t in request_counts[key] if now - t < window]
    
    if len(request_counts[key]) >= max_requests:
        return False
    
    request_counts[key].append(now)
    return True

# --- Funkcje świąt polskich --------------------------------------------------------

def polish_holidays(year: int) -> List[dt.date]:
    """Zwraca listę świąt polskich dla danego roku"""
    holidays = [
        dt.date(year, 1, 1),    # Nowy Rok
        dt.date(year, 1, 6),    # Trzech Króli
        dt.date(year, 5, 1),    # Święto Pracy
        dt.date(year, 5, 3),    # Konstytucja 3 Maja
        dt.date(year, 8, 15),   # Wniebowzięcie NMP
        dt.date(year, 11, 1),   # Wszystkich Świętych
        dt.date(year, 11, 11),  # Niepodległość
        dt.date(year, 12, 25),  # Boże Narodzenie
        dt.date(year, 12, 26),  # Drugi dzień świąt
    ]
    
    # Święta ruchome (Wielkanoc)
    # Uproszczone obliczenie - w rzeczywistości lepiej użyć biblioteki
    if year == 2024:
        holidays.extend([dt.date(2024, 3, 31), dt.date(2024, 4, 1)])  # Wielkanoc
    elif year == 2025:
        holidays.extend([dt.date(2025, 4, 20), dt.date(2025, 4, 21)])  # Wielkanoc
    
    return holidays

# --- Migracje bazy danych --------------------------------------------------------

def ensure_users_role_column():
    """Dodaje kolumnę role do tabeli users jeśli nie istnieje"""
    try:
        db = get_db()
        cols = db.execute("PRAGMA table_info(users)").fetchall()
        has_role = any(c[1] == 'role' for c in cols)
        
        if not has_role:
            db.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'USER'")
            db.commit()
            logger.info("Dodano kolumnę role do tabeli users")
    except Exception as e:
        logger.error(f"Błąd podczas dodawania kolumny role: {e}")

def ensure_employees_user_id_column():
    """Dodaje kolumnę user_id do tabeli employees jeśli nie istnieje"""
    try:
        db = get_db()
        cols = db.execute("PRAGMA table_info(employees)").fetchall()
        has_user_id = any(c[1] == 'user_id' for c in cols)
        
        if not has_user_id:
            db.execute("ALTER TABLE employees ADD COLUMN user_id INTEGER REFERENCES users(id)")
            db.commit()
            logger.info("Dodano kolumnę user_id do tabeli employees")
    except Exception as e:
        logger.error(f"Błąd podczas dodawania kolumny user_id: {e}")

def ensure_employees_code_column():
    """Dodaje kolumnę code do tabeli employees jeśli nie istnieje"""
    try:
        db = get_db()
        cols = db.execute("PRAGMA table_info(employees)").fetchall()
        has_code = any(c[1] == 'code' for c in cols)
        
        if not has_code:
            db.execute("ALTER TABLE employees ADD COLUMN code TEXT DEFAULT ''")
            db.commit()
            logger.info("Dodano kolumnę code do tabeli employees")
    except Exception as e:
        logger.error(f"Błąd podczas dodawania kolumny code: {e}")

def ensure_swaps_table():
    """Tworzy tabelę swap_requests jeśli nie istnieje"""
    try:
        db = get_db()
        db.execute("""
            CREATE TABLE IF NOT EXISTS swap_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requester_id INTEGER NOT NULL,
                target_id INTEGER NOT NULL,
                requester_date TEXT NOT NULL,
                target_date TEXT NOT NULL,
                requester_shift TEXT NOT NULL,
                target_shift TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                boss_status TEXT DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (requester_id) REFERENCES employees (id),
                FOREIGN KEY (target_id) REFERENCES employees (id)
            )
        """)
        
        # Sprawdź czy indeksy istnieją
        indices = db.execute("PRAGMA index_list(swap_requests)").fetchall()
        index_names = [idx[1] for idx in indices]
        
        if 'idx_swap_status' not in index_names:
            db.execute("CREATE INDEX idx_swap_status ON swap_requests(status)")
        if 'idx_swap_boss_status' not in index_names:
            db.execute("CREATE INDEX idx_swap_boss_status ON swap_requests(boss_status)")
        
        db.commit()
        logger.info("Utworzono tabelę swap_requests z indeksami")
        return
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia tabeli swap_requests: {e}")

# --- Główne trasy --------------------------------------------------------

@app.route("/")
@login_required
def index():
    """Główna strona z grafikiem"""
    try:
        # Uruchom migracje bazy danych
        ensure_users_role_column()
        ensure_employees_user_id_column()
        ensure_employees_code_column()
        ensure_swaps_table()
        
        tz = ZoneInfo("Europe/Warsaw")
        today = dt.datetime.now(tz).date()
        
        db = get_db()
        
        # Lista pracowników z bazy danych
        rows = db.execute("SELECT name FROM employees ORDER BY name").fetchall()
        employees = [r["name"] for r in rows]
        me_emp = db.execute("SELECT name FROM employees WHERE user_id=?", (session.get("user_id"),)).fetchone()
        current_emp_name = me_emp["name"] if me_emp else ""
        
        # Mapowanie specjalnych kont (admin i konkretne konta)
        try:
            # Promuj admina przez email
            db.execute("UPDATE users SET role='ADMIN' WHERE email=?", ("official221team@gmail.com",))
            
            # Helper: mapuj email użytkownika na pierwszą istniejącą nazwę pracownika z listy
            def map_user(email: str, names: List[str]):
                uid_row = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
                if not uid_row:
                    return
                for nm in names:
                    cur = db.execute("UPDATE employees SET user_id=? WHERE name=?", (uid_row["id"], nm))
                    if cur.rowcount > 0:
                        return
            
            map_user("official221team@gmail.com", ["Szef - administrator", "Szef", "szef"])  # admin
            map_user("nikodemboniecki1@gmail.com", ["Nikodem"])                                # Nikodem
            map_user("bonieckinikodem0@gmail.com", ["Weronika"])                               # Weronika
            db.commit()
            
        except Exception as e:
            logger.warning(f"Błąd podczas mapowania użytkowników: {e}")
        
        # Wybór miesiąca (z URL) i etykiety
        MONTHS_PL = [
            "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
            "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"
        ]
        
        year = int(request.args.get("year", today.year))
        month = int(request.args.get("month", today.month))
        
        # Normalizuj miesiąc
        if month < 1:
            month += 12
            year -= 1
        if month > 12:
            month -= 12
            year += 1
            
        month_label = f"{MONTHS_PL[month-1]} {year}"
        
        # Wiersze: wszystkie dni wybranego miesiąca
        days_in_month = calendar.monthrange(year, month)[1]
        abbr = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"]
        hols = polish_holidays(year)
        
        schedule_rows = []
        for d in range(1, days_in_month + 1):
            date_obj = dt.date(year, month, d)
            is_weekend = date_obj.weekday() >= 5
            is_holiday = date_obj in hols
            schedule_rows.append({
                "dd": f"{d:02d}",
                "abbr": abbr[date_obj.weekday()],
                "iso": date_obj.isoformat(),
                "is_off": is_weekend or is_holiday,
            })
        
        # Pobierz wszystkie zmiany dla wybranego miesiąca
        start_date = dt.date(year, month, 1).isoformat()
        end_date = dt.date(year, month, days_in_month).isoformat()
        shifts_data = db.execute("""
            SELECT s.date, s.shift_type, e.name as employee_name
            FROM shifts s
            JOIN employees e ON e.id = s.employee_id
            WHERE s.date >= ? AND s.date <= ?
            ORDER BY s.date, e.name
        """, (start_date, end_date)).fetchall()
        
        # Organizuj dane w słownik {date: {employee: shift_type}}
        shifts_by_date = {}
        for shift in shifts_data:
            date = shift["date"]
            if date not in shifts_by_date:
                shifts_by_date[date] = {}
            shifts_by_date[date][shift["employee_name"]] = shift["shift_type"]
        
        # Dodaj timestamp do wymuszenia odświeżenia cache
        shifts_by_date["_timestamp"] = dt.datetime.now().isoformat()
        
        # Lewy panel (dzisiejsze zmiany)
        d = db.execute("""
            SELECT e.name FROM shifts s
            JOIN employees e ON e.id = s.employee_id
            WHERE s.date=? AND s.shift_type='DNIOWKA' ORDER BY e.name
        """, (today.isoformat(),)).fetchall()
        
        n = db.execute("""
            SELECT e.name FROM shifts s
            JOIN employees e ON e.id = s.employee_id
            WHERE s.date=? AND s.shift_type='NOCKA' ORDER BY e.name
        """, (today.isoformat(),)).fetchall()
        
        # Sprawdź uprawnienia administratora
        try:
            user_row = db.execute("SELECT role FROM users WHERE id=?", (session.get("user_id"),)).fetchone()
            is_admin = user_row and user_row["role"] == "ADMIN"
        except:
            is_admin = False
        
        return render_template("index.html",
                             employees=employees,
                             schedule_rows=schedule_rows,
                             month_label=month_label,
                             view_year=year,
                             view_month=month,
                             current_emp_name=current_emp_name,
                             is_admin=is_admin,
                             shifts_by_date=shifts_by_date,
                             today_d=d,
                             today_n=n)
    except Exception as e:
        logger.error(f"Błąd w głównej stronie: {e}")
        return "Błąd serwera", 500

@app.route("/signin")
def signin():
    """Strona logowania"""
    return render_template("signin.html")

@app.route("/signout")
def signout():
    """Wylogowanie użytkownika"""
    session.clear()
    return redirect(url_for("signin"))

@app.route("/login")
def login():
    """Przekierowanie do Google OAuth2"""
    # Wyczyść poprzednią sesję
    session.clear()
    
    # Ustaw sesję jako trwałą
    session.permanent = True
    
    # Generuj redirect URI
    redirect_uri = url_for('authorize', _external=True)
    
    # Dodaj state do sesji dla bezpieczeństwa
    session['oauth_state'] = True
    
    return google.authorize_redirect(redirect_uri)

@app.route("/authorize")
def authorize():
    """Callback po autoryzacji Google OAuth2"""
    try:
        # Pobierz token dostępu
        token = google.authorize_access_token()
        if not token:
            logger.error("Brak tokenu dostępu")
            return "Błąd autoryzacji - brak tokenu", 500
        
        # Pobierz informacje o użytkowniku
        resp = google.get('userinfo')
        if not resp.ok:
            logger.error(f"Błąd pobierania danych użytkownika: {resp.status_code}")
            return "Błąd pobierania danych użytkownika", 500
        
        user_info = resp.json()
        logger.info(f"Otrzymano dane użytkownika: {user_info.get('email', 'brak email')}")
        
        # Sprawdź whitelist emaili
        whitelist = load_whitelist()
        if whitelist and user_info['email'].lower() not in whitelist:
            logger.warning(f"Próba logowania z niedozwolonego emaila: {user_info['email']}")
            return "Brak dostępu - email nie jest na liście dozwolonych", 403
        
        # Sprawdź rate limiting
        if not check_rate_limit(f"login_{user_info['email']}", max_requests=5, window=300):
            logger.warning(f"Przekroczono limit prób logowania dla: {user_info['email']}")
            return "Zbyt wiele prób logowania. Spróbuj ponownie za 5 minut.", 429
        
        db = get_db()
        
        # Sprawdź czy użytkownik istnieje
        user = db.execute("SELECT * FROM users WHERE google_sub=?", (user_info['sub'],)).fetchone()
        
        if user is None:
            # Utwórz nowego użytkownika
            db.execute("""
                INSERT INTO users (google_sub, email, name, picture)
                VALUES (?, ?, ?, ?)
            """, (user_info['sub'], user_info['email'], user_info.get('name'), user_info.get('picture')))
            db.commit()
            
            # Pobierz utworzonego użytkownika
            user = db.execute("SELECT * FROM users WHERE google_sub=?", (user_info['sub'],)).fetchone()
        
        # Zaktualizuj sesję
        session['user_id'] = user['id']
        session['user_name'] = user['name']
        session['user_email'] = user['email']
        session.permanent = True
        
        logger.info(f"Użytkownik zalogowany: {user_info['email']}")
        return redirect(url_for('index'))
        
    except Exception as e:
        logger.error(f"Błąd podczas autoryzacji: {e}")
        return f"Błąd autoryzacji: {str(e)}", 500

# --- API endpoints --------------------------------------------------------

@app.route("/api/save", methods=["POST"])
@login_required
def api_save():
    """Zapisuje zmiany w grafiku"""
    try:
        if not check_rate_limit(f"save_{session['user_id']}", max_requests=30, window=60):
            return jsonify({"error": "Zbyt wiele żądań"}), 429
        
        data = safe_get_json()
        if not data:
            return jsonify({"error": "Nieprawidłowy format danych"}), 400
        
        db = get_db()
        
        # Rozpocznij transakcję
        db.execute("BEGIN TRANSACTION")
        
        try:
            for item in data:
                date = item.get("date")
                shift_type = item.get("shift_type")
                employee = item.get("employee")
                
                if not all([date, shift_type, employee]):
                    continue
                
                if not validate_date_format(date) or not validate_shift_type(shift_type):
                    continue
                
                # Usuń istniejącą zmianę
                db.execute("""
                    DELETE FROM shifts s
                    JOIN employees e ON e.id = s.employee_id
                    WHERE s.date=? AND e.name=?
                """, (date, employee))
                
                # Dodaj nową zmianę
                db.execute("""
                    INSERT INTO shifts (date, shift_type, employee_id)
                    SELECT ?, ?, e.id FROM employees e WHERE e.name=?
                """, (date, shift_type, employee))
            
            db.commit()
            logger.info(f"Zapisano zmiany w grafiku przez użytkownika {session['user_id']}")
            return jsonify({"success": True, "message": "Grafik zaktualizowany"})
            
        except Exception as e:
            db.rollback()
            raise e
            
    except Exception as e:
        logger.error(f"Błąd podczas zapisywania grafiku: {e}")
        return jsonify({"error": "Błąd serwera"}), 500

@app.route("/api/employees", methods=["GET", "POST", "PUT", "DELETE"])
@admin_required
def api_employees():
    """API do zarządzania pracownikami"""
    try:
        if not check_rate_limit(f"employees_{session['user_id']}", max_requests=30, window=60):
            return jsonify({"error": "Zbyt wiele żądań"}), 429
        
        db = get_db()
        
        if request.method == "GET":
            # Pobierz listę pracowników
            rows = db.execute("SELECT id, name, code FROM employees ORDER BY name").fetchall()
            employees = [{"id": r["id"], "name": r["name"], "code": r["code"]} for r in rows]
            return jsonify(employees)
        
        elif request.method == "POST":
            # Dodaj pracownika
            data = safe_get_json()
            name = data.get("name", "").strip()
            code = data.get("code", "").strip()
            
            if not name:
                return jsonify({"error": "Nazwa pracownika nie może być pusta"}), 400
            
            # Sprawdź czy nazwa już istnieje
            existing = db.execute("SELECT id FROM employees WHERE name=?", (name,)).fetchone()
            if existing:
                return jsonify({"error": "Pracownik o tej nazwie już istnieje"}), 409
            
            cursor = db.execute("INSERT INTO employees (name, code) VALUES (?, ?)", (name, code))
            db.commit()
            
            new_employee = {"id": cursor.lastrowid, "name": name, "code": code}
            logger.info(f"Dodano pracownika: {name} przez użytkownika {session['user_id']}")
            return jsonify(new_employee), 201
        
        elif request.method == "PUT":
            # Aktualizuj pracownika
            data = safe_get_json()
            emp_id = data.get("id")
            name = data.get("name", "").strip()
            code = data.get("code", "").strip()
            
            if not name:
                return jsonify({"error": "Nazwa pracownika nie może być pusta"}), 400
            
            # Sprawdź czy pracownik istnieje
            existing = db.execute("SELECT id FROM employees WHERE id=?", (emp_id,)).fetchone()
            if not existing:
                return jsonify({"error": "Pracownik nie istnieje"}), 404
            
            # Sprawdź czy nazwa nie koliduje z innym pracownikiem
            name_conflict = db.execute("SELECT id FROM employees WHERE name=? AND id!=?", (name, emp_id)).fetchone()
            if name_conflict:
                return jsonify({"error": "Nazwa jest już używana przez innego pracownika"}), 409
            
            # Aktualizuj pracownika
            db.execute("UPDATE employees SET name=?, code=? WHERE id=?", (name, code, emp_id))
            db.commit()
            
            updated_employee = {"id": emp_id, "name": name, "code": code}
            logger.info(f"Zaktualizowano pracownika: {name} przez użytkownika {session['user_id']}")
            return jsonify(updated_employee)
        
        elif request.method == "DELETE":
            # Usuń pracownika
            emp_id = request.args.get("id")
            if not emp_id:
                return jsonify({"error": "Brak ID pracownika"}), 400
            
            # Sprawdź czy pracownik istnieje
            existing = db.execute("SELECT name FROM employees WHERE id=?", (emp_id,)).fetchone()
            if not existing:
                return jsonify({"error": "Pracownik nie istnieje"}), 404
            
            # Usuń pracownika (cascade usunie też zmiany)
            db.execute("DELETE FROM employees WHERE id=?", (emp_id,))
            db.commit()
            
            logger.info(f"Usunięto pracownika: {existing['name']} przez użytkownika {session['user_id']}")
            return jsonify({"success": True, "message": "Pracownik usunięty"})
        
    except Exception as e:
        logger.error(f"Błąd w API pracowników: {e}")
        return jsonify({"error": "Błąd serwera"}), 500

@app.route("/api/swaps", methods=["GET", "POST"])
@login_required
def api_swaps():
    """API do zarządzania prośbami o zamianę"""
    try:
        if not check_rate_limit(f"swaps_{session['user_id']}", max_requests=30, window=60):
            return jsonify({"error": "Zbyt wiele żądań"}), 429
        
        db = get_db()
        
        if request.method == "GET":
            # Pobierz prośby o zamianę
            rows = db.execute("""
                SELECT sr.*, 
                       e1.name as requester_name, e2.name as target_name,
                       sr.requester_date, sr.target_date,
                       sr.requester_shift, sr.target_shift,
                       sr.status, sr.boss_status
                FROM swap_requests sr
                JOIN employees e1 ON e1.id = sr.requester_id
                JOIN employees e2 ON e2.id = sr.target_id
                ORDER BY sr.created_at DESC
            """).fetchall()
            
            swaps = []
            for row in rows:
                swaps.append({
                    "id": row["id"],
                    "requester_name": row["requester_name"],
                    "target_name": row["target_name"],
                    "requester_date": row["requester_date"],
                    "target_date": row["target_date"],
                    "requester_shift": row["requester_shift"],
                    "target_shift": row["target_shift"],
                    "status": row["status"],
                    "boss_status": row["boss_status"],
                    "created_at": row["created_at"]
                })
            
            return jsonify(swaps)
        
        elif request.method == "POST":
            # Utwórz nową prośbę o zamianę
            data = safe_get_json()
            
            # Pobierz ID pracowników
            requester_emp = db.execute("SELECT id FROM employees WHERE user_id=?", (session["user_id"],)).fetchone()
            if not requester_emp:
                return jsonify({"error": "Nie jesteś przypisany do żadnego pracownika"}), 400
            
            target_emp = db.execute("SELECT id FROM employees WHERE name=?", (data.get("target_name"),)).fetchone()
            if not target_emp:
                return jsonify({"error": "Pracownik docelowy nie istnieje"}), 404
            
            # Sprawdź czy nie ma już aktywnej prośby
            existing = db.execute("""
                SELECT id FROM swap_requests 
                WHERE requester_id=? AND target_id=? AND status='PENDING'
            """, (requester_emp["id"], target_emp["id"])).fetchone()
            
            if existing:
                return jsonify({"error": "Masz już aktywną prośbę o zamianę z tym pracownikiem"}), 409
            
            # Utwórz prośbę o zamianę
            cursor = db.execute("""
                INSERT INTO swap_requests (
                    requester_id, target_id, requester_date, target_date,
                    requester_shift, target_shift, status, boss_status
                ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', 'PENDING')
            """, (
                requester_emp["id"], target_emp["id"],
                data.get("requester_date"), data.get("target_date"),
                data.get("requester_shift"), data.get("target_shift")
            ))
            
            db.commit()
            
            new_swap = {
                "id": cursor.lastrowid,
                "requester_name": data.get("requester_name"),
                "target_name": data.get("target_name"),
                "requester_date": data.get("requester_date"),
                "target_date": data.get("target_date"),
                "requester_shift": data.get("requester_shift"),
                "target_shift": data.get("target_shift"),
                "status": "PENDING",
                "boss_status": "PENDING"
            }
            
            logger.info(f"Utworzono prośbę o zamianę przez użytkownika {session['user_id']}")
            return jsonify(new_swap), 201
        
    except Exception as e:
        logger.error(f"Błąd w API zamian: {e}")
        return jsonify({"error": "Błąd serwera"}), 500

# --- Uruchomienie aplikacji --------------------------------------------------------

if __name__ == "__main__":
    # Sprawdź czy mamy wymagane zmienne środowiskowe
    if not os.environ.get("GOOGLE_CLIENT_ID") or not os.environ.get("GOOGLE_CLIENT_SECRET"):
        logger.error("Brak GOOGLE_CLIENT_ID lub GOOGLE_CLIENT_SECRET w zmiennych środowiskowych")
        print("❌ Błąd: Brak konfiguracji Google OAuth2")
        print("📝 Upewnij się, że masz plik .env z GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET")
        exit(1)
    
    print("🚀 Uruchamiam aplikację Flask...")
    print(f"🔑 Używasz Google OAuth2")
    print(f"🌐 Aplikacja będzie dostępna na: http://0.0.0.0:5000")
    print(f"📱 Dla dostępu z telefonu użyj localtunnel: lt --port 5000 --subdomain grafiksp4600")
    
    app.run(host="0.0.0.0", port=5000, debug=True) 
