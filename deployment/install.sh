#!/bin/bash
# Skrypt instalacyjny dla aplikacji GRAFIKSP4600

set -e

# Kolory dla output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Sprawdź czy skrypt jest uruchomiony jako root
if [[ $EUID -eq 0 ]]; then
   log_error "Ten skrypt nie powinien być uruchomiony jako root"
   exit 1
fi

# Konfiguracja
APP_NAME="grafiksp4600"
APP_USER="grafiksp4600"
APP_GROUP="grafiksp4600"
APP_DIR="/opt/$APP_NAME"
SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"
LOGROTATE_FILE="/etc/logrotate.d/$APP_NAME"
NGINX_CONF="/etc/nginx/sites-available/$APP_NAME"
NGINX_ENABLED="/etc/nginx/sites-enabled/$APP_NAME"

log_info "Rozpoczynam instalację aplikacji $APP_NAME..."

# Sprawdź wymagania systemowe
log_info "Sprawdzam wymagania systemowe..."

# Sprawdź Python
if ! command -v python3 &> /dev/null; then
    log_error "Python 3 nie jest zainstalowany"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
if [[ $(echo "$PYTHON_VERSION >= 3.8" | bc -l) -eq 0 ]]; then
    log_error "Wymagany Python 3.8+, znaleziono $PYTHON_VERSION"
    exit 1
fi

log_info "Python $PYTHON_VERSION - OK"

# Sprawdź pip
if ! command -v pip3 &> /dev/null; then
    log_error "pip3 nie jest zainstalowany"
    exit 1
fi

log_info "pip3 - OK"

# Sprawdź nginx
if ! command -v nginx &> /dev/null; then
    log_warn "nginx nie jest zainstalowany - pomijam konfigurację nginx"
    NGINX_AVAILABLE=false
else
    NGINX_AVAILABLE=true
    log_info "nginx - OK"
fi

# Sprawdź systemd
if ! command -v systemctl &> /dev/null; then
    log_error "systemd nie jest dostępny - ten skrypt wymaga systemd"
    exit 1
fi

log_info "systemd - OK"

# Utwórz użytkownika i grupę
log_info "Tworzę użytkownika i grupę systemową..."

if ! getent group $APP_GROUP > /dev/null 2>&1; then
    sudo groupadd $APP_GROUP
    log_info "Grupa $APP_GROUP utworzona"
else
    log_info "Grupa $APP_GROUP już istnieje"
fi

if ! getent passwd $APP_USER > /dev/null 2>&1; then
    sudo useradd -r -g $APP_GROUP -d $APP_DIR -s /bin/false $APP_USER
    log_info "Użytkownik $APP_USER utworzony"
else
    log_info "Użytkownik $APP_USER już istnieje"
fi

# Utwórz katalogi aplikacji
log_info "Tworzę katalogi aplikacji..."

sudo mkdir -p $APP_DIR
sudo mkdir -p /var/log/$APP_NAME
sudo mkdir -p /var/backups/$APP_NAME

# Skopiuj pliki aplikacji
log_info "Kopiuję pliki aplikacji..."

sudo cp -r . $APP_DIR/
sudo chown -R $APP_USER:$APP_GROUP $APP_DIR
sudo chmod -R 755 $APP_DIR

# Utwórz wirtualne środowisko Python
log_info "Tworzę wirtualne środowisko Python..."

cd $APP_DIR
sudo -u $APP_USER python3 -m venv venv
sudo -u $APP_USER $APP_DIR/venv/bin/pip install --upgrade pip
sudo -u $APP_USER $APP_DIR/venv/bin/pip install -r requirements.txt

# Zainicjalizuj bazę danych
log_info "Inicjalizuję bazę danych..."

if [ -f "$APP_DIR/app.db" ]; then
    log_warn "Baza danych już istnieje - tworzę backup"
    sudo cp $APP_DIR/app.db /var/backups/$APP_NAME/app.db.backup.$(date +%Y%m%d_%H%M%S)
fi

sudo -u $APP_USER $APP_DIR/venv/bin/flask init-db

# Skonfiguruj systemd service
log_info "Konfiguruję systemd service..."

sudo cp $APP_DIR/deployment/$APP_NAME.service $SERVICE_FILE
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME

# Skonfiguruj logrotate
log_info "Konfiguruję logrotate..."

sudo cp $APP_DIR/deployment/$APP_NAME.logrotate $LOGROTATE_FILE
sudo chown root:root $LOGROTATE_FILE
sudo chmod 644 $LOGROTATE_FILE

# Skonfiguruj nginx (jeśli dostępny)
if [ "$NGINX_AVAILABLE" = true ]; then
    log_info "Konfiguruję nginx..."
    
    # Sprawdź czy istnieje konfiguracja SSL
    if [ -d "/etc/nginx/ssl" ]; then
        sudo cp $APP_DIR/nginx.conf $NGINX_CONF
        log_info "Konfiguracja nginx z SSL skopiowana"
    else
        log_warn "Katalog SSL nginx nie istnieje - skonfiguruj SSL ręcznie"
        # Utwórz podstawową konfigurację bez SSL
        sudo sed 's/listen 443 ssl http2;/# listen 443 ssl http2;/' $APP_DIR/nginx.conf > /tmp/nginx_basic.conf
        sudo sed -i 's/ssl_certificate/# ssl_certificate/' /tmp/nginx_basic.conf
        sudo sed -i 's/ssl_certificate_key/# ssl_certificate_key/' /tmp/nginx_basic.conf
        sudo cp /tmp/nginx_basic.conf $NGINX_CONF
        sudo rm /tmp/nginx_basic.conf
        log_info "Podstawowa konfiguracja nginx skopiowana"
    fi
    
    # Włącz konfigurację
    sudo ln -sf $NGINX_CONF $NGINX_ENABLED
    sudo nginx -t
    sudo systemctl reload nginx
    log_info "Nginx skonfigurowany i przeładowany"
fi

# Ustaw uprawnienia
log_info "Ustawiam uprawnienia..."

sudo chown -R $APP_USER:$APP_GROUP /var/log/$APP_NAME
sudo chown -R $APP_USER:$APP_GROUP /var/backups/$APP_NAME
sudo chmod -R 755 /var/log/$APP_NAME
sudo chmod -R 755 /var/backups/$APP_NAME

# Utwórz plik .env jeśli nie istnieje
if [ ! -f "$APP_DIR/.env" ]; then
    log_info "Tworzę plik .env..."
    sudo -u $APP_USER cp $APP_DIR/.env.example $APP_DIR/.env 2>/dev/null || {
        sudo -u $APP_USER touch $APP_DIR/.env
        echo "# Konfiguracja aplikacji $APP_NAME" | sudo -u $APP_USER tee $APP_DIR/.env
        echo "# Uzupełnij te wartości przed uruchomieniem" | sudo -u $APP_USER tee -a $APP_DIR/.env
        echo "FLASK_ENV=production" | sudo -u $APP_USER tee -a $APP_DIR/.env
        echo "SECRET_KEY=change-this-in-production" | sudo -u $APP_USER tee -a $APP_DIR/.env
        echo "GOOGLE_CLIENT_ID=" | sudo -u $APP_USER tee -a $APP_DIR/.env
        echo "GOOGLE_CLIENT_SECRET=" | sudo -u $APP_USER tee -a $APP_DIR/.env
    }
    log_warn "Plik .env utworzony - uzupełnij konfigurację przed uruchomieniem!"
fi

# Uruchom aplikację
log_info "Uruchamiam aplikację..."

sudo systemctl start $APP_NAME

# Sprawdź status
if sudo systemctl is-active --quiet $APP_NAME; then
    log_info "Aplikacja uruchomiona pomyślnie!"
    log_info "Status: $(sudo systemctl is-active $APP_NAME)"
else
    log_error "Błąd podczas uruchamiania aplikacji"
    sudo systemctl status $APP_NAME
    exit 1
fi

# Instrukcje końcowe
echo
log_info "🎉 Instalacja zakończona pomyślnie!"
echo
echo "📋 Następne kroki:"
echo "1. Edytuj plik $APP_DIR/.env i uzupełnij konfigurację"
echo "2. Skonfiguruj Google OAuth2 (GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET)"
echo "3. Uruchom ponownie aplikację: sudo systemctl restart $APP_NAME"
echo "4. Sprawdź logi: sudo journalctl -u $APP_NAME -f"
echo
echo "🌐 Aplikacja będzie dostępna pod adresem:"
if [ "$NGINX_AVAILABLE" = true ]; then
    echo "   - HTTP: http://$(hostname -I | awk '{print $1}')"
    echo "   - HTTPS: https://$(hostname -I | awk '{print $1}') (jeśli SSL skonfigurowane)"
else
    echo "   - HTTP: http://$(hostname -I | awk '{print $1}'):8000"
fi
echo
echo "📚 Dokumentacja: $APP_DIR/README.md"
echo "🔧 Zarządzanie: sudo systemctl {start|stop|restart|status} $APP_NAME"
echo
