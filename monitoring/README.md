# Monitoring dla aplikacji GRAFIKSP4600

Ten katalog zawiera kompletny system monitoringu dla aplikacji GRAFIKSP4600, wykorzystujący stack Prometheus + Grafana + Alertmanager.

## 🏗️ Architektura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Aplikacja     │    │   Prometheus    │    │   Grafana       │
│   GRAFIKSP4600  │◄──►│   (zbieranie    │◄──►│   (wizualizacja)│
│   (port 8000)   │    │    metryk)      │    │   (port 3000)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SQLite        │    │   Alertmanager  │    │   Node Exporter │
│   Exporter      │    │   (alerty)      │    │   (system)      │
│   (port 9114)   │    │   (port 9093)   │    │   (port 9100)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Szybki start

### 1. Uruchomienie monitoringu

```bash
cd monitoring
./start_monitoring.sh start
```

### 2. Dostęp do serwisów

- **Grafana**: http://localhost:3000 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

### 3. Sprawdzenie statusu

```bash
./start_monitoring.sh status
```

## 📊 Dostępne metryki

### Aplikacja GRAFIKSP4600
- Status aplikacji (up/down)
- Czas odpowiedzi HTTP
- Liczba żądań HTTP
- Kody odpowiedzi HTTP
- Użycie pamięci i CPU
- Liczba użytkowników online
- Liczba sesji

### System
- Użycie CPU i pamięci
- Wolne miejsce na dysku
- Obciążenie systemu
- Sieć i dyski

### Baza danych SQLite
- Rozmiar bazy danych
- Liczba tabel i rekordów
- Czas zapytań
- Błędy bazy danych

### Nginx (jeśli używany)
- Status nginx
- Liczba żądań
- Czas odpowiedzi
- Błędy

## 🔧 Konfiguracja

### Prometheus (`prometheus.yml`)
- Konfiguracja scrape'owania
- Reguły alertów
- Ustawienia przechowywania

### Alertmanager (`alertmanager.yml`)
- Routing alertów
- Odbiorcy (email, Slack, webhook)
- Reguły inhibitu
- Szablony wiadomości

### Grafana (`grafana_dashboard.json`)
- Predefiniowany dashboard
- Metryki aplikacji
- Wykresy wydajności

## 📈 Dashboard Grafana

Dashboard zawiera następujące panele:

1. **Status aplikacji** - czy aplikacja działa
2. **Czas odpowiedzi HTTP** - histogram opóźnień
3. **Liczba żądań HTTP** - throughput aplikacji
4. **Kody odpowiedzi HTTP** - rozkład statusów
5. **Użycie zasobów** - CPU, pamięć, dysk
6. **Metryki bazy danych** - połączenia, zapytania
7. **Metryki biznesowe** - użytkownicy, sesje

## 🚨 Alerty

### Alerty krytyczne (natychmiastowe)
- Aplikacja nie odpowiada
- Wysokie opóźnienie (>2s)
- Wysoka liczba błędów 5xx
- Próby ataków

### Alerty ostrzegawcze (z opóźnieniem)
- Wysokie użycie zasobów
- Mało wolnego miejsca
- Wolne zapytania do bazy
- Niska aktywność użytkowników

### Odbiorcy alertów
- **Email** - admin, security, sysadmin, business
- **Slack** - kanały #alerts-critical, #alerts-security
- **Webhook** - integracja z aplikacją

## 🛠️ Zarządzanie

### Podstawowe komendy

```bash
# Uruchom monitoring
./start_monitoring.sh start

# Zatrzymaj monitoring
./start_monitoring.sh stop

# Uruchom ponownie
./start_monitoring.sh restart

# Pokaż status
./start_monitoring.sh status

# Pokaż logi
./start_monitoring.sh logs [serwis]

# Sprawdź zdrowie
./start_monitoring.sh health

# Backup danych
./start_monitoring.sh backup

# Przywróć z backupu
./start_monitoring.sh restore /ścieżka/do/backupu
```

### Zarządzanie Docker Compose

```bash
# Uruchom wszystkie serwisy
docker-compose up -d

# Zatrzymaj wszystkie serwisy
docker-compose down

# Pokaż status serwisów
docker-compose ps

# Pokaż logi
docker-compose logs -f [serwis]

# Restart konkretnego serwisu
docker-compose restart [serwis]
```

## 🔍 Troubleshooting

### Problem: Prometheus nie może połączyć się z aplikacją

```bash
# Sprawdź czy aplikacja działa
curl http://localhost:8000/healthz

# Sprawdź logi Prometheus
docker-compose logs prometheus

# Sprawdź konfigurację
cat prometheus.yml
```

### Problem: Grafana nie ładuje dashboardu

```bash
# Sprawdź logi Grafana
docker-compose logs grafana

# Sprawdź czy Prometheus jest dostępny
curl http://localhost:9090/api/v1/targets

# Sprawdź konfigurację datasource
```

### Problem: Alerty nie są wysyłane

```bash
# Sprawdź logi Alertmanager
docker-compose logs alertmanager

# Sprawdź konfigurację SMTP
cat alertmanager.yml

# Sprawdź status alertów w Prometheus
curl http://localhost:9090/api/v1/alerts
```

## 📁 Struktura plików

```
monitoring/
├── README.md                    # Ten plik
├── docker-compose.yml           # Konfiguracja Docker Compose
├── start_monitoring.sh          # Skrypt zarządzania
├── prometheus.yml               # Konfiguracja Prometheus
├── alerts.yml                   # Reguły alertów
├── alertmanager.yml             # Konfiguracja Alertmanager
├── grafana_dashboard.json       # Dashboard Grafana
├── nginx_status.conf            # Konfiguracja nginx dla statusu
├── sqlite_exporter.py           # Eksporter metryk SQLite
├── sqlite-exporter.Dockerfile   # Dockerfile dla eksportera
└── requirements.txt              # Zależności Python
```

## 🔐 Bezpieczeństwo

### Uwierzytelnianie
- Grafana: admin/admin123 (zmień w produkcji!)
- Prometheus: basic auth (skonfiguruj certyfikaty)
- Alertmanager: basic auth + TLS

### Sieci
- Wszystkie serwisy w sieci Docker `monitoring`
- Izolacja od sieci hosta
- Porty eksponowane tylko lokalnie

### Dane
- Wolumeny Docker dla trwałości
- Backup automatyczny
- Szyfrowanie w spoczynku (opcjonalnie)

## 📊 Metryki niestandardowe

### SQLite Exporter
Eksporter SQLite zbiera następujące metryki:

- `sqlite_database_size_bytes` - rozmiar bazy danych
- `sqlite_tables_total` - liczba tabel
- `sqlite_records_total{table="nazwa_tabeli"}` - liczba rekordów
- `sqlite_connections_active` - aktywne połączenia
- `sqlite_query_duration_seconds` - czas zapytań
- `sqlite_errors_total{error_type="typ_błędu"}` - błędy

### Dodawanie nowych metryk

1. Edytuj `sqlite_exporter.py`
2. Dodaj nowe metryki Prometheus
3. Zbuduj nowy obraz: `docker-compose build sqlite-exporter`
4. Uruchom ponownie: `docker-compose restart sqlite-exporter`

## 🚀 Produkcja

### Wymagania systemowe
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM
- 20GB wolnego miejsca
- Porty 9090, 9093, 3000, 9100, 9113, 9114

### Konfiguracja produkcji
1. Zmień hasła w `alertmanager.yml`
2. Skonfiguruj certyfikaty TLS
3. Ustaw SMTP dla alertów
4. Skonfiguruj Slack webhook
5. Dostosuj reguły alertów
6. Ustaw retention danych

### Backup i restore
```bash
# Automatyczny backup
./start_monitoring.sh backup

# Restore z backupu
./start_monitoring.sh restore /var/backups/monitoring/20241201_120000
```

## 📚 Dokumentacja

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Node Exporter](https://github.com/prometheus/node_exporter)
- [Nginx Exporter](https://github.com/nginxinc/nginx-prometheus-exporter)

## 🤝 Wsparcie

W przypadku problemów:

1. Sprawdź logi: `./start_monitoring.sh logs`
2. Sprawdź zdrowie: `./start_monitoring.sh health`
3. Sprawdź status: `./start_monitoring.sh status`
4. Sprawdź dokumentację powyżej
5. Zgłoś issue w repozytorium projektu

## 📝 Licencja

Ten monitoring jest częścią projektu GRAFIKSP4600 i podlega tej samej licencji.
