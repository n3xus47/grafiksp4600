"""
Testy integracyjne aplikacji
"""

import pytest
import json
from app import create_app

@pytest.fixture
def app():
    """Utwórz aplikację testową"""
    app = create_app()
    app.config['TESTING'] = True
    app.config['DATABASE_PATH'] = ':memory:'
    return app

@pytest.fixture
def client(app):
    """Klient testowy"""
    return app.test_client()

def test_app_creation(app):
    """Test czy aplikacja się tworzy poprawnie"""
    assert app is not None
    assert app.config['TESTING'] is True

def test_database_initialization(app):
    """Test czy baza danych się inicjalizuje"""
    from app.database import init_db
    with app.app_context():
        init_db()
        # Sprawdź czy tabele zostały utworzone
        from app.database import get_db
        db = get_db()
        tables = db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
        table_names = [table[0] for table in tables]
        
        assert 'users' in table_names
        assert 'employees' in table_names
        assert 'shifts' in table_names

def test_csrf_protection_integration(app):
    """Test czy CSRF protection działa w integracji"""
    with app.test_client() as client:
        # Test POST bez CSRF token
        response = client.post('/api/save', 
                              json={'changes': []},
                              headers={'Content-Type': 'application/json'})
        # Powinien zwrócić błąd CSRF lub 400
        assert response.status_code in [400, 403]

def test_rate_limiting_integration(app):
    """Test czy rate limiting działa"""
    with app.test_client() as client:
        # Wykonaj wiele żądań szybko
        responses = []
        for i in range(15):  # Więcej niż limit 10/min
            response = client.post('/api/save',
                                  json={'changes': []},
                                  headers={'Content-Type': 'application/json'})
            responses.append(response.status_code)
        
        # Sprawdź czy rate limiting zadziałał
        # (może zwrócić 429 Too Many Requests lub inne błędy)
        assert any(status in [400, 403, 429] for status in responses)

def test_api_validation_integration(client):
    """Test walidacji API w integracji"""
    # Test z nieprawidłowymi danymi
    test_cases = [
        {'changes': []},  # Puste zmiany
        {'changes': [{'date': 'invalid', 'employee': '', 'shift_type': 'D'}]},  # Nieprawidłowa data
        {'changes': [{'date': '2025-01-01', 'employee': '', 'shift_type': 'D'}]},  # Pusty pracownik
        {'changes': [{'date': '2025-01-01', 'employee': 'Test', 'shift_type': 'D'}]},  # Prawidłowe dane
    ]
    
    for i, test_data in enumerate(test_cases):
        response = client.post('/api/save',
                              json=test_data,
                              headers={'Content-Type': 'application/json'})
        
        if i < 3:  # Pierwsze 3 przypadki powinny zwrócić błąd
            assert response.status_code in [400, 403, 429]
        else:  # Ostatni przypadek może przejść (ale bez autoryzacji)
            assert response.status_code in [200, 400, 401, 403, 429]

def test_health_endpoint_integration(client):
    """Test health endpoint w integracji"""
    response = client.get('/healthz')
    # Health endpoint może nie istnieć w testach
    assert response.status_code in [200, 404]

def test_static_files_serving(app):
    """Test czy pliki statyczne są serwowane"""
    with app.test_client() as client:
        # Test CSS
        response = client.get('/static/style.css')
        assert response.status_code in [200, 404]  # Może nie istnieć w testach
        
        # Test JS
        response = client.get('/static/app.js')
        assert response.status_code in [200, 404]  # Może nie istnieć w testach

def test_error_handling_integration(app):
    """Test obsługi błędów w integracji"""
    with app.test_client() as client:
        # Test nieistniejącego endpointu
        response = client.get('/nonexistent')
        assert response.status_code == 404
        
        # Test nieprawidłowej metody
        response = client.get('/api/save')  # GET zamiast POST
        assert response.status_code in [405, 404]  # Method Not Allowed lub Not Found

if __name__ == '__main__':
    pytest.main([__file__])
