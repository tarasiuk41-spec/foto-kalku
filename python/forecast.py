"""
Prognoza Generacji PV (Open-Meteo API Solar Radiation)
Pobieranie promieniowania słonecznego i przeliczanie na prognozowaną moc i energię PV.
"""

from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import requests

@dataclass
class HourlyForecast:
    time: str
    hour: int
    date_str: str
    day_label: str
    radiation_wm2: float
    estimated_kw: float
    estimated_kwh: float
    temperature_c: float
    cloud_cover_percent: float

@dataclass
class SolarForecastResult:
    location_name: str
    latitude: float
    longitude: float
    peak_power_kwp: float
    efficiency_percent: float
    today_kwh: float
    tomorrow_kwh: float
    day_after_tomorrow_kwh: float
    best_window_today: Dict[str, Any]
    best_window_tomorrow: Dict[str, Any]
    hourly: List[HourlyForecast]
    updated_at: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            **asdict(self),
            "hourly": [asdict(h) for h in self.hourly]
        }

def fetch_solar_forecast(
    latitude: float = 52.2297,
    longitude: float = 21.0122,
    peak_power_kwp: float = 3.8,
    efficiency_percent: float = 82.0,
    location_name: str = "Warszawa"
) -> SolarForecastResult:
    """
    Pobiera dane z darmowego Open-Meteo API i wylicza przewidywaną generację PV na 72 godziny.
    """
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}&longitude={longitude}"
        f"&hourly=shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m,cloudcover"
        f"&timezone=auto&forecast_days=3"
    )

    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    hourly_data = data.get("hourly", {})
    times = hourly_data.get("time", [])
    radiations = hourly_data.get("shortwave_radiation", [])
    temps = hourly_data.get("temperature_2m", [])
    clouds = hourly_data.get("cloudcover", [])

    eta = efficiency_percent / 100.0
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")
    tomorrow_str = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    day_after_str = (now + timedelta(days=2)).strftime("%Y-%m-%d")

    processed: List[HourlyForecast] = []

    for i in range(len(times)):
        iso_str = times[i]
        date_part, time_part = iso_str.split("T")
        hour = int(time_part.split(":")[0])
        rad = max(0.0, float(radiations[i] or 0))
        temp = float(temps[i] if i < len(temps) and temps[i] is not None else 15.0)
        cloud = float(clouds[i] if i < len(clouds) and clouds[i] is not None else 0.0)

        # Współczynnik straty cieplnej paneli krzemowych (-0.38%/°C powyżej 25°C)
        temp_derating = (1.0 - ((temp - 25.0) * 0.0038)) if temp > 25.0 else 1.0

        # Moc szacunkowa kW
        est_kw = max(0.0, min(peak_power_kwp * 1.1, peak_power_kwp * (rad / 1000.0) * eta * temp_derating))
        est_kwh = est_kw * 1.0  # krok 1h

        if date_part == today_str:
            day_label = "Dziś"
        elif date_part == tomorrow_str:
            day_label = "Jutro"
        elif date_part == day_after_str:
            day_label = "Pojutrze"
        else:
            day_label = date_part

        processed.append(HourlyForecast(
            time=iso_str,
            hour=hour,
            date_str=date_part,
            day_label=day_label,
            radiation_wm2=round(rad, 1),
            estimated_kw=round(est_kw, 2),
            estimated_kwh=round(est_kwh, 2),
            temperature_c=round(temp, 1),
            cloud_cover_percent=round(cloud, 1)
        ))

    today_items = [p for p in processed if p.date_str == today_str]
    tomorrow_items = [p for p in processed if p.date_str == tomorrow_str]
    day_after_items = [p for p in processed if p.date_str == day_after_str]

    today_kwh = round(sum(p.estimated_kwh for p in today_items), 1)
    tomorrow_kwh = round(sum(p.estimated_kwh for p in tomorrow_items), 1)
    day_after_kwh = round(sum(p.estimated_kwh for p in day_after_items), 1)

    def find_best_window(items: List[HourlyForecast]) -> Dict[str, Any]:
        if not items:
            return {"start_hour": "11:00", "end_hour": "14:00", "peak_kw": 0.0, "description": "Brak danych"}
        best_sum = 0.0
        best_start = 11
        peak_kw = 0.0

        for h in range(8, 18):
            window = [p for p in items if h <= p.hour < h + 3]
            s = sum(p.estimated_kwh for p in window)
            if s > best_sum:
                best_sum = s
                best_start = h
                peak_kw = max((p.estimated_kw for p in window), default=0.0)

        start_str = f"{best_start:02d}:00"
        end_str = f"{(best_start + 3):02d}:00"
        return {
            "start_hour": start_str,
            "end_hour": end_str,
            "peak_kw": round(peak_kw, 2),
            "description": f"Najwyższa produkcja między {start_str} a {end_str} (moc szczytowa do {round(peak_kw, 1)} kW)"
        }

    return SolarForecastResult(
        location_name=location_name,
        latitude=latitude,
        longitude=longitude,
        peak_power_kwp=peak_power_kwp,
        efficiency_percent=efficiency_percent,
        today_kwh=today_kwh,
        tomorrow_kwh=tomorrow_kwh,
        day_after_tomorrow_kwh=day_after_kwh,
        best_window_today=find_best_window(today_items),
        best_window_tomorrow=find_best_window(tomorrow_items),
        hourly=processed,
        updated_at=datetime.now().strftime("%H:%M")
    )
