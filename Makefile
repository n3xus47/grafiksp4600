.PHONY: help install dev test clean docker-build docker-run docker-stop lint format

# Default target
help:
	@echo "Dostępne komendy:"
	@echo "  install      - Zainstaluj zależności"
	@echo "  dev          - Uruchom w trybie deweloperskim"
	@echo "  test         - Uruchom testy"
	@echo "  clean        - Wyczyść pliki tymczasowe"
	@echo "  docker-build - Zbuduj obraz Docker"
	@echo "  docker-run   - Uruchom kontener Docker"
	@echo "  docker-stop  - Zatrzymaj kontener Docker"
	@echo "  lint         - Sprawdź jakość kodu"
	@echo "  format       - Sformatuj kod"
	@echo "  init-db      - Zainicjalizuj bazę danych"
	@echo "  backup       - Utwórz backup bazy danych"
	@echo "  deploy       - Wdróż aplikację"

# Instalacja zależności
install:
	@echo "Instalowanie zależności..."
	pip install -r requirements.txt

# Uruchomienie w trybie deweloperskim
dev:
	@echo "Uruchamianie w trybie deweloperskim..."
	export FLASK_ENV=development
	python app.py

# Uruchomienie testów
test:
	@echo "Uruchamianie testów..."
	export FLASK_ENV=testing
	python -m pytest tests/ -v

# Czyszczenie plików tymczasowych
clean:
	@echo "Czyszczenie plików tymczasowych..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type f -name "*.log" -delete
	find . -type f -name ".coverage" -delete
	find . -type d -name ".pytest_cache" -delete
	find . -type d -name "htmlcov" -delete

# Budowanie obrazu Docker
docker-build:
	@echo "Budowanie obrazu Docker..."
	docker build -t grafiksp4600:latest .

# Uruchomienie kontenera Docker
docker-run:
	@echo "Uruchamianie kontenera Docker..."
	docker-compose up -d

# Zatrzymanie kontenera Docker
docker-stop:
	@echo "Zatrzymywanie kontenera Docker..."
	docker-compose down

# Sprawdzenie jakości kodu
lint:
	@echo "Sprawdzanie jakości kodu..."
	@if command -v flake8 >/dev/null 2>&1; then \
		flake8 app.py config.py wsgi.py; \
	else \
		echo "flake8 nie jest zainstalowany. Zainstaluj: pip install flake8"; \
	fi

# Formatowanie kodu
format:
	@echo "Formatowanie kodu..."
	@if command -v black >/dev/null 2>&1; then \
		black app.py config.py wsgi.py; \
	else \
		echo "black nie jest zainstalowany. Zainstaluj: pip install black"; \
	fi

# Inicjalizacja bazy danych
init-db:
	@echo "Inicjalizacja bazy danych..."
	flask init-db

# Backup bazy danych
backup:
	@echo "Tworzenie backupu bazy danych..."
	@if [ -f "app.db" ]; then \
		cp app.db "backup_$(date +%Y%m%d_%H%M%S).db"; \
		echo "Backup utworzony: backup_$(date +%Y%m%d_%H%M%S).db"; \
	else \
		echo "Baza danych app.db nie istnieje"; \
	fi

# Wdrażanie aplikacji
deploy:
	@echo "Wdrażanie aplikacji..."
	@if [ "$(FLASK_ENV)" = "production" ]; then \
		echo "Wdrażanie w środowisku produkcyjnym..."; \
		docker-compose -f docker-compose.yml --profile production up -d; \
	else \
		echo "Wdrażanie w środowisku deweloperskim..."; \
		docker-compose up -d; \
	fi

# Status aplikacji
status:
	@echo "Status aplikacji:"
	@docker-compose ps
	@echo ""
	@echo "Logi aplikacji:"
	@docker-compose logs --tail=20 app

# Restart aplikacji
restart:
	@echo "Restart aplikacji..."
	docker-compose restart app

# Aktualizacja aplikacji
update:
	@echo "Aktualizacja aplikacji..."
	git pull
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

# Monitorowanie zasobów
monitor:
	@echo "Monitorowanie zasobów:"
	@docker stats --no-stream
	@echo ""
	@echo "Użycie dysku:"
	@df -h .
	@echo ""
	@echo "Użycie pamięci:"
	@free -h
