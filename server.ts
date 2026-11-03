import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LatestMetricsStore {
  production_kwh: number;
  import_kwh: number;
  export_kwh: number;
  self_consumption_kwh: number;
  self_consumption_percent: number;
  coverage_percent: number;
  grid_balance_kwh: number;
  financial_balance_pln: number;
  energy_price_pln: number;
  year: number;
  month: number;
  month_name: string;
  installation_name: string;
  peak_power_kwp: number;
  forecast_today_kwh: number;
  forecast_tomorrow_kwh: number;
  best_window_tomorrow: string;
  last_updated: string;
}

// In-memory metrics storage (initialized with representative baseline data)
let latestMetrics: LatestMetricsStore = {
  production_kwh: 485.2,
  import_kwh: 215.4,
  export_kwh: 298.0,
  self_consumption_kwh: 187.2,
  self_consumption_percent: 38.6,
  coverage_percent: 46.5,
  grid_balance_kwh: 23.0,
  financial_balance_pln: 341.60,
  energy_price_pln: 0.95,
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  month_name: 'Bieżący',
  installation_name: 'Instalacja PV Dom',
  peak_power_kwp: 3.8,
  forecast_today_kwh: 16.4,
  forecast_tomorrow_kwh: 19.8,
  best_window_tomorrow: '11:30 - 14:00',
  last_updated: new Date().toISOString(),
};

import fs from 'fs';

// Polish power grid tariff helpers
function isWeekendDay(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function checkG12OffPeak(hour: number): boolean {
  return (hour >= 13 && hour < 15) || hour >= 22 || hour < 6;
}

function checkG12wOffPeak(hour: number, isWeekend: boolean): boolean {
  if (isWeekend) return true;
  return checkG12OffPeak(hour);
}

function categorizePrice(priceKwh: number): 'negative' | 'super_cheap' | 'cheap' | 'moderate' | 'expensive' | 'extreme_peak' {
  if (priceKwh <= 0) return 'negative';
  if (priceKwh < 0.40) return 'super_cheap';
  if (priceKwh < 0.65) return 'cheap';
  if (priceKwh < 0.95) return 'moderate';
  if (priceKwh < 1.25) return 'expensive';
  return 'extreme_peak';
}

async function fetchPseDayData(
  dateStr: string,
  dayLabel: 'Dzisiaj' | 'Jutro' | string,
  distributionFee: number = 0.35,
  vatRate: number = 0.23
) {
  const isWeekend = isWeekendDay(dateStr);
  let hourlyMwh: number[] = new Array(24).fill(0);
  let source: 'pse_live' | 'pse_day_ahead' | 'simulated_forecast' = 'simulated_forecast';
  let fetchedFromPse = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const pseUrl = `https://api.raporty.pse.pl/api/rce-pln?$filter=business_date%20eq%20'${dateStr}'`;

    const pseResponse = await fetch(pseUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MonitorPV/2.0 (PSE-RCE-Connector)',
      },
    });
    clearTimeout(timeoutId);

    if (pseResponse.ok) {
      const data = await pseResponse.json();
      if (data && Array.isArray(data.value) && data.value.length > 0) {
        // Group 15-minute points by hour
        const hourCounts = new Array(24).fill(0);
        const hourSums = new Array(24).fill(0);

        for (const item of data.value) {
          if (typeof item.rce_pln === 'number') {
            let hour = 0;
            if (item.period && typeof item.period === 'string') {
              const startPart = item.period.split('-')[0].trim();
              hour = parseInt(startPart.split(':')[0], 10);
            } else if (item.dtime) {
              const timePart = item.dtime.split(' ')[1] || '';
              hour = parseInt(timePart.split(':')[0], 10);
            }
            if (!isNaN(hour) && hour >= 0 && hour < 24) {
              hourSums[hour] += item.rce_pln;
              hourCounts[hour] += 1;
            }
          }
        }

        // Calculate averages for available hours
        let validHoursCount = 0;
        for (let h = 0; h < 24; h++) {
          if (hourCounts[h] > 0) {
            hourlyMwh[h] = Number((hourSums[h] / hourCounts[h]).toFixed(2));
            validHoursCount++;
          }
        }

        if (validHoursCount >= 18) {
          fetchedFromPse = true;
          source = dayLabel === 'Dzisiaj' ? 'pse_live' : 'pse_day_ahead';
        }
      }
    }
  } catch (err: any) {
    console.warn(`PSE API query for ${dateStr} fell back to projection:`, err.message);
  }

  // Realistic simulation fallback if PSE data is not yet published (e.g. tomorrow morning) or temporarily unreachable
  if (!fetchedFromPse) {
    source = 'simulated_forecast';
    // Base Polish electricity price curve (PLN/MWh)
    const baseProfile = [
      440, 420, 410, 415, 435, 520, // 00 - 05
      680, 790, 810, 720, 580, 390, // 06 - 11
      280, 260, 310, 420, 620, 840, // 12 - 17
      980, 1040, 920, 740, 580, 490  // 18 - 23
    ];

    // Seed variations slightly based on date to keep it natural
    const dateNum = dateStr.split('-').reduce((acc, part) => acc + parseInt(part, 10), 0);
    const dayVariation = ((dateNum % 7) - 3) * 15;

    for (let h = 0; h < 24; h++) {
      let val = baseProfile[h] + dayVariation;
      if (isWeekend) {
        val *= 0.84; // Weekend demand drop
      }
      hourlyMwh[h] = Math.max(80, Math.round(val));
    }
  }

  // Build 24 hourly objects with all multi-zone and dynamic prices
  const now = new Date();
  const currentHour = now.getHours();
  const isCurrentToday = dayLabel === 'Dzisiaj' || dateStr === now.toISOString().split('T')[0];

  const hours = hourlyMwh.map((mwh, h) => {
    const rce_pln_kwh = Number((mwh / 1000).toFixed(4));
    const dynamic_retail_kwh = Number(((rce_pln_kwh + distributionFee) * (1 + vatRate)).toFixed(4));

    const isG12Off = checkG12OffPeak(h);
    const g12_price_kwh = isG12Off ? 0.65 : 1.18;
    const g12_zone: 'peak' | 'offpeak' = isG12Off ? 'offpeak' : 'peak';

    const isG12wOff = checkG12wOffPeak(h, isWeekend);
    const g12w_price_kwh = isG12wOff ? 0.62 : 1.18;
    const g12w_zone: 'peak' | 'offpeak' = isG12wOff ? 'offpeak' : 'peak';

    const priceCategory = categorizePrice(dynamic_retail_kwh);
    const isCurrent = isCurrentToday && h === currentHour;

    let recommendation: 'charge_now' | 'self_consume' | 'export_beneficial' | 'avoid_grid' | 'battery_discharge' = 'self_consume';
    let actionText = 'Standardowa autokonsumpcja';

    if (dynamic_retail_kwh < 0.70 || isG12Off) {
      recommendation = 'charge_now';
      actionText = 'TANIA ENERGIA: Optymalne okno na ładowanie EV, pompy CWU i bufora';
    } else if (dynamic_retail_kwh >= 1.20 || !isG12Off && (h >= 17 && h <= 21)) {
      recommendation = 'avoid_grid';
      actionText = 'SZCZYT DROŻYZNY: Unikaj poboru z sieci, zasilaj dom z PV / magazynu';
    } else {
      recommendation = 'self_consume';
      actionText = 'STREFA UMIARKOWANA: Standardowa autokonsumpcja bieżącej produkcji PV';
    }

    return {
      hour: h,
      timeLabel: `${String(h).padStart(2, '0')}:00`,
      periodLabel: `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`,
      date: dateStr,
      rce_pln_mwh: mwh,
      rce_pln_kwh,
      dynamic_retail_kwh,
      g11_price_kwh: 0.98,
      g12_price_kwh,
      g12_zone,
      g12w_price_kwh,
      g12w_zone,
      activePrice: dynamic_retail_kwh,
      activeZone: g12_zone,
      priceCategory,
      isCurrentHour: isCurrent,
      recommendation,
      actionText,
    };
  });

  // Calculate day summary metrics
  let minHour = hours[0];
  let maxHour = hours[0];
  let sumPrice = 0;

  for (const h of hours) {
    sumPrice += h.dynamic_retail_kwh;
    if (h.dynamic_retail_kwh < minHour.dynamic_retail_kwh) minHour = h;
    if (h.dynamic_retail_kwh > maxHour.dynamic_retail_kwh) maxHour = h;
  }

  const avgPrice = Number((sumPrice / 24).toFixed(4));
  const spread = Number((maxHour.dynamic_retail_kwh - minHour.dynamic_retail_kwh).toFixed(4));

  return {
    date: dateStr,
    dayLabel,
    isWeekend,
    source,
    hours,
    summary: {
      minPrice: {
        hour: minHour.hour,
        price: minHour.dynamic_retail_kwh,
        time: `${String(minHour.hour).padStart(2, '0')}:00 - ${String(minHour.hour + 1).padStart(2, '0')}:00`,
      },
      maxPrice: {
        hour: maxHour.hour,
        price: maxHour.dynamic_retail_kwh,
        time: `${String(maxHour.hour).padStart(2, '0')}:00 - ${String(maxHour.hour + 1).padStart(2, '0')}:00`,
      },
      avgPrice,
      spread,
      currentHourPrice: isCurrentToday ? hours[currentHour]?.dynamic_retail_kwh : undefined,
      bestChargeWindows: [
        { start: '13:00', end: '15:00', avgPrice: Number(((minHour.dynamic_retail_kwh * 1.05)).toFixed(2)), description: 'Dolina dzienna (wysoka generacja PV w sieci)' },
        { start: '01:00', end: '05:00', avgPrice: Number(((minHour.dynamic_retail_kwh * 1.10)).toFixed(2)), description: 'Dolina nocna pozaszczytowa' },
      ],
      avoidConsumptionWindows: [
        { start: '18:00', end: '21:00', avgPrice: Number(((maxHour.dynamic_retail_kwh * 0.98)).toFixed(2)), description: 'Wieczorny szczyt zapotrzebowania w KSE' },
      ],
      potentialEvSavings: Number(((maxHour.dynamic_retail_kwh - minHour.dynamic_retail_kwh) * 50).toFixed(2)),
      potentialHeatPumpSavings: Number(((maxHour.dynamic_retail_kwh - minHour.dynamic_retail_kwh) * 15).toFixed(2)),
    },
  };
}

// Determine the port: dev runner and nginx proxy target port 3000.
// If process.env.PORT is 8080, that is the outer Nginx reverse proxy port in Cloud Run.
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const cliPort = portIndex !== -1 && args[portIndex + 1] ? Number(args[portIndex + 1]) : undefined;
const defaultAppPort = Number(process.env.APP_PORT || process.env.DEFAULT_APP_PORT);
const envPort = Number(process.env.PORT);
const PORT = cliPort || (defaultAppPort && !isNaN(defaultAppPort) ? defaultAppPort : (envPort && envPort !== 8080 ? envPort : 3000));

async function startServer() {
  const app = express();

  app.use(express.json());

  // CORS headers for external IoT clients (e.g., Home Assistant, Node-RED, local scripts)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // REST API: GET latest metrics for Home Assistant RESTful Sensor
  app.get('/api/v1/metrics/latest', (req: Request, res: Response) => {
    res.json({
      status: 'success',
      ...latestMetrics,
      timestamp: new Date().toISOString(),
      ha_hint: 'Integrate with Home Assistant via RESTful sensor platform'
    });
  });

  // REST API: POST update metrics (called by frontend or external inverters/meters)
  app.post('/api/v1/metrics/latest', (req: Request, res: Response) => {
    const data = req.body;
    latestMetrics = {
      ...latestMetrics,
      ...data,
      last_updated: new Date().toISOString(),
    };
    res.json({
      status: 'success',
      message: 'Metrics updated successfully',
      metrics: latestMetrics,
    });
  });

  // REST API: Webhook dispatcher (relays payload to external Home Assistant / Node-RED / n8n without CORS block)
  app.post('/api/v1/webhook/dispatch', async (req: Request, res: Response) => {
    const { targetUrl, payload } = req.body;
    if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('http')) {
      return res.status(400).json({ status: 'error', message: 'Nieprawidłowy adres URL webhooka' });
    }

    try {
      const fetchResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MonitorPV-WebhookDispatcher/1.0',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await fetchResponse.text().catch(() => '');
      return res.json({
        status: 'success',
        statusCode: fetchResponse.status,
        statusText: fetchResponse.statusText,
        response: responseText,
      });
    } catch (err: any) {
      console.error('Webhook dispatch error:', err.message);
      return res.status(502).json({
        status: 'error',
        message: `Błąd wysyłania webhooka: ${err.message}`,
      });
    }
  });

  // Health endpoint
  app.get('/api/v1/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // REST API: GET Hourly energy tariffs & day-ahead prices from PSE (Polskie Sieci Elektroenergetyczne)
  app.get('/api/v1/tariffs/hourly', async (req: Request, res: Response) => {
    try {
      const now = new Date();
      // Format YYYY-MM-DD in Polish/UTC timezone
      const todayStr = (req.query.date as string) || now.toISOString().split('T')[0];
      const tomorrow = new Date(new Date(todayStr).getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const distributionFee = parseFloat(req.query.distributionFee as string) || 0.35;
      const vatRate = parseFloat(req.query.vatRate as string) || 0.23;

      const [todayData, tomorrowData] = await Promise.all([
        fetchPseDayData(todayStr, 'Dzisiaj', distributionFee, vatRate),
        fetchPseDayData(tomorrowStr, 'Jutro', distributionFee, vatRate)
      ]);

      return res.json({
        status: 'success',
        today: todayData,
        tomorrow: tomorrowData,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Błąd w /api/v1/tariffs/hourly:', err.message);
      return res.status(500).json({
        status: 'error',
        message: `Błąd przetwarzania taryf: ${err.message}`,
      });
    }
  });

  const distPath = path.resolve(__dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (!isProd) {
    // Development: Mount Vite middleware with HMR disabled to prevent port collisions
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Monitor PV Server listening on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    console.error(`Monitor PV Server encountered an error on port ${PORT}:`, err);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
