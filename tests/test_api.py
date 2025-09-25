"""
Testy jednostkowe dla API aplikacji
"""

import pytest
import tempfile
import os
from app import app
from app.database import get_db, init_db


@pytest.fixture
def client():
    """Klient testowy Flask"""
    # Utwórz tymczasową bazę danych
    db_fd, db_path = tempfile.mkstemp()
    
    app.config.update({
        'TESTING': True,
        'DATABASE_PATH': db_path,
    })
    
    with app.test_client() as client:
        with app.app_context():
            init_db()
            yield client
    
    # Wyczyść po testach
    os.close(db_fd)
    os.unlink(db_path)


# CLI commands are not available in the new modular structure


def test_health_check(client):
    """Test endpointu health check"""
    response = client.get('/api/healthz')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
    assert 'timestamp' in data


def test_debug_env(client):
    """Test endpointu debug środowiska"""
    response = client.get('/api/debug/env')
    assert response.status_code == 200
    data = response.get_json()
    assert 'has_client_id' in data
    assert 'has_client_secret' in data
    assert 'has_secret_key' in data
    assert 'environment' in data


def test_index_redirect(client):
    """Test przekierowania z głównej strony (wymaga logowania)"""
    response = client.get('/')
    assert response.status_code == 302  # Przekierowanie do logowania


def test_signin_page(client):
    """Test strony logowania"""
    response = client.get('/signin')
    assert response.status_code == 200
    assert b'login' in response.data.lower()


def test_api_employees_unauthorized(client):
    """Test API pracowników bez autoryzacji"""
    response = client.get('/api/employees')
    assert response.status_code == 302  # Przekierowanie do logowania


def test_api_save_unauthorized(client):
    """Test API zapisywania bez autoryzacji"""
    response = client.post('/api/save', json={'changes': []})
    assert response.status_code == 302  # Przekierowanie do logowania


def test_api_swaps_unauthorized(client):
    """Test API próśb o zamianę bez autoryzacji"""
    response = client.post('/api/swaps', json={})
    assert response.status_code == 401  # Brak autoryzacji (własna logika)


def test_invalid_json(client):
    """Test obsługi nieprawidłowego JSON"""
    response = client.post('/api/save', data='invalid json')
    assert response.status_code == 302  # Przekierowanie do logowania (brak autoryzacji)


# Rate limiting is not implemented in the current version


# CLI commands are not available in the new modular structure


def test_safe_get_json():
    """Test bezpiecznego pobierania JSON"""
    from app.routes.api import safe_get_json
    
    # Test z prawidłowym JSON
    with app.test_request_context('/api/test', json={'key': 'value'}):
        data = safe_get_json()
        assert data == {'key': 'value'}
    
    # Test z nieprawidłowym JSON
    with app.test_request_context('/api/test', data='invalid json'):
        data = safe_get_json()
        assert data == {}


if __name__ == '__main__':
    pytest.main([__file__])
