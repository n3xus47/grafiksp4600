#!/bin/bash
# Skrypt uruchamiający monitoring dla aplikacji GRAFIKSP4600

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

log_debug() {
    echo -e "${BLUE}[DEBUG]${NC} $1"
}

# Sprawdź czy Docker jest dostępny
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker nie jest zainstalowany"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker nie jest uruchomiony lub użytkownik nie ma uprawnień"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose nie jest zainstalowany"
        exit 1
    fi
    
    log_info "Docker i Docker Compose są dostępne"
}

# Sprawdź czy porty są wolne
check_ports() {
    local ports=("9090" "9093" "3000" "9100" "9113" "9114" "8080" "6379" "9121")
    
    for port in "${ports[@]}"; do
        if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
            log_warn "Port $port jest już używany"
        else
            log_info "Port $port jest wolny"
        fi
    done
}

# Uruchom monitoring
start_monitoring() {
    log_info "Uruchamiam monitoring..."
    
    cd "$(dirname "$0")"
    
    # Uruchom wszystkie serwisy
    docker-compose up -d
    
    log_info "Monitoring uruchomiony!"
    
    # Pokaż status
    show_status
}

# Zatrzymaj monitoring
stop_monitoring() {
    log_info "Zatrzymuję monitoring..."
    
    cd "$(dirname "$0")"
    
    # Zatrzymaj wszystkie serwisy
    docker-compose down
    
    log_info "Monitoring zatrzymany!"
}

# Pokaż status
show_status() {
    log_info "Status serwisów monitoringu:"
    echo "----------------------------------------"
    
    cd "$(dirname "$0")"
    docker-compose ps
    
    echo
    log_info "Dostępne serwisy:"
    echo "  - Prometheus: http://localhost:9090"
    echo "  - Alertmanager: http://localhost:9093"
    echo "  - Grafana: http://localhost:3000 (admin/admin123)"
    echo "  - Node Exporter: http://localhost:9100/metrics"
    echo "  - Nginx Exporter: http://localhost:9113/metrics"
    echo "  - SQLite Exporter: http://localhost:9114/metrics"
    echo "  - Cadvisor: http://localhost:8080"
    echo "  - Redis: localhost:6379"
    echo "  - Redis Exporter: http://localhost:9121/metrics"
}

# Pokaż logi
show_logs() {
    local service="${1:-}"
    
    cd "$(dirname "$0")"
    
    if [ -n "$service" ]; then
        log_info "Pokażę logi dla serwisu: $service"
        docker-compose logs -f "$service"
    else
        log_info "Pokażę logi wszystkich serwisów..."
        docker-compose logs -f
    fi
}

# Restart monitoring
restart_monitoring() {
    log_info "Uruchamiam ponownie monitoring..."
    
    stop_monitoring
    sleep 2
    start_monitoring
}

# Sprawdź zdrowie
check_health() {
    log_info "Sprawdzam zdrowie serwisów monitoringu..."
    
    local services=(
        "prometheus:9090"
        "alertmanager:9093"
        "grafana:3000"
        "node-exporter:9100"
        "nginx-exporter:9113"
        "sqlite-exporter:9114"
    )
    
    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"
        
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            log_info "✓ $name: OK"
        else
            log_error "✗ $name: NIEDOSTĘPNY"
        fi
    done
}

# Backup danych
backup_data() {
    log_info "Tworzę backup danych monitoringu..."
    
    local backup_dir="/var/backups/monitoring/$(date +%Y%m%d_%H%M%S)"
    
    sudo mkdir -p "$backup_dir"
    
    cd "$(dirname "$0")"
    
    # Backup wolumenów Docker
    docker run --rm -v prometheus_data:/data -v "$backup_dir":/backup alpine tar czf /backup/prometheus_data.tar.gz -C /data .
    docker run --rm -v alertmanager_data:/data -v "$backup_dir":/backup alpine tar czf /backup/alertmanager_data.tar.gz -C /data .
    docker run --rm -v grafana_data:/data -v "$backup_dir":/backup alpine tar czf /backup/grafana_data.tar.gz -C /data .
    docker run --rm -v redis_data:/data -v "$backup_dir":/backup alpine tar czf /backup/redis_data.tar.gz -C /data .
    
    # Backup konfiguracji
    sudo cp -r . "$backup_dir/config"
    
    log_info "Backup utworzony w: $backup_dir"
}

# Restore danych
restore_data() {
    local backup_dir="$1"
    
    if [ -z "$backup_dir" ]; then
        log_error "Musisz podać ścieżkę do backupu"
        exit 1
    fi
    
    if [ ! -d "$backup_dir" ]; then
        log_error "Katalog backupu nie istnieje: $backup_dir"
        exit 1
    fi
    
    log_info "Przywracam dane z backupu: $backup_dir"
    
    # Zatrzymaj monitoring
    stop_monitoring
    
    # Usuń istniejące wolumeny
    docker volume rm monitoring_prometheus_data monitoring_alertmanager_data monitoring_grafana_data monitoring_redis_data 2>/dev/null || true
    
    # Przywróć wolumeny
    docker run --rm -v prometheus_data:/data -v "$backup_dir":/backup alpine tar xzf /backup/prometheus_data.tar.gz -C /data
    docker run --rm -v alertmanager_data:/data -v "$backup_dir":/backup alpine tar xzf /backup/alertmanager_data.tar.gz -C /data
    docker run --rm -v grafana_data:/data -v "$backup_dir":/backup alpine tar xzf /backup/grafana_data.tar.gz -C /data
    docker run --rm -v redis_data:/data -v "$backup_dir":/backup alpine tar xzf /backup/redis_data.tar.gz -C /data
    
    # Przywróć konfigurację
    sudo cp -r "$backup_dir/config"/* .
    
    # Uruchom monitoring
    start_monitoring
    
    log_info "Dane przywrócone pomyślnie!"
}

# Pokaż pomoc
show_help() {
    echo "Użycie: $0 [OPCJA]"
    echo
    echo "Opcje:"
    echo "  start       - Uruchom monitoring"
    echo "  stop        - Zatrzymaj monitoring"
    echo "  restart     - Uruchom ponownie monitoring"
    echo "  status      - Pokaż status serwisów"
    echo "  logs        - Pokaż logi (wszystkie lub konkretnego serwisu)"
    echo "  health      - Sprawdź zdrowie serwisów"
    echo "  backup      - Utwórz backup danych"
    echo "  restore     - Przywróć dane z backupu"
    echo "  help        - Pokaż tę pomoc"
    echo
    echo "Przykłady:"
    echo "  $0 start"
    echo "  $0 logs prometheus"
    echo "  $0 backup"
    echo "  $0 restore /var/backups/monitoring/20241201_120000"
}

# Główna logika
main() {
    case "${1:-help}" in
        start)
            check_docker
            check_ports
            start_monitoring
            ;;
        stop)
            stop_monitoring
            ;;
        restart)
            restart_monitoring
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        health)
            check_health
            ;;
        backup)
            backup_data
            ;;
        restore)
            restore_data "$2"
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
