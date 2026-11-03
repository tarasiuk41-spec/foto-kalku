"""
Monitor PV - Główna Aplikacja w Pythonie (FastAPI + CLI)
Obsługuje silnik kalkulacyjny (opust 0.8), Open-Meteo API, Home Assistant REST, generowanie PDF/Excel oraz Smart Insights.
"""

import sys
import argparse
from typing import Optional
from fastapi import FastAPI, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from models import PVReading, MeterBaseline, calculate_monthly_report, calculate_yearly_summary
    from insights import generate_smart_insights
    from forecast import fetch_solar_forecast
    from reports import generate_excel_report, generate_pdf_report
    from ha_mqtt import send_pv_webhook, HomeAssistantMQTT
except ImportError:
    from python.models import PVReading, MeterBaseline, calculate_monthly_report, calculate_yearly_summary
    from python.insights import generate_smart_insights
    from python.forecast import fetch_solar_forecast
    from python.reports import generate_excel_report, generate_pdf_report
    from python.ha_mqtt import send_pv_webhook, HomeAssistantMQTT

app = FastAPI(
    title="Monitor PV API (Python)",
    description="Silnik analityczny, prognozowanie solarne i integracja Smart Home dla fotowoltaiki.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Przykładowe dane referencyjne (rok 2025/2026 z punktem zero na 31.12)
sample_baseline = MeterBaseline(year=2025, baseline_180=5200.0, baseline_280=8100.0)

sample_readings = [
    PVReading(year=2025, month=1, production_kwh=65.0, meter_180=5550.0, meter_280=8120.0, price_per_kwh=0.95),
    PVReading(year=2025, month=2, production_kwh=145.0, meter_180=5860.0, meter_280=8170.0, price_per_kwh=0.95),
    PVReading(year=2025, month=3, production_kwh=310.0, meter_180=6110.0, meter_280=8320.0, price_per_kwh=0.95),
    PVReading(year=2025, month=4, production_kwh=430.0, meter_180=6330.0, meter_280=8560.0, price_per_kwh=0.95),
    PVReading(year=2025, month=5, production_kwh=580.0, meter_180=6520.0, meter_280=8920.0, price_per_kwh=0.95),
    PVReading(year=2025, month=6, production_kwh=620.0, meter_180=6710.0, meter_280=9330.0, price_per_kwh=0.95),
    PVReading(year=2025, month=7, production_kwh=590.0, meter_180=6900.0, meter_280=9710.0, price_per_kwh=0.95),
    PVReading(year=2025, month=8, production_kwh=510.0, meter_180=7100.0, meter_280=10060.0, price_per_kwh=0.95),
    PVReading(year=2025, month=9, production_kwh=380.0, meter_180=7320.0, meter_280=10262.0, price_per_kwh=0.95),
    PVReading(year=2025, month=10, production_kwh=220.0, meter_180=7570.0, meter_280=10360.0, price_per_kwh=0.95),
    PVReading(year=2025, month=11, production_kwh=90.0, meter_180=7870.0, meter_280=10390.0, price_per_kwh=0.95),
    PVReading(year=2025, month=12, production_kwh=50.0, meter_180=8220.0, meter_280=10400.0, price_per_kwh=0.95),
]

class MetricsUpdate(BaseModel):
    production_kwh: float
    import_kwh: float
    export_kwh: float
    self_consumption_kwh: float
    self_consumption_percent: float
    grid_balance_kwh: float
    financial_balance_pln: float
    energy_price_pln: float = 0.95
    year: int = 2025
    month: int = 9

# Stan w pamięci dla Home Assistanta
latest_metrics_state = {
    "production_kwh": 380.0,
    "import_kwh": 220.0,
    "export_kwh": 202.0,
    "self_consumption_kwh": 178.0,
    "self_consumption_percent": 46.8,
    "coverage_percent": 44.7,
    "grid_balance_kwh": -58.4,
    "financial_balance_pln": 113.62,
    "energy_price_pln": 0.95,
    "year": 2025,
    "month": 9,
    "month_name": "Wrzesień",
    "forecast_today_kwh": 14.8,
    "forecast_tomorrow_kwh": 18.2,
    "best_window_tomorrow": "11:00 - 14:00"
}

@app.get("/")
def get_root():
    return {
        "app": "Monitor PV (Python Edition)",
        "status": "online",
        "features": [
            "Net-metering 0.8 Calculation Engine",
            "Open-Meteo Solar Forecast",
            "Smart Energy Insights",
            "Home Assistant REST / MQTT Integration",
            "Excel (XLSX) & PDF Reporting"
        ]
    }

@app.get("/api/v1/metrics/latest")
def get_latest_metrics():
    """Endpoint dla integracji Home Assistant RESTful Sensor"""
    return {
        "status": "success",
        **latest_metrics_state
    }

@app.post("/api/v1/metrics/latest")
def update_latest_metrics(data: MetricsUpdate):
    global latest_metrics_state
    latest_metrics_state.update(data.model_dump())
    return {"status": "success", "metrics": latest_metrics_state}

@app.get("/api/v1/forecast")
def get_forecast(lat: float = 52.2297, lon: float = 21.0122, peak_kwp: float = 3.8):
    """Prognoza generacji PV na najbliższe 72h z Open-Meteo API"""
    res = fetch_solar_forecast(latitude=lat, longitude=lon, peak_power_kwp=peak_kwp)
    return res.to_dict()

@app.get("/api/v1/insights")
def get_insights(month: int = 9, price: float = 0.95):
    """Inteligentne wskazówki dotyczące optymalizacji autokonsumpcji"""
    reading = next((r for r in sample_readings if r.month == month), sample_readings[8])
    rep = calculate_monthly_report(reading, sample_readings, [sample_baseline])
    insights = generate_smart_insights(rep, energy_price=price)
    return insights

@app.get("/api/v1/yearly-summary")
def get_yearly_summary(year: int = 2025):
    """Zestawienie roczne od stycznia do grudnia z współczynnikiem 0.8"""
    summary = calculate_yearly_summary(year, sample_readings, [sample_baseline])
    return summary.to_dict()

@app.get("/api/v1/export/excel")
def download_excel(year: int = 2025):
    """Eksport rocznego zestawienia do pliku Excel (.xlsx)"""
    summary = calculate_yearly_summary(year, sample_readings, [sample_baseline])
    excel_bytes = generate_excel_report(summary)
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=Raport_PV_{year}.xlsx"}
    )

@app.get("/api/v1/export/pdf")
def download_pdf(year: int = 2025):
    """Eksport eleganckiego raportu PDF z tabelą bilansu prosumenckiego"""
    summary = calculate_yearly_summary(year, sample_readings, [sample_baseline])
    pdf_bytes = generate_pdf_report(summary)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Raport_PV_{year}.pdf"}
    )

def run_cli_demo():
    print("=" * 75)
    print("          MONITOR PV (PYTHON) - SYMULACJA BILANSU ROCZNEGO (0.8)")
    print("=" * 75)

    summary = calculate_yearly_summary(2025, sample_readings, [sample_baseline])

    print(f"\nROK: {summary.year}")
    print(f"Produkcja całkowita:          {summary.total_production_kwh:>8.1f} kWh")
    print(f"Pobór z sieci (1.8.0):         {summary.total_import_kwh:>8.1f} kWh")
    print(f"Oddanie do sieci (2.8.0):      {summary.total_export_kwh:>8.1f} kWh")
    print(f"Oddanie po opuście (0.8):      {summary.total_corrected_grid_08_kwh:>8.1f} kWh")
    print(f"Autokonsumpcja:                {summary.total_self_consumption_kwh:>8.1f} kWh ({summary.avg_self_consumption_percent:.1f}%)")
    print(f"Bilans sieci (0.8 * Odd - Pob):{summary.total_grid_balance_kwh:>+8.1f} kWh")
    print(f"Saldo finansowe:               {summary.total_financial_balance_pln:>+8.2f} PLN")

    print("\n--- TABELA MIESIĘCZNA (STYCZEŃ - GRUDZIEŃ) ---")
    print(f"{'Miesiąc':<12} | {'Prod [kWh]':<10} | {'Oddano 0.8':<10} | {'Pobór':<8} | {'Autokons. %':<11} | {'Saldo PLN':<10}")
    print("-" * 75)
    for m in summary.monthly_reports:
        print(f"{m.month_name:<12} | {m.production_kwh:>10.1f} | {m.corrected_grid_energy_kwh:>10.1f} | {m.import_from_grid_kwh:>8.1f} | {m.self_consumption_percent:>10.1f}% | {m.financial_balance_pln:>+9.2f}")

    print("\n--- TEST: INTELIGENTNE REKOMENDACJE (WRZESIEŃ) ---")
    september_rep = summary.monthly_reports[8]
    insight = generate_smart_insights(september_rep)
    print(f"Tytuł:   {insight['title']} [{insight['badge']}]")
    print(f"Wskazówka: {insight['message']}")
    print("Działania:")
    for act in insight['actions']:
        print(f"  * {act}")

    print("\n--- GENEROWANIE RAPORTÓW EXCEL I PDF ---")
    generate_excel_report(summary, "Raport_PV_2025.xlsx")
    print("Wygenerowano plik: Raport_PV_2025.xlsx")
    generate_pdf_report(summary, "Raport_PV_2025.pdf")
    print("Wygenerowano plik: Raport_PV_2025.pdf")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Monitor PV Python Engine")
    parser.add_argument("--demo", action="store_true", help="Uruchom symulację i wygeneruj raporty demonstracyjne")
    parser.add_argument("--port", type=int, default=8000, help="Port serwera FastAPI")

    args = parser.parse_args()
    if args.demo or len(sys.argv) == 1:
        run_cli_demo()
    else:
        import uvicorn
        uvicorn.run("main:app", host="0.0.0.0", port=args.port, reload=True)
