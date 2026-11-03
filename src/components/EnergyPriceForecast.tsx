import React, { useState, useEffect, useMemo } from 'react';
import {
  Zap,
  TrendingDown,
  TrendingUp,
  Clock,
  Car,
  Flame,
  BatteryCharging,
  Sparkles,
  RefreshCw,
  Sun,
  Calendar,
  Layers,
  ArrowUpDown,
  Settings2,
  Check,
  Percent,
  CheckCircle2,
  ShieldAlert,
  Info,
  Sliders,
  DollarSign
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
  Cell,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import {
  TariffType,
  TariffDayData,
  HourlyTariffPrice,
  TariffSettings,
  getStoredTariffSettings,
  saveStoredTariffSettings,
  fetchHourlyTariffs,
  formatDayWithSettings,
  getPriceCategory
} from '../lib/energyTariffs';
import { SolarForecastResult } from '../lib/solarForecast';

interface EnergyPriceForecastProps {
  theme: 'light' | 'dark';
  solarForecast?: SolarForecastResult | null;
  onOpenSmartHomeModal?: () => void;
}

export const EnergyPriceForecast: React.FC<EnergyPriceForecastProps> = ({
  theme,
  solarForecast,
  onOpenSmartHomeModal,
}) => {
  const [settings, setSettings] = useState<TariffSettings>(getStoredTariffSettings);
  const [dataToday, setDataToday] = useState<TariffDayData | null>(null);
  const [dataTomorrow, setDataTomorrow] = useState<TariffDayData | null>(null);
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow'>('today');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showPvOverlay, setShowPvOverlay] = useState<boolean>(true);
  const [tableSort, setTableSort] = useState<'hour' | 'price_asc' | 'price_desc'>('hour');

  // Load tariffs from backend API
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchHourlyTariffs(undefined, settings);
      setDataToday(result.today);
      setDataTomorrow(result.tomorrow);
    } catch (e: any) {
      console.error('Błąd pobierania danych taryfowych:', e);
      setError(e.message || 'Nie udało się pobrać aktualnych cen energii');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Recalculate formatted day data when settings change
  const currentDayData = useMemo(() => {
    const raw = selectedDay === 'today' ? dataToday : dataTomorrow;
    if (!raw) return null;
    return formatDayWithSettings(raw, settings);
  }, [selectedDay, dataToday, dataTomorrow, settings]);

  const handleUpdateSettings = (updated: TariffSettings) => {
    setSettings(updated);
    saveStoredTariffSettings(updated);
  };

  // Combine hourly prices with solar generation estimate if available
  const chartData = useMemo(() => {
    if (!currentDayData) return [];
    
    // Map solar forecast hourly if present
    const isToday = selectedDay === 'today';
    const solarItems = solarForecast?.hourly || [];
    
    return currentDayData.hours.map((h) => {
      // Find matching solar hour
      let solarKw = 0;
      if (solarItems.length > 0) {
        const found = solarItems.find((s) => {
          if (isToday) {
            return s.dayLabel === 'Dziś' && s.hour === h.hour;
          } else {
            return s.dayLabel === 'Jutro' && s.hour === h.hour;
          }
        });
        if (found) {
          solarKw = Number(found.estimatedKw.toFixed(2));
        }
      }

      return {
        ...h,
        displayPrice: h.activePrice,
        solarKw: solarKw > 0 ? solarKw : 0,
      };
    });
  }, [currentDayData, selectedDay, solarForecast]);

  // Color helper based on price category
  const getBarColor = (item: HourlyTariffPrice) => {
    if (settings.tariffType === 'g12' || settings.tariffType === 'g12w') {
      return item.activeZone === 'offpeak' ? '#10b981' : '#f43f5e';
    }
    switch (item.priceCategory) {
      case 'negative':
        return '#06b6d4'; // Cyan for negative prices
      case 'super_cheap':
        return '#10b981'; // Emerald
      case 'cheap':
        return '#34d399'; // Mint
      case 'moderate':
        return '#f59e0b'; // Amber
      case 'expensive':
        return '#f97316'; // Orange
      case 'extreme_peak':
        return '#ef4444'; // Red
      default:
        return '#3b82f6';
    }
  };

  // Table items sorted
  const sortedTableHours = useMemo(() => {
    if (!currentDayData) return [];
    const list = [...currentDayData.hours];
    if (tableSort === 'price_asc') {
      return list.sort((a, b) => a.activePrice - b.activePrice);
    }
    if (tableSort === 'price_desc') {
      return list.sort((a, b) => b.activePrice - a.activePrice);
    }
    return list.sort((a, b) => a.hour - b.hour);
  }, [currentDayData, tableSort]);

  const summary = currentDayData?.summary;
  const now = new Date();
  const currentHour = now.getHours();

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className={cn(
        "rounded-[32px] p-6 lg:p-8 border shadow-sm transition-all duration-300",
        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Zap className="w-5 h-5 fill-amber-500/20" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                Rynek Energii i Taryfy Dynamiczne (PSE / TGE)
              </span>
            </div>
            <h2 className={cn("text-2xl lg:text-3xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
              Prognoza Cen Energii i Optymalizacja Autokonsumpcji
            </h2>
            <p className={cn("text-xs font-semibold mt-1 max-w-2xl", theme === 'dark' ? "text-slate-400" : "text-slate-600")}>
              Analiza godzinowych cen rynkowych energii (RCE z Polskich Sieci Elektroenergetycznych) oraz taryf strefowych G12/G12w. Wykorzystaj doliny cenowe i produkcję ze słońca, by zredukować rachunki do minimum.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Day Selector */}
            <div className={cn("flex items-center p-1 rounded-2xl border", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}>
              <button
                onClick={() => setSelectedDay('today')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  selectedDay === 'today'
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                )}
              >
                Dzisiaj
              </button>
              <button
                onClick={() => setSelectedDay('tomorrow')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                  selectedDay === 'tomorrow'
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                )}
              >
                Jutro
                {dataTomorrow?.source === 'simulated_forecast' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">Prognoza</span>
                )}
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={loadData}
              disabled={loading}
              className={cn(
                "p-3 rounded-2xl border transition-all flex items-center justify-center",
                theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              )}
              title="Odśwież dane z PSE"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin text-amber-500")} />
            </button>

            {/* Settings Trigger */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all",
                theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-200 hover:border-amber-500/50" : "bg-white border-slate-200 text-slate-700 hover:border-amber-500 hover:bg-amber-50/30"
              )}
            >
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>Stawki i Taryfa</span>
            </button>
          </div>
        </div>

        {/* Tariff Switcher Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-xs font-bold mr-2", theme === 'dark' ? "text-slate-400" : "text-slate-500")}>
              Aktywna Taryfa:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'rce', label: 'Dynamiczna RCE (PSE)', desc: 'Cena giełdowa' },
                { id: 'g12', label: 'G12 (Dwustrefowa)', desc: 'Szczyt / Noc' },
                { id: 'g12w', label: 'G12w (Weekendowa)', desc: 'Tani weekend' },
                { id: 'g11', label: 'G11 (Płaska)', desc: 'Stała cena' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleUpdateSettings({ ...settings, tariffType: t.id as TariffType })}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border",
                    settings.tariffType === t.id
                      ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                      : (theme === 'dark'
                          ? "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {/* Distribution toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.includeDistribution}
                onChange={(e) => handleUpdateSettings({ ...settings, includeDistribution: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 accent-amber-500"
              />
              <span className={theme === 'dark' ? "text-slate-300 font-semibold" : "text-slate-700 font-semibold"}>
                Uwzględnij dystrybucję i VAT (+~0.43 zł/kWh)
              </span>
            </label>

            {/* Solar overlay toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPvOverlay}
                onChange={(e) => setShowPvOverlay(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 accent-amber-500"
              />
              <span className="flex items-center gap-1 font-semibold text-amber-500">
                <Sun className="w-3.5 h-3.5" />
                <span>Nałóż produkcję PV (kW)</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Main KPI Highlight Grid */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Current Price */}
          <div className={cn(
            "p-5 rounded-3xl border shadow-sm transition-all duration-300 relative overflow-hidden",
            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Bieżąca Stawka ({String(currentHour).padStart(2, '0')}:00)
              </span>
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-black font-mono tracking-tight tabular-nums", theme === 'dark' ? "text-white" : "text-slate-900")}>
                {summary.currentHourPrice !== undefined ? summary.currentHourPrice.toFixed(2) : summary.avgPrice.toFixed(2)}
              </span>
              <span className="text-xs font-bold text-slate-400">PLN/kWh</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
              <span>{settings.tariffType === 'rce' ? 'Cena dynamiczna' : `Taryfa ${settings.tariffType.toUpperCase()}`}</span>
              <span>·</span>
              <span className={summary.currentHourPrice !== undefined && summary.currentHourPrice < summary.avgPrice ? "text-emerald-500" : "text-rose-500"}>
                {summary.currentHourPrice !== undefined && summary.currentHourPrice < summary.avgPrice ? 'Tania strefa' : 'Szczyt cenowy'}
              </span>
            </div>
          </div>

          {/* Card 2: Minimum Price */}
          <div className={cn(
            "p-5 rounded-3xl border shadow-sm transition-all duration-300 relative overflow-hidden",
            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                Najniższa Cena Doby
              </span>
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <TrendingDown className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-black font-mono tracking-tight tabular-nums text-emerald-500")}>
                {summary.minPrice.price.toFixed(2)}
              </span>
              <span className="text-xs font-bold text-slate-400">PLN/kWh</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="text-slate-700 dark:text-slate-300 font-mono font-bold">Godz. {summary.minPrice.time}</span>
              <span>·</span>
              <span className="text-emerald-500">Optymalne okno</span>
            </div>
          </div>

          {/* Card 3: Maximum Price */}
          <div className={cn(
            "p-5 rounded-3xl border shadow-sm transition-all duration-300 relative overflow-hidden",
            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">
                Szczyt Cenowy (Drożyzna)
              </span>
              <span className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-black font-mono tracking-tight tabular-nums text-rose-500")}>
                {summary.maxPrice.price.toFixed(2)}
              </span>
              <span className="text-xs font-bold text-slate-400">PLN/kWh</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
              <span className="text-slate-700 dark:text-slate-300 font-mono font-bold">Godz. {summary.maxPrice.time}</span>
              <span>·</span>
              <span className="text-rose-500">Unikaj poboru</span>
            </div>
          </div>

          {/* Card 4: Potential Savings Spread */}
          <div className={cn(
            "p-5 rounded-3xl border shadow-sm transition-all duration-300 relative overflow-hidden",
            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">
                Zysk z Przesunięcia Obciążenia
              </span>
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Sparkles className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-3xl font-black font-mono tracking-tight tabular-nums text-amber-500")}>
                +{summary.potentialEvSavings.toFixed(2)}
              </span>
              <span className="text-xs font-bold text-slate-400">PLN / cykl EV</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
              <span>Spread: {summary.spread.toFixed(2)} zł/kWh</span>
              <span>·</span>
              <span>Bufor CWU: +{summary.potentialHeatPumpSavings.toFixed(2)} zł</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Hourly Chart Section */}
      <div className={cn(
        "rounded-[32px] p-6 lg:p-8 border shadow-sm transition-all duration-300",
        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className={cn("text-lg font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
              Profil Godzinowy Cen Energii (24h)
            </h3>
            <p className={cn("text-xs font-medium mt-0.5", theme === 'dark' ? "text-slate-400" : "text-slate-500")}>
              {currentDayData?.date} · Źródło: {currentDayData?.source === 'pse_live' ? 'Bieżący rynek bilansujący PSE' : (currentDayData?.source === 'pse_day_ahead' ? 'Rynek Dnia Następnego PSE' : 'Model prognozowany')}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500" />
              <span className={theme === 'dark' ? "text-slate-300" : "text-slate-600"}>Tania strefa</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500" />
              <span className={theme === 'dark' ? "text-slate-300" : "text-slate-600"}>Średnia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-500" />
              <span className={theme === 'dark' ? "text-slate-300" : "text-slate-600"}>Szczyt</span>
            </div>
            {showPvOverlay && (
              <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-200 dark:border-slate-800">
                <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-600" />
                <span className="text-amber-500">Moc PV [kW]</span>
              </div>
            )}
          </div>
        </div>

        {/* Chart View Container */}
        <div className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#334155" : "#e2e8f0"} />
              <XAxis
                dataKey="timeLabel"
                stroke={theme === 'dark' ? "#64748b" : "#94a3b8"}
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke={theme === 'dark' ? "#64748b" : "#94a3b8"}
                fontSize={11}
                tickLine={false}
                unit=" zł"
                domain={[0, 'auto']}
              />
              {showPvOverlay && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f59e0b"
                  fontSize={11}
                  tickLine={false}
                  unit=" kW"
                  domain={[0, 'auto']}
                />
              )}
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as HourlyTariffPrice & { solarKw?: number };
                    return (
                      <div className={cn(
                        "p-4 rounded-2xl border shadow-xl text-xs space-y-2 backdrop-blur-md max-w-xs",
                        theme === 'dark' ? "bg-slate-900/95 border-slate-800 text-white" : "bg-white/95 border-slate-200 text-slate-900"
                      )}>
                        <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
                          <span className="font-black font-mono text-sm">{data.periodLabel}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                            data.activeZone === 'offpeak' ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                          )}>
                            {data.activeZone === 'offpeak' ? 'Pozaszczyt' : 'Szczyt'}
                          </span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Cena aktywna:</span>
                            <span className="font-black font-mono text-amber-500 text-sm tabular-nums">
                              {data.activePrice.toFixed(4)} PLN/kWh
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-slate-400">
                            <span>Rynek PSE (hurt):</span>
                            <span className="font-mono tabular-nums">{data.rce_pln_mwh.toFixed(1)} PLN/MWh ({data.rce_pln_kwh.toFixed(3)} zł/kWh)</span>
                          </div>
                          {data.solarKw !== undefined && data.solarKw > 0 && (
                            <div className="flex justify-between items-center text-amber-500 font-semibold pt-1 border-t border-slate-100 dark:border-slate-800">
                              <span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Prognoza PV:</span>
                              <span className="font-mono font-black">{data.solarKw.toFixed(2)} kW</span>
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-slate-400 leading-snug">
                          {data.actionText}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Average Price Line */}
              {summary && (
                <ReferenceLine
                  yAxisId="left"
                  y={summary.avgPrice}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  label={{
                    value: `Śr: ${summary.avgPrice.toFixed(2)} zł`,
                    fill: theme === 'dark' ? '#94a3b8' : '#64748b',
                    fontSize: 10,
                    position: 'insideTopLeft'
                  }}
                />
              )}

              {/* Current Hour Indicator */}
              {selectedDay === 'today' && (
                <ReferenceLine
                  yAxisId="left"
                  x={`${String(currentHour).padStart(2, '0')}:00`}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray="2 2"
                  label={{
                    value: 'TERAZ',
                    fill: '#3b82f6',
                    fontSize: 10,
                    position: 'top'
                  }}
                />
              )}

              {/* Price Bars */}
              <Bar yAxisId="left" dataKey="displayPrice" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                ))}
              </Bar>

              {/* Solar Generation Area / Line Overlay */}
              {showPvOverlay && (
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="solarKw"
                  fill="#f59e0b"
                  fillOpacity={theme === 'dark' ? 0.15 : 0.25}
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Appliance & Energy Optimization Schedule (Smart Recommendations) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device 1: Electric Vehicle (EV) */}
        <div className={cn(
          "rounded-[32px] p-6 border shadow-sm transition-all duration-300 relative flex flex-col justify-between",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        )}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-500">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <h4 className={cn("text-base font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    Ładowanie Samochodu (EV)
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Bateria {settings.evBatteryKwh} kWh
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-sky-500/5 border border-sky-500/20 mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Najtańsze okno ładowania:</span>
                <span className="font-mono font-black text-sky-500">
                  {summary?.bestChargeWindows[0]?.start || '13:00'} - {summary?.bestChargeWindows[0]?.end || '15:00'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Koszt w dolinie cenowej:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {((summary?.minPrice.price || 0.6) * settings.evBatteryKwh).toFixed(2)} zł
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Koszt w szczycie wieczornym:</span>
                <span className="font-mono font-bold text-rose-500 line-through">
                  {((summary?.maxPrice.price || 1.2) * settings.evBatteryKwh).toFixed(2)} zł
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
              <Sparkles className="w-4 h-4" />
              <span>Oszczędność: +{summary?.potentialEvSavings.toFixed(2)} zł na jednym cyklu</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Zalecenie: Podłącz auto w trybie harmonogramu lub przez wallbox z automatyzacją Home Assistant w oknie doliny cenowej.
          </div>
        </div>

        {/* Device 2: Heat Pump / Hot Water Buffer (CWU) */}
        <div className={cn(
          "rounded-[32px] p-6 border shadow-sm transition-all duration-300 relative flex flex-col justify-between",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        )}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h4 className={cn("text-base font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    Pompa Ciepła i Bufor CWU
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Akumulacja ciepła {settings.heatPumpBufferKwh} kWh
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Podbicie temperatury:</span>
                <span className="font-mono font-black text-amber-500">
                  {summary?.bestChargeWindows[0]?.start || '12:00'} - {summary?.bestChargeWindows[0]?.end || '15:00'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Koszt wygrzania zasobnika:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {((summary?.minPrice.price || 0.6) * settings.heatPumpBufferKwh).toFixed(2)} zł
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Synergia z fotowoltaiką:</span>
                <span className="font-bold text-emerald-500">Maksymalna (COP ~4.2)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
              <Sparkles className="w-4 h-4" />
              <span>Oszczędność: +{summary?.potentialHeatPumpSavings.toFixed(2)} zł / dobę</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Zalecenie: Podnieś zadaną temperaturę w buforze o 5-8°C w oknie wysokiej generacji PV oraz niskiej ceny taryfowej.
          </div>
        </div>

        {/* Device 3: Home Battery Storage */}
        <div className={cn(
          "rounded-[32px] p-6 border shadow-sm transition-all duration-300 relative flex flex-col justify-between",
          theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
        )}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <BatteryCharging className="w-6 h-6" />
                </div>
                <div>
                  <h4 className={cn("text-base font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    Domowy Magazyn Energii
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Pojemność {settings.batteryStorageKwh} kWh
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Tryb ładowania z sieci:</span>
                <span className="font-mono font-bold text-emerald-500">01:00 - 05:00</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Szczyt rozładowania:</span>
                <span className="font-mono font-bold text-rose-500">17:00 - 21:00</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Arbitraż cenowy:</span>
                <span className="font-bold text-emerald-500">
                  +{(summary?.spread ? summary.spread * settings.batteryStorageKwh : 0).toFixed(2)} zł / cykl
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
              <Sparkles className="w-4 h-4" />
              <span>Ochrona przed szczytem: zero poboru z sieci w godz. 18-21</span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
            Zalecenie: Wstrzymaj oddawanie energii z baterii w ciągu dnia i zachowaj pełną pojemność na drogi szczyt wieczorny.
          </div>
        </div>
      </div>

      {/* Hourly Breakdown Table */}
      <div className={cn(
        "rounded-[32px] p-6 lg:p-8 border shadow-sm transition-all duration-300",
        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className={cn("text-lg font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
              Szczegółowa Tabela Cen i Rekomendacji (24 Godziny)
            </h3>
            <p className={cn("text-xs font-medium mt-0.5", theme === 'dark' ? "text-slate-400" : "text-slate-500")}>
              Zestawienie stawek, stref taryfowych i zaleceń operacyjnych dla urządzeń
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400">Sortuj:</span>
            <div className={cn("flex items-center p-1 rounded-xl border text-xs", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200")}>
              <button
                onClick={() => setTableSort('hour')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all",
                  tableSort === 'hour'
                    ? "bg-amber-500 text-white"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")
                )}
              >
                Godzina
              </button>
              <button
                onClick={() => setTableSort('price_asc')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all",
                  tableSort === 'price_asc'
                    ? "bg-amber-500 text-white"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")
                )}
              >
                Najtańsze
              </button>
              <button
                onClick={() => setTableSort('price_desc')}
                className={cn(
                  "px-3 py-1 rounded-lg font-bold transition-all",
                  tableSort === 'price_desc'
                    ? "bg-amber-500 text-white"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")
                )}
              >
                Najdroższe
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={cn(
                "border-b text-[10px] uppercase font-black tracking-widest",
                theme === 'dark' ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-400"
              )}>
                <th className="py-3 px-4">Godzina</th>
                <th className="py-3 px-4">Strefa</th>
                <th className="py-3 px-4 text-right">Cena Aktywna (PLN/kWh)</th>
                <th className="py-3 px-4 text-right">Rynek PSE (PLN/MWh)</th>
                <th className="py-3 px-4 text-right">Dystrybucja + VAT</th>
                <th className="py-3 px-4">Rekomendacja dla odbiorników</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {sortedTableHours.map((row) => {
                const isNow = selectedDay === 'today' && row.hour === currentHour;
                return (
                  <tr
                    key={row.hour}
                    className={cn(
                      "transition-colors",
                      isNow
                        ? (theme === 'dark' ? "bg-amber-500/10" : "bg-amber-50/70")
                        : (theme === 'dark' ? "hover:bg-slate-800/40" : "hover:bg-slate-50")
                    )}
                  >
                    <td className="py-3 px-4 font-mono font-black">
                      <div className="flex items-center gap-2">
                        <span>{row.periodLabel}</span>
                        {isNow && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white font-sans text-[9px] uppercase tracking-wider font-black">
                            Teraz
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 font-bold",
                        row.activeZone === 'offpeak' ? "text-emerald-500" : (row.activeZone === 'peak' ? "text-rose-500" : "text-slate-400")
                      )}>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          row.activeZone === 'offpeak' ? "bg-emerald-500" : (row.activeZone === 'peak' ? "bg-rose-500" : "bg-slate-400")
                        )} />
                        {row.activeZone === 'offpeak' ? 'Pozaszczyt (Tania)' : (row.activeZone === 'peak' ? 'Szczyt (Droga)' : 'Standard')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black tabular-nums">
                      <span className={cn(
                        "text-sm",
                        row.activePrice <= (summary?.minPrice.price || 0.6) * 1.15 ? "text-emerald-500" : (row.activePrice >= (summary?.maxPrice.price || 1.1) * 0.9 ? "text-rose-500" : "")
                      )}>
                        {row.activePrice.toFixed(4)} zł
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                      {row.rce_pln_mwh.toFixed(1)} zł
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400">
                      {settings.includeDistribution ? `+${(settings.distributionFee * (1 + settings.vatRate)).toFixed(2)} zł` : 'Pominięto'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "font-semibold text-[11px]",
                        row.recommendation === 'charge_now' ? "text-emerald-600 dark:text-emerald-400" : (row.recommendation === 'avoid_grid' ? "text-rose-600 dark:text-rose-400" : "text-slate-400")
                      )}>
                        {row.actionText}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={cn(
                "rounded-[32px] p-6 lg:p-8 max-w-xl w-full border shadow-2xl relative max-h-[90vh] overflow-y-auto",
                theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
              )}
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">Parametry Taryf i Odbiorników</h3>
                    <p className="text-xs text-slate-400 font-medium">Dostosuj stawki swojego operatora OSD oraz parametry urządzeń</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="py-6 space-y-6">
                {/* Section 1: Tariff Type */}
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2 block">
                    Model Rozliczenia Energii
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'rce', label: 'Dynamiczna RCE', sub: 'Rynek PSE' },
                      { id: 'g12', label: 'Taryfa G12', sub: 'Dwie strefy' },
                      { id: 'g12w', label: 'Taryfa G12w', sub: 'Weekendowa' },
                      { id: 'g11', label: 'Taryfa G11', sub: 'Płaska' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleUpdateSettings({ ...settings, tariffType: t.id as TariffType })}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all",
                          settings.tariffType === t.id
                            ? "border-amber-500 bg-amber-500/10 text-amber-500"
                            : (theme === 'dark' ? "border-slate-800 bg-slate-950 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700")
                        )}
                      >
                        <div className="font-bold text-xs">{t.label}</div>
                        <div className="text-[10px] text-slate-400">{t.sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 2: Distribution & VAT */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">
                      Opłata Dystrybucyjna zmienna (PLN/kWh)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.distributionFee}
                      onChange={(e) => handleUpdateSettings({ ...settings, distributionFee: parseFloat(e.target.value) || 0 })}
                      className={cn(
                        "w-full px-4 py-2.5 rounded-2xl border font-mono font-bold text-sm",
                        theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">
                      Stawka VAT (np. 0.23 dla 23%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.vatRate}
                      onChange={(e) => handleUpdateSettings({ ...settings, vatRate: parseFloat(e.target.value) || 0.23 })}
                      className={cn(
                        "w-full px-4 py-2.5 rounded-2xl border font-mono font-bold text-sm",
                        theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                </div>

                {/* Section 3: G12 / G12w Rates */}
                <div className="border-t pt-4 border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                    Stawki Strefowe (G12 / G12w)
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">
                        Cena Szczytowa (PLN/kWh)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.g12PeakRate}
                        onChange={(e) => handleUpdateSettings({ ...settings, g12PeakRate: parseFloat(e.target.value) || 0 })}
                        className={cn(
                          "w-full px-4 py-2.5 rounded-2xl border font-mono font-bold text-sm",
                          theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">
                        Cena Pozaszczytowa (PLN/kWh)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={settings.g12OffpeakRate}
                        onChange={(e) => handleUpdateSettings({ ...settings, g12OffpeakRate: parseFloat(e.target.value) || 0 })}
                        className={cn(
                          "w-full px-4 py-2.5 rounded-2xl border font-mono font-bold text-sm",
                          theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Device Capacities for calculations */}
                <div className="border-t pt-4 border-slate-100 dark:border-slate-800">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                    Pojemności Urządzeń do Kalkulacji Oszczędności
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        Bateria EV (kWh)
                      </label>
                      <input
                        type="number"
                        value={settings.evBatteryKwh}
                        onChange={(e) => handleUpdateSettings({ ...settings, evBatteryKwh: parseFloat(e.target.value) || 50 })}
                        className={cn(
                          "w-full px-3 py-2 rounded-xl border font-mono font-bold text-xs",
                          theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        Bufor CWU (kWh)
                      </label>
                      <input
                        type="number"
                        value={settings.heatPumpBufferKwh}
                        onChange={(e) => handleUpdateSettings({ ...settings, heatPumpBufferKwh: parseFloat(e.target.value) || 15 })}
                        className={cn(
                          "w-full px-3 py-2 rounded-xl border font-mono font-bold text-xs",
                          theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 block mb-1">
                        Magazyn Dom (kWh)
                      </label>
                      <input
                        type="number"
                        value={settings.batteryStorageKwh}
                        onChange={(e) => handleUpdateSettings({ ...settings, batteryStorageKwh: parseFloat(e.target.value) || 10 })}
                        className={cn(
                          "w-full px-3 py-2 rounded-xl border font-mono font-bold text-xs",
                          theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-6 py-2.5 rounded-2xl bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-500/20 hover:bg-amber-600 transition-all"
                >
                  Zapisz i Zamknij
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
