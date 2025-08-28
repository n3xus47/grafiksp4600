"""
WSGI entry point dla wdrażania produkcyjnego
"""

import os
from dotenv import load_dotenv

# Załaduj zmienne środowiskowe
load_dotenv()

# Ustaw środowisko na produkcję jeśli nie określono
if not os.environ.get('FLASK_ENV'):
    os.environ['FLASK_ENV'] = 'production'

# Importuj aplikację Flask
from app import app

if __name__ == "__main__":
    # Uruchom aplikację (tylko dla development)
    app.run(host='0.0.0.0', port=5000)
else:
    # Dla WSGI serwera (gunicorn, uwsgi, etc.)
    application = app
