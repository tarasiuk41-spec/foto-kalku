export type TariffType = 'rce' | 'g12' | 'g12w' | 'g11' | 'custom';

export interface HourlyTariffPrice {
  hour: number;                 // 0 - 23
  timeLabel: string;            // "00:00", "01:00", etc.
  periodLabel: string;          // "00:00 - 01:00"
  date: string;                 // "YYYY-MM-DD"
  rce_pln_mwh: number;          // Cena hurtowa PSE (PLN/MWh)
  rce_pln_kwh: number;          // Cena hurtowa PSE (PLN/kWh)
  dynamic_retail_kwh: number;   // Cena z dystrybucją i podatkami
  g11_price_kwh: number;        // Taryfa płaska
  g12_price_kwh: number;        // Taryfa G12
  g12_zone: 'peak' | 'offpeak'; // Szczyt / Pozaszczyt
  g12w_price_kwh: number;       // Taryfa G12w
  g12w_zone: 'peak' | 'offpeak';
  activePrice: number;          // Cena dla aktualnie wybranej taryfy
  activeZone: 'peak' | 'offpeak' | 'standard';
  priceCategory: 'negative' | 'super_cheap' | 'cheap' | 'moderate' | 'expensive' | 'extreme_peak';
  isCurrentHour: boolean;
  recommendation: 'charge_now' | 'self_consume' | 'export_beneficial' | 'avoid_grid' | 'battery_discharge';
  actionText: string;
  solarKwEstimate?: number;     // Skorelowana prognoza PV
}

export interface TariffDayData {
  date: string;
  dayLabel: 'Dzisiaj' | 'Jutro' | string;
  isWeekend: boolean;
  source: 'pse_live' | 'pse_day_ahead' | 'simulated_forecast';
  hours: HourlyTariffPrice[];
  summary: {
    minPrice: { hour: number; price: number; time: string };
    maxPrice: { hour: number; price: number; time: string };
    avgPrice: number;
    spread: number;
    currentHourPrice?: number;
    bestChargeWindows: { start: string; end: string; avgPrice: number; description: string }[];
    avoidConsumptionWindows: { start: string; end: string; avgPrice: number; description: string }[];
    potentialEvSavings: number;      // Oszczędność na 50 kWh baterii EV
    potentialHeatPumpSavings: number; // Oszczędność na 15 kWh CWU
  };
}

export interface TariffSettings {
  tariffType: TariffType;
  includeDistribution: boolean;
  distributionFee: number;        // PLN/kWh (domyślnie ~0.35)
  vatRate: number;                // 0.23 (23%)
  g11Rate: number;                // PLN/kWh (domyślnie ~0.98)
  g12PeakRate: number;            // PLN/kWh (domyślnie ~1.18)
  g12OffpeakRate: number;         // PLN/kWh (domyślnie ~0.65)
  g12wPeakRate: number;           // PLN/kWh (domyślnie ~1.18)
  g12wOffpeakRate: number;        // PLN/kWh (domyślnie ~0.62)
  evBatteryKwh: number;           // Pojemność EV do kalkulatora (np. 50 kWh)
  heatPumpBufferKwh: number;      // Pojemność bufora CWU (np. 15 kWh)
  batteryStorageKwh: number;      // Magazyn domowy (np. 10 kWh)
}

export const DEFAULT_TARIFF_SETTINGS: TariffSettings = {
  tariffType: 'rce',
  includeDistribution: true,
  distributionFee: 0.35,
  vatRate: 0.23,
  g11Rate: 0.98,
  g12PeakRate: 1.18,
  g12OffpeakRate: 0.65,
  g12wPeakRate: 1.18,
  g12wOffpeakRate: 0.62,
  evBatteryKwh: 50,
  heatPumpBufferKwh: 15,
  batteryStorageKwh: 10,
};

export function getStoredTariffSettings(): TariffSettings {
  try {
    const raw = localStorage.getItem('pv-tariff-settings');
    if (raw) {
      return { ...DEFAULT_TARIFF_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Błąd odczytu ustawień taryf:', e);
  }
  return DEFAULT_TARIFF_SETTINGS;
}

export function saveStoredTariffSettings(settings: TariffSettings): void {
  try {
    localStorage.setItem('pv-tariff-settings', JSON.stringify(settings));
  } catch (e) {
    console.error('Błąd zapisu ustawień taryf:', e);
  }
}

/**
 * Zwraca czy dany dzień to weekend w Polsce (sobota lub niedziela)
 */
export function isPolishWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0 = niedziela, 6 = sobota
  return day === 0 || day === 6;
}

/**
 * Sprawdza czy godzina w taryfie G12 jest pozaszczytowa
 * Standard w Polsce: 13:00 - 15:00 oraz 22:00 - 06:00
 */
export function isG12OffPeak(hour: number): boolean {
  return (hour >= 13 && hour < 15) || hour >= 22 || hour < 6;
}

/**
 * Sprawdza czy godzina w taryfie G12w jest pozaszczytowa
 * W weekendy cała doba jest pozaszczytowa, w dni robocze jak G12
 */
export function isG12wOffPeak(hour: number, isWeekend: boolean): boolean {
  if (isWeekend) return true;
  return isG12OffPeak(hour);
}

/**
 * Kategoryzuje cenę energii na progi intuicyjne dla użytkownika
 */
export function getPriceCategory(priceKwh: number): HourlyTariffPrice['priceCategory'] {
  if (priceKwh <= 0) return 'negative';
  if (priceKwh < 0.40) return 'super_cheap';
  if (priceKwh < 0.65) return 'cheap';
  if (priceKwh < 0.95) return 'moderate';
  if (priceKwh < 1.25) return 'expensive';
  return 'extreme_peak';
}

/**
 * Pobiera dane taryfowe z backendu API (`/api/v1/tariffs/hourly`)
 */
export async function fetchHourlyTariffs(
  date?: string,
  settings: TariffSettings = DEFAULT_TARIFF_SETTINGS
): Promise<{ today: TariffDayData; tomorrow: TariffDayData }> {
  const queryParams = new URLSearchParams();
  if (date) queryParams.set('date', date);
  queryParams.set('distributionFee', settings.distributionFee.toString());
  queryParams.set('vatRate', settings.vatRate.toString());

  const response = await fetch(`/api/v1/tariffs/hourly?${queryParams.toString()}`);
  if (!response.ok) {
    throw new Error(`Błąd pobierania danych taryfowych: HTTP ${response.status}`);
  }

  const json = await response.json();
  if (json.status !== 'success' || !json.today) {
    throw new Error(json.message || 'Niepoprawna odpowiedź API taryf');
  }

  return {
    today: formatDayWithSettings(json.today, settings),
    tomorrow: formatDayWithSettings(json.tomorrow, settings),
  };
}

/**
 * Przelicza dynamicznie aktywne ceny i podsumowania w zależności od wybranych przez usera stawek
 */
export function formatDayWithSettings(
  dayData: TariffDayData,
  settings: TariffSettings
): TariffDayData {
  const now = new Date();
  const currentHour = now.getHours();
  const isToday = dayData.dayLabel === 'Dzisiaj' || dayData.date === now.toISOString().split('T')[0];

  const hours: HourlyTariffPrice[] = dayData.hours.map((item) => {
    let activePrice = item.rce_pln_kwh;
    let activeZone: 'peak' | 'offpeak' | 'standard' = 'standard';

    if (settings.tariffType === 'rce') {
      activePrice = settings.includeDistribution
        ? item.dynamic_retail_kwh
        : item.rce_pln_kwh;
      activeZone = item.priceCategory === 'super_cheap' || item.priceCategory === 'negative' ? 'offpeak' : (item.priceCategory === 'extreme_peak' ? 'peak' : 'standard');
    } else if (settings.tariffType === 'g11') {
      activePrice = settings.g11Rate;
      activeZone = 'standard';
    } else if (settings.tariffType === 'g12') {
      const isOff = isG12OffPeak(item.hour);
      activePrice = isOff ? settings.g12OffpeakRate : settings.g12PeakRate;
      activeZone = isOff ? 'offpeak' : 'peak';
    } else if (settings.tariffType === 'g12w') {
      const isOff = isG12wOffPeak(item.hour, dayData.isWeekend);
      activePrice = isOff ? settings.g12wOffpeakRate : settings.g12wPeakRate;
      activeZone = isOff ? 'offpeak' : 'peak';
    }

    const isCurrent = isToday && item.hour === currentHour;

    // Rekomendacja optymalizacyjna
    let recommendation: HourlyTariffPrice['recommendation'] = 'self_consume';
    let actionText = 'Standardowe zużycie';

    if (item.rce_pln_kwh <= 0.20 || activeZone === 'offpeak') {
      recommendation = 'charge_now';
      actionText = '🟢 TANIA STREFA: Ładuj baterię, uruchom pompę CWU, EV i zmywarkę';
    } else if (activeZone === 'peak' || item.rce_pln_kwh > 0.85) {
      recommendation = 'avoid_grid';
      actionText = '🔴 SZCZYT DROŻYZNY: Unikaj poboru z sieci, zasilaj z PV/magazynu';
    } else {
      recommendation = 'self_consume';
      actionText = '⚪ STREFA UMIARKOWANA: Standardowa autokonsumpcja bieżąca';
    }

    return {
      ...item,
      activePrice: Number(activePrice.toFixed(4)),
      activeZone,
      isCurrentHour: isCurrent,
      recommendation,
      actionText,
    };
  });

  // Obliczenia podsumowujące dla wybranej taryfy
  let minHour = hours[0];
  let maxHour = hours[0];
  let sumPrice = 0;

  hours.forEach((h) => {
    sumPrice += h.activePrice;
    if (h.activePrice < minHour.activePrice) minHour = h;
    if (h.activePrice > maxHour.activePrice) maxHour = h;
  });

  const avgPrice = Number((sumPrice / hours.length).toFixed(4));
  const spread = Number((maxHour.activePrice - minHour.activePrice).toFixed(4));
  const currentHourItem = hours.find((h) => h.isCurrentHour);

  // Wyszukaj 2 najlepsze okna do ładowania
  const cheapThreshold = minHour.activePrice + spread * 0.25;
  const cheapHours = hours.filter((h) => h.activePrice <= cheapThreshold);

  const bestChargeWindows: TariffDayData['summary']['bestChargeWindows'] = [];
  if (cheapHours.length > 0) {
    // Grupowanie sąsiadujących godzin
    let startH = cheapHours[0].hour;
    let prevH = startH;

    for (let i = 1; i < cheapHours.length; i++) {
      if (cheapHours[i].hour === prevH + 1) {
        prevH = cheapHours[i].hour;
      } else {
        bestChargeWindows.push({
          start: `${String(startH).padStart(2, '0')}:00`,
          end: `${String(prevH + 1).padStart(2, '0')}:00`,
          avgPrice: Number(((minHour.activePrice + cheapThreshold) / 2).toFixed(2)),
          description: 'Najniższe ceny energii z sieci',
        });
        startH = cheapHours[i].hour;
        prevH = startH;
      }
    }
    bestChargeWindows.push({
      start: `${String(startH).padStart(2, '0')}:00`,
      end: `${String(prevH + 1).padStart(2, '0')}:00`,
      avgPrice: Number(((minHour.activePrice + cheapThreshold) / 2).toFixed(2)),
      description: 'Zalecane okno ładowania EV i pracy pompy ciepła',
    });
  }

  // Wyszukaj okna szczytu drożyzny
  const expensiveThreshold = maxHour.activePrice - spread * 0.25;
  const expensiveHours = hours.filter((h) => h.activePrice >= expensiveThreshold);
  const avoidConsumptionWindows: TariffDayData['summary']['avoidConsumptionWindows'] = [];
  if (expensiveHours.length > 0) {
    let startH = expensiveHours[0].hour;
    let prevH = startH;

    for (let i = 1; i < expensiveHours.length; i++) {
      if (expensiveHours[i].hour === prevH + 1) {
        prevH = expensiveHours[i].hour;
      } else {
        avoidConsumptionWindows.push({
          start: `${String(startH).padStart(2, '0')}:00`,
          end: `${String(prevH + 1).padStart(2, '0')}:00`,
          avgPrice: Number(((maxHour.activePrice + expensiveThreshold) / 2).toFixed(2)),
          description: 'Szczyt cenowy – odłącz zbędne obciążenia',
        });
        startH = expensiveHours[i].hour;
        prevH = startH;
      }
    }
    avoidConsumptionWindows.push({
      start: `${String(startH).padStart(2, '0')}:00`,
      end: `${String(prevH + 1).padStart(2, '0')}:00`,
      avgPrice: Number(((maxHour.activePrice + expensiveThreshold) / 2).toFixed(2)),
      description: 'Szczyt cenowy – zasilanie z PV lub baterii',
    });
  }

  // Oszczędność przy naładowaniu EV (50 kWh) i CWU (15 kWh) w najtańszej vs najdroższej godzinie
  const potentialEvSavings = Number(((maxHour.activePrice - minHour.activePrice) * settings.evBatteryKwh).toFixed(2));
  const potentialHeatPumpSavings = Number(((maxHour.activePrice - minHour.activePrice) * settings.heatPumpBufferKwh).toFixed(2));

  return {
    ...dayData,
    hours,
    summary: {
      minPrice: {
        hour: minHour.hour,
        price: minHour.activePrice,
        time: `${String(minHour.hour).padStart(2, '0')}:00 - ${String(minHour.hour + 1).padStart(2, '0')}:00`,
      },
      maxPrice: {
        hour: maxHour.hour,
        price: maxHour.activePrice,
        time: `${String(maxHour.hour).padStart(2, '0')}:00 - ${String(maxHour.hour + 1).padStart(2, '0')}:00`,
      },
      avgPrice,
      spread,
      currentHourPrice: currentHourItem ? currentHourItem.activePrice : undefined,
      bestChargeWindows: bestChargeWindows.slice(0, 2),
      avoidConsumptionWindows: avoidConsumptionWindows.slice(0, 2),
      potentialEvSavings,
      potentialHeatPumpSavings,
    },
  };
}
