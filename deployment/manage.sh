#!/bin/bash
# Skrypt zarządzania aplikacją GRAFIKSP4600

set -e

# Kolory dla output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Konfiguracja
APP_NAME="grafiksp4600"
APP_USER="grafiksp4600"
APP_DIR="/opt/$APP_NAME"
SERVICE_NAME="$APP_NAME.service"

# Funkcje pomocnicze
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Sprawdź czy aplikacja jest zainstalowana
check_installation() {
    if [ ! -d "$APP_DIR" ]; then
        log_error "Aplikacja $APP_NAME nie jest zainstalowana w $APP_DIR"
        log_info "Uruchom najpierw skrypt instalacyjny: ./deployment/install.sh"
        exit 1
    fi
    
    if [ ! -f "/etc/systemd/system/$SERVICE_NAME" ]; then
        log_error "Service systemd $SERVICE_NAME nie istnieje"
        exit 1
    fi
}

# Funkcja pomocnicza
show_help() {
    echo "Użycie: $0 [OPCJA]"
    echo
    echo "Opcje:"
    echo "  start       - Uruchom aplikację"
    echo "  stop        - Zatrzymaj aplikację"
    echo "  restart     - Uruchom ponownie aplikację"
    echo "  status      - Pokaż status aplikacji"
    echo "  logs        - Pokaż logi aplikacji (live)"
    echo "  logs-tail   - Pokaż ostatnie logi"
    echo "  backup      - Utwórz backup bazy danych"
    echo "  restore     - Przywróć backup bazy danych"
    echo "  update      - Zaktualizuj aplikację z git"
    echo "  deploy      - Wdróż nową wersję"
    echo "  shell       - Otwórz shell w wirtualnym środowisku"
    echo "  test        - Uruchom testy"
    echo "  clean       - Wyczyść pliki tymczasowe i logi"
    echo "  health      - Sprawdź zdrowie aplikacji"
    echo "  help        - Pokaż tę pomoc"
    echo
    echo "Przykłady:"
    echo "  $0 start"
    echo "  $0 logs"
    echo "  $0 backup"
    echo "  $0 update"
}

# Funkcja start
start_app() {
    log_info "Uruchamiam aplikację $APP_NAME..."
    sudo systemctl start $SERVICE_NAME
    
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        log_info "Aplikacja uruchomiona pomyślnie!"
        show_status
    else
        log_error "Błąd podczas uruchamiania aplikacji"
        sudo systemctl status $SERVICE_NAME
        exit 1
    fi
}

# Funkcja stop
stop_app() {
    log_info "Zatrzymuję aplikację $APP_NAME..."
    sudo systemctl stop $SERVICE_NAME
    
    if ! sudo systemctl is-active --quiet $SERVICE_NAME; then
        log_info "Aplikacja zatrzymana pomyślnie!"
    else
        log_error "Błąd podczas zatrzymywania aplikacji"
        exit 1
    fi
}

# Funkcja restart
restart_app() {
    log_info "Uruchamiam ponownie aplikację $APP_NAME..."
    sudo systemctl restart $SERVICE_NAME
    
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        log_info "Aplikacja uruchomiona ponownie pomyślnie!"
        show_status
    else
        log_error "Błąd podczas uruchamiania ponownego aplikacji"
        sudo systemctl status $SERVICE_NAME
        exit 1
    fi
}

# Funkcja status
show_status() {
    echo
    log_info "Status aplikacji $APP_NAME:"
    echo "----------------------------------------"
    sudo systemctl status $SERVICE_NAME --no-pager -l
    echo "----------------------------------------"
    
    # Pokaż informacje o procesie
    if pgrep -f "gunicorn.*$APP_NAME" > /dev/null; then
        echo
        log_info "Procesy aplikacji:"
        ps aux | grep -E "(gunicorn|$APP_NAME)" | grep -v grep
    fi
    
    # Pokaż informacje o portach
    echo
    log_info "Porty nasłuchujące:"
    netstat -tlnp | grep -E "(8000|80|443)" || echo "Brak aktywnych portów"
}

# Funkcja logi
show_logs() {
    log_info "Pokażę logi aplikacji $APP_NAME (live)..."
    echo "Naciśnij Ctrl+C aby zatrzymać"
    sudo journalctl -u $SERVICE_NAME -f
}

# Funkcja logi tail
show_logs_tail() {
    log_info "Ostatnie logi aplikacji $APP_NAME:"
    sudo journalctl -u $SERVICE_NAME --no-pager -n 50
}

# Funkcja backup
create_backup() {
    log_info "Tworzę backup bazy danych..."
    
    BACKUP_DIR="/var/backups/$APP_NAME"
    BACKUP_FILE="$BACKUP_DIR/app.db.backup.$(date +%Y%m%d_%H%M%S)"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        sudo mkdir -p "$BACKUP_DIR"
        sudo chown $APP_USER:$APP_USER "$BACKUP_DIR"
    fi
    
    if [ -f "$APP_DIR/app.db" ]; then
        sudo cp "$APP_DIR/app.db" "$BACKUP_FILE"
        sudo chown $APP_USER:$APP_USER "$BACKUP_FILE"
        log_info "Backup utworzony: $BACKUP_FILE"
        
        # Pokaż listę backupów
        echo
        log_info "Lista dostępnych backupów:"
        ls -la "$BACKUP_DIR"/*.backup.* 2>/dev/null | head -10 || echo "Brak backupów"
    else
        log_error "Baza danych nie istnieje: $APP_DIR/app.db"
        exit 1
    fi
}

# Funkcja restore
restore_backup() {
    log_info "Przywracam backup bazy danych..."
    
    BACKUP_DIR="/var/backups/$APP_NAME"
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "Katalog backupów nie istnieje: $BACKUP_DIR"
        exit 1
    fi
    
    # Pokaż dostępne backupy
    echo
    log_info "Dostępne backupy:"
    ls -la "$BACKUP_DIR"/*.backup.* 2>/dev/null || {
        log_error "Brak dostępnych backupów"
        exit 1
    }
    
    # Poproś o wybór backupu
    echo
    read -p "Podaj nazwę pliku backupu do przywrócenia: " BACKUP_FILE
    
    if [ ! -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        log_error "Plik backupu nie istnieje: $BACKUP_DIR/$BACKUP_FILE"
        exit 1
    fi
    
    # Zatrzymaj aplikację
    log_info "Zatrzymuję aplikację przed przywróceniem..."
    sudo systemctl stop $SERVICE_NAME
    
    # Utwórz backup aktualnej bazy
    CURRENT_BACKUP="$BACKUP_DIR/app.db.current.$(date +%Y%m%d_%H%M%S)"
    sudo cp "$APP_DIR/app.db" "$CURRENT_BACKUP"
    log_info "Utworzono backup aktualnej bazy: $CURRENT_BACKUP"
    
    # Przywróć backup
    sudo cp "$BACKUP_DIR/$BACKUP_FILE" "$APP_DIR/app.db"
    sudo chown $APP_USER:$APP_USER "$APP_DIR/app.db"
    log_info "Backup przywrócony: $BACKUP_FILE"
    
    # Uruchom aplikację
    log_info "Uruchamiam aplikację..."
    sudo systemctl start $SERVICE_NAME
    
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        log_info "Backup przywrócony pomyślnie!"
    else
        log_error "Błąd podczas uruchamiania aplikacji po przywróceniu"
        log_warn "Możesz przywrócić poprzednią wersję: $CURRENT_BACKUP"
        exit 1
    fi
}

# Funkcja update
update_app() {
    log_info "Aktualizuję aplikację $APP_NAME..."
    
    # Sprawdź czy jest git repository
    if [ ! -d "$APP_DIR/.git" ]; then
        log_error "Katalog $APP_DIR nie jest git repository"
        exit 1
    fi
    
    # Zatrzymaj aplikację
    log_info "Zatrzymuję aplikację..."
    sudo systemctl stop $SERVICE_NAME
    
    # Utwórz backup
    create_backup
    
    # Pobierz zmiany
    cd "$APP_DIR"
    log_info "Pobieram zmiany z git..."
    sudo -u $APP_USER git fetch origin
    
    # Sprawdź czy są zmiany
    LOCAL_COMMIT=$(sudo -u $APP_USER git rev-parse HEAD)
    REMOTE_COMMIT=$(sudo -u $APP_USER git rev-parse origin/main)
    
    if [ "$LOCAL_COMMIT" = "$REMOTE_COMMIT" ]; then
        log_info "Aplikacja jest aktualna"
        sudo systemctl start $SERVICE_NAME
        return
    fi
    
    # Zaktualizuj kod
    log_info "Aktualizuję kod aplikacji..."
    sudo -u $APP_USER git reset --hard origin/main
    
    # Zaktualizuj zależności
    log_info "Aktualizuję zależności Python..."
    sudo -u $APP_USER "$APP_DIR/venv/bin/pip" install -r requirements.txt
    
    # Uruchom migracje bazy danych
    log_info "Uruchamiam migracje bazy danych..."
    sudo -u $APP_USER "$APP_DIR/venv/bin/flask" init-db
    
    # Uruchom aplikację
    log_info "Uruchamiam aplikację..."
    sudo systemctl start $SERVICE_NAME
    
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        log_info "Aplikacja zaktualizowana i uruchomiona pomyślnie!"
        show_status
    else
        log_error "Błąd podczas uruchamiania aplikacji po aktualizacji"
        exit 1
    fi
}

# Funkcja deploy
deploy_app() {
    log_info "Wdrażam nową wersję aplikacji $APP_NAME..."
    
    # Sprawdź czy jest git repository
    if [ ! -d "$APP_DIR/.git" ]; then
        log_error "Katalog $APP_DIR nie jest git repository"
        exit 1
    fi
    
    # Sprawdź czy są niezacommitowane zmiany
    cd "$APP_DIR"
    if [ -n "$(sudo -u $APP_USER git status --porcelain)" ]; then
        log_warn "Wykryto niezacommitowane zmiany w $APP_DIR"
        read -p "Czy chcesz kontynuować? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Wdrażanie anulowane"
            return
        fi
    fi
    
    # Wykonaj update
    update_app
}

# Funkcja shell
open_shell() {
    log_info "Otwieram shell w wirtualnym środowisku Python..."
    cd "$APP_DIR"
    sudo -u $APP_USER bash -c "source venv/bin/activate && exec bash"
}

# Funkcja test
run_tests() {
    log_info "Uruchamiam testy aplikacji..."
    
    cd "$APP_DIR"
    
    # Sprawdź czy pytest jest zainstalowany
    if ! sudo -u $APP_USER "$APP_DIR/venv/bin/pip" show pytest > /dev/null 2>&1; then
        log_info "Instaluję pytest..."
        sudo -u $APP_USER "$APP_DIR/venv/bin/pip" install -r requirements-dev.txt
    fi
    
    # Uruchom testy
    sudo -u $APP_USER "$APP_DIR/venv/bin/python" -m pytest tests/ -v
}

# Funkcja clean
clean_app() {
    log_info "Czyczę pliki tymczasowe i logi..."
    
    # Wyczyść logi aplikacji
    if [ -d "/var/log/$APP_NAME" ]; then
        sudo find /var/log/$APP_NAME -name "*.log" -type f -delete
        log_info "Logi aplikacji wyczyszczone"
    fi
    
    # Wyczyść cache Python
    if [ -d "$APP_DIR" ]; then
        sudo find "$APP_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
        sudo find "$APP_DIR" -name "*.pyc" -type f -delete 2>/dev/null || true
        log_info "Cache Python wyczyszczony"
    fi
    
    # Wyczyść pliki tymczasowe
    sudo find /tmp -name "*$APP_NAME*" -type f -delete 2>/dev/null || true
    log_info "Pliki tymczasowe wyczyszczone"
}

# Funkcja health
check_health() {
    log_info "Sprawdzam zdrowie aplikacji $APP_NAME..."
    
    # Sprawdź status systemd
    if sudo systemctl is-active --quiet $SERVICE_NAME; then
        log_info "✓ Service systemd: AKTYWNY"
    else
        log_error "✗ Service systemd: NIEAKTYWNY"
        return 1
    fi
    
    # Sprawdź procesy
    if pgrep -f "gunicorn.*$APP_NAME" > /dev/null; then
        log_info "✓ Procesy aplikacji: DZIAŁAJĄ"
    else
        log_error "✗ Procesy aplikacji: NIE DZIAŁAJĄ"
        return 1
    fi
    
    # Sprawdź porty
    if netstat -tlnp | grep -q ":8000"; then
        log_info "✓ Port 8000: NASŁUCHUJE"
    else
        log_error "✗ Port 8000: NIE NASŁUCHUJE"
        return 1
    fi
    
    # Sprawdź bazę danych
    if [ -f "$APP_DIR/app.db" ]; then
        log_info "✓ Baza danych: ISTNIEJE"
    else
        log_error "✗ Baza danych: NIE ISTNIEJE"
        return 1
    fi
    
    # Sprawdź uprawnienia
    if [ -r "$APP_DIR/app.db" ] && [ -w "$APP_DIR/app.db" ]; then
        log_info "✓ Uprawnienia bazy danych: OK"
    else
        log_error "✗ Uprawnienia bazy danych: BŁĘDNE"
        return 1
    fi
    
    log_info "✓ Aplikacja jest zdrowa!"
}

# Główna logika
main() {
    # Sprawdź czy aplikacja jest zainstalowana
    check_installation
    
    # Sprawdź argumenty
    case "${1:-help}" in
        start)
            start_app
            ;;
        stop)
            stop_app
            ;;
        restart)
            restart_app
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        logs-tail)
            show_logs_tail
            ;;
        backup)
            create_backup
            ;;
        restore)
            restore_backup
            ;;
        update)
            update_app
            ;;
        deploy)
            deploy_app
            ;;
        shell)
            open_shell
            ;;
        test)
            run_tests
            ;;
        clean)
            clean_app
            ;;
        health)
            check_health
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Nieznana opcja: $1"
            show_help
            exit 1
            ;;
    esac
}

# Uruchom główną funkcję
main "$@"
