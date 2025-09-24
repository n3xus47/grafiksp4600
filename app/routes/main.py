"""
Główne trasy aplikacji - strona główna, offline, manifest
Zachowuje pełną kompatybilność z istniejącymi templateami
"""

import datetime as dt
import calendar
import logging
from flask import Blueprint, render_template, send_from_directory, make_response, request
from ..auth import login_required
from ..database import get_db

logger = logging.getLogger(__name__)

bp = Blueprint('main', __name__)

@bp.get("/")
@login_required
def index():
    """Główna strona aplikacji - wymagane logowanie"""
    try:
        from ..database import ensure_unavailability_table
        # Zapewnij że wszystkie tabele istnieją
        ensure_unavailability_table()
        
        # Pobierz parametry kalendarza
        year = int(request.args.get('year', dt.datetime.now().year))
        month = int(request.args.get('month', dt.datetime.now().month))
        
        # Oblicz nawigację kalendarza
        (prev_year, prev_month), (next_year, next_month) = get_calendar_navigation(year, month)
        
        # Utwórz etykietę miesiąca
        month_label = get_month_label(year, month)
        
        # Pobierz dane z bazy danych
        db = get_db()
        employees = db.execute("SELECT id, name FROM employees ORDER BY name").fetchall()
        shifts_today = get_today_shifts(db)
        shifts_tomorrow = get_tomorrow_shifts(db)
        
        # Pobierz zmiany dla wybranego miesiąca
        shifts_by_date = get_shifts_for_month(db, year, month)
        
        # Przygotuj dane dla template
        employees_clean = [{"id": emp["id"], "name": emp["name"], "display_name": emp["name"]} for emp in employees]
        logger.info(f"Pobrano {len(employees_clean)} pracowników: {[emp['name'] for emp in employees_clean[:5]]}")
        
        # Przygotuj dane kalendarza
        calendar_days = get_calendar_days(year, month)
        calendar_days_clean = []
        
        for day in calendar_days:
            day_data = {
                "date": day["date"],
                "iso": day["iso"],
                "dd": day["dd"],
                "abbr": day["abbr"],
                "is_off": day["is_off"],
                "is_today": day["is_today"]
            }
            calendar_days_clean.append(day_data)
        
        # Przygotuj wiersze grafiku
        schedule_rows = []
        for day in calendar_days:
            row_data = {
                "date": day["date"],
                "iso": day["iso"],
                "dd": day["dd"],
                "abbr": day["abbr"],
                "is_off": day["is_off"],
                "is_today": day["is_today"],
                "shifts": shifts_by_date.get(day["date"], {})
            }
            schedule_rows.append(row_data)
        
        # Sprawdź uprawnienia admin
        from ..auth import is_admin_user
        is_admin = is_admin_user()
        
        # Pobierz nazwę aktualnego użytkownika
        from ..auth import get_current_user
        current_user_data = get_current_user()
        current_user = current_user_data.get("name", "Nieznany") if current_user_data else "Nieznany"
        
        # Znajdź pracownika odpowiadającego użytkownikowi
        current_emp_name = None
        if current_user_data:
            user_id = current_user_data.get("id")
            emp_row = db.execute("SELECT name FROM employees WHERE user_id = ?", (user_id,)).fetchone()
            if emp_row:
                current_emp_name = emp_row["name"]
        
        response = make_response(render_template("index.html", 
            shifts_today=shifts_today,
            shifts_tomorrow=shifts_tomorrow,
            month_label=str(month_label),
            prev_year=int(prev_year), prev_month=int(prev_month),
            next_year=int(next_year), next_month=int(next_month),
            view_year=int(year), view_month=int(month),
            employees=employees_clean,
            calendar_days=calendar_days_clean,
            schedule_rows=schedule_rows,
            shifts_by_date=shifts_by_date,
            is_admin=is_admin,
            current_user=current_user,
            current_emp_name=current_emp_name
        ))
        
        logger.info(f"Główna strona załadowana dla użytkownika {current_user}")
        return response
        
    except Exception as e:
        logger.error(f"Błąd podczas ładowania strony głównej: {e}")
        # Przekaż podstawowe zmienne nawet w przypadku błędu
        return render_template("index.html", 
            error="Wystąpił błąd podczas ładowania strony",
            shifts_today={"dniowka": [], "popoludniowka": [], "nocka": []},
            shifts_tomorrow={"dniowka": [], "popoludniowka": [], "nocka": []},
            month_label="Błąd",
            prev_year=2025, prev_month=9,
            next_year=2025, next_month=11,
            view_year=2025, view_month=10,
            employees=[],
            calendar_days=[],
            schedule_rows=[],
            shifts_by_date={},
            is_admin=False,
            current_user="Błąd",
            current_emp_name=None
        )

@bp.get("/offline")
def offline():
    """Strona offline dla PWA"""
    return render_template("offline.html")

# Manifest i Service Worker są serwowane przez domyślny route /static/<path:filename>

@bp.get("/favicon.ico")
def favicon():
    """Favicon dla przeglądarki"""
    return send_from_directory('static', 'favicon.ico', mimetype='image/x-icon')

# Funkcje pomocnicze przeniesione z app.py
def get_calendar_navigation(year, month):
    """Oblicz nawigację kalendarza"""
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1
    
    if month == 12:
        next_year, next_month = year + 1, 1
    else:
        next_year, next_month = year, month + 1
    
    return (prev_year, prev_month), (next_year, next_month)

def get_month_label(year, month):
    """Utwórz etykietę miesiąca"""
    month_names = [
        "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
        "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
    ]
    return f"{month_names[month - 1]} {year}"

def get_today_shifts(db):
    """Pobierz dzisiejsze zmiany"""
    today = dt.date.today().strftime('%Y-%m-%d')
    shifts = db.execute("""
        SELECT s.shift_type, e.name 
        FROM shifts s 
        JOIN employees e ON s.employee_id = e.id 
        WHERE s.date = ?
    """, (today,)).fetchall()
    
    shifts_today = {"DNIOWKA": [], "POPOLUDNIOWKA": [], "NOCKA": []}
    
    for shift in shifts:
        shift_type = shift["shift_type"]
        name = shift["name"]
        
        if shift_type == "DNIOWKA":
            shifts_today["DNIOWKA"].append(name)
        elif shift_type == "POPOLUDNIOWKA":
            shifts_today["POPOLUDNIOWKA"].append(name)
        elif shift_type == "NOCKA":
            shifts_today["NOCKA"].append(name)
    
    # Dodaj małe litery dla kompatybilności z frontendem
    shifts_today["dniowka"] = shifts_today["DNIOWKA"]
    shifts_today["popoludniowka"] = shifts_today["POPOLUDNIOWKA"]
    shifts_today["nocka"] = shifts_today["NOCKA"]
    
    return shifts_today

def get_tomorrow_shifts(db):
    """Pobierz jutrzejsze zmiany"""
    tomorrow = (dt.date.today() + dt.timedelta(days=1)).strftime('%Y-%m-%d')
    shifts = db.execute("""
        SELECT s.shift_type, e.name 
        FROM shifts s 
        JOIN employees e ON s.employee_id = e.id 
        WHERE s.date = ?
    """, (tomorrow,)).fetchall()
    
    shifts_tomorrow = {"DNIOWKA": [], "POPOLUDNIOWKA": [], "NOCKA": []}
    
    for shift in shifts:
        shift_type = shift["shift_type"]
        name = shift["name"]
        
        if shift_type == "DNIOWKA":
            shifts_tomorrow["DNIOWKA"].append(name)
        elif shift_type == "POPOLUDNIOWKA":
            shifts_tomorrow["POPOLUDNIOWKA"].append(name)
        elif shift_type == "NOCKA":
            shifts_tomorrow["NOCKA"].append(name)
    
    # Dodaj małe litery dla kompatybilności z frontendem
    shifts_tomorrow["dniowka"] = shifts_tomorrow["DNIOWKA"]
    shifts_tomorrow["popoludniowka"] = shifts_tomorrow["POPOLUDNIOWKA"]
    shifts_tomorrow["nocka"] = shifts_tomorrow["NOCKA"]
    
    return shifts_tomorrow

def get_shifts_for_month(db, year, month):
    """Pobierz zmiany dla danego miesiąca"""
    start_date = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1:04d}-01-01"
    else:
        end_date = f"{year:04d}-{month + 1:02d}-01"
    
    shifts = db.execute("""
        SELECT s.date, s.shift_type, e.name 
        FROM shifts s 
        JOIN employees e ON s.employee_id = e.id 
        WHERE s.date >= ? AND s.date < ?
        ORDER BY s.date, e.name
    """, (start_date, end_date)).fetchall()
    
    shifts_by_date = {}
    for shift in shifts:
        date = shift["date"]
        if date not in shifts_by_date:
            shifts_by_date[date] = {}
        shifts_by_date[date][shift["name"]] = shift["shift_type"]
    
    return shifts_by_date

def get_calendar_days(year, month):
    """Pobierz dni kalendarza dla danego miesiąca - tylko dni danego miesiąca od 1 do ostatniego"""
    # Polskie nazwy dni
    day_names = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']
    
    # Pobierz pierwszy dzień miesiąca i liczbę dni
    first_day = dt.date(year, month, 1)
    last_day = dt.date(year, month, calendar.monthrange(year, month)[1])
    
    # Wygeneruj tylko dni danego miesiąca (od 1 do ostatniego dnia)
    calendar_days = []
    current_date = first_day
    while current_date <= last_day:
        is_off = current_date.weekday() >= 5  # Sobota i niedziela
        is_today = current_date == dt.date.today()
        
        calendar_days.append({
            "date": current_date.strftime('%Y-%m-%d'),
            "iso": current_date.isoformat(),
            "dd": current_date.strftime('%d'),
            "abbr": day_names[current_date.weekday()],  # Użyj polskich nazw dni
            "is_off": is_off,
            "is_today": is_today
        })
        
        current_date += dt.timedelta(days=1)
    
    return calendar_days
