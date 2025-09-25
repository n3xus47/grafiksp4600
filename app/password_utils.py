"""
Narzędzia do zarządzania hasłami
Bezpieczne hashowanie i weryfikacja haseł
"""

import hashlib
import secrets
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

def generate_salt() -> str:
    """Generuje losową sól dla hasła"""
    return secrets.token_hex(32)

def hash_password(password: str, salt: str = None) -> str:
    """
    Hashuje hasło z solą
    
    Args:
        password: Hasło do zahashowania
        salt: Opcjonalna sól (jeśli None, zostanie wygenerowana)
    
    Returns:
        String w formacie "hash:salt"
    """
    if salt is None:
        salt = generate_salt()
    
    # Użyj PBKDF2 z SHA-256 dla bezpiecznego hashowania
    password_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000  # 100,000 iteracji
    )
    
    return f"{password_hash.hex()}:{salt}"

def verify_password(password: str, stored_hash_salt: str) -> bool:
    """
    Weryfikuje hasło względem przechowywanego hashu
    
    Args:
        password: Hasło do weryfikacji
        stored_hash_salt: Przechowywany hash w formacie "hash:salt"
    
    Returns:
        True jeśli hasło jest poprawne, False w przeciwnym razie
    """
    try:
        if ':' not in stored_hash_salt:
            logger.error("Nieprawidłowy format przechowywanego hashu")
            return False
        
        stored_hash, salt = stored_hash_salt.split(':', 1)
        computed_hash_salt = hash_password(password, salt)
        computed_hash = computed_hash_salt.split(':', 1)[0]
        
        return secrets.compare_digest(computed_hash, stored_hash)
    except Exception as e:
        logger.error(f"Błąd podczas weryfikacji hasła: {e}")
        return False

def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Sprawdza siłę hasła
    
    Args:
        password: Hasło do sprawdzenia
    
    Returns:
        Tuple (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Hasło musi mieć co najmniej 8 znaków"
    
    if len(password) > 128:
        return False, "Hasło nie może mieć więcej niż 128 znaków"
    
    # Sprawdź czy hasło zawiera co najmniej jedną cyfrę
    if not any(c.isdigit() for c in password):
        return False, "Hasło musi zawierać co najmniej jedną cyfrę"
    
    # Sprawdź czy hasło zawiera co najmniej jedną literę
    if not any(c.isalpha() for c in password):
        return False, "Hasło musi zawierać co najmniej jedną literę"
    
    return True, ""

def is_password_strong_enough(password: str) -> bool:
    """
    Sprawdza czy hasło jest wystarczająco silne (uproszczona wersja)
    
    Args:
        password: Hasło do sprawdzenia
    
    Returns:
        True jeśli hasło jest wystarczająco silne
    """
    is_valid, _ = validate_password_strength(password)
    return is_valid
