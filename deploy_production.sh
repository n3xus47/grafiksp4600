#!/bin/bash
# Skrypt wdrożenia produkcyjnego dla GRAFIKSP4600

set -e

# Kolory dla output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
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
DOMAIN=""
EMAIL=""

# Funkcja do pobierania danych od użytkownika
get_user_input() {
    echo
    log_step "Konfiguracja wdrożenia"
    echo "=========================="
    
    while [[ -z "$DOMAIN" ]]; do
        read -p "Podaj nazwę domeny (np. grafiksp4600.pl): " DOMAIN
        if [[ -z "$DOMAIN" ]]; then
            log_error "Domena nie może być pusta"
        fi
    done
    
    while [[ -z "$EMAIL" ]]; do
        read -p "Podaj email administratora (dla certyfikatów SSL): " EMAIL
        if [[ -z "$EMAIL" ]]; then
            log_error "Email nie może być pusty"
        fi
    done
    
    echo
    log_info "Konfiguracja:"
    echo "  Domena: $DOMAIN"
    echo "  Email: $EMAIL"
    echo "  Katalog aplikacji: $APP_DIR"
    echo
    
    read -p "Czy chcesz kontynuować? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Anulowano wdrożenie"
        exit 0
    fi
}

# Aktualizacja systemu
update_system() {
    log_step "Aktualizacja systemu"
    
    sudo apt update
    sudo apt upgrade -y
    sudo apt install -y curl wget git ufw fail2ban
}

# Instalacja wymaganych pakietów
install_packages() {
    log_step "Instalacja wymaganych pakietów"
    
    # Podstawowe pakiety
    sudo apt install -y python3 python3-pip python3-venv python3-dev
    
    # Nginx
    sudo apt install -y nginx
    
    # Certbot dla SSL
    sudo apt install -y certbot python3-certbot-nginx
    
    # Inne przydatne pakiety
    sudo apt install -y sqlite3 supervisor
}

# Konfiguracja firewalla
setup_firewall() {
    log_step "Konfiguracja firewalla"
    
    sudo ufw --force reset
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    sudo ufw allow ssh
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw --force enable
    
    log_info "Firewall skonfigurowany"
}

# Konfiguracja fail2ban
setup_fail2ban() {
    log_step "Konfiguracja fail2ban"
    
    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    
    log_info "Fail2ban skonfigurowany"
}

# Utworzenie użytkownika aplikacji
create_app_user() {
    log_step "Tworzenie użytkownika aplikacji"
    
    if ! getent group $APP_GROUP > /dev/null 2>&1; then
        sudo groupadd $APP_GROUP
        log_info "Grupa $APP_GROUP utworzona"
    fi
    
    if ! getent passwd $APP_USER > /dev/null 2>&1; then
        sudo useradd -r -g $APP_GROUP -d $APP_DIR -s /bin/false $APP_USER
        log_info "Użytkownik $APP_USER utworzony"
    fi
    
    sudo mkdir -p $APP_DIR
    sudo chown $APP_USER:$APP_GROUP $APP_DIR
}

# Instalacja aplikacji
install_application() {
    log_step "Instalacja aplikacji"
    
    # Skopiuj pliki aplikacji
    sudo cp -r . $APP_DIR/
    sudo chown -R $APP_USER:$APP_GROUP $APP_DIR
    
    # Utwórz wirtualne środowisko
    cd $APP_DIR
    sudo -u $APP_USER python3 -m venv venv
    sudo -u $APP_USER $APP_DIR/venv/bin/pip install --upgrade pip
    sudo -u $APP_USER $APP_DIR/venv/bin/pip install -r requirements.txt
    sudo -u $APP_USER $APP_DIR/venv/bin/pip install gunicorn
    
    # Utwórz katalogi logów
    sudo mkdir -p /var/log/$APP_NAME
    sudo chown -R $APP_USER:$APP_GROUP /var/log/$APP_NAME
}

# Konfiguracja systemd service
setup_systemd() {
    log_step "Konfiguracja systemd service"
    
    sudo cp $APP_DIR/deployment/$APP_NAME.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable $APP_NAME
}

# Konfiguracja Nginx
setup_nginx() {
    log_step "Konfiguracja Nginx"
    
    # Utwórz konfigurację dla domeny
    sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Przekierowanie na HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL configuration (będzie automatycznie skonfigurowane przez certbot)
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;
    
        alias $APP_DIR/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /healthz {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Login endpoints with stricter rate limiting
    location /login/ {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Auth callback
    location /authorize {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Main application
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
EOF
    
    # Włącz konfigurację
    sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test konfiguracji
    sudo nginx -t
    sudo systemctl reload nginx
    
    log_info "Nginx skonfigurowany"
}

# Konfiguracja SSL
setup_ssl() {
    log_step "Konfiguracja SSL"
    
    # Zatrzymaj nginx przed certbot
    sudo systemctl stop nginx
    
    # Uzyskaj certyfikat SSL
    sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive
    
    # Uruchom nginx ponownie
    sudo systemctl start nginx
    
    # Automatyczne odnowienie certyfikatów
    sudo crontab -l 2>/dev/null | { cat; echo "0 12 * * * /usr/bin/certbot renew --quiet"; } | sudo crontab -
    
    log_info "SSL skonfigurowany"
}

# Konfiguracja aplikacji
configure_app() {
    log_step "Konfiguracja aplikacji"
    
    # Utwórz plik .env
    sudo -u $APP_USER tee $APP_DIR/.env > /dev/null <<EOF
# Konfiguracja produkcyjna GRAFIKSP4600
FLASK_ENV=production
SECRET_KEY=$(openssl rand -hex 32)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
SERVER_NAME=$DOMAIN
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_HTTPONLY=true
SESSION_COOKIE_SAMESITE=Lax
WHITELIST_EMAILS=official221team@gmail.com,nikodemboniecki1@gmail.com,bonieckinikodem0@gmail.com
EOF
    
    log_warn "Plik .env utworzony - uzupełnij GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET!"
}

# Uruchomienie aplikacji
start_application() {
    log_step "Uruchomienie aplikacji"
    
    sudo systemctl start $APP_NAME
    
    if sudo systemctl is-active --quiet $APP_NAME; then
        log_info "Aplikacja uruchomiona pomyślnie!"
    else
        log_error "Błąd podczas uruchamiania aplikacji"
        sudo systemctl status $APP_NAME
        exit 1
    fi
}

# Test aplikacji
test_application() {
    log_step "Test aplikacji"
    
    # Poczekaj na uruchomienie
    sleep 5
    
    # Test HTTP
    if curl -f -s "http://$DOMAIN" > /dev/null; then
        log_info "HTTP redirect działa"
    else
        log_warn "HTTP redirect może nie działać"
    fi
    
    # Test HTTPS
    if curl -f -s "https://$DOMAIN" > /dev/null; then
        log_info "HTTPS działa"
    else
        log_error "HTTPS nie działa"
    fi
    
    # Test health check
    if curl -f -s "https://$DOMAIN/healthz" | grep -q "healthy"; then
        log_info "Health check działa"
    else
        log_warn "Health check może nie działać"
    fi
}

# Instrukcje końcowe
show_final_instructions() {
    echo
    log_info "🎉 Wdrożenie zakończone pomyślnie!"
    echo
    echo "📋 Następne kroki:"
    echo "1. Edytuj plik $APP_DIR/.env i uzupełnij:"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET"
    echo
    echo "2. Zaktualizuj Google OAuth2:"
    echo "   - Dodaj redirect URI: https://$DOMAIN/authorize"
    echo
    echo "3. Uruchom ponownie aplikację:"
    echo "   sudo systemctl restart $APP_NAME"
    echo
    echo "4. Sprawdź logi:"
    echo "   sudo journalctl -u $APP_NAME -f"
    echo
    echo "🌐 Aplikacja dostępna pod adresem:"
    echo "   - HTTPS: https://$DOMAIN"
    echo "   - HTTP: http://$DOMAIN (przekieruje na HTTPS)"
    echo
    echo "🔧 Zarządzanie:"
    echo "   - Start: sudo systemctl start $APP_NAME"
    echo "   - Stop: sudo systemctl stop $APP_NAME"
    echo "   - Restart: sudo systemctl restart $APP_NAME"
    echo "   - Status: sudo systemctl status $APP_NAME"
    echo
    echo "📚 Logi:"
    echo "   - Aplikacja: sudo journalctl -u $APP_NAME -f"
    echo "   - Nginx: sudo tail -f /var/log/nginx/access.log"
    echo
    echo "🔒 Bezpieczeństwo:"
    echo "   - Firewall: sudo ufw status"
    echo "   - Fail2ban: sudo fail2ban-client status"
    echo
}

# Główna funkcja
main() {
    echo "🚀 Wdrażanie aplikacji GRAFIKSP4600 na serwer produkcyjny"
    echo "=========================================================="
    echo
    
    get_user_input
    
    update_system
    install_packages
    setup_firewall
    setup_fail2ban
    create_app_user
    install_application
    setup_systemd
    setup_nginx
    setup_ssl
    configure_app
    start_application
    test_application
    show_final_instructions
}

# Uruchom główną funkcję
main "$@"
