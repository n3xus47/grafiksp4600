#!/bin/bash

# Clean deployment script for grafiksp4600 production server
# This script will clean everything and start fresh

set -e

echo "🧹 Starting CLEAN deployment to production server..."

# Configuration
SERVER_IP="46.101.144.141"
DOMAIN="grafik4600.com"
APP_NAME="grafiksp4600"
REMOTE_USER="root"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
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

print_warning "⚠️  This will COMPLETELY CLEAN the server and start fresh!"
print_warning "⚠️  All existing applications, databases, and configurations will be REMOVED!"
echo ""
read -p "Are you sure you want to continue? (type 'YES' to confirm): " confirm

if [ "$confirm" != "YES" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Create deployment package
print_step "Creating deployment package..."
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
print_step "Uploading application to server..."
scp deploy-package.tar.gz $REMOTE_USER@$SERVER_IP:/tmp/

# Clean deployment on server
print_step "Performing CLEAN deployment on server..."
ssh $REMOTE_USER@$SERVER_IP << 'ENDSSH'
set -e

echo "🧹 CLEANING SERVER - Starting fresh installation..."

# Stop all running containers and services
echo "🛑 Stopping all Docker containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

# Remove all Docker images, volumes, networks
echo "🗑️  Removing all Docker resources..."
docker system prune -af --volumes || true
docker network prune -f || true

# Stop and disable nginx if running
echo "🛑 Stopping nginx..."
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true

# Remove old nginx configurations
echo "🗑️  Removing old nginx configurations..."
rm -rf /etc/nginx/sites-available/* 2>/dev/null || true
rm -rf /etc/nginx/sites-enabled/* 2>/dev/null || true

# Remove old SSL certificates
echo "🗑️  Removing old SSL certificates..."
certbot delete --cert-name grafik4600.com 2>/dev/null || true
certbot delete --cert-name www.grafik4600.com 2>/dev/null || true

# Remove old application directories
echo "🗑️  Removing old application directories..."
rm -rf /opt/grafiksp4600 2>/dev/null || true
rm -rf /var/www/html/* 2>/dev/null || true

# Clean up processes
echo "🛑 Killing any remaining processes on ports 80, 443, 5000..."
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
fuser -k 5000/tcp 2>/dev/null || true

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required packages (fresh installation)
echo "📦 Installing required packages..."
apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx git curl ufw

# Start and enable Docker
echo "🐳 Starting Docker service..."
systemctl start docker
systemctl enable docker

# Add user to docker group (if not root)
if [ "$USER" != "root" ]; then
    usermod -aG docker $USER
fi

# Create fresh app directory
echo "📁 Creating fresh application directory..."
mkdir -p /opt/grafiksp4600
cd /opt/grafiksp4600

# Extract application
echo "📦 Extracting application..."
tar -xzf /tmp/deploy-package.tar.gz
rm /tmp/deploy-package.tar.gz

# Create production environment file
echo "⚙️  Creating production environment file..."
cat > .env << 'EOF'
# Production Environment Configuration
FLASK_ENV=production
SECRET_KEY=$(openssl rand -base64 32)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
DATABASE_URL=sqlite:///app.db
DOMAIN=grafik4600.com
WHITELIST_EMAILS=official221team@gmail.com
EOF

# Create logs directory
mkdir -p logs

# Build and start containers
echo "🐳 Building and starting Docker containers..."
docker-compose build
docker-compose up -d

# Wait for container to be ready
echo "⏳ Waiting for application to start..."
sleep 10

# Configure nginx
echo "🌐 Configuring nginx..."
cat > /etc/nginx/sites-available/grafiksp4600 << 'NGINXCONF'
server {
    listen 80;
    server_name grafik4600.com www.grafik4600.com;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Static files with caching
    location /static {
        proxy_pass http://localhost:5000/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check
    location /health {
        proxy_pass http://localhost:5000/;
        access_log off;
    }
}
NGINXCONF

# Enable site
ln -sf /etc/nginx/sites-available/grafiksp4600 /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
echo "🔍 Testing nginx configuration..."
nginx -t

# Start nginx
echo "🌐 Starting nginx..."
systemctl start nginx
systemctl enable nginx

# Configure firewall
echo "🔥 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Check if everything is running
echo "🔍 Checking services status..."
echo "Docker containers:"
docker-compose ps
echo ""
echo "Nginx status:"
systemctl status nginx --no-pager -l
echo ""
echo "Application logs:"
docker-compose logs --tail=10

echo ""
echo "✅ CLEAN DEPLOYMENT COMPLETED!"
echo ""
echo "📋 NEXT STEPS:"
echo "  1. ✅ Server cleaned and application deployed"
echo "  2. 🔧 Configure DNS: grafik4600.com → 46.101.144.141"
echo "  3. 🔐 Update Google OAuth credentials in /opt/grafiksp4600/.env"
echo "  4. 🔒 Setup SSL: certbot --nginx -d grafik4600.com -d www.grafik4600.com"
echo "  5. 🧪 Test the application"
echo ""
echo "🔗 Your app should be available at: http://grafik4600.com"

ENDSSH

# Cleanup
rm deploy-package.tar.gz

print_status "✅ CLEAN DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo ""
print_warning "📋 IMPORTANT NEXT STEPS:"
echo "  1. 🌐 Configure DNS records for grafik4600.com → 46.101.144.141"
echo "  2. 🔐 Update Google OAuth credentials:"
echo "     ssh root@46.101.144.141"
echo "     nano /opt/grafiksp4600/.env"
echo "  3. 🔒 Setup SSL certificate:"
echo "     ssh root@46.101.144.141"
echo "     certbot --nginx -d grafik4600.com -d www.grafik4600.com"
echo "  4. 🧪 Test: http://grafik4600.com"
echo ""
print_status "🎉 Your server is now clean and ready for production!"
