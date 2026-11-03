export interface LocationPreset {
  name: string;
  latitude: number;
  longitude: number;
}

export const POLISH_CITIES: LocationPreset[] = [
  { name: 'Warszawa', latitude: 52.2297, longitude: 21.0122 },
  { name: 'Kraków', latitude: 50.0647, longitude: 19.9450 },
  { name: 'Wrocław', latitude: 51.1079, longitude: 17.0385 },
  { name: 'Poznań', latitude: 52.4064, longitude: 16.9252 },
  { name: 'Gdańsk', latitude: 54.3520, longitude: 18.6466 },
  { name: 'Katowice / Śląsk', latitude: 50.2649, longitude: 19.0238 },
  { name: 'Łódź', latitude: 51.7592, longitude: 19.4560 },
  { name: 'Lublin', latitude: 51.2465, longitude: 22.5684 },
  { name: 'Rzeszów', latitude: 50.0412, longitude: 21.9991 },
  { name: 'Białystok', latitude: 53.1325, longitude: 23.1688 },
  { name: 'Szczecin', latitude: 53.4285, longitude: 14.5528 },
];

export interface HourlyForecastItem {
  time: string;           // ISO or formatted
  hour: number;           // 0 - 23
  dateStr: string;        // YYYY-MM-DD
  dayLabel: 'Dziś' | 'Jutro' | 'Pojutrze' | string;
  radiationWm2: number;   // W/m2
  estimatedKw: number;    // kW output power
  estimatedKwh: number;   // kWh in this hour
  temperatureC: number;
  cloudCoverPercent: number;
}

export interface SolarForecastResult {
  locationName: string;
  latitude: number;
  longitude: number;
  peakPowerKwp: number;
  efficiencyPercent: number;
  todayKwh: number;
  tomorrowKwh: number;
  dayAfterTomorrowKwh: number;
  bestWindowToday: {
    startHour: string;
    endHour: string;
    peakKw: number;
    description: string;
  };
  bestWindowTomorrow: {
    startHour: string;
    endHour: string;
    peakKw: number;
    description: string;
  };
  hourly: HourlyForecastItem[];
  updatedAt: string;
}

/**
 * Pobiera prognozę nasłonecznienia z Open-Meteo i przelicza na energię z instalacji PV
 */
export async function fetchSolarForecast(
  latitude: number,
  longitude: number,
  peakPowerKwp: number = 3.8,
  efficiencyPercent: number = 82,
  locationName: string = 'Lokalizacja'
): Promise<SolarForecastResult> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m,cloudcover&timezone=auto&forecast_days=3`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Błąd pobierania prognozy z Open-Meteo: status ${res.status}`);
  }

  const data = await res.json();
  const hourly = data.hourly;
  if (!hourly || !hourly.time) {
    throw new Error('Nieprawidłowy format danych z Open-Meteo API');
  }

  const times: string[] = hourly.time;
  const radiations: number[] = hourly.shortwave_radiation || [];
  const temps: number[] = hourly.temperature_2m || [];
  const clouds: number[] = hourly.cloudcover || [];

  const eta = (efficiencyPercent || 82) / 100;
  const pPeak = peakPowerKwp || 3.8;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const dayAfterStr = dayAfter.toISOString().split('T')[0];

  const processedItems: HourlyForecastItem[] = [];

  for (let i = 0; i < times.length; i++) {
    const timeIso = times[i];
    const itemDate = new Date(timeIso);
    const datePart = timeIso.split('T')[0];
    const hour = itemDate.getHours();
    const rad = Math.max(0, radiations[i] || 0);
    const temp = temps[i] ?? 15;
    const cloud = clouds[i] ?? 0;

    // Współczynnik temperaturowy dla paneli krzemowych (~ -0.38%/°C powyżej 25°C)
    const tempDerating = temp > 25 ? 1 - ((temp - 25) * 0.0038) : 1;

    // Przeliczenie na moc i energię:
    // P = P_peak * (Radiation / 1000 W/m2) * sprawność * derating
    const estimatedKw = Math.max(0, Math.min(pPeak * 1.1, pPeak * (rad / 1000) * eta * tempDerating));
    const estimatedKwh = estimatedKw * 1; // 1-hour step

    let dayLabel = 'Inny dzień';
    if (datePart === todayStr) dayLabel = 'Dziś';
    else if (datePart === tomorrowStr) dayLabel = 'Jutro';
    else if (datePart === dayAfterStr) dayLabel = 'Pojutrze';

    processedItems.push({
      time: timeIso,
      hour,
      dateStr: datePart,
      dayLabel,
      radiationWm2: Math.round(rad),
      estimatedKw: Math.round(estimatedKw * 100) / 100,
      estimatedKwh: Math.round(estimatedKwh * 100) / 100,
      temperatureC: Math.round(temp),
      cloudCoverPercent: Math.round(cloud),
    });
  }

  // Oblicz sumy dla dni
  const todayItems = processedItems.filter(p => p.dateStr === todayStr);
  const tomorrowItems = processedItems.filter(p => p.dateStr === tomorrowStr);
  const dayAfterItems = processedItems.filter(p => p.dateStr === dayAfterStr);

  const todayKwh = Math.round(todayItems.reduce((acc, curr) => acc + curr.estimatedKwh, 0) * 10) / 10;
  const tomorrowKwh = Math.round(tomorrowItems.reduce((acc, curr) => acc + curr.estimatedKwh, 0) * 10) / 10;
  const dayAfterTomorrowKwh = Math.round(dayAfterItems.reduce((acc, curr) => acc + curr.estimatedKwh, 0) * 10) / 10;

  // Znajdź najlepsze okno 3-godzinne dla dziś i jutro
  const findBestWindow = (items: HourlyForecastItem[]) => {
    if (items.length === 0) {
      return { startHour: '11:00', endHour: '14:00', peakKw: 0, description: 'Brak danych' };
    }
    let maxKwhSum = 0;
    let bestStartHour = 11;
    let peakKwInWindow = 0;

    for (let h = 8; h <= 17; h++) {
      const windowItems = items.filter(it => it.hour >= h && it.hour < h + 3);
      const sum = windowItems.reduce((acc, curr) => acc + curr.estimatedKwh, 0);
      if (sum > maxKwhSum) {
        maxKwhSum = sum;
        bestStartHour = h;
        peakKwInWindow = Math.max(...windowItems.map(w => w.estimatedKw), 0);
      }
    }

    const startFormatted = `${String(bestStartHour).padStart(2, '0')}:00`;
    const endFormatted = `${String(bestStartHour + 3).padStart(2, '0')}:00`;

    return {
      startHour: startFormatted,
      endHour: endFormatted,
      peakKw: Math.round(peakKwInWindow * 10) / 10,
      description: `Najwyższa produkcja między ${startFormatted} a ${endFormatted} (moc do ${Math.round(peakKwInWindow * 10) / 10} kW)`
    };
  };

  const bestWindowToday = findBestWindow(todayItems);
  const bestWindowTomorrow = findBestWindow(tomorrowItems);

  return {
    locationName,
    latitude,
    longitude,
    peakPowerKwp: pPeak,
    efficiencyPercent,
    todayKwh,
    tomorrowKwh,
    dayAfterTomorrowKwh,
    bestWindowToday,
    bestWindowTomorrow,
    hourly: processedItems,
    updatedAt: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
  };
}
