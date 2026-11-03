"""
Smart Energy Insights - Inteligentny silnik rekomendacji energetycznych
"""

from typing import Dict, Any, List
try:
    from models import MonthlyReport
except ImportError:
    from python.models import MonthlyReport

MONTH_NAMES_GENITIVE = [
    "styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu",
    "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"
]

def generate_smart_insights(
    report: MonthlyReport,
    energy_price: float = 0.95,
    peak_power_kwp: float = 3.8
) -> Dict[str, Any]:
    """
    Dynamiczne generowanie wskazówek dla użytkownika w sekcji 'WSKAZÓWKA ODNOŚNIE WYDAJNOŚCI'
    na podstawie parametrów miesięcznych.
    """
    month_idx = max(0, min(11, report.month - 1))
    month_name = MONTH_NAMES_GENITIVE[month_idx]
    production = report.production_kwh
    exported = report.export_to_grid_kwh
    ak_kw = report.self_consumption_kwh
    ak_percent = report.self_consumption_percent
    export_ratio = (exported / production) if production > 0 else 0.0
    price = energy_price if energy_price > 0 else 0.95

    # Przypadek 1: Brak lub znikoma generacja słoneczna (np. zima)
    if production <= 0:
        return {
            "level": "info",
            "title": "Brak generacji słonecznej",
            "badge": "Zima / Oczekiwanie",
            "message": (
                f"W {month_name} brak zarejestrowanej produkcji PV. "
                "W miesiącach zimowych warto skupić się na optymalizacji zużycia taryfowego "
                "(np. taryfa nocna G12w) oraz redukcji poboru bazowego standby."
            ),
            "metrics": {
                "exported_kwh": 0.0,
                "current_ak_percent": 0.0,
                "estimated_ak_percent": 0.0,
                "potential_savings_pln": 0.0,
                "shiftable_kwh": 0.0,
            },
            "actions": [
                "Wykorzystaj taryfę nocną/weekendową do ogrzewania domu i wody",
                "Sprawdź czy panele nie są zaśnieżone lub zabrudzone",
                "Rozważ programator czasowy dla urządzeń o dużym poborze"
            ]
        }

    # Szacowanie potencjału przeniesienia obciążenia (CWU, pompa ciepła, EV, pranie)
    shift_factor = 0.45 if exported > 300 else (0.40 if exported > 150 else 0.35)
    shiftable_kwh = round(exported * shift_factor)
    new_ak_kw = ak_kw + shiftable_kwh
    estimated_ak_percent = min(95, round((new_ak_kw / production) * 100))

    # Realna korzyść: unikanie potrącenia 20% opustu oraz opłat dystrybucyjnych zmiennych
    unit_savings_pln = price * 0.35
    potential_savings_pln = max(round(shiftable_kwh * 0.30), round(shiftable_kwh * unit_savings_pln))

    # Przypadek 2: Oddanie do sieci przekracza 30% produkcji
    if export_ratio > 0.30 and exported >= 30:
        return {
            "level": "warning",
            "title": "Możliwość zwiększenia autokonsumpcji",
            "badge": "Wysoki eksport do sieci",
            "message": (
                f"W {month_name} wyeksportowałeś {int(round(exported))} kWh. "
                "Gdybyś przeniósł podgrzewanie CWU, uruchamianie pompy ciepła lub ładowanie EV "
                f"na godziny 11:00–15:00, podniósłbyś autokonsumpcję do ~{estimated_ak_percent}%, "
                f"oszczędzając dodatkowo {potential_savings_pln} zł miesięcznie."
            ),
            "metrics": {
                "exported_kwh": round(exported, 1),
                "current_ak_percent": round(ak_percent, 1),
                "estimated_ak_percent": estimated_ak_percent,
                "potential_savings_pln": potential_savings_pln,
                "shiftable_kwh": shiftable_kwh,
            },
            "actions": [
                "Ustaw zegar grzałki bojlera CWU na okno 11:30 - 14:30",
                "Zaprogramuj pralkę, suszarkę i zmywarkę w godzinach południowych",
                "Podnoś zadaną temperaturę pompy ciepła w dzień (akumulacja w buforze)",
                "Rozważ stacjonarny magazyn energii (5-10 kWh) do absorpcji nadwyżek"
            ]
        }

    # Przypadek 3: Bardzo wysoka autokonsumpcja (> 60%)
    if ak_percent >= 60.0:
        return {
            "level": "success",
            "title": "Wzorowa autokonsumpcja",
            "badge": "Mistrz autokonsumpcji",
            "message": (
                f"Świetny wynik w {month_name}! Twoja autokonsumpcja wyniosła aż {round(ak_percent)}%. "
                "Większość generowanego prądu zasila Twoje bieżące potrzeby, co maksymalizuje opłacalność "
                "instalacji PV i minimalizuje straty przesyłowe."
            ),
            "metrics": {
                "exported_kwh": round(exported, 1),
                "current_ak_percent": round(ak_percent, 1),
                "estimated_ak_percent": round(ak_percent),
                "potential_savings_pln": 0.0,
                "shiftable_kwh": 0.0,
            },
            "actions": [
                "Utrzymuj nawyk uruchamiania urządzeń w godzinach pracy paneli",
                "Instalacja jest bardzo dobrze zwymiarowana do profilu zużycia domu"
            ]
        }

    # Przypadek 4: Zrównoważony profil
    return {
        "level": "info",
        "title": "Zrównoważony profil energetyczny",
        "badge": "Stabilna praca",
        "message": (
            f"W {month_name} autokonsumpcja wyniosła {round(ak_percent)}% przy oddaniu {round(exported)} kWh. "
            "Profil zużycia jest zrównoważony, a nadwyżki zasilają Twój wirtualny magazyn w sieci (współczynnik 0.8)."
        ),
        "metrics": {
            "exported_kwh": round(exported, 1),
            "current_ak_percent": round(ak_percent, 1),
            "estimated_ak_percent": min(85, round(ak_percent + 15)),
            "potential_savings_pln": round(exported * 0.2 * price),
            "shiftable_kwh": round(exported * 0.3),
        },
        "actions": [
            "W słoneczne dni przenieś część zmywania i prania na godziny 12:00-14:00",
            "Pamiętaj o czyszczeniu paneli przed szczytem sezonu wiosenno-letniego"
        ]
    }
