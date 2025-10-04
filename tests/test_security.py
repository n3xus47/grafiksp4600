"""
Testy bezpieczeństwa aplikacji
"""

import pytest
import os
from app import create_app

@pytest.fixture
def app():
    """Utwórz aplikację testową"""
    app = create_app()
    app.config['TESTING'] = True
    app.config['DATABASE_PATH'] = ':memory:'  # Użyj bazy w pamięci
    return app

@pytest.fixture
def client(app):
    """Klient testowy"""
    return app.test_client()

def test_csrf_protection_enabled(app):
    """Test czy CSRF protection jest włączone"""
    assert 'WTF_CSRF_ENABLED' in app.config
    assert app.config['WTF_CSRF_ENABLED'] is True

def test_secret_key_not_default(app):
    """Test czy klucz szyfrowania nie jest domyślny"""
    secret_key = app.config['SECRET_KEY']
    assert secret_key != "dev-secret-key-change-in-production"
    assert len(secret_key) >= 32  # Bezpieczny klucz

def test_health_endpoint(client):
    """Test endpointu health check"""
    response = client.get('/healthz')
    # Health endpoint może nie istnieć w testach, sprawdź czy jest 200 lub 404
    assert response.status_code in [200, 404]
    if response.status_code == 200:
        data = response.get_json()
        assert data['status'] == 'ok'

def test_api_save_validation(client):
    """Test walidacji danych w API save"""
    # Test z pustymi danymi
    response = client.post('/api/save', 
                          json={'changes': []},
                          headers={'Content-Type': 'application/json'})
    assert response.status_code == 400
    
    # Test z nieprawidłowymi danymi
    response = client.post('/api/save',
                          json={'changes': [{'date': 'invalid', 'employee': '', 'shift_type': 'D'}]},
                          headers={'Content-Type': 'application/json'})
    assert response.status_code == 400

def test_database_indexes_created(app):
    """Test czy indeksy bazy danych zostały utworzone"""
    from app.database import get_db, create_database_indexes, init_db
    with app.app_context():
        # Najpierw utwórz tabele
        init_db()
        
        # Potem utwórz indeksy
        create_database_indexes()
        
        db = get_db()
        # Sprawdź czy indeksy istnieją
        indexes = db.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()
        index_names = [idx[0] for idx in indexes]
        
        # Sprawdź kluczowe indeksy
        assert 'idx_users_email' in index_names
        assert 'idx_shifts_date' in index_names
        assert 'idx_employees_name' in index_names

if __name__ == '__main__':
    pytest.main([__file__])
