#!/bin/bash
# Prosty skrypt wdrożeniowy dla Grafik SP4600
# Użycie: ./deploy.sh

set -e

echo "🚀 Wdrażanie aplikacji na serwer..."

# Konfiguracja serwera
SERVER_IP="46.101.144.141"
DOMAIN="grafik4600.com"
REMOTE_USER="root"

# Sprawdź połączenie z serwerem
echo "📡 Sprawdzanie połączenia z serwerem..."
if ! sshpass -p 'MiaOzzie3547.xd' ssh -o ConnectTimeout=10 $REMOTE_USER@$SERVER_IP "echo 'Połączenie OK'"; then
    echo "❌ Nie można połączyć się z serwerem"
    exit 1
fi

# Utwórz pakiet wdrożeniowy
echo "📦 Tworzenie pakietu wdrożeniowego..."
tar -czf deploy-package.tar.gz \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git' \
    --exclude='*.db' \
    --exclude='*.log' \
    --exclude='.env' \
    .

# Wyślij na serwer
echo "⬆️ Wysyłanie na serwer..."
sshpass -p 'MiaOzzie3547.xd' scp deploy-package.tar.gz $REMOTE_USER@$SERVER_IP:/tmp/

# Wdróż na serwerze
echo "🔧 Wdrażanie na serwerze..."
sshpass -p 'MiaOzzie3547.xd' ssh $REMOTE_USER@$SERVER_IP << 'ENDSSH'
set -e

# Zatrzymaj aplikację
systemctl stop grafiksp4600 || true

# Przejdź do katalogu aplikacji
cd /opt/grafiksp4600

# Rozpakuj nową wersję
tar -xzf /tmp/deploy-package.tar.gz
rm /tmp/deploy-package.tar.gz

# Uruchom aplikację
systemctl start grafiksp4600
systemctl enable grafiksp4600

echo "✅ Aplikacja została zaktualizowana!"
ENDSSH

# Wyczyść lokalnie
rm deploy-package.tar.gz

echo "✅ Wdrożenie zakończone pomyślnie!"
echo "🌐 Aplikacja dostępna pod: http://$DOMAIN"