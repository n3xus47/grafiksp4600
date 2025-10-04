"""
Zarządzanie bazą danych SQLite
Zachowuje pełną kompatybilność z istniejącą strukturą
"""

import sqlite3
import logging
from flask import g, current_app

logger = logging.getLogger(__name__)

def get_db():
    """Pobierz połączenie z bazą danych z optymalizacjami"""
    if 'db' not in g:
        g.db = sqlite3.connect(
            current_app.config['DATABASE_PATH'],
            timeout=30.0,  # Increase timeout for better reliability
            check_same_thread=False  # Allow multi-threading
        )
        g.db.row_factory = sqlite3.Row
        
        # Enable WAL mode for better concurrency
        g.db.execute("PRAGMA journal_mode=WAL")
        
        # Optimize SQLite settings for performance
        g.db.execute("PRAGMA synchronous=NORMAL")
        g.db.execute("PRAGMA cache_size=10000")
        g.db.execute("PRAGMA temp_store=MEMORY")
        g.db.execute("PRAGMA mmap_size=268435456")  # 256MB memory mapping
        
        # Enable foreign key constraints
        g.db.execute("PRAGMA foreign_keys=ON")
        
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
        ensure_draft_shifts_table()
        
        # Migruj tabelę users do nowej struktury
        migrate_users_table()
        
        # Dodaj indeksy dla wydajności
        create_database_indexes()
        
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

def ensure_draft_shifts_table():
    """Tworzy tabelę draft_shifts jeśli nie istnieje"""
    try:
        db = get_db()
        
        # Sprawdź czy tabela istnieje
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='draft_shifts'")
        if not cursor.fetchone():
            db.execute('''
                CREATE TABLE draft_shifts (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  date TEXT NOT NULL,
                  shift_type TEXT NOT NULL,
                  employee_id INTEGER NOT NULL,
                  created_by INTEGER NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (employee_id) REFERENCES employees (id),
                  FOREIGN KEY (created_by) REFERENCES users (id)
                );
            ''')
            logger.info("Tabela draft_shifts utworzona")
        else:
            logger.info("Tabela draft_shifts już istnieje")
            
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia tabeli draft_shifts: {e}")
        raise

def ensure_request_history_table():
    """Tworzy tabelę request_history jeśli nie istnieje"""
    try:
        db = get_db()
        
        # Sprawdź czy tabela istnieje
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='request_history'")
        if not cursor.fetchone():
            db.execute('''
                CREATE TABLE request_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_id INTEGER NOT NULL,
                    type VARCHAR(20) NOT NULL, -- 'swap' lub 'unavailability'
                    from_employee VARCHAR(100),
                    to_employee VARCHAR(100),
                    from_date TEXT,
                    to_date TEXT,
                    month_year TEXT,
                    reason TEXT,
                    comment_requester TEXT,
                    final_status VARCHAR(50) NOT NULL, -- ZATWIERDZONE, ODRZUCONE, etc.
                    admin_action VARCHAR(50), -- APPROVED, REJECTED
                    admin_comment TEXT,
                    created_at DATETIME NOT NULL,
                    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    archived_by INTEGER,
                    FOREIGN KEY (archived_by) REFERENCES users (id)
                );
            ''')
            
            # Dodaj indeksy dla lepszej wydajności
            db.execute('CREATE INDEX idx_request_history_type ON request_history(type)')
            db.execute('CREATE INDEX idx_request_history_status ON request_history(final_status)')
            db.execute('CREATE INDEX idx_request_history_archived_at ON request_history(archived_at)')
            
            logger.info("Tabela request_history utworzona")
        else:
            logger.info("Tabela request_history już istnieje")
            
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia tabeli request_history: {e}")
        raise

def ensure_whitelist_table():
    """Tworzy tabelę whitelist_emails jeśli nie istnieje"""
    try:
        db = get_db()
        
        # Sprawdź czy tabela istnieje
        cursor = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='whitelist_emails'")
        if not cursor.fetchone():
            db.execute('''
                CREATE TABLE whitelist_emails (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    added_by INTEGER,
                    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (added_by) REFERENCES users (id)
                );
            ''')
            
            # Dodaj indeks dla lepszej wydajności
            db.execute('CREATE INDEX idx_whitelist_emails_email ON whitelist_emails(email)')
            
            # Dodaj domyślne emaile do whitelist
            default_emails = [
                'nikodemboniecki1@gmail.com',
                'official221team@gmail.com', 
                'bonieckinikodem0@gmail.com'
            ]
            
            for email in default_emails:
                try:
                    db.execute("INSERT INTO whitelist_emails (email) VALUES (?)", (email,))
                except Exception as e:
                    logger.warning(f"Email {email} już istnieje w whitelist: {e}")
            
            db.commit()
            logger.info("Tabela whitelist_emails utworzona z domyślnymi emailami")
        else:
            logger.info("Tabela whitelist_emails już istnieje")
            
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia tabeli whitelist_emails: {e}")
        raise

def archive_completed_requests():
    """Archiwizuje zakończone prośby i ustawia status na OCZEKUJACE w skrzynce"""
    try:
        db = get_db()
        
        # Pobierz zakończone prośby o zamianę
        completed_swaps = db.execute("""
            SELECT * FROM swap_requests 
            WHERE boss_status IN ('APPROVED', 'REJECTED')
        """).fetchall()
        
        # Pobierz zakończone niedyspozycje
        completed_unavail = db.execute("""
            SELECT ur.*, e.name as employee_name
            FROM unavailability_requests ur
            JOIN employees e ON ur.employee_id = e.id
            WHERE ur.status IN ('APPROVED', 'REJECTED')
        """).fetchall()
        
        archived_count = 0
        
        # Archiwizuj prośby o zamianę
        for swap in completed_swaps:
            # Określ finalny status
            if swap['boss_status'] == 'APPROVED':
                final_status = 'ZATWIERDZONE'
            else:
                final_status = 'ODRZUCONE_PRZEZ_SZEFA'
            
            # Dodaj do historii
            db.execute("""
                INSERT INTO request_history (
                    original_id, type, from_employee, to_employee, 
                    from_date, to_date, comment_requester, final_status,
                    admin_action, created_at, archived_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                swap['id'], 'swap', swap['from_employee'], swap['to_employee'],
                swap['from_date'], swap['to_date'], swap['comment_requester'],
                final_status, swap['boss_status'], swap['created_at']
            ))
            
            # Usuń z aktywnej skrzynki
            db.execute("DELETE FROM swap_requests WHERE id = ?", (swap['id'],))
            archived_count += 1
        
        # Archiwizuj niedyspozycje
        for unavail in completed_unavail:
            # Określ finalny status
            if unavail['status'] == 'APPROVED':
                final_status = 'ZATWIERDZONE'
            else:
                final_status = 'ODRZUCONE'
            
            # Dodaj do historii
            db.execute("""
                INSERT INTO request_history (
                    original_id, type, from_employee, month_year, reason,
                    final_status, admin_action, created_at, archived_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (
                unavail['id'], 'unavailability', unavail['employee_name'],
                unavail['month_year'], unavail['reason'], final_status,
                unavail['status'], unavail['created_at']
            ))
            
            # Usuń z aktywnej skrzynki
            db.execute("DELETE FROM unavailability_requests WHERE id = ?", (unavail['id'],))
            archived_count += 1
        
        db.commit()
        logger.info(f"Zarchiwizowano {archived_count} zakończonych próśb")
        return archived_count
        
    except Exception as e:
        logger.error(f"Błąd podczas archiwizacji próśb: {e}")
        raise

def get_request_history(limit=50, offset=0, request_type=None):
    """Pobiera historię próśb"""
    try:
        db = get_db()
        
        query = "SELECT * FROM request_history"
        params = []
        
        if request_type:
            query += " WHERE type = ?"
            params.append(request_type)
        
        query += " ORDER BY archived_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        history = db.execute(query, params).fetchall()
        
        # Konwertuj na listę słowników
        history_list = []
        for item in history:
            history_list.append({
                'id': item['id'],
                'original_id': item['original_id'],
                'type': item['type'],
                'from_employee': item['from_employee'],
                'to_employee': item['to_employee'],
                'from_date': item['from_date'],
                'to_date': item['to_date'],
                'month_year': item['month_year'],
                'reason': item['reason'],
                'comment_requester': item['comment_requester'],
                'final_status': item['final_status'],
                'admin_action': item['admin_action'],
                'admin_comment': item['admin_comment'],
                'created_at': item['created_at'],
                'archived_at': item['archived_at']
            })
        
        return history_list
        
    except Exception as e:
        logger.error(f"Błąd podczas pobierania historii: {e}")
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

def create_database_indexes():
    """Tworzy indeksy dla wydajności bazy danych"""
    try:
        db = get_db()
        
        # Indeksy dla tabeli users
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub)")
        
        # Indeksy dla tabeli shifts
        db.execute("CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_shifts_employee_id ON shifts(employee_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_shifts_date_employee ON shifts(date, employee_id)")
        
        # Indeksy dla tabeli employees
        db.execute("CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name)")
        
        # Indeksy dla tabeli swap_requests
        db.execute("CREATE INDEX IF NOT EXISTS idx_swap_requests_requester ON swap_requests(requester_user_id)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_swap_requests_from_employee ON swap_requests(from_employee)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_swap_requests_to_employee ON swap_requests(to_employee)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_swap_requests_status ON swap_requests(recipient_status, boss_status)")
        
        # Indeksy dla tabeli schedule_changes
        db.execute("CREATE INDEX IF NOT EXISTS idx_schedule_changes_date ON schedule_changes(date)")
        db.execute("CREATE INDEX IF NOT EXISTS idx_schedule_changes_employee ON schedule_changes(employee_name)")
        
        logger.info("Indeksy bazy danych utworzone pomyślnie")
        
    except Exception as e:
        logger.error(f"Błąd podczas tworzenia indeksów: {e}")
        # Nie rzucamy wyjątku - indeksy to optymalizacja, nie krytyczna funkcjonalność

def init_app(app):
    """Inicjalizuj moduł bazy danych z aplikacją Flask"""
    app.teardown_appcontext(close_db)
