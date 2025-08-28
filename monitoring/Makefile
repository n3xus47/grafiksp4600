# Makefile dla monitoringu GRAFIKSP4600

.PHONY: help start stop restart status logs health backup restore clean build update

# Zmienne
COMPOSE_FILE = docker-compose.yml
PROJECT_NAME = monitoring

# Kolory
GREEN = \033[0;32m
YELLOW = \033[1;33m
RED = \033[0;31m
NC = \033[0m # No Color

# Domyślny target
help: ## Pokaż pomoc
	@echo "$(GREEN)Monitoring GRAFIKSP4600 - Dostępne komendy:$(NC)"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo

start: ## Uruchom monitoring
	@echo "$(GREEN)Uruchamiam monitoring...$(NC)"
	@./start_monitoring.sh start

stop: ## Zatrzymaj monitoring
	@echo "$(YELLOW)Zatrzymuję monitoring...$(NC)"
	@./start_monitoring.sh stop

restart: ## Uruchom ponownie monitoring
	@echo "$(YELLOW)Uruchamiam ponownie monitoring...$(NC)"
	@./start_monitoring.sh restart

status: ## Pokaż status serwisów
	@echo "$(GREEN)Status serwisów monitoringu:$(NC)"
	@./start_monitoring.sh status

logs: ## Pokaż logi (użyj: make logs SERVICE=nazwa_serwisu)
	@if [ -n "$(SERVICE)" ]; then \
		echo "$(GREEN)Logi serwisu $(SERVICE):$(NC)"; \
		./start_monitoring.sh logs $(SERVICE); \
	else \
		echo "$(GREEN)Logi wszystkich serwisów:$(NC)"; \
		./start_monitoring.sh logs; \
	fi

health: ## Sprawdź zdrowie serwisów
	@echo "$(GREEN)Sprawdzam zdrowie serwisów...$(NC)"
	@./start_monitoring.sh health

backup: ## Utwórz backup danych
	@echo "$(GREEN)Tworzę backup danych...$(NC)"
	@./start_monitoring.sh backup

restore: ## Przywróć dane z backupu (użyj: make restore BACKUP_DIR=ścieżka)
	@if [ -z "$(BACKUP_DIR)" ]; then \
		echo "$(RED)Błąd: Musisz podać BACKUP_DIR$(NC)"; \
		echo "Przykład: make restore BACKUP_DIR=/var/backups/monitoring/20241201_120000"; \
		exit 1; \
	fi
	@echo "$(GREEN)Przywracam dane z backupu: $(BACKUP_DIR)$(NC)"
	@./start_monitoring.sh restore $(BACKUP_DIR)

clean: ## Wyczyść dane i obrazy
	@echo "$(YELLOW)Czyczę dane i obrazy...$(NC)"
	@docker-compose down -v
	@docker system prune -f
	@echo "$(GREEN)Czyszczenie zakończone$(NC)"

build: ## Zbuduj obrazy Docker
	@echo "$(GREEN)Buduję obrazy Docker...$(NC)"
	@docker-compose build --no-cache
	@echo "$(GREEN)Budowanie zakończone$(NC)"

update: ## Zaktualizuj obrazy Docker
	@echo "$(GREEN)Aktualizuję obrazy Docker...$(NC)"
	@docker-compose pull
	@docker-compose up -d
	@echo "$(GREEN)Aktualizacja zakończona$(NC)"

# Komendy Docker Compose
up: ## Uruchom serwisy w tle
	@echo "$(GREEN)Uruchamiam serwisy...$(NC)"
	@docker-compose up -d

down: ## Zatrzymaj i usuń serwisy
	@echo "$(YELLOW)Zatrzymuję serwisy...$(NC)"
	@docker-compose down

ps: ## Pokaż status serwisów
	@echo "$(GREEN)Status serwisów:$(NC)"
	@docker-compose ps

logs-follow: ## Pokaż logi z follow (użyj: make logs-follow SERVICE=nazwa_serwisu)
	@if [ -n "$(SERVICE)" ]; then \
		docker-compose logs -f $(SERVICE); \
	else \
		docker-compose logs -f; \
	fi

# Komendy dla konkretnych serwisów
prometheus-logs: ## Logi Prometheus
	@docker-compose logs -f prometheus

grafana-logs: ## Logi Grafana
	@docker-compose logs -f grafana

alertmanager-logs: ## Logi Alertmanager
	@docker-compose logs -f alertmanager

node-exporter-logs: ## Logi Node Exporter
	@docker-compose logs -f node-exporter

nginx-exporter-logs: ## Logi Nginx Exporter
	@docker-compose logs -f nginx-exporter

sqlite-exporter-logs: ## Logi SQLite Exporter
	@docker-compose logs -f sqlite-exporter

# Komendy administracyjne
shell: ## Otwórz shell w kontenerze (użyj: make shell SERVICE=nazwa_serwisu)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)Błąd: Musisz podać SERVICE$(NC)"; \
		echo "Przykład: make shell SERVICE=prometheus"; \
		exit 1; \
	fi
	@docker-compose exec $(SERVICE) /bin/sh

exec: ## Wykonaj komendę w kontenerze (użyj: make exec SERVICE=nazwa_serwisu CMD="komenda")
	@if [ -z "$(SERVICE)" ] || [ -z "$(CMD)" ]; then \
		echo "$(RED)Błąd: Musisz podać SERVICE i CMD$(NC)"; \
		echo "Przykład: make exec SERVICE=prometheus CMD=\"ls -la\""; \
		exit 1; \
	fi
	@docker-compose exec $(SERVICE) $(CMD)

# Komendy dla bazy danych
db-backup: ## Backup bazy danych SQLite
	@echo "$(GREEN)Tworzę backup bazy danych...$(NC)"
	@docker run --rm -v monitoring_sqlite_data:/data -v $(PWD):/backup alpine tar czf /backup/sqlite_backup_$(shell date +%Y%m%d_%H%M%S).tar.gz -C /data .

db-restore: ## Przywróć bazę danych (użyj: make db-restore BACKUP_FILE=plik.tar.gz)
	@if [ -z "$(BACKUP_FILE)" ]; then \
		echo "$(RED)Błąd: Musisz podać BACKUP_FILE$(NC)"; \
		echo "Przykład: make db-restore BACKUP_FILE=sqlite_backup_20241201_120000.tar.gz"; \
		exit 1; \
	fi
	@echo "$(GREEN)Przywracam bazę danych z: $(BACKUP_FILE)$(NC)"
	@docker run --rm -v monitoring_sqlite_data:/data -v $(PWD):/backup alpine tar xzf /backup/$(BACKUP_FILE) -C /data

# Komendy dla konfiguracji
config-check: ## Sprawdź konfigurację
	@echo "$(GREEN)Sprawdzam konfigurację...$(NC)"
	@docker-compose config
	@echo "$(GREEN)Konfiguracja jest poprawna$(NC)"

config-validate: ## Waliduj konfigurację Prometheus
	@echo "$(GREEN)Waliduję konfigurację Prometheus...$(NC)"
	@docker run --rm -v $(PWD):/config prom/prometheus:latest promtool check config /config/prometheus.yml

# Komendy dla metryk
metrics: ## Pokaż metryki (użyj: make metrics SERVICE=nazwa_serwisu)
	@if [ -z "$(SERVICE)" ]; then \
		echo "$(RED)Błąd: Musisz podać SERVICE$(NC)"; \
		echo "Przykład: make metrics SERVICE=prometheus"; \
		exit 1; \
	fi
	@case $(SERVICE) in \
		prometheus) curl -s http://localhost:9090/metrics | head -20 ;; \
		grafana) curl -s http://localhost:3000/api/health ;; \
		alertmanager) curl -s http://localhost:9093/api/v1/status ;; \
		node-exporter) curl -s http://localhost:9100/metrics | head -20 ;; \
		nginx-exporter) curl -s http://localhost:9113/metrics | head -20 ;; \
		sqlite-exporter) curl -s http://localhost:9114/metrics | head -20 ;; \
		*) echo "$(RED)Nieznany serwis: $(SERVICE)$(NC)" ;; \
	esac

# Komendy dla alertów
alerts: ## Pokaż aktywne alerty
	@echo "$(GREEN)Aktywne alerty w Prometheus:$(NC)"
	@curl -s http://localhost:9090/api/v1/alerts | jq '.data[] | {alertname: .labels.alertname, severity: .labels.severity, state: .state}' 2>/dev/null || echo "Brak aktywnych alertów lub jq nie jest zainstalowany"

silences: ## Pokaż aktywne wyciszenia
	@echo "$(GREEN)Aktywne wyciszenia w Alertmanager:$(NC)"
	@curl -s http://localhost:9093/api/v1/silences | jq '.data[] | {id: .id, comment: .comment, endsAt: .endsAt}' 2>/dev/null || echo "Brak aktywnych wyciszeń lub jq nie jest zainstalowany"

# Komendy dla dashboardu
dashboard-import: ## Zaimportuj dashboard do Grafana
	@echo "$(GREEN)Importuję dashboard do Grafana...$(NC)"
	@curl -X POST -H "Content-Type: application/json" -d @grafana_dashboard.json http://admin:admin123@localhost:3000/api/dashboards/db

# Komendy dla bezpieczeństwa
security-check: ## Sprawdź bezpieczeństwo
	@echo "$(GREEN)Sprawdzam bezpieczeństwo...$(NC)"
	@echo "Sprawdzam czy porty są dostępne tylko lokalnie..."
	@netstat -tlnp | grep -E "(9090|9093|3000|9100|9113|9114)" || echo "Porty nie są otwarte"
	@echo "Sprawdzam czy serwisy działają w sieci Docker..."
	@docker network ls | grep monitoring || echo "Sieć monitoring nie istnieje"

# Komendy dla wydajności
performance: ## Sprawdź wydajność
	@echo "$(GREEN)Sprawdzam wydajność...$(NC)"
	@echo "Użycie CPU i pamięci przez kontenery:"
	@docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Komendy dla logów
logs-rotate: ## Rotacja logów
	@echo "$(GREEN)Rotuję logi...$(NC)"
	@docker-compose exec prometheus sh -c "echo 'SIGHUP' > /proc/1/fd/1" 2>/dev/null || echo "Nie można zrestartować Prometheus"
	@docker-compose exec alertmanager sh -c "echo 'SIGHUP' > /proc/1/fd/1" 2>/dev/null || echo "Nie można zrestartować Alertmanager"

# Komendy dla backupu
backup-full: ## Pełny backup (monitoring + aplikacja)
	@echo "$(GREEN)Tworzę pełny backup...$(NC)"
	@make backup
	@echo "Backup monitoringu utworzony"
	@if [ -f "../deployment/manage.sh" ]; then \
		cd .. && ./deployment/manage.sh backup; \
	else \
		echo "Skrypt zarządzania aplikacją nie znaleziony"; \
	fi

# Komendy dla testów
test: ## Uruchom testy
	@echo "$(GREEN)Uruchamiam testy...$(NC)"
	@echo "Testowanie połączeń..."
	@make health
	@echo "Testowanie metryk..."
	@make metrics SERVICE=prometheus
	@echo "Testowanie alertów..."
	@make alerts
	@echo "$(GREEN)Testy zakończone$(NC)"

# Komendy dla dokumentacji
docs: ## Generuj dokumentację
	@echo "$(GREEN)Generuję dokumentację...$(NC)"
	@echo "# Monitoring GRAFIKSP4600" > README_generated.md
	@echo "" >> README_generated.md
	@echo "## Dostępne komendy" >> README_generated.md
	@echo "" >> README_generated.md
	@make help | grep -v "make help" >> README_generated.md
	@echo "$(GREEN)Dokumentacja wygenerowana w README_generated.md$(NC)"

# Komendy dla instalacji
install: ## Instalacja monitoringu
	@echo "$(GREEN)Instaluję monitoring...$(NC)"
	@chmod +x start_monitoring.sh
	@make build
	@make start
	@echo "$(GREEN)Instalacja zakończona$(NC)"

uninstall: ## Odinstaluj monitoring
	@echo "$(YELLOW)Odinstaluję monitoring...$(NC)"
	@make stop
	@make clean
	@echo "$(GREEN)Odinstalacja zakończona$(NC)"

# Komendy dla aktualizacji
upgrade: ## Aktualizuj monitoring
	@echo "$(GREEN)Aktualizuję monitoring...$(NC)"
	@make backup
	@make update
	@echo "$(GREEN)Aktualizacja zakończona$(NC)"

# Komendy dla monitoringu
monitor: ## Monitoruj w czasie rzeczywistym
	@echo "$(GREEN)Monitoruję w czasie rzeczywistym...$(NC)"
	@echo "Naciśnij Ctrl+C aby zatrzymać"
	@watch -n 5 'make status'

# Komendy dla raportów
report: ## Generuj raport
	@echo "$(GREEN)Generuję raport...$(NC)"
	@echo "=== RAPORT MONITORINGU GRAFIKSP4600 ===" > monitoring_report.txt
	@echo "Data: $(shell date)" >> monitoring_report.txt
	@echo "" >> monitoring_report.txt
	@echo "Status serwisów:" >> monitoring_report.txt
	@make status >> monitoring_report.txt 2>&1
	@echo "" >> monitoring_report.txt
	@echo "Metryki systemu:" >> monitoring_report.txt
	@make performance >> monitoring_report.txt 2>&1
	@echo "$(GREEN)Raport wygenerowany w monitoring_report.txt$(NC)"

# Komendy dla konserwacji
maintenance: ## Tryb konserwacji
	@echo "$(YELLOW)Włączam tryb konserwacji...$(NC)"
	@docker-compose stop grafana
	@echo "Grafana zatrzymana - tryb konserwacji włączony"
	@echo "Aby wyłączyć: make maintenance-off"

maintenance-off: ## Wyłącz tryb konserwacji
	@echo "$(GREEN)Wyłączam tryb konserwacji...$(NC)"
	@docker-compose start grafana
	@echo "Grafana uruchomiona - tryb konserwacji wyłączony"

# Komendy dla debugowania
debug: ## Debug monitoring
	@echo "$(GREEN)Debug monitoringu...$(NC)"
	@echo "=== DEBUG INFO ==="
	@echo "Docker version:"
	@docker --version
	@echo "Docker Compose version:"
	@docker-compose --version
	@echo "Docker info:"
	@docker info | head -10
	@echo "Docker networks:"
	@docker network ls
	@echo "Docker volumes:"
	@docker volume ls | grep monitoring
	@echo "Porty nasłuchujące:"
	@netstat -tlnp | grep -E "(9090|9093|3000|9100|9113|9114)" || echo "Brak aktywnych portów monitoringu"
