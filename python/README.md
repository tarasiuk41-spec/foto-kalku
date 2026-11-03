# Monitor PV - Wersja Python 🐍

Kompletna implementacja silnika analitycznego fotowoltaiki, prognozowania pogody i integracji Smart Home w języku Python.

## 📁 Struktura plików:

1. **`standalone_cli.py`** – Wersja autonomiczna w **czystym Pythonie (standard library only)**. Działa od razu bez konieczności instalowania jakichkolwiek paczek (`pip`). Pobiera dane pogodowe z Open-Meteo, liczy bilans roczny 0.8 i eksportuje do CSV.
2. **`models.py`** – Silnik matematyczny kalkulacji prosumenckich: Net-metering (opust 0.8), autokonsumpcja, bilans sieci, saldo finansowe, symulacja magazynu energii.
3. **`insights.py`** – Inteligentne rekomendacje energetyczne (*Smart Energy Insights*), wyliczające potencjał przesunięcia obciążenia na okno 11:00-15:00 i oszczędności PLN.
4. **`forecast.py`** – Integracja z Open-Meteo Solar Radiation API (przeliczanie $W/m^2$ na moc kW i energię kWh z uwzględnieniem deratingu termicznego).
5. **`ha_mqtt.py`** – Obsługa webhooków oraz klienta MQTT z funkcją Home Assistant Auto-Discovery.
6. **`reports.py`** – Generowanie raportów Excel (`.xlsx` przez `openpyxl`) oraz PDF (`reportlab`).
7. **`main.py`** – Serwer REST API (FastAPI) udostępniający endpointy `/api/v1/metrics/latest`, `/api/v1/forecast`, `/api/v1/export/excel`, `/api/v1/export/pdf`.

---

## 🚀 Uruchomienie:

### 1. Szybki start (Czysty Python, bez instalacji bibliotek):
```bash
python3 python/standalone_cli.py
```

### 2. Pełny pakiet z serwerem FastAPI i raportami PDF/Excel:
```bash
pip install -r python/requirements.txt

# Uruchomienie serwera API (port 8000)
python3 python/main.py --serve --port 8000

# Lub tryb demonstracyjny (generuje raporty Excel i PDF)
python3 python/main.py --demo
```
