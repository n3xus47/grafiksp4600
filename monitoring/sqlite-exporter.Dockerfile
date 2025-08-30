FROM python:3.11-alpine

# Instalacja zależności systemowych
RUN apk add --no-cache sqlite

# Ustawienie katalogu roboczego
WORKDIR /app

# Kopiowanie plików wymaganych
COPY requirements.txt .

# Instalacja zależności Python
RUN pip install --no-cache-dir -r requirements.txt

# Kopiowanie kodu aplikacji
COPY sqlite_exporter.py .

# Utworzenie użytkownika non-root
RUN adduser -D -s /bin/sh exporter
USER exporter

# Ekspozycja portu
EXPOSE 9114

# Uruchomienie aplikacji
CMD ["python", "sqlite_exporter.py"]
