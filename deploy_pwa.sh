#!/bin/bash

# Skrypt wdrażania PWA na serwer DigitalOcean
# Użycie: ./deploy_pwa.sh

echo "🚀 Wdrażanie PWA na serwer produkcyjny..."

# Kolory dla lepszej czytelności
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SERVER_IP="46.101.144.141"
DOMAIN="grafik4600.com"
SERVER_USER="root"  # Zmień na właściwego użytkownika
APP_PATH="/var/www/grafiksp4600"  # Zmień na właściwą ścieżkę

echo -e "${BLUE}📋 Sprawdzanie połączenia z serwerem...${NC}"
if ! ping -c 1 $SERVER_IP &> /dev/null; then
    echo -e "${RED}❌ Nie można połączyć się z serwerem $SERVER_IP${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Serwer odpowiada${NC}"

echo -e "${BLUE}📦 Przygotowywanie plików do wdrożenia...${NC}"

# Utwórz tymczasowy folder z plikami do wdrożenia
TEMP_DIR="/tmp/pwa_deploy_$(date +%s)"
mkdir -p $TEMP_DIR

# Skopiuj pliki PWA
cp -r static/icons $TEMP_DIR/
cp static/manifest.json $TEMP_DIR/
cp static/sw.js $TEMP_DIR/
cp static/favicon.ico $TEMP_DIR/
cp templates/offline.html $TEMP_DIR/
cp PWA_GUIDE.md $TEMP_DIR/

echo -e "${BLUE}📤 Przygotowywanie skryptu wdrożeniowego...${NC}"

# Utwórz skrypt wdrożeniowy dla serwera
cat > $TEMP_DIR/deploy_on_server.sh << 'EOF'
#!/bin/bash

echo "🔧 Wdrażanie PWA na serwerze..."

APP_PATH="/var/www/grafiksp4600"
BACKUP_PATH="/var/www/grafiksp4600_backup_$(date +%Y%m%d_%H%M%S)"

# Sprawdź czy aplikacja istnieje
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Nie znaleziono aplikacji w $APP_PATH"
    echo "📍 Sprawdź lokalizację aplikacji na serwerze"
    exit 1
fi

# Utwórz backup
echo "💾 Tworzenie backupu..."
cp -r $APP_PATH $BACKUP_PATH

# Wdrażanie plików PWA
echo "📱 Kopiowanie plików PWA..."
cp -r icons $APP_PATH/static/ 2>/dev/null || echo "⚠️  Folder icons już istnieje"
cp manifest.json $APP_PATH/static/
cp sw.js $APP_PATH/static/
cp favicon.ico $APP_PATH/static/
cp offline.html $APP_PATH/templates/

# Sprawdź czy nginx jest zainstalowany
if command -v nginx &> /dev/null; then
    echo "🌐 Aktualizacja konfiguracji Nginx..."
    
    # Backup konfiguracji nginx
    cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%Y%m%d_%H%M%S)
    
    # Dodaj konfigurację PWA do nginx
    cat >> /etc/nginx/sites-available/default << 'NGINX_EOF'

# PWA Configuration
location /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}

location /manifest.json {
    add_header Cache-Control "max-age=3600";
    add_header Content-Type "application/json";
}

location ~* \.(png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
NGINX_EOF

    echo "🔄 Restartowanie Nginx..."
    nginx -t && systemctl reload nginx
else
    echo "⚠️  Nginx nie znaleziony - pomiń konfigurację"
fi

# Sprawdź czy aplikacja używa systemd
if systemctl list-units --full -all | grep -q "grafiksp4600"; then
    echo "🔄 Restartowanie aplikacji..."
    systemctl restart grafiksp4600
fi

# Sprawdź czy aplikacja używa gunicorn
if pgrep -f "gunicorn.*grafiksp4600" > /dev/null; then
    echo "🔄 Restartowanie Gunicorn..."
    pkill -f "gunicorn.*grafiksp4600"
    sleep 2
    # Aplikacja powinna się automatycznie restartować przez systemd
fi

echo "✅ Wdrożenie PWA zakończone!"
echo "📍 Backup utworzony w: $BACKUP_PATH"

# Sprawdź HTTPS
echo "🔒 Sprawdzanie HTTPS..."
if curl -k -s https://grafik4600.com >/dev/null 2>&1; then
    echo "✅ HTTPS działa na grafik4600.com"
    echo "🌐 Sprawdź PWA: https://grafik4600.com"
    echo "📱 Otwórz w Chrome/Safari i sprawdź przycisk instalacji"
else
    echo "❌ HTTPS nie działa - PWA wymaga HTTPS w produkcji!"
    echo "🔧 Sprawdź konfigurację SSL dla grafik4600.com"
fi

EOF

chmod +x $TEMP_DIR/deploy_on_server.sh

echo -e "${YELLOW}📋 Instrukcje wdrożenia:${NC}"
echo -e "${BLUE}1.${NC} Skopiuj pliki na serwer:"
echo "   scp -r $TEMP_DIR/* $SERVER_USER@$SERVER_IP:/tmp/"
echo ""
echo -e "${BLUE}2.${NC} Zaloguj się na serwer:"
echo "   ssh $SERVER_USER@$SERVER_IP"
echo ""
echo -e "${BLUE}3.${NC} Uruchom wdrożenie:"
echo "   cd /tmp && chmod +x deploy_on_server.sh && ./deploy_on_server.sh"
echo ""
echo -e "${BLUE}4.${NC} Sprawdź czy PWA działa:"
echo "   - Otwórz aplikację w Chrome/Safari"
echo "   - Sprawdź DevTools → Application → Manifest"
echo "   - Sprawdź czy pojawia się przycisk instalacji"
echo ""

echo -e "${RED}⚠️  WAŻNE:${NC}"
echo -e "${YELLOW}• PWA wymaga HTTPS w produkcji!${NC}"
echo -e "${YELLOW}• Skonfiguruj SSL certyfikat (np. Let's Encrypt)${NC}"
echo -e "${YELLOW}• Sprawdź czy wszystkie pliki PWA zostały skopiowane${NC}"

echo ""
echo -e "${GREEN}📂 Pliki przygotowane w: $TEMP_DIR${NC}"
echo -e "${GREEN}🚀 Gotowe do wdrożenia!${NC}"
