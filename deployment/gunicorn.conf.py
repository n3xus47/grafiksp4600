# Konfiguracja Gunicorn dla aplikacji GRAFIKSP4600

import os
import multiprocessing

# Ścieżka do aplikacji
bind = "127.0.0.1:8000"
backlog = 2048

# Liczba workerów
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50

# Timeout
timeout = 30
keepalive = 2
graceful_timeout = 30

# Logowanie
accesslog = "/var/log/grafiksp4600/gunicorn_access.log"
errorlog = "/var/log/grafiksp4600/gunicorn_error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Użytkownik i grupa
user = "grafiksp4600"
group = "grafiksp4600"

# Katalog roboczy
chdir = "/opt/grafiksp4600"

# Preload aplikacji
preload_app = True

# Restart workerów
max_requests = 1000
max_requests_jitter = 50

# Limity pamięci
worker_tmp_dir = "/dev/shm"
worker_exit_on_app = False

# Bezpieczeństwo
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Hooki
def on_starting(server):
    """Hook wywoływany przy starcie serwera"""
    server.log.info("Gunicorn startuje...")

def on_reload(server):
    """Hook wywoływany przy przeładowaniu"""
    server.log.info("Gunicorn przeładowuje...")

def worker_int(worker):
    """Hook wywoływany przy przerwaniu workera"""
    worker.log.info("Worker przerwany")

def pre_fork(server, worker):
    """Hook wywoływany przed forkowaniem workera"""
    server.log.info("Worker %s będzie utworzony", worker.pid)

def post_fork(server, worker):
    """Hook wywoływany po utworzeniu workera"""
    server.log.info("Worker %s utworzony", worker.pid)

def post_worker_init(worker):
    """Hook wywoływany po inicjalizacji workera"""
    worker.log.info("Worker %s zainicjalizowany", worker.pid)

def worker_abort(worker):
    """Hook wywoływany przy awaryjnym zakończeniu workera"""
    worker.log.info("Worker %s zakończony awaryjnie", worker.pid)

def pre_exec(server):
    """Hook wywoływany przed exec"""
    server.log.info("Gunicorn wykonuje exec")

def when_ready(server):
    """Hook wywoływany gdy serwer jest gotowy"""
    server.log.info("Gunicorn jest gotowy do obsługi żądań")

def on_exit(server):
    """Hook wywoływany przy wyjściu"""
    server.log.info("Gunicorn kończy pracę")

# Konfiguracja dla różnych środowisk
if os.getenv("FLASK_ENV") == "production":
    # Produkcja - więcej workerów, mniej logowania
    workers = multiprocessing.cpu_count() * 2 + 1
    loglevel = "warning"
    accesslog = None  # Wyłącz logi dostępu w produkcji
    max_requests = 2000
    max_requests_jitter = 100
    
elif os.getenv("FLASK_ENV") == "testing":
    # Testy - mniej workerów, więcej logowania
    workers = 1
    loglevel = "debug"
    max_requests = 100
    
else:
    # Development - domyślne ustawienia
    workers = 2
    loglevel = "info"
    reload = True
    reload_extra_files = [
        "/opt/grafiksp4600/app.py",
        "/opt/grafiksp4600/static/",
        "/opt/grafiksp4600/templates/"
    ]
