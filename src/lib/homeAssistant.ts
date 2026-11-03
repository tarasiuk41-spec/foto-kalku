export interface SmartHomeSettings {
  webhookUrl: string;
  autoSendOnSave: boolean;
  installationName: string;
  peakPowerKwp: number;
  latitude: number;
  longitude: number;
  cityName: string;
}

export const DEFAULT_SMART_HOME_SETTINGS: SmartHomeSettings = {
  webhookUrl: '',
  autoSendOnSave: false,
  installationName: 'Instalacja PV Dom',
  peakPowerKwp: 3.8,
  latitude: 52.2297,
  longitude: 21.0122,
  cityName: 'Warszawa',
};

export interface PVWebhookPayload {
  event: 'pv_reading_saved' | 'pv_metrics_sync' | 'test_ping';
  timestamp: string;
  installation: {
    name: string;
    peakPowerKwp: number;
    billingType: string;
  };
  metrics: {
    year: number;
    month: number;
    monthName: string;
    production_kwh: number;
    import_kwh: number;
    export_kwh: number;
    self_consumption_kwh: number;
    self_consumption_percent: number;
    coverage_percent: number;
    corrected_grid_energy_08_kwh: number;
    grid_balance_kwh: number;
    financial_balance_pln: number;
    energy_price_pln: number;
  };
  forecast?: {
    today_kwh: number;
    tomorrow_kwh: number;
    best_window: string;
  };
}

export function getStoredSmartHomeSettings(): SmartHomeSettings {
  try {
    const raw = localStorage.getItem('pv-smart-home-settings');
    if (raw) {
      return { ...DEFAULT_SMART_HOME_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Error reading smart home settings:', e);
  }
  return DEFAULT_SMART_HOME_SETTINGS;
}

export function saveStoredSmartHomeSettings(settings: SmartHomeSettings): void {
  try {
    localStorage.setItem('pv-smart-home-settings', JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving smart home settings:', e);
  }
}

/**
 * Wysyła payload do webhooka (np. Home Assistant / Node-RED / n8n)
 * Używamy proxy na serwerze `/api/v1/webhook/dispatch` aby uniknąć problemów z CORS.
 */
export async function sendWebhook(
  url: string,
  payload: PVWebhookPayload
): Promise<{ success: boolean; message: string; statusCode?: number }> {
  if (!url || !url.startsWith('http')) {
    return { success: false, message: 'Podaj poprawny adres URL webhooka (zaczynający się od http:// lub https://).' };
  }

  try {
    // Najpierw próbujemy przez backend proxy
    const response = await fetch('/api/v1/webhook/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUrl: url, payload }),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: 'Webhook wysłany pomyślnie!', statusCode: data.statusCode || 200 };
    }

    // Fallback bezpośredni z przeglądarki
    const directRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors'
    });

    if (directRes.ok) {
      return { success: true, message: 'Webhook dostarczony pomyślnie bezpośrednio z przeglądarki!', statusCode: directRes.status };
    } else {
      return { success: false, message: `Otrzymano błąd od odbiorcy: ${directRes.status} ${directRes.statusText}`, statusCode: directRes.status };
    }
  } catch (err: any) {
    return { 
      success: false, 
      message: `Nie udało się nawiązać połączenia z webhookiem: ${err.message || 'Błąd sieci / CORS'}` 
    };
  }
}

/**
 * Generuje konfigurację YAML dla integracji RESTful Sensor w Home Assistant
 */
export function generateHomeAssistantYaml(apiOrigin?: string): string {
  const host = apiOrigin || window.location.origin;
  return `# ========================================================
# Konfiguracja Home Assistant (sensor.yaml lub configuration.yaml)
# Monitor PV - RESTful Sensor
# ========================================================

sensor:
  - platform: rest
    name: "Monitor PV"
    resource: "${host}/api/v1/metrics/latest"
    scan_interval: 300
    json_attributes:
      - production_kwh
      - import_kwh
      - export_kwh
      - self_consumption_kwh
      - self_consumption_percent
      - coverage_percent
      - grid_balance_kwh
      - financial_balance_pln
      - forecast_today_kwh
      - forecast_tomorrow_kwh
      - best_window_tomorrow
      - last_updated
    value_template: "{{ value_json.production_kwh }}"
    unit_of_measurement: "kWh"
    device_class: energy
    state_class: total_increasing

# Opcjonalne sensory pomocnicze do wstawienia na Dashboard Lovelace:
template:
  - sensor:
      - name: "PV Autokonsumpcja"
        unit_of_measurement: "%"
        state: "{{ state_attr('sensor.monitor_pv', 'self_consumption_percent') | round(1) }}"
        icon: "mdi:solar-power-variant"

      - name: "PV Saldo Finansowe"
        unit_of_measurement: "PLN"
        state: "{{ state_attr('sensor.monitor_pv', 'financial_balance_pln') | round(2) }}"
        icon: "mdi:cash-multiple"

      - name: "PV Prognoza Jutro"
        unit_of_measurement: "kWh"
        state: "{{ state_attr('sensor.monitor_pv', 'forecast_tomorrow_kwh') }}"
        icon: "mdi:weather-sunny"

      - name: "PV Najlepsze Okno Energetyczne"
        state: "{{ state_attr('sensor.monitor_pv', 'best_window_tomorrow') }}"
        icon: "mdi:clock-fast"
`;
}
