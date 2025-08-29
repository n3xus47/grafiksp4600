"""
Testy jednostkowe dla API aplikacji
"""

import pytest
import tempfile
import os
from app import app, get_db, init_db


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


@pytest.fixture
def runner():
    """Runner dla komend CLI"""
    return app.test_cli_runner()


def test_health_check(client):
    """Test endpointu health check"""
    response = client.get('/healthz')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'
    assert 'timestamp' in data


def test_debug_env(client):
    """Test endpointu debug środowiska"""
    response = client.get('/debug/env')
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
    assert response.status_code == 302  # Przekierowanie do logowania


def test_invalid_json(client):
    """Test obsługi nieprawidłowego JSON"""
    response = client.post('/api/save', data='invalid json')
    assert response.status_code == 400


def test_rate_limit_exceeded(client):
    """Test przekroczenia limitu żądań"""
    # Wysyłaj wiele żądań w krótkim czasie
    for _ in range(150):  # Przekrocz limit 100/min
        client.get('/healthz')
    
    # Ostatnie żądanie powinno zostać zablokowane
    response = client.get('/healthz')
    assert response.status_code == 429  # Too Many Requests


def test_cli_init_db(runner):
    """Test komendy CLI init-db"""
    result = runner.invoke(cli_commands=['init-db'])
    assert result.exit_code == 0


def test_cli_add_employee(runner):
    """Test komendy CLI add-employee"""
    # Symuluj input
    result = runner.invoke(cli_commands=['add-employee'], input='Test Employee\n')
    assert result.exit_code == 0


def test_cli_assign_today(runner):
    """Test komendy CLI assign-today"""
    # Symuluj input
    result = runner.invoke(cli_commands=['assign-today'], input='Test Employee\nDNIOWKA\n')
    assert result.exit_code == 0


def test_validate_date_format():
    """Test walidacji formatu daty"""
    from app import validate_date_format
    
    # Prawidłowe daty
    assert validate_date_format('2024-01-01') == True
    assert validate_date_format('2024-12-31') == True
    
    # Nieprawidłowe daty
    assert validate_date_format('2024-13-01') == False  # Nieprawidłowy miesiąc
    assert validate_date_format('2024-01-32') == False  # Nieprawidłowy dzień
    assert validate_date_format('invalid') == False
    assert validate_date_format('') == False
    assert validate_date_format(None) == False


def test_validate_shift_type():
    """Test walidacji typu zmiany"""
    from app import validate_shift_type
    
    # Prawidłowe typy
    assert validate_shift_type('DNIOWKA') == True
    assert validate_shift_type('NOCKA') == True
    
    # Nieprawidłowe typy
    assert validate_shift_type('dzienna') == False
    assert validate_shift_type('nocna') == False
    assert validate_shift_type('') == False
    assert validate_shift_type(None) == False


def test_get_bool_field():
    """Test bezpiecznego pobierania pól boolean"""
    from app import get_bool_field
    from sqlite3 import Row
    
    # Symuluj wiersz bazy danych
    class MockRow:
        def __init__(self, data):
            self._data = data
        
        def get(self, key, default=None):
            return self._data.get(key, default)
    
    row = MockRow({'field1': True, 'field2': False, 'field3': 1, 'field4': 0})
    
    # Testy
    assert get_bool_field(row, 'field1') == True
    assert get_bool_field(row, 'field2') == False
    assert get_bool_field(row, 'field3') == True
    assert get_bool_field(row, 'field4') == False
    assert get_bool_field(row, 'nonexistent') == False
    assert get_bool_field(row, 'nonexistent', True) == True


def test_safe_get_json():
    """Test bezpiecznego pobierania JSON"""
    from app import safe_get_json
    
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
