#!/bin/bash

# Skrypt do uruchamiania aplikacji GRAFIKSP4600 lokalnie
# Autor: System migracji z serwera na localhost

echo "🚀 Uruchamianie aplikacji GRAFIKSP4600 lokalnie..."

# Sprawdź czy istnieje środowisko wirtualne
if [ ! -d "venv" ]; then
    echo "❌ Brak środowiska wirtualnego. Tworzę nowe..."
    python3 -m venv venv
    echo "✅ Utworzono środowisko wirtualne"
fi

# Aktywuj środowisko wirtualne
echo "🔧 Aktywuję środowisko wirtualne..."
source venv/bin/activate

# Sprawdź czy istnieje plik .env
if [ ! -f ".env" ]; then
    echo "⚠️  Brak pliku .env. Kopiuję z szablonu..."
    if [ -f "local_config.env" ]; then
        cp local_config.env .env
        echo "✅ Skopiowano local_config.env jako .env"
        echo "⚠️  UWAGA: Musisz skonfigurować Google OAuth i dodać swoje dane do .env"
    else
        echo "❌ Brak pliku szablonu local_config.env"
        exit 1
    fi
fi

# Zainstaluj zależności
echo "📦 Instaluję zależności..."
pip install -r requirements.txt

# Sprawdź czy istnieje baza danych
if [ ! -f "app.db" ]; then
    echo "🗄️  Inicjalizuję bazę danych..."
    flask init-db
    echo "✅ Baza danych zainicjalizowana"
fi

# Utwórz folder na logi jeśli nie istnieje
mkdir -p logs

echo ""
echo "🌟 Aplikacja gotowa do uruchomienia!"
echo ""
echo "📋 Następne kroki:"
echo "1. Skonfiguruj Google OAuth w Google Cloud Console"
echo "2. Uzupełnij GOOGLE_CLIENT_ID i GOOGLE_CLIENT_SECRET w pliku .env"
echo "3. Dodaj swój email do WHITELIST_EMAILS w pliku .env"
echo "4. Uruchom aplikację: python app.py"
echo ""
echo "🌐 Aplikacja będzie dostępna pod adresem: http://localhost:8000"
echo ""
echo "🔧 Uruchamianie aplikacji..."

# Uruchom aplikację
export FLASK_APP=app.py
export FLASK_ENV=development
python app.py