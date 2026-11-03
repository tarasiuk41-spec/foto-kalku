import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  CloudSun, 
  Clock, 
  MapPin, 
  RefreshCw, 
  TrendingUp, 
  Zap, 
  Sliders, 
  ChevronRight, 
  Sparkles,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import { cn } from '../lib/utils';
import { 
  fetchSolarForecast, 
  SolarForecastResult, 
  POLISH_CITIES, 
  HourlyForecastItem 
} from '../lib/solarForecast';

interface SolarForecastWidgetProps {
  theme: 'light' | 'dark';
  defaultPeakKwp?: number;
  onSettingsChange?: (peakKwp: number, lat: number, lon: number, cityName: string) => void;
}

export const SolarForecastWidget: React.FC<SolarForecastWidgetProps> = ({ 
  theme, 
  defaultPeakKwp = 3.8,
  onSettingsChange
}) => {
  const isDark = theme === 'dark';
  
  // State
  const [selectedCity, setSelectedCity] = useState(POLISH_CITIES[0]);
  const [peakKwp, setPeakKwp] = useState<number>(defaultPeakKwp);
  const [efficiency, setEfficiency] = useState<number>(82);
  const [activeTab, setActiveTab] = useState<'today' | 'tomorrow' | '48h'>('tomorrow');
  const [forecast, setForecast] = useState<SolarForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [customLat, setCustomLat] = useState<number>(selectedCity.latitude);
  const [customLon, setCustomLon] = useState<number>(selectedCity.longitude);

  const loadForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSolarForecast(
        customLat,
        customLon,
        peakKwp,
        efficiency,
        selectedCity.name
      );
      setForecast(res);
    } catch (err: any) {
      console.error('Błąd ładowania prognozy:', err);
      setError(err.message || 'Nie udało się pobrać danych pogodowych z Open-Meteo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForecast();
  }, [selectedCity, peakKwp, efficiency, customLat, customLon]);

  const handleCityChange = (cityName: string) => {
    const city = POLISH_CITIES.find(c => c.name === cityName);
    if (city) {
      setSelectedCity(city);
      setCustomLat(city.latitude);
      setCustomLon(city.longitude);
      onSettingsChange?.(peakKwp, city.latitude, city.longitude, city.name);
    }
  };

  // Filter hourly items based on active tab
  const filteredHourly = React.useMemo(() => {
    if (!forecast || !forecast.hourly) return [];
    if (activeTab === 'today') {
      return forecast.hourly.filter(h => h.dayLabel === 'Dziś');
    }
    if (activeTab === 'tomorrow') {
      return forecast.hourly.filter(h => h.dayLabel === 'Jutro');
    }
    // 48h view: today + tomorrow
    return forecast.hourly.filter(h => h.dayLabel === 'Dziś' || h.dayLabel === 'Jutro');
  }, [forecast, activeTab]);

  return (
    <section className={cn(
      "rounded-[36px] border p-8 shadow-sm transition-all duration-500 relative overflow-hidden group",
      isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
    )}>
      {/* Decorative ambient aura */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b pb-4 border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <Sun className="w-5 h-5 animate-[spin_12s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                PROGNOZA GENERACJI PV (OPEN-METEO)
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h3 className={cn("text-base font-black tracking-tight flex items-center gap-2", isDark ? "text-white" : "text-slate-900")}>
              Prognoza Produkcji na 24h & 48h
              <span className="text-xs font-semibold text-slate-400 font-mono">({selectedCity.name}, {peakKwp} kWp)</span>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick city dropdown */}
          <div className="relative">
            <select
              value={selectedCity.name}
              onChange={(e) => handleCityChange(e.target.value)}
              className={cn(
                "text-xs font-bold py-2 px-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-amber-500/20 appearance-none pr-8 cursor-pointer transition-colors",
                isDark ? "bg-slate-950 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
              )}
            >
              {POLISH_CITIES.map(c => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
            <MapPin className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className={cn(
              "p-2.5 rounded-xl border transition-colors",
              showConfig 
                ? "bg-amber-500 text-white border-amber-500" 
                : (isDark ? "bg-slate-950 border-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900")
            )}
            title="Konfiguracja parametrów falownika i lokalizacji"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button
            onClick={loadForecast}
            disabled={loading}
            className={cn(
              "p-2.5 rounded-xl border transition-colors",
              isDark ? "bg-slate-950 border-slate-800 text-slate-400 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900"
            )}
            title="Odśwież dane pogodowe"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-amber-500")} />
          </button>
        </div>
      </div>

      {/* Collapsible config drawer */}
      {showConfig && (
        <div className={cn(
          "mb-6 p-5 rounded-2xl border animate-in fade-in slide-in-from-top-2 space-y-4",
          isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-amber-500" />
            Parametry modelowania fotowoltaicznego
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Moc zainstalowana Ppeak (kWp)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="50"
                value={peakKwp}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 3.8;
                  setPeakKwp(val);
                  onSettingsChange?.(val, customLat, customLon, selectedCity.name);
                }}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                  isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                )}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Sprawność systemu η (%)
              </label>
              <input
                type="number"
                step="1"
                min="50"
                max="98"
                value={efficiency}
                onChange={(e) => setEfficiency(parseInt(e.target.value) || 82)}
                className={cn(
                  "w-full px-3 py-2 rounded-xl border font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                  isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                )}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Współrzędne GPS (szer. / dł.)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  value={customLat}
                  onChange={(e) => setCustomLat(parseFloat(e.target.value) || 52.23)}
                  placeholder="Lat"
                  className={cn(
                    "w-1/2 px-2 py-2 rounded-xl border font-mono text-xs focus:outline-none",
                    isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                  )}
                />
                <input
                  type="number"
                  step="0.001"
                  value={customLon}
                  onChange={(e) => setCustomLon(parseFloat(e.target.value) || 21.01)}
                  placeholder="Lon"
                  className={cn(
                    "w-1/2 px-2 py-2 rounded-xl border font-mono text-xs focus:outline-none",
                    isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards: Today vs Tomorrow vs Best Window */}
      {forecast && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Dziś */}
          <div className={cn(
            "p-5 rounded-2xl border transition-all relative overflow-hidden",
            isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"
          )}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest">Produkcja Dziś</span>
              <Sun className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-black font-mono tracking-tighter text-amber-500">
              {forecast.todayKwh} <span className="text-sm font-sans font-bold text-slate-400">kWh</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Szacowana dzienna generacja
            </p>
          </div>

          {/* Jutro */}
          <div className={cn(
            "p-5 rounded-2xl border transition-all relative overflow-hidden ring-1",
            isDark ? "bg-amber-500/10 border-amber-500/30 ring-amber-500/20" : "bg-amber-50/50 border-amber-200 ring-amber-100"
          )}>
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest">Produkcja Jutro</span>
              <CloudSun className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-black font-mono tracking-tighter text-amber-600 dark:text-amber-400">
              {forecast.tomorrowKwh} <span className="text-sm font-sans font-bold text-slate-400">kWh</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {forecast.tomorrowKwh > forecast.todayKwh 
                ? `+${(forecast.tomorrowKwh - forecast.todayKwh).toFixed(1)} kWh więcej niż dziś ☀️` 
                : `${(forecast.tomorrowKwh - forecast.todayKwh).toFixed(1)} kWh vs dziś`}
            </p>
          </div>

          {/* Pojutrze */}
          <div className={cn(
            "p-5 rounded-2xl border transition-all relative overflow-hidden",
            isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-100"
          )}>
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest">Pojutrze</span>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-3xl font-black font-mono tracking-tighter text-blue-500">
              {forecast.dayAfterTomorrowKwh} <span className="text-sm font-sans font-bold text-slate-400">kWh</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Prognoza na 3. dzień
            </p>
          </div>
        </div>
      )}

      {/* BEST TIME WINDOW BANNER (Kluczowy wymóg prompta!) */}
      {forecast && (
        <div className={cn(
          "p-4 rounded-2xl border mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md",
          isDark 
            ? "bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-950 border-amber-500/30 text-amber-200" 
            : "bg-gradient-to-r from-amber-50 via-amber-100/50 to-orange-50 border-amber-200 text-amber-900"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                NAJLEPSZE OKNO ENERGETYCZNE (CWU / POMPA / EV / AGD)
              </div>
              <div className="text-sm font-black tracking-tight mt-0.5">
                {activeTab === 'today' ? forecast.bestWindowToday.description : forecast.bestWindowTomorrow.description}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-300">
              Maksymalizuj Autokonsumpcję
            </span>
          </div>
        </div>
      )}

      {/* Chart Sub-tabs & Hourly Bar/Area Visualization */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <button
              onClick={() => setActiveTab('today')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                activeTab === 'today'
                  ? (isDark ? "bg-amber-500 text-white shadow" : "bg-slate-900 text-white shadow")
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              Dziś
            </button>
            <button
              onClick={() => setActiveTab('tomorrow')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                activeTab === 'tomorrow'
                  ? (isDark ? "bg-amber-500 text-white shadow" : "bg-slate-900 text-white shadow")
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              Jutro
            </button>
            <button
              onClick={() => setActiveTab('48h')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                activeTab === '48h'
                  ? (isDark ? "bg-amber-500 text-white shadow" : "bg-slate-900 text-white shadow")
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              Pełne 48h
            </button>
          </div>

          <span className="text-[10px] font-mono font-bold text-slate-400 hidden sm:inline">
            Aktualizacja: {forecast?.updatedAt || '—'}
          </span>
        </div>

        {/* Chart Container */}
        <div className="h-[240px] w-full" id="solar-forecast-chart">
          {loading && !forecast ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-amber-500" />
              Pobieranie radiacji z Open-Meteo...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredHourly} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#1e293b" : "#f1f5f9"} />
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(h, idx) => {
                    const item = filteredHourly[idx];
                    if (activeTab === '48h') {
                      return `${h}h`;
                    }
                    return `${h}:00`;
                  }}
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }}
                  unit=" kW"
                />
                <RechartsTooltip 
                  contentStyle={{
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    border: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9',
                    borderRadius: '14px',
                    fontSize: '11px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                  }}
                  formatter={(val: number) => [`${val} kW (${val} kWh/h)`, 'Moc szacowana']}
                  labelFormatter={(h, items) => {
                    const payload = items?.[0]?.payload as HourlyForecastItem | undefined;
                    return payload ? `${payload.dayLabel}, godzina ${payload.hour}:00 (${payload.radiationWm2} W/m²)` : `Godzina ${h}:00`;
                  }}
                />
                <Bar 
                  dataKey="estimatedKw" 
                  name="Moc szacowana (kW)" 
                  fill="#f59e0b" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
};
