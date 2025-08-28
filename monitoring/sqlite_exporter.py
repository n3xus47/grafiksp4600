#!/usr/bin/env python3
"""
SQLite Exporter dla Prometheus
Eksportuje metryki z bazy danych SQLite aplikacji GRAFIKSP4600
"""

import os
import sqlite3
import time
from prometheus_client import start_http_server, Gauge, Counter, Histogram, Summary
from flask import Flask, request, jsonify
import logging

# Konfiguracja logowania
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Metryki Prometheus
DB_SIZE = Gauge('sqlite_database_size_bytes', 'Rozmiar bazy danych w bajtach')
DB_TABLES = Gauge('sqlite_tables_total', 'Liczba tabel w bazie danych')
DB_RECORDS = Gauge('sqlite_records_total', 'Liczba rekordów w tabeli', ['table'])
DB_CONNECTIONS = Gauge('sqlite_connections_active', 'Liczba aktywnych połączeń')
DB_QUERY_DURATION = Histogram('sqlite_query_duration_seconds', 'Czas wykonania zapytań', ['query_type'])
DB_ERRORS = Counter('sqlite_errors_total', 'Liczba błędów bazy danych', ['error_type'])

# Flask app
app = Flask(__name__)

class SQLiteExporter:
    """Eksporter metryk SQLite"""
    
    def __init__(self, db_path):
        self.db_path = db_path
        self.last_check = 0
        self.check_interval = 30  # sekundy
        
    def get_db_size(self):
        """Pobierz rozmiar bazy danych"""
        try:
            if os.path.exists(self.db_path):
                size = os.path.getsize(self.db_path)
                DB_SIZE.set(size)
                return size
            else:
                DB_SIZE.set(0)
                return 0
        except Exception as e:
            logger.error(f"Błąd podczas pobierania rozmiaru bazy: {e}")
            DB_ERRORS.labels(error_type="size_check").inc()
            return 0
    
    def get_table_info(self):
        """Pobierz informacje o tabelach"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Pobierz listę tabel
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            DB_TABLES.set(len(tables))
            
            # Pobierz liczbę rekordów w każdej tabeli
            for table in tables:
                table_name = table[0]
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count = cursor.fetchone()[0]
                    DB_RECORDS.labels(table=table_name).set(count)
                except Exception as e:
                    logger.warning(f"Nie można policzyć rekordów w tabeli {table_name}: {e}")
                    DB_RECORDS.labels(table=table_name).set(0)
            
            conn.close()
            return len(tables)
            
        except Exception as e:
            logger.error(f"Błąd podczas pobierania informacji o tabelach: {e}")
            DB_ERRORS.labels(error_type="table_info").inc()
            return 0
    
    def get_connection_info(self):
        """Pobierz informacje o połączeniach"""
        try:
            # W SQLite nie ma prawdziwych połączeń, ale możemy symulować
            # na podstawie aktywnych procesów
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Sprawdź czy baza jest dostępna
            cursor.execute("SELECT 1")
            cursor.fetchone()
            
            # Symuluj liczbę połączeń (w rzeczywistości zawsze 1 dla SQLite)
            DB_CONNECTIONS.set(1)
            
            conn.close()
            return 1
            
        except Exception as e:
            logger.error(f"Błąd podczas sprawdzania połączeń: {e}")
            DB_ERRORS.labels(error_type="connection_check").inc()
            DB_CONNECTIONS.set(0)
            return 0
    
    def check_database_health(self):
        """Sprawdź zdrowie bazy danych"""
        try:
            start_time = time.time()
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Sprawdź integralność bazy
            cursor.execute("PRAGMA integrity_check")
            integrity = cursor.fetchone()
            
            # Sprawdź wersję SQLite
            cursor.execute("SELECT sqlite_version()")
            version = cursor.fetchone()
            
            # Sprawdź ustawienia
            cursor.execute("PRAGMA foreign_keys")
            foreign_keys = cursor.fetchone()
            
            conn.close()
            
            duration = time.time() - start_time
            DB_QUERY_DURATION.labels(query_type="health_check").observe(duration)
            
            logger.info(f"Sprawdzono zdrowie bazy danych w {duration:.3f}s")
            return True
            
        except Exception as e:
            logger.error(f"Błąd podczas sprawdzania zdrowia bazy: {e}")
            DB_ERRORS.labels(error_type="health_check").inc()
            return False
    
    def update_metrics(self):
        """Zaktualizuj wszystkie metryki"""
        current_time = time.time()
        
        # Sprawdź czy minął interwał
        if current_time - self.last_check < self.check_interval:
            return
        
        logger.info("Aktualizuję metryki SQLite...")
        
        # Pobierz metryki
        self.get_db_size()
        self.get_table_info()
        self.get_connection_info()
        self.check_database_health()
        
        self.last_check = current_time
        logger.info("Metryki SQLite zaktualizowane")

# Inicjalizacja eksportera
db_path = os.getenv('DB_PATH', '/app/db/app.db')
exporter = SQLiteExporter(db_path)

@app.route('/')
def index():
    """Strona główna"""
    return jsonify({
        'name': 'SQLite Exporter',
        'version': '1.0.0',
        'database': db_path,
        'endpoints': {
            '/': 'Ta strona',
            '/metrics': 'Metryki Prometheus',
            '/health': 'Health check',
            '/info': 'Informacje o bazie danych'
        }
    })

@app.route('/metrics')
def metrics():
    """Endpoint z metrykami Prometheus"""
    # Zaktualizuj metryki
    exporter.update_metrics()
    
    # Zwróć metryki w formacie Prometheus
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/health')
def health():
    """Health check endpoint"""
    try:
        # Sprawdź czy baza istnieje
        if not os.path.exists(db_path):
            return jsonify({'status': 'unhealthy', 'error': 'Database file not found'}), 503
        
        # Sprawdź zdrowie bazy
        if exporter.check_database_health():
            return jsonify({'status': 'healthy'}), 200
        else:
            return jsonify({'status': 'unhealthy', 'error': 'Database health check failed'}), 503
            
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 503

@app.route('/info')
def info():
    """Informacje o bazie danych"""
    try:
        if not os.path.exists(db_path):
            return jsonify({'error': 'Database file not found'}), 404
        
        # Pobierz podstawowe informacje
        size = exporter.get_db_size()
        tables = exporter.get_table_info()
        
        # Pobierz szczegółowe informacje o tabelach
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        table_names = [row[0] for row in cursor.fetchall()]
        
        table_info = {}
        for table in table_names:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                table_info[table] = count
            except:
                table_info[table] = 0
        
        conn.close()
        
        return jsonify({
            'database_path': db_path,
            'size_bytes': size,
            'tables_count': tables,
            'tables': table_info,
            'last_update': time.time()
        })
        
    except Exception as e:
        logger.error(f"Error getting database info: {e}")
        return jsonify({'error': str(e)}), 500

def main():
    """Główna funkcja"""
    logger.info(f"Uruchamiam SQLite Exporter dla bazy: {db_path}")
    
    # Sprawdź czy baza istnieje
    if not os.path.exists(db_path):
        logger.warning(f"Plik bazy danych nie istnieje: {db_path}")
    
    # Uruchom serwer HTTP dla metryk Prometheus
    start_http_server(9114)
    logger.info("Serwer HTTP uruchomiony na porcie 9114")
    
    # Uruchom Flask app
    app.run(host='0.0.0.0', port=9114, debug=False)

if __name__ == '__main__':
    main()
