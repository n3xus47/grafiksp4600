#!/bin/bash

# Bezpieczny skrypt wdrożenia PWA - sprawdza różnice przed mergowaniem
# Użycie: ./safe_deploy.sh

echo "🛡️ Bezpieczne wdrożenie PWA na serwer..."

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER_IP="46.101.144.141"
SERVER_USER="root"
APP_PATH="/var/www/grafiksp4600"
BACKUP_PATH="/var/www/grafiksp4600_backup_$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}📋 Sprawdzanie połączenia z serwerem...${NC}"
if ! ping -c 1 $SERVER_IP &> /dev/null; then
    echo -e "${RED}❌ Nie można połączyć się z serwerem $SERVER_IP${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Serwer odpowiada${NC}"

# Utwórz skrypt sprawdzający dla serwera
cat > /tmp/check_server_changes.sh << 'EOF'
#!/bin/bash

echo "🔍 Sprawdzanie różnic na serwerze..."

APP_PATH="/var/www/grafiksp4600"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Aplikacja nie znaleziona w $APP_PATH"
    exit 1
fi

cd $APP_PATH

echo "📊 Status Git:"
git status

echo ""
echo "📋 Lokalne zmiany (jeśli są):"
if git diff --quiet; then
    echo "✅ Brak lokalnych zmian"
else
    echo "⚠️  Znaleziono lokalne zmiany:"
    git diff --name-only
    echo ""
    echo "🔍 Szczegóły zmian:"
    git diff
fi

echo ""
echo "📦 Sprawdzanie różnic z GitHub:"
git fetch origin

if git diff --quiet HEAD origin/master; then
    echo "✅ Serwer jest zgodny z GitHub"
else
    echo "⚠️  Różnice między serwerem a GitHub:"
    git diff --name-only HEAD origin/master
    echo ""
    echo "📋 Nowe commity w GitHub:"
    git log HEAD..origin/master --oneline
fi

echo ""
echo "🎯 Rekomendacja:"
if git diff --quiet && git diff --quiet HEAD origin/master; then
    echo "✅ Bezpieczne: git pull origin master"
elif git diff --quiet; then
    echo "✅ Bezpieczne: git pull origin master (tylko nowe zmiany z GitHub)"
else
    echo "⚠️  OSTROŻNIE: Są lokalne zmiany!"
    echo "   Opcje:"
    echo "   1. git stash && git pull && git stash pop"
    echo "   2. git add -A && git commit -m 'local' && git pull"
    echo "   3. Ręczne kopiowanie tylko plików PWA"
fi

EOF

echo -e "${BLUE}📤 Wysyłanie skryptu sprawdzającego na serwer...${NC}"
scp /tmp/check_server_changes.sh $SERVER_USER@$SERVER_IP:/tmp/

echo -e "${BLUE}🔍 Sprawdzanie różnic na serwerze...${NC}"
ssh $SERVER_USER@$SERVER_IP "chmod +x /tmp/check_server_changes.sh && /tmp/check_server_changes.sh"

echo ""
echo -e "${YELLOW}📋 Co dalej?${NC}"
echo -e "${BLUE}1.${NC} Jeśli serwer jest zgodny z GitHub:"
echo "   ssh $SERVER_USER@$SERVER_IP"
echo "   cd $APP_PATH && git pull origin master"
echo ""
echo -e "${BLUE}2.${NC} Jeśli są lokalne zmiany (OSTROŻNIE):"
echo "   ssh $SERVER_USER@$SERVER_IP"
echo "   cd $APP_PATH"
echo "   # Backup:"
echo "   cp -r . $BACKUP_PATH"
echo "   # Jedna z opcji:"
echo "   git stash && git pull && git stash pop"
echo "   # LUB"
echo "   git add -A && git commit -m 'local changes' && git pull"
echo ""
echo -e "${BLUE}3.${NC} Ręczne kopiowanie (NAJBEZPIECZNIEJSZE):"
echo "   Użyj instrukcji z SAFE_DEPLOY.md"
echo ""
echo -e "${RED}⚠️  ZAWSZE ZRÓB BACKUP PRZED ZMIANAMI!${NC}"

# Przygotuj pliki do ręcznego kopiowania
echo -e "${BLUE}📦 Przygotowywanie plików PWA do ręcznego kopiowania...${NC}"
TEMP_DIR="/tmp/pwa_manual_$(date +%s)"
mkdir -p $TEMP_DIR

# Skopiuj tylko nowe pliki PWA (bezpieczne)
cp -r static/icons $TEMP_DIR/
cp static/manifest.json $TEMP_DIR/
cp static/sw.js $TEMP_DIR/
cp static/favicon.ico $TEMP_DIR/
cp templates/offline.html $TEMP_DIR/

# Utwórz skrypt do ręcznego kopiowania
cat > $TEMP_DIR/manual_install.sh << 'MANUAL_EOF'
#!/bin/bash
echo "📱 Ręczna instalacja plików PWA..."

APP_PATH="/var/www/grafiksp4600"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Aplikacja nie znaleziona w $APP_PATH"
    exit 1
fi

echo "💾 Tworzenie backupu..."
cp -r $APP_PATH ${APP_PATH}_backup_$(date +%Y%m%d_%H%M%S)

echo "📁 Kopiowanie nowych plików PWA..."
cp -r icons $APP_PATH/static/ 2>/dev/null || echo "Folder icons skopiowany"
cp manifest.json $APP_PATH/static/
cp sw.js $APP_PATH/static/
cp favicon.ico $APP_PATH/static/
cp offline.html $APP_PATH/templates/

echo "✅ Nowe pliki PWA skopiowane!"
echo ""
echo "⚠️  RĘCZNIE DODAJ do istniejących plików:"
echo "📄 app.py - route'y PWA (patrz SAFE_DEPLOY.md)"
echo "📄 templates/index.html - meta tagi PWA i skrypty"
echo "📄 templates/signin.html - meta tagi PWA"
echo "📄 static/style.css - style PWA"
echo ""
echo "🔄 Po dodaniu zmian restartuj aplikację:"
echo "systemctl restart grafiksp4600"
MANUAL_EOF

chmod +x $TEMP_DIR/manual_install.sh

echo ""
echo -e "${GREEN}📂 Pliki do ręcznego kopiowania przygotowane w: $TEMP_DIR${NC}"
echo -e "${BLUE}📤 Aby skopiować na serwer:${NC}"
echo "scp -r $TEMP_DIR/* $SERVER_USER@$SERVER_IP:/tmp/"
echo ""
echo -e "${GREEN}🛡️ Bezpieczne sprawdzenie zakończone!${NC}"
