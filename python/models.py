"""
Monitor PV - Modele danych i silnik obliczeniowy bilansu prosumenckiego (Net-metering 0.8 / Net-billing)
"""

from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
import calendar

MONTH_NAMES_PL = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
]

@dataclass
class PVReading:
    year: int
    month: int
    production_kwh: float       # P - miesięczna produkcja z falownika
    meter_180: float            # Stan licznika 1.8.0 (Pobór energii z sieci)
    meter_280: float            # Stan licznika 2.8.0 (Oddanie energii do sieci)
    price_per_kwh: float = 0.95 # PLN za 1 kWh

@dataclass
class MeterBaseline:
    year: int                   # Rok, dla którego to punkt odniesienia (stan na 31.12 roku ubiegłego)
    baseline_180: float
    baseline_280: float

@dataclass
class MonthlyReport:
    year: int
    month: int
    month_name: str
    production_kwh: float
    import_from_grid_kwh: float       # Delta 1.8.0
    export_to_grid_kwh: float         # Delta 2.8.0
    self_consumption_kwh: float       # AK = max(0, P - Export)
    total_consumption_kwh: float      # Z = AK + Import
    self_consumption_percent: float   # %
    coverage_percent: float           # %
    corrected_grid_energy_kwh: float  # Export * 0.8 (opust prosumencki)
    grid_balance_kwh: float           # (Export * 0.8) - Import
    financial_balance_pln: float      # (AK * cena) + ((Export * 0.8 - Import) * cena)
    saved_amount_pln: float           # AK * cena
    battery_5kwh_savings_pln: float
    battery_10kwh_savings_pln: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

@dataclass
class YearlySummary:
    year: int
    total_production_kwh: float
    total_import_kwh: float
    total_export_kwh: float
    total_corrected_grid_08_kwh: float
    total_grid_balance_kwh: float
    total_self_consumption_kwh: float
    total_consumption_kwh: float
    avg_self_consumption_percent: float
    avg_coverage_percent: float
    total_financial_balance_pln: float
    total_saved_pln: float
    monthly_reports: List[MonthlyReport]

    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            "monthly_reports": [m.to_dict() for m in self.monthly_reports]
        }

def calculate_monthly_report(
    current: PVReading,
    all_readings: List[PVReading],
    baselines: List[MeterBaseline],
    prosumer_ratio: float = 0.8
) -> MonthlyReport:
    """
    Oblicza pełny bilans miesięczny zgodnie z polskimi zasadami prosumenckimi (Net-metering 0.8 / 0.7).
    Delta 1.8.0 i 2.8.0 wyliczana jest względem poprzedniego miesiąca lub bazy początkowej roku.
    """
    # Znajdź odczyt z poprzedniego miesiąca lub baseline
    prev_reading = None
    sorted_readings = sorted(
        [r for r in all_readings if (r.year == current.year and r.month < current.month) or (r.year < current.year)],
        key=lambda r: (r.year, r.month),
        reverse=True
    )
    if sorted_readings:
        prev_reading = sorted_readings[0]

    baseline = next((b for b in baselines if b.year == current.year), None)
    prev_180 = prev_reading.meter_180 if prev_reading else (baseline.baseline_180 if baseline else 0.0)
    prev_280 = prev_reading.meter_280 if prev_reading else (baseline.baseline_280 if baseline else 0.0)

    import_kwh = max(0.0, current.meter_180 - prev_180)
    export_kwh = max(0.0, current.meter_280 - prev_280)
    self_cons_kwh = max(0.0, current.production_kwh - export_kwh)
    total_cons_kwh = self_cons_kwh + import_kwh

    corrected_exp = export_kwh * prosumer_ratio
    grid_bal = corrected_exp - import_kwh

    ak_percent = (self_cons_kwh / current.production_kwh * 100.0) if current.production_kwh > 0 else 0.0
    cov_percent = (self_cons_kwh / total_cons_kwh * 100.0) if total_cons_kwh > 0 else 0.0

    saved_pln = self_cons_kwh * current.price_per_kwh
    surplus_val = grid_bal * current.price_per_kwh
    fin_bal = saved_pln + surplus_val

    # Symulacja magazynu energii 5 kWh i 10 kWh
    bat5_limit = 5.0 * 30.0 * 0.8
    bat10_limit = 10.0 * 30.0 * 0.8
    bat5_savings = min(export_kwh, bat5_limit) * current.price_per_kwh
    bat10_savings = min(export_kwh, bat10_limit) * current.price_per_kwh

    month_name = MONTH_NAMES_PL[current.month - 1] if 1 <= current.month <= 12 else f"Miesiąc {current.month}"

    return MonthlyReport(
        year=current.year,
        month=current.month,
        month_name=month_name,
        production_kwh=round(current.production_kwh, 2),
        import_from_grid_kwh=round(import_kwh, 2),
        export_to_grid_kwh=round(export_kwh, 2),
        self_consumption_kwh=round(self_cons_kwh, 2),
        total_consumption_kwh=round(total_cons_kwh, 2),
        self_consumption_percent=round(ak_percent, 1),
        coverage_percent=round(cov_percent, 1),
        corrected_grid_energy_kwh=round(corrected_exp, 2),
        grid_balance_kwh=round(grid_bal, 2),
        financial_balance_pln=round(fin_bal, 2),
        saved_amount_pln=round(saved_pln, 2),
        battery_5kwh_savings_pln=round(bat5_savings, 2),
        battery_10kwh_savings_pln=round(bat10_savings, 2)
    )

def calculate_yearly_summary(
    year: int,
    readings: List[PVReading],
    baselines: List[MeterBaseline],
    prosumer_ratio: float = 0.8
) -> YearlySummary:
    """
    Oblicza roczne zestawienie od stycznia do grudnia uwzględniające współczynnik opustu (0.8).
    """
    year_readings = sorted([r for r in readings if r.year == year], key=lambda r: r.month)
    monthly_reports = [
        calculate_monthly_report(r, readings, baselines, prosumer_ratio)
        for r in year_readings
    ]

    total_prod = sum(m.production_kwh for m in monthly_reports)
    total_imp = sum(m.import_from_grid_kwh for m in monthly_reports)
    total_exp = sum(m.export_to_grid_kwh for m in monthly_reports)
    total_corr_exp = sum(m.corrected_grid_energy_kwh for m in monthly_reports)
    total_grid_bal = sum(m.grid_balance_kwh for m in monthly_reports)
    total_fin_bal = sum(m.financial_balance_pln for m in monthly_reports)
    total_saved = sum(m.saved_amount_pln for m in monthly_reports)

    total_ak = max(0.0, total_prod - total_exp)
    total_cons = total_ak + total_imp
    avg_ak_pct = (total_ak / total_prod * 100.0) if total_prod > 0 else 0.0
    avg_cov_pct = (total_ak / total_cons * 100.0) if total_cons > 0 else 0.0

    return YearlySummary(
        year=year,
        total_production_kwh=round(total_prod, 2),
        total_import_kwh=round(total_imp, 2),
        total_export_kwh=round(total_exp, 2),
        total_corrected_grid_08_kwh=round(total_corr_exp, 2),
        total_grid_balance_kwh=round(total_grid_bal, 2),
        total_self_consumption_kwh=round(total_ak, 2),
        total_consumption_kwh=round(total_cons, 2),
        avg_self_consumption_percent=round(avg_ak_pct, 1),
        avg_coverage_percent=round(avg_cov_pct, 1),
        total_financial_balance_pln=round(total_fin_bal, 2),
        total_saved_pln=round(total_saved, 2),
        monthly_reports=monthly_reports
    )
