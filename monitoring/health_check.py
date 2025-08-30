#!/usr/bin/env python3
"""
Skrypt monitorowania zdrowia aplikacji GRAFIKSP4600
"""

import requests
import time
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional

# Konfiguracja logowania
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('health_check.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class HealthChecker:
    """Klasa do sprawdzania zdrowia aplikacji"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.timeout = 30
    
    def check_health_endpoint(self) -> Dict[str, Any]:
        """Sprawdza endpoint /healthz"""
        try:
            response = self.session.get(f"{self.base_url}/healthz")
            if response.status_code == 200:
                data = response.json()
                return {
                    'status': 'healthy',
                    'response_time': response.elapsed.total_seconds(),
                    'data': data
                }
            else:
                return {
                    'status': 'unhealthy',
                    'status_code': response.status_code,
                    'error': f"HTTP {response.status_code}"
                }
        except requests.exceptions.RequestException as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def check_debug_endpoint(self) -> Dict[str, Any]:
        """Sprawdza endpoint /debug/env"""
        try:
            response = self.session.get(f"{self.base_url}/debug/env")
            if response.status_code == 200:
                data = response.json()
                return {
                    'status': 'healthy',
                    'response_time': response.elapsed.total_seconds(),
                    'data': data
                }
            else:
                return {
                    'status': 'unhealthy',
                    'status_code': response.status_code,
                    'error': f"HTTP {response.status_code}"
                }
        except requests.exceptions.RequestException as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def check_main_page(self) -> Dict[str, Any]:
        """Sprawdza główną stronę aplikacji"""
        try:
            response = self.session.get(f"{self.base_url}/")
            if response.status_code in [200, 302]:  # 302 to przekierowanie do logowania
                return {
                    'status': 'healthy',
                    'response_time': response.elapsed.total_seconds(),
                    'status_code': response.status_code
                }
            else:
                return {
                    'status': 'unhealthy',
                    'status_code': response.status_code,
                    'error': f"HTTP {response.status_code}"
                }
        except requests.exceptions.RequestException as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def check_database_connection(self) -> Dict[str, Any]:
        """Sprawdza połączenie z bazą danych (przez API)"""
        try:
            # Sprawdź endpoint który wymaga bazy danych
            response = self.session.get(f"{self.base_url}/api/employees")
            if response.status_code in [401, 403]:  # Brak autoryzacji ale baza działa
                return {
                    'status': 'healthy',
                    'response_time': response.elapsed.total_seconds(),
                    'note': 'Database accessible (auth required)'
                }
            elif response.status_code == 500:  # Błąd bazy danych
                return {
                    'status': 'unhealthy',
                    'status_code': response.status_code,
                    'error': 'Database error'
                }
            else:
                return {
                    'status': 'healthy',
                    'response_time': response.elapsed.total_seconds(),
                    'status_code': response.status_code
                }
        except requests.exceptions.RequestException as e:
            return {
                'status': 'error',
                'error': str(e)
            }
    
    def run_full_health_check(self) -> Dict[str, Any]:
        """Przeprowadza pełne sprawdzenie zdrowia aplikacji"""
        start_time = time.time()
        
        logger.info("Rozpoczynam sprawdzanie zdrowia aplikacji...")
        
        checks = {
            'health_endpoint': self.check_health_endpoint(),
            'debug_endpoint': self.check_debug_endpoint(),
            'main_page': self.check_main_page(),
            'database': self.check_database_connection()
        }
        
        # Podsumowanie
        total_time = time.time() - start_time
        healthy_checks = sum(1 for check in checks.values() if check['status'] == 'healthy')
        total_checks = len(checks)
        
        overall_status = 'healthy' if healthy_checks == total_checks else 'unhealthy'
        
        result = {
            'timestamp': datetime.now().isoformat(),
            'overall_status': overall_status,
            'total_checks': total_checks,
            'healthy_checks': healthy_checks,
            'unhealthy_checks': total_checks - healthy_checks,
            'total_time': total_time,
            'checks': checks
        }
        
        logger.info(f"Sprawdzanie zakończone: {healthy_checks}/{total_checks} testów przeszło")
        logger.info(f"Ogólny status: {overall_status}")
        
        return result
    
    def save_health_report(self, report: Dict[str, Any], filename: str = None) -> None:
        """Zapisuje raport zdrowia do pliku"""
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"health_report_{timestamp}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2, ensure_ascii=False)
            logger.info(f"Raport zdrowia zapisany do: {filename}")
        except Exception as e:
            logger.error(f"Błąd podczas zapisywania raportu: {e}")
    
    def send_alert(self, report: Dict[str, Any], webhook_url: str = None) -> None:
        """Wysyła alert w przypadku problemów"""
        if report['overall_status'] == 'healthy':
            return
        
        if not webhook_url:
            logger.warning("Brak URL webhook - pomijam wysyłanie alertu")
            return
        
        try:
            alert_data = {
                'text': f"🚨 Alert: Aplikacja GRAFIKSP4600 ma problemy!",
                'attachments': [{
                    'color': 'danger',
                    'fields': [
                        {
                            'title': 'Status',
                            'value': report['overall_status'],
                            'short': True
                        },
                        {
                            'title': 'Testy',
                            'value': f"{report['healthy_checks']}/{report['total_checks']}",
                            'short': True
                        },
                        {
                            'title': 'Szczegóły',
                            'value': json.dumps(report['checks'], indent=2),
                            'short': False
                        }
                    ]
                }]
            }
            
            response = requests.post(webhook_url, json=alert_data, timeout=10)
            if response.status_code == 200:
                logger.info("Alert wysłany pomyślnie")
            else:
                logger.error(f"Błąd podczas wysyłania alertu: HTTP {response.status_code}")
                
        except Exception as e:
            logger.error(f"Błąd podczas wysyłania alertu: {e}")


def main():
    """Główna funkcja"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Sprawdź zdrowie aplikacji GRAFIKSP4600')
    parser.add_argument('--url', default='http://localhost:8000', 
                       help='URL aplikacji (domyślnie: http://localhost:8000)')
    parser.add_argument('--webhook', help='URL webhook dla alertów')
    parser.add_argument('--save', action='store_true', 
                       help='Zapisz raport do pliku')
    parser.add_argument('--continuous', type=int, metavar='SECONDS',
                       help='Uruchom w trybie ciągłym co X sekund')
    
    args = parser.parse_args()
    
    checker = HealthChecker(args.url)
    
    if args.continuous:
        logger.info(f"Uruchamiam monitorowanie ciągłe co {args.continuous} sekund...")
        try:
            while True:
                report = checker.run_full_health_check()
                
                if args.save:
                    checker.save_health_report(report)
                
                if args.webhook:
                    checker.send_alert(report, args.webhook)
                
                time.sleep(args.continuous)
                
        except KeyboardInterrupt:
            logger.info("Monitorowanie zatrzymane przez użytkownika")
    else:
        # Jednorazowe sprawdzenie
        report = checker.run_full_health_check()
        
        if args.save:
            checker.save_health_report(report)
        
        if args.webhook:
            checker.send_alert(report, args.webhook)
        
        # Wyświetl podsumowanie
        print(f"\n📊 Podsumowanie sprawdzenia zdrowia:")
        print(f"   Status: {report['overall_status']}")
        print(f"   Testy: {report['healthy_checks']}/{report['total_checks']}")
        print(f"   Czas: {report['total_time']:.2f}s")
        
        if report['overall_status'] == 'unhealthy':
            print(f"\n❌ Problemy znalezione:")
            for check_name, check_result in report['checks'].items():
                if check_result['status'] != 'healthy':
                    print(f"   - {check_name}: {check_result.get('error', 'Unknown error')}")
        else:
            print(f"\n✅ Wszystkie testy przeszły pomyślnie!")


if __name__ == '__main__':
    main()
