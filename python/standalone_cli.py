#!/usr/bin/env python3
"""
Monitor PV - Standalone CLI (Czysty Python 3, bez zewnętrznych zależności)
Działa natychmiast na każdym systemie z Pythonem 3.7+ (używa wyłącznie biblioteki standardowej: urllib, json, csv).
"""

import urllib.request
import json
import csv
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import List, Dict, Any

MONTH_NAMES = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
]

@dataclass
class Reading:
    month: int
    production: float
    meter_180: float
    meter_280: float
    price_pln: float = 0.95

def run_pure_python_monitor():
    print("=" * 80)
    print("      MONITOR PV - PURE PYTHON CLI (STANDARD LIBRARY ONLY)")
    print("=" * 80)

    # 1. Baza początkowa (stan 31.12 roku ubiegłego)
    base_180 = 5200.0
    base_280 = 8100.0

    # 2. Przykładowe odczyty 12 miesięcy
    readings = [
        Reading(1,  65.0,  5550.0, 8120.0),
        Reading(2,  145.0, 5860.0, 8170.0),
        Reading(3,  310.0, 6110.0, 8320.0),
        Reading(4,  430.0, 6330.0, 8560.0),
        Reading(5,  580.0, 6520.0, 8920.0),
        Reading(6,  620.0, 6710.0, 9330.0),
        Reading(7,  590.0, 6900.0, 9710.0),
        Reading(8,  510.0, 7100.0, 10060.0),
        Reading(9,  380.0, 7320.0, 10262.0),
        Reading(10, 220.0, 7570.0, 10360.0),
        Reading(11, 90.0,  7870.0, 10390.0),
        Reading(12, 50.0,  8220.0, 10400.0),
    ]

    print(f"\nStan bazowy liczników (31.12): 1.8.0={base_180:.1f} kWh | 2.8.0={base_280:.1f} kWh\n")
    print(f"{'Miesiąc':<11} | {'Produkcja':<10} | {'Pobór':<8} | {'Oddano':<8} | {'Oddano 0.8':<10} | {'Autokons.':<10} | {'AK %':<6} | {'Bilans Sieci':<12} | {'Saldo PLN':<10}")
    print("-" * 105)

    tot_prod = 0.0
    tot_imp = 0.0
    tot_exp = 0.0
    tot_corr = 0.0
    tot_ak = 0.0
    tot_fin = 0.0

    table_rows = []

    prev_180 = base_180
    prev_280 = base_280

    for r in readings:
        imp = max(0.0, r.meter_180 - prev_180)
        exp = max(0.0, r.meter_280 - prev_280)
        ak = max(0.0, r.production - exp)
        corr_exp = exp * 0.8
        grid_bal = corr_exp - imp
        ak_pct = (ak / r.production * 100.0) if r.production > 0 else 0.0
        fin_bal = (ak * r.price_pln) + (grid_bal * r.price_pln)

        m_name = MONTH_NAMES[r.month - 1]
        print(f"{m_name:<11} | {r.production:>8.1f} k | {imp:>6.1f} k | {exp:>6.1f} k | {corr_exp:>8.1f} k | {ak:>8.1f} k | {ak_pct:>5.1f}% | {grid_bal:>+10.1f} k | {fin_bal:>+9.2f} zł")

        tot_prod += r.production
        tot_imp += imp
        tot_exp += exp
        tot_corr += corr_exp
        tot_ak += ak
        tot_fin += fin_bal

        table_rows.append({
            "Miesiac": m_name,
            "Produkcja_kWh": round(r.production, 2),
            "Pobor_180_kWh": round(imp, 2),
            "Oddano_280_kWh": round(exp, 2),
            "Oddano_08_kWh": round(corr_exp, 2),
            "Autokonsumpcja_kWh": round(ak, 2),
            "Autokonsumpcja_Procent": round(ak_pct, 1),
            "Bilans_Sieci_kWh": round(grid_bal, 2),
            "Saldo_Finansowe_PLN": round(fin_bal, 2)
        })

        prev_180 = r.meter_180
        prev_280 = r.meter_280

    print("-" * 105)
    tot_ak_pct = (tot_ak / tot_prod * 100.0) if tot_prod > 0 else 0.0
    tot_grid_bal = tot_corr - tot_imp
    print(f"{'SUMA ROCZNA':<11} | {tot_prod:>8.1f} k | {tot_imp:>6.1f} k | {tot_exp:>6.1f} k | {tot_corr:>8.1f} k | {tot_ak:>8.1f} k | {tot_ak_pct:>5.1f}% | {tot_grid_bal:>+10.1f} k | {tot_fin:>+9.2f} zł")

    # Zapis do pliku CSV (zgodny z Excel)
    csv_file = "raport_pv_roczny.csv"
    with open(csv_file, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(table_rows[0].keys()), delimiter=";")
        writer.writeheader()
        writer.writerows(table_rows)
    print(f"\n[OK] Zapisano zestawienie roczne do pliku: {csv_file}")

    # Pobranie prognozy z Open-Meteo bez zewnętrznych bibliotek (urllib)
    print("\n--- POBIERANIE PROGNOZY SOLARNEJ Z OPEN-METEO DLA WARSZAWY (72H) ---")
    try:
        url = "https://api.open-meteo.com/v1/forecast?latitude=52.2297&longitude=21.0122&hourly=shortwave_radiation,temperature_2m&timezone=auto&forecast_days=3"
        req = urllib.request.Request(url, headers={"User-Agent": "MonitorPV-PurePython/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            forecast_data = json.loads(resp.read().decode())
            hourly = forecast_data.get("hourly", {})
            times = hourly.get("time", [])
            rads = hourly.get("shortwave_radiation", [])

            now_str = datetime.now().strftime("%Y-%m-%d")
            tom_str = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

            today_kwh = 0.0
            tom_kwh = 0.0
            peak_kwp = 3.8
            eta = 0.82

            for t, r in zip(times, rads):
                date_part = t.split("T")[0]
                kw = peak_kwp * (r / 1000.0) * eta
                if date_part == now_str:
                    today_kwh += kw
                elif date_part == tom_str:
                    tom_kwh += kw

            print(f"Prognoza produkcji DZIŚ:  {today_kwh:.1f} kWh")
            print(f"Prognoza produkcji JUTRO: {tom_kwh:.1f} kWh")
            print("Najlepsze okno na uruchomienie sprzętów (CWU, EV, pompa ciepła): 11:30 - 14:30")
    except Exception as e:
        print(f"Brak połączenia z Open-Meteo: {e}")

if __name__ == "__main__":
    run_pure_python_monitor()
