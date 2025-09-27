"""
Zarządzanie bazą danych SQLite
Zachowuje pełną kompatybilność z istniejącą strukturą
"""

import sqlite3
import logging
from flask import g, current_app

logger = logging.getLogger(__name__)

def get_db():
    """Pobierz połączenie z bazą danych"""
    if 'db' not in g:
        g.db = sqlite3.connect(current_app.config['DATABASE_PATH'])
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    """Zamknij połączenie z bazą danych"""
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db():
    """Inicjalizuj bazę danych z wszystkimi tabelami"""
    try:
        db = get_db()
        
        # Tabela users
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              google_sub TEXT UNIQUE,           -- Unikalny ID z Google (może być NULL)
              email TEXT NOT NULL UNIQUE,       -- Email użytkownika
              name TEXT NOT NULL,               -- Imię i nazwisko
              password_hash TEXT,               -- Hash hasła (może być NULL dla Google-only)
              login_type TEXT NOT NULL DEFAULT 'GOOGLE', -- Typ logowania: GOOGLE, EMAIL, BOTH
              role TEXT NOT NULL DEFAULT 'USER', -- Rola: USER lub ADMIN
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')
        
        # Tabela employees
        db.execute('''
            CREATE TABLE IF NOT EXISTS employees (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE  -- Imię i nazwisko pracownika
            );
        ''')
        
        # Tabela shifts
        db.execute('''
            CREATE TABLE IF NOT EXISTS shifts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              date TEXT NOT NULL,                    -- Data zmiany (YYYY-MM-DD)
              shift_type TEXT NOT NULL,              -- Typ zmiany (DNIOWKA, NOCKA, etc.)
              employee_id INTEGER NOT NULL,          -- ID pracownika
              FOREIGN KEY (employee_id) REFERENCES employees (id)
            );
        ''')
        
        # Inicjalizuj pozostałe tabele
        ensure_swaps_table()
        ensure_unavailability_table()
        ensure_schedule_changes_table()
        ensure_push_subscriptions_table()
        
        # Migruj tabelę users do nowej struktury
        migrate_users_table()
        
        db.commit()
        logger.info("Baza danych zainicjalizowana pomyślnie")
        
    except Exception as e:
        logger.error(f"Błąd podczas inicjalizacji bazy danych: {e}")
        raise

def ensure_swaps_table():
    """Tworzy lub aktualizuje tabelę swap_requests"""
    try:
        db = get_db()
        
        # Sprawdź czy tabela istnieje
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='swap_requests'")
        if not cursor.fetchone():
            db.execute('''
                CREATE TABLE swap_requests (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  requester_user_id INTEGER NOT NULL,
                  from_date TEXT NOT NULL,
                  to_date TEXT NOT NULL,
                  from_employee TEXT NOT NULL,
                  to_employee TEXT NOT NULL,
                  comment_requester TEXT DEFAULT '',
                  recipient_status TEXT DEFAULT 'PENDING',
                  boss_status TEXT DEFAULT 'PENDING',
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (requester_user_id) REFERENCES users (id)
                );
            ''')
            logger.info("Tabela swap_requests utworzona")
        else:
            logger.info("Tabela swap_requests już istnieje")
            
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia tabeli swap_requests: {e}")
        raise

def ensure_unavailability_table():
    """Tworzy lub aktualizuje tabelę unavailability_requests"""
    try:
        db = get_db()
        
        # Sprawdź czy tabela istnieje
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='unavailability_requests'")
        if not cursor.fetchone():
            db.execute('''
                CREATE TABLE unavailability_requests (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  employee_id INTEGER NOT NULL,
                  month_year TEXT NOT NULL,
                  reason TEXT NOT NULL,
                  selected_days TEXT,
                  status TEXT DEFAULT 'PENDING',
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (employee_id) REFERENCES employees (id)
                );
            ''')
            logger.info("Tabela unavailability_requests utworzona")
        else:
            # Sprawdź czy kolumna selected_days istnieje
            cursor = db.execute("PRAGMA table_info(unavailability_requests)")
            columns = [column[1] for column in cursor.fetchall()]
            if 'selected_days' not in columns:
                db.execute('ALTER TABLE unavailability_requests ADD COLUMN selected_days TEXT')
                logger.info("Dodano kolumnę selected_days do tabeli unavailability_requests")
            logger.info("Tabela unavailability_requests już istnieje")
            
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia tabeli unavailability_requests: {e}")
        raise

def ensure_schedule_changes_table():
    """Tworzy tabelę schedule_changes jeśli nie istnieje"""
    try:
        db = get_db()
        
        # Sprawdź czy tabela istnieje
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schedule_changes'")
        if not cursor.fetchone():
            db.execute('''
                CREATE TABLE schedule_changes (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  date TEXT NOT NULL,
                  employee_name TEXT NOT NULL,
                  old_shift TEXT,
                  new_shift TEXT,
                  changed_by TEXT NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ''')
            logger.info("Tabela schedule_changes utworzona")
        else:
            logger.info("Tabela schedule_changes już istnieje")
            
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia tabeli schedule_changes: {e}")
        raise

def ensure_push_subscriptions_table():
    """Tworzy tabelę push_subscriptions jeśli nie istnieje"""
    try:
        db = get_db()
        
        # Sprawdź czy tabela istnieje
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'")
        if not cursor.fetchone():
            db.execute('''
                CREATE TABLE push_subscriptions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  subscription_data TEXT NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (user_id) REFERENCES users (id)
                );
            ''')
            logger.info("Tabela push_subscriptions utworzona")
        else:
            logger.info("Tabela push_subscriptions już istnieje")
            
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia tabeli push_subscriptions: {e}")
        raise

def save_push_subscription(user_id, subscription):
    """
    Zapisuje subskrypcję push w bazie danych
    """
    try:
        import json
        logger.info(f"Zapisywanie subskrypcji push - user_id: {user_id}, subscription: {subscription}")
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Sprawdź czy użytkownik już ma subskrypcję
        cursor.execute("SELECT id FROM push_subscriptions WHERE user_id = ?", (user_id,))
        existing = cursor.fetchone()
        logger.info(f"Istniejąca subskrypcja: {existing}")
        
        if existing:
            # Aktualizuj istniejącą subskrypcję
            logger.info("Aktualizuję istniejącą subskrypcję")
            cursor.execute("""
                UPDATE push_subscriptions 
                SET subscription_data = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE user_id = ?
            """, (json.dumps(subscription), user_id))
        else:
            # Utwórz nową subskrypcję
            logger.info("Tworzę nową subskrypcję")
            cursor.execute("""
                INSERT INTO push_subscriptions (user_id, subscription_data, created_at, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (user_id, json.dumps(subscription)))
        
        conn.commit()
        logger.info(f"Subskrypcja push zapisana dla użytkownika {user_id}")
        return True
        
    except Exception as e:
        logger.error(f"Błąd zapisywania subskrypcji push: {e}")
        logger.error(f"Szczegóły błędu: {type(e).__name__}: {str(e)}")
        return False

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
            
    except Exception as e:
        logger.error(f"Błąd podczas dodawania kolumny 'code' do tabeli employees: {e}")

def ensure_employees_email_column():
    """Dodaje kolumnę email do tabeli employees jeśli nie istnieje"""
    try:
        db = get_db()
        cols = db.execute("PRAGMA table_info(employees)").fetchall()
        has_email = any(c[1] == 'email' for c in cols)
        
        if not has_email:
            db.execute("ALTER TABLE employees ADD COLUMN email TEXT")
            db.execute("CREATE UNIQUE INDEX IF NOT EXISTS employees_email_idx ON employees(email)")
            db.commit()
            logger.info("Dodano kolumnę 'email' do tabeli employees")
            
    except Exception as e:
        logger.error(f"Błąd podczas dodawania kolumny 'email' do tabeli employees: {e}")

def migrate_users_table():
    """Migruje tabelę users do nowej struktury z obsługą email/hasło"""
    try:
        db = get_db()
        
        # Sprawdź czy kolumny już istnieją
        cols = db.execute("PRAGMA table_info(users)").fetchall()
        existing_columns = [col[1] for col in cols]
        
        # Dodaj kolumnę password_hash jeśli nie istnieje
        if 'password_hash' not in existing_columns:
            db.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
            logger.info("Dodano kolumnę 'password_hash' do tabeli users")
        
        # Dodaj kolumnę login_type jeśli nie istnieje
        if 'login_type' not in existing_columns:
            db.execute("ALTER TABLE users ADD COLUMN login_type TEXT NOT NULL DEFAULT 'GOOGLE'")
            logger.info("Dodano kolumnę 'login_type' do tabeli users")
        
        # Zmień google_sub na nullable jeśli nie jest
        if 'google_sub' in existing_columns:
            # Sprawdź czy google_sub jest NOT NULL
            google_sub_col = next((col for col in cols if col[1] == 'google_sub'), None)
            if google_sub_col and google_sub_col[3] == 1:  # 1 oznacza NOT NULL
                # SQLite nie obsługuje ALTER COLUMN, więc musimy utworzyć nową tabelę
                logger.info("Migruję tabelę users do nowej struktury...")
                
                # Utwórz nową tabelę z poprawną strukturą
                db.execute('''
                    CREATE TABLE users_new (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      google_sub TEXT UNIQUE,
                      email TEXT NOT NULL UNIQUE,
                      name TEXT NOT NULL,
                      password_hash TEXT,
                      login_type TEXT NOT NULL DEFAULT 'GOOGLE',
                      role TEXT NOT NULL DEFAULT 'USER',
                      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                ''')
                
                # Skopiuj dane z starej tabeli
                db.execute('''
                    INSERT INTO users_new (id, google_sub, email, name, role, created_at, login_type)
                    SELECT id, google_sub, email, name, role, created_at, 'GOOGLE'
                    FROM users
                ''')
                
                # Usuń starą tabelę i zmień nazwę nowej
                db.execute("DROP TABLE users")
                db.execute("ALTER TABLE users_new RENAME TO users")
                
                logger.info("Migracja tabeli users zakończona pomyślnie")
        
        db.commit()
        
    except Exception as e:
        logger.error(f"Błąd podczas migracji tabeli users: {e}")
        raise

def init_app(app):
    """Inicjalizuj moduł bazy danych z aplikacją Flask"""
    app.teardown_appcontext(close_db)
