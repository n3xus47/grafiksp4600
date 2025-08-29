#!/bin/bash

# Server status checker for grafiksp4600
# Usage: ./server-status.sh

SERVER_IP="46.101.144.141"
DOMAIN="grafik4600.com"
REMOTE_USER="root"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

print_ok() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "🔍 Checking server status for grafik4600.com..."
echo ""

# Test SSH connection
print_header "SSH CONNECTION"
if ssh -o ConnectTimeout=5 $REMOTE_USER@$SERVER_IP "echo 'SSH OK'" 2>/dev/null; then
    print_ok "SSH connection working"
else
    print_error "SSH connection failed"
fi

# Test DNS resolution
print_header "DNS RESOLUTION"
if nslookup $DOMAIN | grep -q $SERVER_IP; then
    print_ok "DNS pointing to correct IP"
else
    print_warning "DNS not yet propagated or misconfigured"
fi

# Test HTTP connection
print_header "HTTP CONNECTION"
if curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN | grep -q "200\|302"; then
    print_ok "HTTP connection working"
else
    print_warning "HTTP connection not working yet"
fi

# Test HTTPS connection
print_header "HTTPS CONNECTION"
if curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN 2>/dev/null | grep -q "200\|302"; then
    print_ok "HTTPS connection working"
else
    print_warning "HTTPS not configured yet"
fi

# Check server services (if SSH works)
if ssh -o ConnectTimeout=5 $REMOTE_USER@$SERVER_IP "echo test" >/dev/null 2>&1; then
    print_header "SERVER SERVICES"
    
    # Docker status
    if ssh $REMOTE_USER@$SERVER_IP "docker ps" 2>/dev/null | grep -q "grafiksp4600"; then
        print_ok "Docker containers running"
    else
        print_error "Docker containers not running"
    fi
    
    # Nginx status
    if ssh $REMOTE_USER@$SERVER_IP "systemctl is-active nginx" 2>/dev/null | grep -q "active"; then
        print_ok "Nginx running"
    else
        print_error "Nginx not running"
    fi
    
    # SSL certificate
    if ssh $REMOTE_USER@$SERVER_IP "certbot certificates 2>/dev/null | grep -q '$DOMAIN'"; then
        print_ok "SSL certificate installed"
    else
        print_warning "SSL certificate not installed"
    fi
    
    print_header "APPLICATION LOGS (last 5 lines)"
    ssh $REMOTE_USER@$SERVER_IP "cd /opt/grafiksp4600 && docker-compose logs --tail=5" 2>/dev/null || print_error "Cannot access application logs"
fi

echo ""
echo "🔗 Test URLs:"
echo "  HTTP:  http://$DOMAIN"
echo "  HTTPS: https://$DOMAIN"
echo ""
echo "📞 Server management commands:"
echo "  SSH:     ssh $REMOTE_USER@$SERVER_IP"
echo "  Restart: ssh $REMOTE_USER@$SERVER_IP 'cd /opt/grafiksp4600 && docker-compose restart'"
echo "  Logs:    ssh $REMOTE_USER@$SERVER_IP 'cd /opt/grafiksp4600 && docker-compose logs -f'"
