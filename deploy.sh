#!/bin/bash

# Deployment script for grafiksp4600 production server
# Usage: ./deploy.sh

set -e

echo "🚀 Starting deployment to production server..."

# Configuration
SERVER_IP="46.101.144.141"
DOMAIN="grafik4600.com"
APP_NAME="grafiksp4600"
REMOTE_USER="root"  # Change if you have a different user

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we can connect to server
print_status "Testing connection to server..."
if ! ssh -o ConnectTimeout=10 $REMOTE_USER@$SERVER_IP "echo 'Connection successful'"; then
    print_error "Cannot connect to server. Please check:"
    echo "  1. Server IP: $SERVER_IP"
    echo "  2. SSH key is added to server"
    echo "  3. Server is running"
    exit 1
fi

# Create deployment package
print_status "Creating deployment package..."
tar -czf deploy-package.tar.gz \
    --exclude='venv' \
    --exclude='__pycache__' \
    --exclude='*.pyc' \
    --exclude='.git' \
    --exclude='*.db' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='.env.backup' \
    .

# Upload to server
print_status "Uploading application to server..."
scp deploy-package.tar.gz $REMOTE_USER@$SERVER_IP:/tmp/

# Deploy on server
print_status "Deploying application on server..."
ssh $REMOTE_USER@$SERVER_IP << 'ENDSSH'
set -e

# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx git

# Start Docker service
systemctl start docker
systemctl enable docker

# Create app directory
mkdir -p /opt/grafiksp4600
cd /opt/grafiksp4600

# Extract application
tar -xzf /tmp/deploy-package.tar.gz
rm /tmp/deploy-package.tar.gz

# Create production environment file
cat > .env << 'EOF'
# Production Environment Configuration
FLASK_ENV=production
SECRET_KEY=$(openssl rand -base64 32)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
DATABASE_URL=sqlite:///app.db
DOMAIN=grafik4600.com
EOF

echo "🔧 Created .env file - REMEMBER to update Google OAuth credentials!"

# Build and start containers
docker-compose down || true
docker-compose build
docker-compose up -d

# Configure nginx
cat > /etc/nginx/sites-available/grafiksp4600 << 'NGINXCONF'
server {
    listen 80;
    server_name grafik4600.com www.grafik4600.com;
    
    # Redirect HTTP to HTTPS (will be enabled after SSL setup)
    # return 301 https://$server_name$request_uri;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (if needed later)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Static files
    location /static {
        proxy_pass http://localhost:5000/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINXCONF

# Enable site
ln -sf /etc/nginx/sites-available/grafiksp4600 /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
nginx -t

# Restart nginx
systemctl restart nginx
systemctl enable nginx

# Setup firewall
ufw allow 22/tcp
ufw allow 80/tcp  
ufw allow 443/tcp
ufw --force enable

echo "✅ Basic deployment completed!"
echo "📋 Next steps:"
echo "  1. Update Google OAuth credentials in /opt/grafiksp4600/.env"
echo "  2. Run SSL setup: certbot --nginx -d grafik4600.com -d www.grafik4600.com"
echo "  3. Test the application"

ENDSSH

# Cleanup
rm deploy-package.tar.gz

print_status "✅ Deployment completed successfully!"
print_warning "⚠️  Important next steps:"
echo "  1. Configure DNS records for grafik4600.com → 46.101.144.141"
echo "  2. Update Google OAuth credentials on server"
echo "  3. Setup SSL certificate"
echo "  4. Test the application"

echo ""
echo "🔗 Your app will be available at: http://grafik4600.com"
