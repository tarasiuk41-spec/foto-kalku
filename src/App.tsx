import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sun,
  Moon,
  Leaf, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  TrendingUp, 
  DollarSign, 
  BarChart3,
  Info, 
  Wallet,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  LineChart as LineChartIcon,
  Table as TableIcon,
  TrendingDown,
  Minus,
  Settings,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  FileSpreadsheet,
  Download,
  Cpu,
  Radio,
  Sparkles,
  CheckCircle2,
  X,
  Smartphone
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
  Cell,
  Label,
  LineChart,
  Line,
  ReferenceLine,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { generateSmartInsights } from './lib/smartInsights';
import { SmartInsightsCard } from './components/SmartInsightsCard';
import { SolarForecastWidget } from './components/SolarForecastWidget';
import { SmartHomeModal } from './components/SmartHomeModal';
import { EnergyPriceForecast } from './components/EnergyPriceForecast';
import { 
  getStoredSmartHomeSettings, 
  saveStoredSmartHomeSettings, 
  SmartHomeSettings, 
  sendWebhook, 
  PVWebhookPayload 
} from './lib/homeAssistant';
import { exportYearlyExcel, exportYearlyPdf } from './lib/reporting';
import { AndroidShell } from './components/AndroidShell';
import { AndroidBottomNav, AndroidTab } from './components/AndroidBottomNav';
import { AndroidQuickBar } from './components/AndroidQuickBar';
import { AndroidInstallModal } from './components/AndroidInstallModal';
import { 
  triggerAndroidHaptic, 
  isStandalonePWA, 
  releaseAndroidWakeLock, 
  requestAndroidWakeLock, 
  toggleAndroidFullscreen 
} from './lib/androidBridge';

function loadLocalArray<T>(key: string): T[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch { return []; }
}

// Types
interface PVData {
  meter180: number;        // Stan licznika 1.8.0 (Pobranie)
  meter280: number;        // Stan licznika 2.8.0 (Oddanie)
  production: number;      // P (miesięczna produkcja z falownika)
  pricePerKwh: number;     // PLN
  year: number;
  month: number;
}

interface MeterBaseline {
  year: number;            // Rok, dla którego to jest punkt zero (np. 2025)
  baseline180: number;     // Stan 1.8.0 na dzień 31.12 roku poprzedniego
  baseline280: number;     // Stan 2.8.0 na dzień 31.12 roku poprzedniego
}

interface PVReport {
  production: number;
  productionPln?: number;
  importFromGrid: number;
  exportToGrid: number;
  selfConsumptionKw: number;
  totalConsumptionKw: number;
  totalConsumptionPln?: number;
  selfConsumptionPercent: number;
  coveragePercent: number;
  savedAmount: number;
  energyBalance: number;
  financialBalance: number;
  dailyAverage: number;
  correctedGridEnergy: number; // 2.8.0 * 0.8
  gridBalance: number;         // (2.8.0 * 0.8) - 1.8.0
  gridBalancePln: number;      // (2.8.0 * 0.8 - 1.8.0) * cena (PLN)
  battery5Savings?: number;
  battery10Savings?: number;
  battery5AkBoost?: number;
  battery10AkBoost?: number;
}

const MONTHS = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", 
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"
];

export default function App() {
  const [readings, setReadings] = useState<PVData[]>(() => loadLocalArray<PVData>('pv-readings-local'));
  const [baselines, setBaselines] = useState<MeterBaseline[]>(() => loadLocalArray<MeterBaseline>('pv-baselines-local'));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [view, setView] = useState<AndroidTab>('month');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('pv-theme') as 'light' | 'dark') || 'light');
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showBatterySim, setShowBatterySim] = useState(false);
  const [showSmartHomeModal, setShowSmartHomeModal] = useState(false);
  const [smartHomeSettings, setSmartHomeSettings] = useState<SmartHomeSettings>(getStoredSmartHomeSettings);
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | null>(null);
  const [webhookStatusNotice, setWebhookStatusNotice] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Android OS states
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    setIsInstalled(isStandalonePWA());

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('pv-theme', theme);
  }, [theme]);

  // Clock Update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Form states
  const [formData, setFormData] = useState<Omit<PVData, 'year' | 'month'>>({
    production: 0,
    meter180: 0,
    meter280: 0,
    pricePerKwh: 0.95,
  });

  const [baselineFormData, setBaselineFormData] = useState<Omit<MeterBaseline, 'year'>>({
    baseline180: 0,
    baseline280: 0,
  });

  useEffect(() => {
    localStorage.setItem('pv-readings-local', JSON.stringify(readings));
  }, [readings]);

  useEffect(() => {
    localStorage.setItem('pv-baselines-local', JSON.stringify(baselines));
  }, [baselines]);

  // Handle data updates when month/year changes
  useEffect(() => {
    const currentReading = readings.find(r => r.year === selectedYear && r.month === selectedMonth);
    const baseline = baselines.find(b => b.year === selectedYear);
    
    if (currentReading) {
      setFormData({
        production: currentReading.production ?? 0,
        meter180: currentReading.meter180 ?? 0,
        meter280: currentReading.meter280 ?? 0,
        pricePerKwh: currentReading.pricePerKwh ?? 0,
      });
    } else {
      // Find latest reading to pre-fill meters
      const lastReading = [...readings]
        .filter(r => (r.year === selectedYear && r.month < selectedMonth) || (r.year < selectedYear))
        .sort((a, b) => b.year - a.year || b.month - a.month)[0];
      
      setFormData(prev => ({ 
        ...prev, 
        production: 0, 
        meter180: lastReading?.meter180 || baseline?.baseline180 || 0, 
        meter280: lastReading?.meter280 || baseline?.baseline280 || 0 
      }));
    }

    if (baseline) {
      setBaselineFormData({
        baseline180: baseline.baseline180,
        baseline280: baseline.baseline280,
      });
    } else {
      setBaselineFormData({ baseline180: 0, baseline280: 0 });
    }
  }, [selectedYear, selectedMonth, readings, baselines]);

  const saveReading = async () => {
    setSaving(true);
    try {
      const reading: PVData = { ...formData, year: selectedYear, month: selectedMonth };
      setReadings(prev => [...prev.filter(r => r.year !== selectedYear || r.month !== selectedMonth), reading]);
      // Synchronizacja z lokalnym backendem REST API (/api/v1/metrics/latest) dla Home Assistant
      const rep = calculateReport({ ...formData, year: selectedYear, month: selectedMonth }, readings, baselines);
      const metricsPayload = {
        production_kwh: formData.production,
        import_kwh: rep.importFromGrid,
        export_kwh: rep.exportToGrid,
        self_consumption_kwh: rep.selfConsumptionKw,
        self_consumption_percent: rep.selfConsumptionPercent,
        coverage_percent: rep.coveragePercent,
        corrected_grid_energy_08_kwh: rep.correctedGridEnergy,
        grid_balance_kwh: rep.gridBalance,
        financial_balance_pln: rep.financialBalance,
        energy_price_pln: formData.pricePerKwh,
        year: selectedYear,
        month: selectedMonth,
        monthName: MONTHS[selectedMonth - 1],
        month_name: MONTHS[selectedMonth - 1],
        installation_name: smartHomeSettings.installationName,
        peak_power_kwp: smartHomeSettings.peakPowerKwp,
      };

      fetch('/api/v1/metrics/latest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsPayload),
      }).catch(err => console.log('REST sync notice:', err.message));

      // Automatyczna wysyłka do Webhooka (np. Home Assistant / Node-RED)
      if (smartHomeSettings.autoSendOnSave && smartHomeSettings.webhookUrl) {
        const webhookPayload: PVWebhookPayload = {
          event: 'pv_reading_saved',
          timestamp: new Date().toISOString(),
          installation: {
            name: smartHomeSettings.installationName,
            peakPowerKwp: smartHomeSettings.peakPowerKwp,
            billingType: 'Net-metering 0.8',
          },
          metrics: metricsPayload,
        };

        sendWebhook(smartHomeSettings.webhookUrl, webhookPayload).then(res => {
          if (res.success) {
            setWebhookStatusNotice(`Webhook wysłany pomyślnie (${MONTHS[selectedMonth - 1]} ${selectedYear})`);
          } else {
            setWebhookStatusNotice(`Błąd webhooka: ${res.message}`);
          }
          setTimeout(() => setWebhookStatusNotice(null), 5000);
        });
      }
    } catch (e) { console.error(e); alert('Nie udało się zapisać odczytu.'); }
    finally { setSaving(false); }
  };

  const saveBaseline = async () => {
    setSaving(true);
    try {
      const baseline: MeterBaseline = { ...baselineFormData, year: selectedYear };
      setBaselines(prev => [...prev.filter(b => b.year !== selectedYear), baseline]);
      setShowSetup(false);
    } catch (e) { console.error(e); alert('Nie udało się zapisać stanu początkowego.'); }
    finally { setSaving(false); }
  };

  const exportBackup = () => {
    const payload = { format: 'foto-kalku-local-v1', createdAt: new Date().toISOString(), readings, baselines, smartHomeSettings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `FotoKalku_Kopia_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importBackup = async (file: File) => {
    try {
      let incomingReadings: PVData[] = [];
      let incomingBaselines: MeterBaseline[] = [];
      let settings: SmartHomeSettings | undefined;
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(await file.text());
        if (parsed.format !== 'foto-kalku-local-v1' || !Array.isArray(parsed.readings) || !Array.isArray(parsed.baselines)) throw new Error('Nieobsługiwany format kopii JSON');
        incomingReadings = parsed.readings;
        incomingBaselines = parsed.baselines;
        settings = parsed.smartHomeSettings;
      } else if (file.name.toLowerCase().endsWith('.xlsx')) {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const sheet = workbook.Sheets['Zestawienie 2026'] || workbook.Sheets[workbook.SheetNames.find(n => n.startsWith('Zestawienie')) || workbook.SheetNames[0]];
        if (!sheet) throw new Error('Nie znaleziono arkusza');
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
        incomingReadings = rows.filter(row => Number.isInteger(Number(row['Rok'])) && Number.isFinite(Number(row['Produkcja Falownika (kWh)'])) && Number.isFinite(Number(row['Stan Licznika 1.8.0'])) && Number.isFinite(Number(row['Stan Licznika 2.8.0']))).map(row => ({
          year: Number(row['Rok']),
          month: MONTHS.indexOf(String(row['Miesiąc'])) + 1,
          production: Number(row['Produkcja Falownika (kWh)']),
          meter180: Number(row['Stan Licznika 1.8.0']),
          meter280: Number(row['Stan Licznika 2.8.0']),
          pricePerKwh: Number(row['Cena Energii (PLN/kWh)']) || 0.95
        })).filter(r => r.month > 0);
      } else throw new Error('Wybierz plik .json lub .xlsx');
      if (!incomingReadings.every(r => Number.isInteger(r.year) && Number.isInteger(r.month) && r.month >= 1 && r.month <= 12 && ['production','meter180','meter280','pricePerKwh'].every(k => Number.isFinite(Number((r as unknown as Record<string, unknown>)[k]))))) throw new Error('Niepoprawne dane odczytów');
      if (!incomingBaselines.every(b => Number.isInteger(b.year) && Number.isFinite(b.baseline180) && Number.isFinite(b.baseline280))) throw new Error('Niepoprawne dane stanów początkowych');
      if (incomingReadings.length === 0 && incomingBaselines.length === 0) throw new Error('Plik nie zawiera odczytów');
      if (!window.confirm(`Zaimportować ${incomingReadings.length} odczytów? Odczyty z tych samych miesięcy zostaną zastąpione.`)) return;
      setReadings(prev => {
        const merged = new Map(prev.map(r => [`${r.year}-${r.month}`, r]));
        incomingReadings.forEach(r => merged.set(`${r.year}-${r.month}`, r));
        return [...merged.values()];
      });
      setBaselines(prev => {
        const merged = new Map(prev.map(b => [b.year, b]));
        incomingBaselines.forEach(b => merged.set(b.year, b));
        return [...merged.values()];
      });
      if (settings && typeof settings === 'object') {
        setSmartHomeSettings(settings);
        saveStoredSmartHomeSettings(settings);
      }
      alert(`Import zakończony: ${incomingReadings.length} odczytów.`);
    } catch (e) { alert(`Błąd importu: ${e instanceof Error ? e.message : String(e)}`); }
  };

  const calculateReport = (curr: PVData, allReadings: PVData[], yearBaselines: MeterBaseline[]): PVReport => {
    const baseline = yearBaselines.find(b => b.year === curr.year);
    
    // Zawsze próbujemy znaleźć najnowszy poprzedni odczyt (włącznie z poprzednimi latami)
    const previousReading = allReadings
      .filter(r => (r.year === curr.year && r.month < curr.month) || (r.year < curr.year))
      .sort((a, b) => b.year - a.year || b.month - a.month)[0];
      
    // Jeśli nie ma odczytu, używamy baseline (lub zera)
    const prev180 = previousReading?.meter180 ?? baseline?.baseline180 ?? 0;
    const prev280 = previousReading?.meter280 ?? baseline?.baseline280 ?? 0;

    const imp = Math.max(0, curr.meter180 - prev180);
    const exp = Math.max(0, curr.meter280 - prev280);
    const ak = Math.max(0, curr.production - exp);
    const totalZ = ak + imp;
    
    // Net-metering 0.8 logic
    const correctedExp = (exp || 0) * 0.8;
    const gBal = correctedExp - (imp || 0);
    const shortfall = Math.max(0, (imp || 0) - correctedExp);
    
    const akP = (curr.production || 0) > 0 ? (ak / curr.production) * 100 : 0;
    const covP = totalZ > 0 ? (ak / totalZ) * 100 : 0;
    
    // Real financial balance: Full market value of produced energy (Self-consumption + corrected Export - Import)
    const saved = ak * (curr.pricePerKwh || 0);
    const surplusValue = (correctedExp - imp) * (curr.pricePerKwh || 0);
    const finBal = saved + surplusValue;
    
    const daysInMonth = new Date(curr.year, curr.month, 0).getDate();
    const dailyAvg = finBal / daysInMonth;

    // Virtual Storage Simulation (still uses original export)
    const bat5Limit = 5 * 30 * 0.8; 
    const bat10Limit = 10 * 30 * 0.8;
    const bat5Kw = Math.min(exp, bat5Limit);
    const bat10Kw = Math.min(exp, bat10Limit);

    return {
      production: curr.production,
      productionPln: curr.production * (curr.pricePerKwh || 0),
      importFromGrid: imp,
      exportToGrid: exp,
      selfConsumptionKw: ak,
      totalConsumptionKw: totalZ,
      totalConsumptionPln: totalZ * (curr.pricePerKwh || 0),
      selfConsumptionPercent: akP,
      coveragePercent: covP,
      savedAmount: saved,
      energyBalance: exp - imp,
      financialBalance: finBal,
      dailyAverage: dailyAvg,
      correctedGridEnergy: correctedExp,
      gridBalance: gBal,
      gridBalancePln: surplusValue,
      battery5Savings: bat5Kw * curr.pricePerKwh,
      battery10Savings: bat10Kw * curr.pricePerKwh,
      battery5AkBoost: curr.production > 0 ? (bat5Kw / curr.production) * 100 : 0,
      battery10AkBoost: curr.production > 0 ? (bat10Kw / curr.production) * 100 : 0,
    };
  };

  // Memoized Reports
  const currentMonthReport = useMemo(() => 
    calculateReport({ ...formData, year: selectedYear, month: selectedMonth }, readings, baselines),
    [formData, selectedYear, selectedMonth, readings, baselines]
  );

  const getYearlyMetrics = (year: number) => {
    // Filter active months
    const yearReadings = readings
      .filter(r => r.year === year)
      .sort((a, b) => a.month - b.month);
    
    if (yearReadings.length === 0) return null;

    const monthlyReports = yearReadings.map(r => calculateReport(r, readings, baselines));
    const totals = monthlyReports.reduce((acc, curr) => ({
      production: acc.production + (yearReadings.find((_, i) => monthlyReports[i] === curr)?.production || 0),
      importFromGrid: acc.importFromGrid + curr.importFromGrid,
      exportToGrid: acc.exportToGrid + curr.exportToGrid,
      savedAmount: acc.savedAmount + curr.savedAmount,
      financialBalance: acc.financialBalance + curr.financialBalance,
      correctedGridEnergy: acc.correctedGridEnergy + curr.correctedGridEnergy,
      gridBalance: acc.gridBalance + curr.gridBalance,
      gridBalancePln: acc.gridBalancePln + curr.gridBalancePln,
    }), { 
      production: 0, 
      importFromGrid: 0, 
      exportToGrid: 0, 
      savedAmount: 0, 
      financialBalance: 0,
      correctedGridEnergy: 0,
      gridBalance: 0,
      gridBalancePln: 0
    });

    // Correct production sum and monetary values
    const totalProd = yearReadings.reduce((a, b) => a + b.production, 0);
    const totalProdPln = yearReadings.reduce((sum, r) => sum + (r.production * (r.pricePerKwh || 0)), 0);
    const totalConsumptionPln = monthlyReports.reduce((sum, rep, i) => sum + (rep.totalConsumptionKw * (yearReadings[i]?.pricePerKwh || 0)), 0);

    const ak = Math.max(0, totalProd - totals.exportToGrid);
    const totalZ = ak + totals.importFromGrid;
    const akP = totalProd > 0 ? (ak / totalProd) * 100 : 0;
    const covP = totalZ > 0 ? (ak / totalZ) * 100 : 0;

    return {
      ...totals,
      production: totalProd,
      productionPln: totalProdPln,
      selfConsumptionKw: ak,
      totalConsumptionKw: totalZ,
      totalConsumptionPln: totalConsumptionPln,
      selfConsumptionPercent: akP,
      coveragePercent: covP,
      energyBalance: totals.gridBalance, // Use the 0.8 balance as the main yearly energy balance
      gridBalancePln: totals.gridBalancePln,
      monthCount: yearReadings.length,
    };
  };

  const yearSummary = useMemo(() => getYearlyMetrics(selectedYear), [selectedYear, readings, baselines]);
  const prevYearSummary = useMemo(() => getYearlyMetrics(selectedYear - 1), [selectedYear, readings, baselines]);

  // Inteligentne Rekomendacje (Smart Energy Insights)
  const smartInsight = useMemo(() => {
    return generateSmartInsights(
      {
        month: selectedMonth,
        year: selectedYear,
        production: currentMonthReport.production,
        importFromGrid: currentMonthReport.importFromGrid,
        exportToGrid: currentMonthReport.exportToGrid,
        selfConsumptionKw: currentMonthReport.selfConsumptionKw,
        selfConsumptionPercent: currentMonthReport.selfConsumptionPercent,
        coveragePercent: currentMonthReport.coveragePercent,
        totalConsumptionKw: currentMonthReport.totalConsumptionKw,
        pricePerKwh: formData.pricePerKwh,
        gridBalance: currentMonthReport.gridBalance,
      },
      formData.pricePerKwh,
      smartHomeSettings.peakPowerKwp
    );
  }, [currentMonthReport, selectedMonth, selectedYear, formData.pricePerKwh, smartHomeSettings.peakPowerKwp]);

  const handleExportExcel = () => {
    if (readings.length === 0) {
      alert("Brak danych do wyeksportowania. Wprowadź co najmniej jeden odczyt.");
      return;
    }
    setIsExporting('excel');
    try {
      exportYearlyExcel(
        readings,
        baselines,
        calculateReport,
        selectedYear,
        {
          name: smartHomeSettings.installationName,
          peakKwp: smartHomeSettings.peakPowerKwp
        }
      );
    } catch (e: any) {
      console.error("Błąd eksportu do Excel:", e);
      alert("Wystąpił błąd podczas generowania arkusza Excel.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (readings.length === 0) {
      alert("Brak danych do wygenerowania raportu PDF. Wprowadź odczyty.");
      return;
    }
    setIsExporting('pdf');
    try {
      const chartIds = view === 'month' 
        ? ['monthly-chart-container', 'solar-forecast-chart'] 
        : ['yearly-line-container', 'yearly-bar-container'];

      await exportYearlyPdf(
        readings,
        baselines,
        calculateReport,
        selectedYear,
        {
          name: smartHomeSettings.installationName,
          peakKwp: smartHomeSettings.peakPowerKwp,
          location: smartHomeSettings.cityName
        },
        chartIds
      );
    } catch (e: any) {
      console.error("Błąd generowania PDF:", e);
      alert("Wystąpił błąd podczas tworzenia pliku PDF.");
    } finally {
      setIsExporting(null);
    }
  };

  // Performance Benchmark
  const benchmark = useMemo(() => {
    const historical = readings.filter(r => r.month === selectedMonth && r.year < selectedYear && r.year >= 2022);
    if (historical.length === 0) return null;
    
    const lastYear = readings.find(r => r.month === selectedMonth && r.year === selectedYear - 1);
    if (!lastYear) return null;

    const currentProd = formData.production;
    const lastYearProd = lastYear.production;
    
    const diff = lastYearProd === 0 ? 0 : ((currentProd - lastYearProd) / lastYearProd) * 100;
    
    return {
      diff,
      lastYearProd,
      alert: diff < -15
    };
  }, [selectedYear, selectedMonth, readings, formData.production]);

  const isLastDayOfMonth = () => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return today.getDate() === lastDay;
  };

  const comparisonData = useMemo(() => {
    if (!yearSummary || !prevYearSummary) return null;
    const diff = (c: number, p: number) => p === 0 ? 0 : ((c - p) / p) * 100;
    return [
      { label: "Produkcja", curr: yearSummary.production, prev: prevYearSummary.production, diff: diff(yearSummary.production, prevYearSummary.production), unit: 'kWh' },
      { label: "Zużycie Domu", curr: yearSummary.totalConsumptionKw, prev: prevYearSummary.totalConsumptionKw, diff: diff(yearSummary.totalConsumptionKw, prevYearSummary.totalConsumptionKw), unit: 'kWh' },
      { label: "Autokonsumpcja", curr: yearSummary.selfConsumptionKw, prev: prevYearSummary.selfConsumptionKw, diff: diff(yearSummary.selfConsumptionKw, prevYearSummary.selfConsumptionKw), unit: 'kWh' },
      { label: "Oszczędności", curr: yearSummary.savedAmount, prev: prevYearSummary.savedAmount, diff: diff(yearSummary.savedAmount, prevYearSummary.savedAmount), unit: 'PLN' }
    ];
  }, [yearSummary, prevYearSummary]);

  const chartData = useMemo(() => {
    return MONTHS.map((name, i) => {
      const r = readings.find(reading => reading.year === selectedYear && reading.month === i + 1);
      const rep = r ? calculateReport(r, readings, baselines) : null;
      return {
        name: name.substring(0, 3),
        Produkcja: r?.production || 0,
        Zużycie: rep?.totalConsumptionKw || 0,
        Oszczędność: rep?.savedAmount || 0,
        Import: rep?.importFromGrid || 0,
      };
    });
  }, [selectedYear, readings, baselines]);

  const productionComparisonData = useMemo(() => {
    return MONTHS.map((name, i) => {
      const currentYearReading = readings.find(r => r.year === selectedYear && r.month === i + 1);
      const prevYearReading = readings.find(r => r.year === selectedYear - 1 && r.month === i + 1);
      return {
        name: name.substring(0, 3),
        [`Rok ${selectedYear}`]: currentYearReading?.production || 0,
        [`Rok ${selectedYear - 1}`]: prevYearReading?.production || 0,
      };
    });
  }, [selectedYear, readings]);

  const cumulativeBalanceData = useMemo(() => {
    let cumulative = 0;
    return MONTHS.map((name, i) => {
      const r = readings.find(reading => reading.year === selectedYear && reading.month === i + 1);
      const rep = r ? calculateReport(r, readings, baselines) : null;
      if (rep) {
        cumulative += rep.gridBalance;
      }
      return {
        name: name.substring(0, 3),
        fullName: name,
        "Bilans Miesięczny (kWh)": rep ? Math.round(rep.gridBalance) : 0,
        "Bilans Skumulowany (kWh)": r ? Math.round(cumulative) : null,
        monthlyBalance: rep ? rep.gridBalance : 0,
        cumulativeBalance: r ? cumulative : null,
        hasData: !!r,
      };
    });
  }, [selectedYear, readings, baselines]);

  const monthDistribution = useMemo(() => [
    { name: 'Zużycie domu', value: currentMonthReport.totalConsumptionKw, color: '#f8fafc', unit: 'kWh' },
    { name: 'Zużycie z sieci', value: currentMonthReport.importFromGrid, color: '#f43f5e', unit: 'kWh' },
    { name: 'Autokonsumpcja', value: currentMonthReport.selfConsumptionKw, color: '#10b981', unit: 'kWh' },
    { name: 'Oddanie do sieci', value: currentMonthReport.exportToGrid, color: '#ef4444', unit: 'kWh' },
    { name: 'Energia z sieci (0.8)', value: currentMonthReport.correctedGridEnergy, color: '#60a5fa', unit: 'kWh' },
    { name: 'Zysk autokons.', value: currentMonthReport.savedAmount, color: '#eab308', unit: 'zł' },
    { name: 'Realne saldo', value: currentMonthReport.financialBalance, color: '#8b5cf6', unit: 'zł' },
  ], [currentMonthReport]);

  const totalMonthlyProd = currentMonthReport.production;

  const formatCurrency = (v: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(v);
  const formatNum = (v: number) => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(v);

  return (
    <AndroidShell theme={theme} currentTime={currentTime} wakeLockActive={wakeLockActive}>
      <div className={cn("min-h-full font-sans pb-24 selection:bg-emerald-500/20 transition-colors duration-500", theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900")}>
        {/* Compact Android Top App Bar */}
        <header className={cn("border-b sticky top-0 z-30 transition-colors duration-500 backdrop-blur-xl px-4 py-2", theme === 'dark' ? "bg-slate-950/90 border-slate-800" : "bg-white/90 border-slate-200")}>
          <div className="max-w-5xl mx-auto flex flex-col gap-2">
            {/* Quick action bar */}
            <AndroidQuickBar
              theme={theme}
              onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              wakeLockActive={wakeLockActive}
              onWakeLockChange={setWakeLockActive}
              isFullscreen={isFullscreen}
              onFullscreenChange={setIsFullscreen}
              onOpenInstall={() => setShowInstallModal(true)}
              isInstallable={!!deferredPrompt}
              isInstalled={isInstalled}
              currentYear={selectedYear}
              currentMonthName={MONTHS[selectedMonth - 1]}
              totalProduction={formData.production}
              totalSavings={currentMonthReport.savedAmount}
              onNotification={(msg) => {
                setWebhookStatusNotice(msg);
                setTimeout(() => setWebhookStatusNotice(null), 4000);
              }}
            />

            {/* App brand & Year Selector */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Zap className="text-white fill-white/20 w-4 h-4" />
                </div>
                <div>
                  <h1 className={cn("text-xs font-black tracking-widest uppercase leading-none", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    MONITOR PV
                  </h1>
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Android Edition
                  </span>
                </div>
              </div>

              {/* Year Switcher (Android touch friendly) */}
              <div className={cn("flex items-center rounded-xl border px-1 py-0.5", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200")}>
                <button 
                  onClick={() => {
                    triggerAndroidHaptic(10);
                    setSelectedYear(y => y-1);
                  }} 
                  className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  aria-label="Poprzedni rok"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className={cn("px-2 font-mono font-black text-xs", theme === 'dark' ? "text-white" : "text-slate-900")}>
                  {selectedYear}
                </span>
                <button 
                  onClick={() => {
                    triggerAndroidHaptic(10);
                    setSelectedYear(y => y+1);
                  }} 
                  className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  aria-label="Następny rok"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={exportBackup} className="p-2 text-xs font-bold text-emerald-600" title="Eksport JSON">Kopia JSON</button>
                <label className="p-2 text-xs font-bold text-emerald-600 cursor-pointer" title="Import JSON lub Excel">
                  Import
                  <input type="file" accept=".json,.xlsx" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (file) await importBackup(file); e.target.value = ''; }} />
                </label>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Notifications */}
          {isLastDayOfMonth() && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/20 ring-2 ring-white dark:ring-slate-900">
                <Zap className="w-5 h-5 text-white fill-white/20" />
              </div>
              <div>
                <p className="font-black text-xs uppercase tracking-tight">Koniec miesiąca!</p>
                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Podaj stany liczników, aby zamknąć okres rozliczeniowy.</p>
              </div>
            </motion.div>
          )}

          {/* Webhook Status Notice */}
          {webhookStatusNotice && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0 }} 
              className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400 text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>{webhookStatusNotice}</span>
              </div>
              <button onClick={() => setWebhookStatusNotice(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}

          {/* Quick Segmented View Tabs for Android */}
          <div className="mb-6 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
            <div className={cn("inline-flex items-center gap-1 p-1 rounded-2xl border transition-colors", theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200")}>
              <button 
                onClick={() => {
                  triggerAndroidHaptic(10);
                  setView('month');
                }}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  view === 'month' 
                    ? "bg-emerald-600 text-white shadow-sm"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                )}
              >
                Miesiąc
              </button>
              <button 
                onClick={() => {
                  triggerAndroidHaptic(10);
                  setView('year');
                }}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                  view === 'year' 
                    ? "bg-emerald-600 text-white shadow-sm"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                )}
              >
                Rok 0.8
              </button>
              <button 
                onClick={() => {
                  triggerAndroidHaptic(10);
                  setView('tariffs');
                }}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                  view === 'tariffs' 
                    ? "bg-amber-600 text-white shadow-sm"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                )}
              >
                <Zap className="w-3 h-3 text-amber-400" />
                Taryfy PSE
              </button>
              <button 
                onClick={() => {
                  triggerAndroidHaptic(10);
                  setView('forecast');
                }}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                  view === 'forecast' 
                    ? "bg-amber-500 text-white shadow-sm"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                )}
              >
                <Sun className="w-3 h-3 text-amber-300" />
                Prognoza
              </button>
              <button 
                onClick={() => {
                  triggerAndroidHaptic(10);
                  setView('settings');
                }}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                  view === 'settings' 
                    ? "bg-purple-600 text-white shadow-sm"
                    : (theme === 'dark' ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")
                )}
              >
                <Cpu className="w-3 h-3 text-purple-400" />
                IoT & Opcje
              </button>
            </div>

            {/* Quick Export in top bar */}
            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => {
                  triggerAndroidHaptic(15);
                  handleExportExcel();
                }}
                disabled={isExporting !== null}
                className="flex items-center gap-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-bold uppercase transition-all"
                title="Pobierz Excel"
              >
                {isExporting === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">XLSX</span>
              </button>

              <button 
                onClick={() => {
                  triggerAndroidHaptic(15);
                  handleExportPDF();
                }}
                disabled={isExporting !== null}
                className="flex items-center gap-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold uppercase transition-all"
                title="Pobierz PDF"
              >
                {isExporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          </div>

          {/* Podsumowanie roczne (Tylko widoczne na górze w widoku miesięcznym) */}
        {view === 'month' && yearSummary && (
          <motion.section 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-[32px] border p-8 shadow-sm mb-10 relative group transition-colors duration-500",
              theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
            )}
          >
            <div className="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <BarChart3 className={cn("w-20 h-20", theme === 'dark' ? "text-slate-500" : "text-slate-200")} />
              </div>
            </div>

            <h3 className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-8 border-b pb-4 flex items-center justify-between", theme === 'dark' ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-50")}>
              <span>Podsumowanie Roku {selectedYear}</span>
              <span className="text-emerald-500 font-mono">{yearSummary.monthCount} miesięcy aktywnie</span>
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 xl:gap-8">
              <div className="space-y-1 relative">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Produkcja PV</p>
                  <MetricInfoTooltip 
                    title="Roczna Produkcja PV"
                    meaning="Całkowita ilość zielonej energii wyprodukowana przez Twoje panele fotowoltaiczne i falownik w ciągu całego roku oraz jej rynkowa wartość."
                    formula="Ilościowo: Suma odczytów produkcji z falownika (PF) [kWh]. Wartość: Produkcja × Cena za kWh [PLN]"
                    unit="kWh / PLN"
                    theme={theme}
                    align="left"
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={cn("text-3xl font-black font-mono tracking-tighter", theme === 'dark' ? "text-emerald-400" : "text-emerald-600")}>
                    {formatNum(yearSummary.production)}
                  </p>
                  <span className="text-xs font-bold text-slate-400">kWh</span>
                </div>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-black border shadow-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                    <span>{formatCurrency(yearSummary.productionPln ?? (yearSummary.production * formData.pricePerKwh))}</span>
                    <span className="text-[9px] font-sans font-bold uppercase tracking-wider opacity-90">
                      wartość
                    </span>
                  </span>
                </div>
              </div>

              <div className="space-y-1 relative">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Całkowite Zużycie</p>
                  <MetricInfoTooltip 
                    title="Całkowite Zużycie Domu (PC)"
                    meaning="Rzeczywista energia zużyta w całym domu przez wszystkie odbiorniki – autokonsumpcja bieżąca ze słońca oraz prąd dokupiony z sieci – wraz z jej łącznym kosztem."
                    formula="Ilościowo: Autokonsumpcja (AK) + Pobranie z sieci (licznik 1.8.0) [kWh]. Wartość: Zużycie × Cena za kWh [PLN]"
                    unit="kWh / PLN"
                    theme={theme}
                    align="left"
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={cn("text-3xl font-black font-mono tracking-tighter", theme === 'dark' ? "text-amber-400" : "text-amber-600")}>
                    {formatNum(yearSummary.totalConsumptionKw)}
                  </p>
                  <span className="text-xs font-bold text-slate-400">kWh</span>
                </div>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-black border shadow-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20">
                    <span>{formatCurrency(yearSummary.totalConsumptionPln ?? (yearSummary.totalConsumptionKw * formData.pricePerKwh))}</span>
                    <span className="text-[9px] font-sans font-bold uppercase tracking-wider opacity-90">
                      koszt
                    </span>
                  </span>
                </div>
              </div>
              
              <div className="space-y-1 relative">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Wartość Energii</p>
                  <MetricInfoTooltip 
                    title="Wartość Energii (Oszczędność)"
                    meaning="Łączna wartość finansowa wygenerowana przez instalację PV – suma prądu zużytego na miejscu bez opłat oraz wartości energii odebranej z sieci w opuście 0.8."
                    formula="(Autokonsumpcja × Cena) + (Odebrana z sieci w 0.8 × Cena)"
                    unit="PLN"
                    theme={theme}
                    align="center"
                  />
                </div>
                <p className={cn("text-3xl font-black font-mono tracking-tighter", theme === 'dark' ? "text-blue-400" : "text-blue-600")}>
                  {formatCurrency(yearSummary.savedAmount)}
                </p>
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border shadow-sm text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20">
                    <span className="text-[9px] font-sans font-bold uppercase tracking-wider">
                      oszczędność PV
                    </span>
                  </span>
                </div>
              </div>

              <div className="space-y-1 relative">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Bilans (0.8)</p>
                  <MetricInfoTooltip 
                    title="Bilans Prosumencki (0.8)"
                    meaning="Ilościowe i finansowe saldo energii w systemie opustów (net-metering dla instalacji ≤ 10 kWp). Wartość (+) oznacza nadpłatę i zapas energii w sieci, a (-) kwotę do zapłaty za brakującą energię."
                    formula="Ilościowo: (Oddanie × 0.8) − Pobranie [kWh]. Finansowo: Bilans kWh × Cena energii [PLN]"
                    unit="kWh / PLN"
                    theme={theme}
                    align="center"
                  />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={cn(
                    "text-3xl font-black font-mono tracking-tighter", 
                    yearSummary.energyBalance >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    {yearSummary.energyBalance >= 0 ? '+' : ''}{formatNum(yearSummary.energyBalance)}
                  </p>
                  <span className="text-xs font-bold text-slate-400">kWh</span>
                </div>
                <div className="pt-1">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-black border shadow-sm",
                    yearSummary.gridBalancePln >= 0 
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                      : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                  )}>
                    <span>{yearSummary.gridBalancePln >= 0 ? '+' : ''}{formatCurrency(yearSummary.gridBalancePln)}</span>
                    <span className="text-[9px] font-sans font-bold uppercase tracking-wider opacity-90">
                      {yearSummary.gridBalancePln >= 0 ? 'nadpłata' : 'do zapłaty'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="space-y-1 relative">
                <div className="flex items-center gap-1.5">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Saldo Finansowe</p>
                  <MetricInfoTooltip 
                    title="Roczne Saldo Finansowe"
                    meaning="Ostateczny bilans finansowy Twojej instalacji. Kwota na plusie (+) oznacza czysty zysk roczny, kwota na minusie (-) szacowany koszt energii dokupionej."
                    formula="Roczny bilans energii (0.8) × Cena za kWh [PLN]"
                    unit="PLN"
                    theme={theme}
                    align="right"
                  />
                </div>
                <p className={cn(
                  "text-3xl font-black font-mono tracking-tighter",
                  yearSummary.financialBalance >= 0 ? "text-emerald-500" : "text-rose-500"
                )}>
                  {yearSummary.financialBalance >= 0 ? '+' : ''}{formatCurrency(yearSummary.financialBalance)}
                </p>
                <div className="pt-1">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono font-bold border shadow-sm",
                    yearSummary.financialBalance >= 0 
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" 
                      : "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                  )}>
                    <span className="text-[9px] font-sans font-bold uppercase tracking-wider">
                      {yearSummary.financialBalance >= 0 ? 'zysk netto' : 'koszt netto'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </motion.section>
        )}


        <AnimatePresence mode="wait">
          {view === 'month' ? (
            <motion.div key="month" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Sidebar Inputs */}
              <div className="lg:col-span-4 space-y-4">
                
                <section className={cn(
                  "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 transition-colors duration-500",
                  theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                )}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Miesiąc Odczytu
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 gap-2 mb-6">
                    {MONTHS.map((m, i) => (
                      <button 
                        key={m} 
                        onClick={() => setSelectedMonth(i + 1)}
                        className={cn(
                          "py-3 rounded-2xl text-[10px] font-black tracking-widest transition-all uppercase", 
                          selectedMonth === i + 1 
                            ? (theme === 'dark' ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 scale-[1.02]" : "bg-slate-900 text-white shadow-xl shadow-slate-900/10 scale-[1.02]")
                            : (theme === 'dark' ? "bg-slate-950 text-slate-500 hover:bg-slate-800" : "bg-slate-50 text-slate-400 hover:bg-slate-100")
                        )}
                      >
                        {m.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                  <div className={cn("flex items-center justify-between p-4 rounded-2xl border group transition-colors", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100")}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Wybrany Rok:</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())} 
                        className={cn("bg-transparent w-16 text-right text-sm font-black font-mono focus:outline-none transition-colors", theme === 'dark' ? "text-slate-200" : "text-slate-700")}
                      />
                    </div>
                  </div>
                </section>
                <section className={cn(
                  "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 transition-colors duration-500",
                  theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                )}>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="font-black text-slate-400 uppercase tracking-widest text-[10px] flex items-center gap-2">
                       <div className="w-2 h-2 rounded bg-blue-500" />
                       Dane Licznikowe
                    </h2>
                    <button onClick={() => setShowSetup(!showSetup)} className={cn("p-2.5 rounded-xl transition-all", showSetup ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : (theme === 'dark' ? "bg-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-50 text-slate-400 hover:text-slate-600"))} title="Konfiguracja"><Settings className="w-4 h-4" /></button>
                  </div>

                  {showSetup ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                      <div className={cn("p-4 rounded-2xl border text-[10px] font-bold uppercase tracking-widest text-center", theme === 'dark' ? "bg-blue-900/20 border-blue-800 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-700")}>
                        Punkt Zero (Stan na 31.12 poprzedniego roku)
                      </div>
                      <InputField theme={theme} label="Stan 1.8.0 (Pobranie)" unit="kWh" value={baselineFormData.baseline180} onChange={v => setBaselineFormData(p => ({ ...p, baseline180: v }))} icon={<ArrowDownRight className="w-4 h-4 text-rose-500" />} />
                      <InputField theme={theme} label="Stan 2.8.0 (Oddanie)" unit="kWh" value={baselineFormData.baseline280} onChange={v => setBaselineFormData(p => ({ ...p, baseline280: v }))} icon={<ArrowUpRight className="w-4 h-4 text-emerald-500" />} />
                      <button onClick={saveBaseline} disabled={saving} className={cn("w-full font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 shadow-xl shadow-slate-900/10", theme === 'dark' ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-slate-900 text-white hover:bg-slate-800")}>{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}Ustaw Punkt Zero</button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <InputField theme={theme} label="PRODUKCJA FALOWNIKA" unit="kWh" value={formData.production} onChange={v => setFormData(p => ({ ...p, production: v }))} icon={<Zap className="w-4 h-4 text-amber-500" />} />
                      <InputField theme={theme} label="STAN LICZNIKA 1.8.0 (POBÓR)" unit="kWh" value={formData.meter180} onChange={v => setFormData(p => ({ ...p, meter180: v }))} icon={<div className="w-2 h-2 rounded-full bg-rose-500" />} />
                      <InputField theme={theme} label="STAN LICZNIKA 2.8.0 (ODDANIE)" unit="kWh" value={formData.meter280} onChange={v => setFormData(p => ({ ...p, meter280: v }))} icon={<div className="w-2 h-2 rounded-full bg-emerald-500" />} />
                      <InputField theme={theme} label="CENA ENERGII" unit="PLN/kWh" value={formData.pricePerKwh} onChange={v => setFormData(p => ({ ...p, pricePerKwh: v }))} step={0.01} icon={<div className="w-2 h-2 rounded-full bg-blue-500" />} />
                      
                      {/* Battery Sim Toggle */}
                      <div className={cn("flex items-center justify-between p-4 border rounded-2xl transition-all group", theme === 'dark' ? "bg-slate-950 border-slate-800 hover:border-emerald-500/50" : "bg-slate-50 border-slate-100 hover:border-emerald-500")}>
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-xl transition-all", showBatterySim ? "bg-emerald-500/10 text-emerald-500" : (theme === 'dark' ? "bg-slate-900 text-slate-700" : "bg-white text-slate-300"))}>
                            <Zap className="w-4 h-4" />
                          </div>
                          <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", showBatterySim ? (theme === 'dark' ? "text-slate-200" : "text-slate-700") : "text-slate-400 group-hover:text-slate-600")}>Symulacja magazynu</span>
                        </div>
                        <button 
                          onClick={() => setShowBatterySim(!showBatterySim)}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                            showBatterySim ? "bg-emerald-500" : (theme === 'dark' ? "bg-slate-800" : "bg-slate-200")
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              showBatterySim ? "translate-x-6" : "translate-x-1"
                            )}
                          />
                        </button>
                      </div>

                      <button onClick={saveReading} disabled={saving} className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 disabled:opacity-50 mt-4 tracking-widest uppercase">{saving ? <Loader2 className="w-5 h-5 animate-spin" /> : null}Zapisz Odczyt</button>
                    </div>
                  )}
                </section>


                <section className={cn(
                  "rounded-3xl border p-8 shadow-xl transition-colors duration-500",
                  theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                )}>
                  <h3 className="font-black text-slate-500 mb-6 flex items-center gap-2 text-[10px] uppercase tracking-widest"><BarChart3 className="w-4 h-4 text-emerald-500" />Struktura Energii</h3>
                  <div className="h-[280px] w-full" id="monthly-chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthDistribution} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#1e293b" : "#f8fafc"} />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }}
                        />
                        <YAxis hide />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40} isAnimationActive={false}>
                          {monthDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                          <LabelList 
                            dataKey="value" 
                            position="top" 
                            formatter={(v: number, entry?: any) => {
                              const item = monthDistribution.find(d => d.name === (entry?.payload?.name || entry?.name));
                              return item?.unit === 'zł' ? `${formatNum(v)} zł` : `${formatNum(v)} kWh`;
                            }}
                            style={{ fill: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: 10, fontWeight: '900', fontFamily: 'monospace' }}
                          />
                        </Bar>
                        <RechartsTooltip 
                          cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f1f5f9', opacity: 0.4 }}
                          contentStyle={{ 
                            backgroundColor: theme === 'dark' ? '#0f172a' : 'white', 
                            border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #f1f5f9', 
                            borderRadius: '12px', 
                            fontSize: '11px',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                          }} 
                          formatter={(v: number, name: string) => {
                            const item = monthDistribution.find(d => d.name === name);
                            return [item?.unit === 'zł' ? `${formatNum(v)} zł` : `${formatNum(v)} kWh`, ''];
                          }}
                        />
                        <Legend 
                          iconType="circle" 
                          verticalAlign="bottom" 
                          align="center"
                          wrapperStyle={{ fontSize: '9px', color: '#94a3b8', paddingTop: '30px' }}
                          formatter={(value, entry: any) => {
                            const item = monthDistribution.find(d => d.name === value);
                            const displayVal = item?.unit === 'zł' ? `${formatNum(entry.payload.value)} zł` : `${formatNum(entry.payload.value)} kWh`;
                            return (
                              <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">
                                {value}: <span className={cn("ml-1", theme === 'dark' ? "text-white" : "text-slate-900")}>{displayVal}</span>
                              </span>
                            );
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              {/* Main Analytics */}
              <div className="lg:col-span-8 space-y-8">
                {/* Inteligentne Saldo Finansowe */}
                <section className={cn(
                  "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 relative overflow-hidden group transition-colors duration-500",
                  theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                )}>
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Wallet className="w-24 h-24 text-slate-400" />
                  </div>
                  <h3 className={cn("text-[10px] font-black uppercase tracking-widest mb-6 border-b pb-4", theme === 'dark' ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-50")}>Twój Bilans Miesięczny</h3>
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                      <div className={cn(
                        "text-5xl font-black font-mono tracking-tighter mb-2 flex items-center gap-3",
                        currentMonthReport.financialBalance >= 0 ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {currentMonthReport.financialBalance >= 0 ? '+' : '-'} {formatCurrency(Math.abs(currentMonthReport.financialBalance))}
                        {currentMonthReport.financialBalance >= 0 ? (
                          <ArrowUp className="w-10 h-10" />
                        ) : (
                          <ArrowDown className="w-10 h-10" />
                        )}
                      </div>
                      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                        {currentMonthReport.financialBalance >= 0 ? "Realny zysk (Autokonsumpcja + Nadwyżka)" : "Szacowany koszt netto instalacji"}
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2">
                        <div className={cn("text-[9px] font-black border px-3 py-1.5 rounded-full uppercase tracking-tighter shadow-sm", theme === 'dark' ? "bg-slate-950 border-slate-800 text-slate-500" : "bg-slate-50 border-slate-100 text-slate-500")}>
                           Energia z sieci (x0.8): <span className="text-blue-600 ml-1">{formatNum(currentMonthReport.correctedGridEnergy)} kWh</span>
                        </div>
                        <div className={cn(
                          "text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-tighter border shadow-sm flex items-center gap-1.5",
                          currentMonthReport.gridBalance >= 0 ? "bg-emerald-50/10 border-emerald-500/20 text-emerald-500" : "bg-rose-50/10 border-rose-500/20 text-rose-500"
                        )}>
                          <span>Bilans energii: {currentMonthReport.gridBalance >= 0 ? '+' : ''}{formatNum(currentMonthReport.gridBalance)} kWh</span>
                          <span className="font-mono font-bold">
                            ({currentMonthReport.gridBalancePln >= 0 ? '+' : ''}{formatCurrency(currentMonthReport.gridBalancePln)}{' '}
                            <span className="opacity-80">{currentMonthReport.gridBalancePln >= 0 ? 'nadpłata' : 'do zapłaty'}</span>)
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={cn("p-8 rounded-[32px] shadow-2xl w-full md:w-auto relative overflow-hidden ring-4 transition-colors", theme === 'dark' ? "bg-slate-950 ring-slate-900" : "bg-slate-900 ring-white")}>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-5 rounded-full -mr-12 -mt-12" />
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Średni bilans dzienny</p>
                      <div className="flex items-baseline gap-2">
                        <span className={cn(
                          "text-3xl font-black font-mono",
                          currentMonthReport.dailyAverage >= 0 ? "text-emerald-400" : "text-rose-400"
                        )}>
                          {currentMonthReport.dailyAverage >= 0 ? '+' : '-'} {formatCurrency(Math.abs(currentMonthReport.dailyAverage))}
                        </span>
                        <span className="text-slate-500 text-xs font-bold font-mono">/ doba</span>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MetricCard theme={theme} title="Autokonsumpcja" value={`${formatNum(currentMonthReport.selfConsumptionPercent)}%`} subValue={`${formatNum(currentMonthReport.selfConsumptionKw)} kWh`} description="Energia zużyta na bieżąco w Twoim gospodarstwie domowym." trend={currentMonthReport.selfConsumptionPercent > 20 ? 'up' : 'down'} color="emerald" />
                  <MetricCard theme={theme} title="Pokrycie Potrzeb" value={`${formatNum(currentMonthReport.coveragePercent)}%`} subValue={`${formatNum(currentMonthReport.totalConsumptionKw)} kWh całkowite`} description="Udział energii słonecznej w całkowitym zapotrzebowaniu domu." trend={currentMonthReport.coveragePercent > 50 ? 'up' : 'down'} color="blue" />
                </div>

                <section className={cn(
                  "rounded-[40px] border overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 transition-colors duration-500",
                  theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                )}>
                  <div className={cn("p-8 border-b flex items-center justify-between", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50/30 border-slate-50")}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analiza Miesięczna: {MONTHS[selectedMonth-1]} {selectedYear}</h3>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className={cn("text-slate-400 font-bold uppercase text-[9px] tracking-widest", theme === 'dark' ? "bg-slate-950" : "bg-slate-50")}>
                        <tr><th className="px-8 py-4">Kategoria</th><th className="px-8 py-4 text-right">Wartość</th><th className="px-8 py-4 text-right">Jednostka</th></tr>
                      </thead>
                      <tbody className={cn("divide-y font-mono", theme === 'dark' ? "divide-slate-800" : "divide-slate-50")}>
                        <TableRow theme={theme} label="Całkowite zużycie domu (własne + sieć)" value={formatNum(currentMonthReport.totalConsumptionKw)} unit="kWh" valueColor={theme === 'dark' ? "text-white" : "text-slate-900"} />
                        <TableRow theme={theme} label="Zużycie z sieci (pobranie)" value={formatNum(currentMonthReport.importFromGrid)} unit="kWh" valueColor="text-rose-500" />
                        <TableRow theme={theme} label="Produkcja z falownika (produkcja)" value={formatNum(currentMonthReport.production)} unit="kWh" valueColor="text-teal-500" />
                        <TableRow theme={theme} label="Autokonsumpcja bezpośrednia" value={formatNum(currentMonthReport.selfConsumptionKw)} unit="kWh" valueColor="text-emerald-500" />
                        <TableRow theme={theme} label="Oddanie do sieci (nadwyżka)" value={formatNum(currentMonthReport.exportToGrid)} unit="kWh" valueColor="text-blue-500" />
                        <TableRow theme={theme} label="Energia z sieci skorygowana (x0.8)" value={formatNum(currentMonthReport.correctedGridEnergy)} unit="kWh" valueColor="text-slate-400" />
                        <TableRow theme={theme} label="Wartość autokonsumpcji" value={formatCurrency(currentMonthReport.savedAmount)} unit="PLN" valueColor="text-amber-600" />
                        {showBatterySim && (
                          <TableRow theme={theme} label="Szacowany zysk z magazynem 10kWh" value={formatCurrency(currentMonthReport.battery10Savings || 0)} unit="PLN" valueColor="text-emerald-600" />
                        )}
                        <TableRow 
                          theme={theme}
                          label="Realny bilans finansowy miesiąca" 
                          value={formatCurrency(currentMonthReport.financialBalance)} 
                          unit="PLN" 
                          valueColor={currentMonthReport.financialBalance >= 0 ? "text-emerald-600" : "text-rose-600"} 
                        />
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 1. Inteligentne Rekomendacje (Smart Energy Insights) */}
                <SmartInsightsCard 
                  insight={smartInsight} 
                  theme={theme} 
                  monthName={`${MONTHS[selectedMonth-1]} ${selectedYear}`} 
                />

                {/* 2. Prognoza Generacji PV (Integracja z Open-Meteo API) */}
                <SolarForecastWidget
                  theme={theme}
                  defaultPeakKwp={smartHomeSettings.peakPowerKwp}
                  onSettingsChange={(peak, lat, lon, city) => {
                    const updated = {
                      ...smartHomeSettings,
                      peakPowerKwp: peak,
                      latitude: lat,
                      longitude: lon,
                      cityName: city
                    };
                    setSmartHomeSettings(updated);
                    saveStoredSmartHomeSettings(updated);
                  }}
                />

                {/* 3. Skrót do modułu Taryf i Cen Energii z sieci */}
                <div className={cn(
                  "p-5 rounded-[28px] border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300",
                  theme === 'dark' 
                    ? "bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border-amber-500/20" 
                    : "bg-gradient-to-r from-amber-500/10 via-white to-white border-amber-500/30"
                )}>
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-md shadow-amber-500/20 flex-shrink-0">
                      <Zap className="w-5 h-5 fill-white/20" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                          Nowy Moduł: Dynamiczne Ceny PSE & G12
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold uppercase">
                          API Live
                        </span>
                      </div>
                      <p className={cn("text-xs font-bold mt-0.5", theme === 'dark' ? "text-slate-200" : "text-slate-800")}>
                        Prognoza cen energii na 24h/48h i optymalizacja autokonsumpcji urządzeń (EV, Pompa ciepła, Bateria)
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setView('tariffs')}
                    className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 flex-shrink-0"
                  >
                    <span>Zobacz Ceny i Wykres</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Virtual Storage Module */}
                  {showBatterySim ? (
                    <section className={cn(
                      "rounded-[32px] p-8 border shadow-sm relative overflow-hidden group transition-colors duration-500",
                      theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                    )}>
                       <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-emerald-50 blur-3xl opacity-50 rounded-full" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-500" /> Symulacja Magazynu
                      </h4>
                      <div className="space-y-6">
                        <div className={cn("flex justify-between items-end p-4 rounded-2xl border", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100")}>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Magazyn 5kWh</p>
                            <p className={cn("text-xl font-black", theme === 'dark' ? "text-white" : "text-slate-900")}>+{formatNum(currentMonthReport.battery5AkBoost || 0)}% <span className="text-[10px] text-slate-400 font-mono tracking-widest ml-1">Autokonsumpcja</span></p>
                          </div>
                          <p className="text-emerald-600 font-mono font-black text-lg">+{formatCurrency(currentMonthReport.battery5Savings || 0)}</p>
                        </div>
                        <div className={cn("flex justify-between items-end p-4 rounded-2xl border", theme === 'dark' ? "bg-emerald-900/10 border-emerald-900/30" : "bg-emerald-50 border-emerald-100")}>
                          <div>
                            <p className={cn("text-[9px] font-bold uppercase mb-1", theme === 'dark' ? "text-emerald-400" : "text-emerald-600")}>Magazyn 10kWh</p>
                            <p className={cn("text-xl font-black", theme === 'dark' ? "text-white" : "text-slate-900")}>+{formatNum(currentMonthReport.battery10AkBoost || 0)}% <span className="text-[10px] text-slate-400 font-mono tracking-widest ml-1">Autokonsumpcja</span></p>
                          </div>
                          <p className="text-emerald-600 font-mono font-black text-lg">+{formatCurrency(currentMonthReport.battery10Savings || 0)}</p>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section className={cn("rounded-[32px] p-8 border border-dashed flex flex-col items-center justify-center text-center opacity-60 transition-colors duration-500", theme === 'dark' ? "bg-slate-900/50 border-slate-700" : "bg-slate-50/50 border-slate-200/50")}>
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm mb-4 transition-colors", theme === 'dark' ? "bg-slate-800" : "bg-white")}>
                        <Zap className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Symulacja magazynu nieaktywna</p>
                    </section>
                  )}

                  {/* Benchmark Module */}
                  <section className={cn(
                    "rounded-[32px] p-8 border shadow-sm relative overflow-hidden group transition-colors duration-500", 
                    theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100",
                    benchmark?.alert ? (theme === 'dark' ? "border-rose-900/50" : "border-rose-100") : ""
                  )}>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                       <TrendingUp className="w-4 h-4 text-blue-500" /> Porównanie (Benchmark)
                    </h4>
                    {benchmark ? (
                      <div className="space-y-4">
                        <div className={cn("flex items-center gap-4 p-4 rounded-2xl border", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-100")}>
                          <div className={cn("p-2.5 rounded-xl shadow-lg", benchmark.diff >= 0 ? "bg-emerald-500 text-white shadow-emerald-500/10" : "bg-rose-500 text-white shadow-rose-500/10")}>
                            {benchmark.diff >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className={cn("text-lg font-black leading-none", theme === 'dark' ? "text-white" : "text-slate-900")}>{Math.abs(benchmark.diff).toFixed(1)}% {benchmark.diff >= 0 ? "więcej" : "mniej"}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">vs Ten sam okres poprz. roku</p>
                          </div>
                        </div>
                        {benchmark.alert && (
                          <div className={cn("p-4 border rounded-2xl", theme === 'dark' ? "bg-rose-900/20 border-rose-900/50" : "bg-rose-50 border-rose-100")}>
                            <p className={cn("text-[10px] font-black leading-relaxed flex gap-2 uppercase tracking-tight", theme === 'dark' ? "text-rose-400" : "text-rose-600")}>
                              <Info className="w-3.5 h-3.5 flex-shrink-0" />
                              Wykryto spadek wydajności powyżej 15%. Sprawdź instalację.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-32 text-center">
                         <Info className="w-8 h-8 text-slate-100 mb-2 opacity-20" />
                         <p className="text-slate-300 text-[9px] font-black uppercase tracking-widest">Oczekuje na dane historyczne</p>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            </motion.div>
          ) : view === 'year' ? (
            <motion.div key="year" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-6">
                  <section className={cn(
                    "rounded-[48px] p-10 shadow-2xl relative overflow-hidden group border-4 transition-colors duration-500",
                    theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-900 border-white"
                  )}>
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-500/10 blur-[60px] group-hover:bg-emerald-500/20 transition-all rounded-full" />
                    <div className="flex items-center gap-3 text-slate-400 mb-6">
                      <Wallet className="w-5 h-5 text-emerald-500" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Suma Oszczędności Roku</span>
                    </div>
                    <div className="text-5xl font-black font-mono tracking-tighter text-white mb-2">{yearSummary ? formatCurrency(yearSummary.savedAmount) : '0,00 zł'}</div>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                       <TrendingUp className="w-4 h-4 text-emerald-500" />
                       Zysk generowany w roku {selectedYear}
                    </p>
                  </section>

                  {yearSummary && (
                    <section className={cn(
                      "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 transition-colors duration-500",
                      theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                    )}>
                      <h3 className={cn("text-[10px] font-black uppercase tracking-widest mb-6 border-b pb-4 flex items-center gap-2", theme === 'dark' ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-50")}>
                        <Zap className="w-4 h-4 text-amber-500" />
                        Roczne Zużycie Energii
                      </h3>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pobór Całkowity (Zużycie)</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-amber-500/10 text-amber-500 border border-amber-500/20")}>PC</span>
                            <span className={cn("text-sm font-black font-mono", theme === 'dark' ? "text-amber-400" : "text-amber-600")}>
                              {formatNum(yearSummary.totalConsumptionKw)} kWh
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal">Całkowity prąd zużyty w gospodarstwie domowym (produkcja własna + pobranie z sieci).</p>
                        </div>
                        
                        <div className={cn("border-t pt-4", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pobranie z Sieci</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-rose-500/10 text-rose-500 border border-rose-500/20")}>PS</span>
                            <span className="text-sm font-black font-mono text-rose-500">
                              {formatNum(yearSummary.importFromGrid)} kWh
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal">Energia elektryczna pobrana z sieci energetycznej dla zaspokojenia ubytków.</p>
                        </div>

                        <div className={cn("border-t pt-4", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Produkcja z Falownika</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-teal-500/10 text-teal-500 border border-teal-500/20")}>PF</span>
                            <span className="text-sm font-black font-mono text-teal-500">
                              {formatNum(yearSummary.production)} kWh
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal">Całkowita roczna ilość energii wygenerowanej przez panele fotowoltaiczne.</p>
                        </div>

                        <div className={cn("border-t pt-4", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Autokonsumpcja</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-emerald-500/10 text-emerald-500 border border-emerald-500/20")}>AK</span>
                            <span className="text-sm font-black font-mono text-emerald-500">
                              {formatNum(yearSummary.selfConsumptionKw)} kWh <span className="text-xs text-slate-400">({formatNum(yearSummary.selfConsumptionPercent)}%)</span>
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal">Suma wyprodukowanej energii zużytej bezpośrednio na potrzeby bieżące. Stanowi <strong>{formatNum(yearSummary.selfConsumptionPercent)}%</strong> całkowitej rocznej produkcji PV.</p>
                        </div>

                        <div className={cn("border-t pt-4", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Pokrycie Potrzeb (Niezależność)</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter bg-blue-500/10 text-blue-500 border border-blue-500/20")}>PP</span>
                            <span className="text-sm font-black font-mono text-blue-500">
                              {formatNum((yearSummary as any).coveragePercent)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal">Wskaźnik autarkii: część całego domowego poboru prądu, która została pokryta bezpośrednio przez słońce. Reszta ({formatNum(100 - (yearSummary as any).coveragePercent)}%) pochodzi z sieci.</p>
                        </div>

                        <div className={cn("border-t pt-4", theme === 'dark' ? "border-slate-800" : "border-slate-100")}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Roczny Bilans (0.8)</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter font-mono", yearSummary.energyBalance >= 0 ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20")}>
                              {yearSummary.energyBalance >= 0 ? 'B+' : 'B-'}
                            </span>
                            <div className="flex flex-col items-end leading-tight">
                              <span className={cn("text-sm font-black font-mono", yearSummary.energyBalance >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {yearSummary.energyBalance >= 0 ? '+' : ''}{formatNum(yearSummary.energyBalance)} kWh
                              </span>
                              <span className={cn("text-xs font-mono font-bold mt-0.5", yearSummary.gridBalancePln >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {yearSummary.gridBalancePln >= 0 ? '+' : ''}{formatCurrency(yearSummary.gridBalancePln)}{' '}
                                <span className="text-[9px] uppercase font-sans">({yearSummary.gridBalancePln >= 0 ? 'nadpłata' : 'do zapłaty'})</span>
                              </span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal">Narastający roczny bilans ilościowy (0.8 × oddanie do sieci minus pobranie) wyliczony od stycznia do grudnia. {yearSummary.energyBalance >= 0 ? 'Posiadasz wypracowaną nadwyżkę energii w sieci.' : 'Masz bilans ujemny w rozliczeniu rocznym.'}</p>
                        </div>
                      </div>
                    </section>
                  )}

                  {comparisonData && (
                    <section className={cn(
                      "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 transition-colors duration-500",
                      theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                    )}>
                      <h3 className={cn("text-[10px] font-black uppercase tracking-widest mb-6 border-b pb-4 flex items-center gap-2", theme === 'dark' ? "text-slate-500 border-slate-800" : "text-slate-400 border-slate-50")}>
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Analiza r/r vs {selectedYear - 1}
                      </h3>
                      <div className="space-y-6">
                        {comparisonData.map(i => (
                          <div key={i.label} className="group">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{i.label}</span>
                              <span className={cn(
                                "text-[9px] font-black px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-tighter border shadow-sm", 
                                i.diff > 0 
                                  ? (theme === 'dark' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-600")
                                  : (theme === 'dark' ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-rose-50 border-rose-100 text-rose-600")
                              )}>
                                {Math.abs(i.diff).toFixed(1)}% {i.diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              </span>
                            </div>
                            <div className={cn("text-xl font-mono font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-800")}>{i.unit === 'PLN' ? formatCurrency(i.curr) : formatNum(i.curr) + ' ' + i.unit}</div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <div className="lg:col-span-8 space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className={cn(
                      "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 relative overflow-hidden group transition-colors duration-500",
                      theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                    )}>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                        <LineChartIcon className="w-4 h-4 text-amber-500" />
                        Charakterystyka Produkcji
                      </h3>
                      <div className="h-[280px] w-full" id="yearly-line-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#1e293b" : "#f8fafc"} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                            <RechartsTooltip 
                              contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : 'white', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #f1f5f9', borderRadius: '16px', fontSize: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                            />
                            <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }} />
                            <Line type="monotone" name="Produkcja (kWh)" dataKey="Produkcja" stroke="#10b981" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 6, stroke: theme === 'dark' ? '#0f172a' : '#fff', strokeWidth: 4, fill: '#10b981' }} />
                            <Line type="monotone" name="Zużycie (kWh)" dataKey="Zużycie" stroke="#3b82f6" strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 6, stroke: theme === 'dark' ? '#0f172a' : '#fff', strokeWidth: 4, fill: '#3b82f6' }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </section>

                    <section className={cn(
                      "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 relative overflow-hidden group transition-colors duration-500",
                      theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                    )}>
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-emerald-500" />
                        Pobór vs Produkcja
                      </h3>
                      <div className="h-[280px] w-full" id="yearly-bar-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#1e293b" : "#f8fafc"} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                            <RechartsTooltip 
                               contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : 'white', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #f1f5f9', borderRadius: '16px', fontSize: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                            />
                            <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }} />
                            <Bar name="Produkcja (kWh)" dataKey="Produkcja" fill="#10b981" radius={[6, 6, 0, 0]} />
                            <Bar name="Pobranie (kWh)" dataKey="Import" fill="#ef4444" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </section>
                  </div>

                  <section className={cn(
                    "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 relative overflow-hidden group transition-colors duration-500",
                    theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                  )}>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-500" />
                      Produkcja rok do roku
                    </h3>
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productionComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#1e293b" : "#f8fafc"} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                          <RechartsTooltip 
                             contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : 'white', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #f1f5f9', borderRadius: '16px', fontSize: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                          />
                          <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }} />
                          <Bar name={`Rok ${selectedYear}`} dataKey={`Rok ${selectedYear}`} fill="#10b981" radius={[6, 6, 0, 0]} />
                          <Bar name={`Rok ${selectedYear - 1}`} dataKey={`Rok ${selectedYear - 1}`} fill="#3b82f6" opacity={0.3} radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>

                  <section className={cn(
                    "rounded-[32px] border p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 relative overflow-hidden group transition-colors duration-500",
                    theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
                  )}>
                    <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-500/10 blur-[60px] group-hover:bg-emerald-500/20 transition-all rounded-full" />
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      Kumulacja Bilansu: Czy instalacja jest "do przodu"? (od stycznia)
                    </h3>
                    <p className="text-xs text-slate-500 leading-normal mb-8">
                      Analiza pokazująca narastający od stycznia stan Twojego rozliczenia ilościowego (0.8 × oddanie do sieci minus pobranie). 
                      Wartości dodatnie (zielone) oznaczają, że bilansowo od początku roku jesteś "do przodu" – wypracowano nadwyżkę w wirtualnym magazynie sieci.
                    </p>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
                      <div className="xl:col-span-8 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={cumulativeBalanceData}>
                            <defs>
                              <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#1e293b" : "#f8fafc"} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} />
                            <RechartsTooltip 
                               contentStyle={{ backgroundColor: theme === 'dark' ? '#0f172a' : 'white', border: theme === 'dark' ? '1px solid #1e293b' : '1px solid #f1f5f9', borderRadius: '16px', fontSize: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                            />
                            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="3 3" />
                            <Area type="monotone" name="Skumulowany Bilans (kWh)" dataKey="Bilans Skumulowany (kWh)" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCumulative)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="xl:col-span-4 space-y-3 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 border-b pb-2">Status kumulacyjny r/r</div>
                        {cumulativeBalanceData.map((d, index) => {
                          const val = d.cumulativeBalance;
                          if (val === null) return null;
                          const isAhead = val >= 0;
                          return (
                            <div key={d.fullName} className={cn("flex justify-between items-center p-2 rounded-xl transition-all border", theme === 'dark' ? "bg-slate-950/40 border-slate-800/40 hover:bg-slate-950" : "bg-slate-50/50 border-slate-100 hover:bg-slate-50")}>
                              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{d.fullName}</span>
                              <div className="text-right">
                                <span className={cn("text-xs font-black font-mono block", isAhead ? "text-emerald-500" : "text-rose-500")}>
                                  {isAhead ? '+' : ''}{formatNum(val)} kWh
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">
                                  {isAhead ? 'Do przodu 🚀' : 'Deficyt ❄️'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <section className={cn(
                "rounded-[40px] border overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.03)] ring-1 transition-colors duration-500",
                theme === 'dark' ? "bg-slate-900 border-slate-800 ring-slate-800" : "bg-white border-slate-100 ring-slate-100"
              )}>
                <div className={cn("p-8 border-b flex items-center gap-3 transition-colors duration-500", theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50/50 border-slate-50")}>
                   <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-sm transition-colors", theme === 'dark' ? "bg-slate-800" : "bg-white")}>
                      <TableIcon className="w-4 h-4 text-emerald-500" />
                   </div>
                   <h3 className={cn("text-xs font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>Skrót Miesięczny {selectedYear}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className={cn("font-bold uppercase text-[9px] tracking-widest border-b transition-colors duration-500", theme === 'dark' ? "bg-slate-950/50 text-slate-500 border-slate-800" : "bg-slate-50/50 text-slate-400 border-slate-100")}>
                      <tr>
                        <th className="px-6 py-6">Miesiąc</th>
                        <th className="px-6 py-6 text-right">Produkcja PV</th>
                        <th className="px-6 py-6 text-right">Pobranie z Sieci</th>
                        <th className="px-6 py-6 text-right">Pobór Całkowity</th>
                        <th className="px-6 py-6 text-right">Autokonsumpcja / Pokrycie</th>
                        <th className="px-6 py-6 text-right">Saldo (0.8) / Skumulowane</th>
                        <th className="px-6 py-6 text-right">Saldo Finansowe</th>
                      </tr>
                    </thead>
                    <tbody className={cn("divide-y font-mono transition-colors duration-500", theme === 'dark' ? "divide-slate-800" : "divide-slate-50")}>
                      {MONTHS.map((m, i) => {
                        const r = readings.find(reading => reading.year === selectedYear && reading.month === i + 1);
                        const rep = r ? calculateReport(r, readings, baselines) : null;
                        return (
                          <tr key={m} className={cn("transition-all group", theme === 'dark' ? "hover:bg-slate-800" : "hover:bg-slate-50", r ? "" : (theme === 'dark' ? "opacity-10" : "opacity-20"))}>
                            <td className={cn("px-6 py-5 font-bold transition-colors uppercase text-[10px] tracking-widest", theme === 'dark' ? "text-slate-500 group-hover:text-slate-200" : "text-slate-400 group-hover:text-slate-900")}>{m}</td>
                            <td className={cn("px-6 py-5 text-right font-black", theme === 'dark' ? "text-slate-200" : "text-slate-900")}>{r ? formatNum(r.production) + ' kWh' : '—'}</td>
                            <td className="px-6 py-5 text-right font-bold text-rose-500">{rep ? formatNum(rep.importFromGrid) + ' kWh' : '—'}</td>
                            <td className={cn("px-6 py-5 text-right font-bold", theme === 'dark' ? "text-amber-400" : "text-amber-600")}>{rep ? formatNum(rep.totalConsumptionKw) + ' kWh' : '—'}</td>
                            <td className="px-6 py-5 text-right">
                              {rep ? (
                                <div className="flex flex-col items-end leading-tight">
                                  <span className="font-bold text-emerald-500" title="Autokonsumpcja (% produkcji PV)">
                                    {formatNum(rep.selfConsumptionPercent)}% <span className="text-[8px] text-slate-400 font-normal">AK</span>
                                  </span>
                                  <span className="font-bold text-blue-500" title="Pokrycie potrzeb (% całkowitego zużycia)">
                                    {formatNum(rep.coveragePercent)}% <span className="text-[8px] text-slate-400 font-normal">PP</span>
                                  </span>
                                </div>
                              ) : '—'}
                            </td>
                             <td className="px-6 py-5 text-right">
                              {rep ? (
                                <div className="flex flex-col items-end leading-tight">
                                  <span className={cn("font-bold", rep.gridBalance >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                    {rep.gridBalance >= 0 ? '+' : ''}{formatNum(rep.gridBalance)} kWh
                                  </span>
                                  {cumulativeBalanceData[i]?.cumulativeBalance !== null && (
                                    <span className={cn("text-[10px] font-bold tracking-tight", (cumulativeBalanceData[i].cumulativeBalance ?? 0) >= 0 ? "text-blue-500" : "text-rose-400 opacity-80")}>
                                      {(cumulativeBalanceData[i].cumulativeBalance ?? 0) >= 0 ? 'Skum: +' : 'Skum: '}{formatNum(cumulativeBalanceData[i].cumulativeBalance ?? 0)} kWh
                                    </span>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                            <td className="px-6 py-5 text-right font-black">
                              {rep ? (
                                <span className={rep.financialBalance >= 0 ? "text-emerald-500" : "text-rose-500"}>
                                  {rep.financialBalance >= 0 ? '+' : ''}{formatCurrency(rep.financialBalance)}
                                </span>
                              ) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {yearSummary && (
                      <tfoot className={cn("font-mono font-black transition-colors duration-500", theme === 'dark' ? "bg-slate-950 text-white" : "bg-slate-900 text-white")}>
                        <tr>
                          <td className="px-6 py-8 text-xs uppercase tracking-widest text-slate-400 underline decoration-emerald-500 underline-offset-8">PODSUMOWANIE ROKU</td>
                          <td className="px-6 py-8 text-right text-base tracking-tighter shadow-inner">{formatNum(yearSummary.production)} kWh</td>
                          <td className="px-6 py-8 text-right text-base tracking-tighter text-rose-500 shadow-inner">{formatNum(yearSummary.importFromGrid)} kWh</td>
                          <td className="px-6 py-8 text-right text-base tracking-tighter text-amber-500 shadow-inner">{formatNum(yearSummary.totalConsumptionKw)} kWh</td>
                          <td className="px-6 py-8 text-right shadow-inner">
                            <div className="flex flex-col items-end leading-tight">
                              <span className="text-emerald-500 text-xs font-black">{formatNum(yearSummary.selfConsumptionPercent)}% <span className="text-[8px] text-slate-400 font-normal">AK</span></span>
                              <span className="text-blue-500 text-xs font-black">{formatNum((yearSummary as any).coveragePercent)}% <span className="text-[8px] text-slate-400 font-normal">PP</span></span>
                            </div>
                          </td>
                          <td className="px-6 py-8 text-right shadow-inner">
                            <div className="flex flex-col items-end leading-tight">
                              <span className={cn("text-base tracking-tighter font-black", yearSummary.energyBalance >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {yearSummary.energyBalance >= 0 ? '+' : ''}{formatNum(yearSummary.energyBalance)} kWh
                              </span>
                              <span className={cn("text-xs font-mono font-bold mt-0.5", yearSummary.gridBalancePln >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                {yearSummary.gridBalancePln >= 0 ? '+' : ''}{formatCurrency(yearSummary.gridBalancePln)}{' '}
                                <span className="text-[9px] uppercase font-sans">({yearSummary.gridBalancePln >= 0 ? 'nadpłata' : 'do zapłaty'})</span>
                              </span>
                              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mt-1">Roczny Bilans</span>
                            </div>
                          </td>
                          <td className="px-6 py-8 text-right text-xl tracking-tighter shadow-inner">
                            <span className={yearSummary.financialBalance >= 0 ? "text-emerald-500" : "text-rose-500"}>
                              {yearSummary.financialBalance >= 0 ? '+' : ''}{formatCurrency(yearSummary.financialBalance)}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>
            </motion.div>
          ) : view === 'tariffs' ? (
            <motion.div key="tariffs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <EnergyPriceForecast
                theme={theme}
                onOpenSmartHomeModal={() => setShowSmartHomeModal(true)}
              />
            </motion.div>
          ) : view === 'forecast' ? (
            <motion.div key="forecast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <SolarForecastWidget
                theme={theme}
                defaultPeakKwp={smartHomeSettings.peakPowerKwp}
                onSettingsChange={(kwp, lat, lon, city) => {
                  const updated = {
                    ...smartHomeSettings,
                    peakPowerKwp: kwp,
                    latitude: lat,
                    longitude: lon,
                    cityName: city
                  };
                  setSmartHomeSettings(updated);
                  saveStoredSmartHomeSettings(updated);
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Android System Options Card */}
              <section className={cn(
                "rounded-[32px] border p-6 shadow-sm transition-colors",
                theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">Opcje Urządzenia Android</h3>
                    <p className="text-xs text-slate-400">Optymalizacja sprzętowa dla smartfonów i tabletów ściennych</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* WakeLock toggle */}
                  <div className={cn("p-4 rounded-2xl border flex items-center justify-between gap-3", theme === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Zawsze włączony ekran (WakeLock)</p>
                      <p className="text-[11px] text-slate-400">Zapobiega usypianiu ekranu na tablecie ściennym</p>
                    </div>
                    <button
                      onClick={async () => {
                        triggerAndroidHaptic(20);
                        if (wakeLockActive) {
                          await releaseAndroidWakeLock();
                          setWakeLockActive(false);
                        } else {
                          const ok = await requestAndroidWakeLock();
                          setWakeLockActive(ok);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl font-bold text-xs transition-all",
                        wakeLockActive ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      )}
                    >
                      {wakeLockActive ? 'WŁ' : 'WYŁ'}
                    </button>
                  </div>

                  {/* PWA Install */}
                  <div className={cn("p-4 rounded-2xl border flex items-center justify-between gap-3", theme === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Aplikacja na pulpicie (PWA)</p>
                      <p className="text-[11px] text-slate-400">{isInstalled ? 'Aplikacja zainstalowana jako PWA' : 'Dodaj ikonę do ekranu głównego Androida'}</p>
                    </div>
                    <button
                      onClick={() => {
                        triggerAndroidHaptic(15);
                        setShowInstallModal(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all"
                    >
                      {isInstalled ? 'Zarządzaj' : 'Instaluj'}
                    </button>
                  </div>

                  {/* Fullscreen toggle */}
                  <div className={cn("p-4 rounded-2xl border flex items-center justify-between gap-3", theme === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Tryb Pełnoekranowy</p>
                      <p className="text-[11px] text-slate-400">Ukrywa paski systemowe przeglądarki</p>
                    </div>
                    <button
                      onClick={async () => {
                        triggerAndroidHaptic(15);
                        const fs = await toggleAndroidFullscreen();
                        setIsFullscreen(fs);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs"
                    >
                      {isFullscreen ? 'Zamknij' : 'Włącz'}
                    </button>
                  </div>

                  {/* Haptics test */}
                  <div className={cn("p-4 rounded-2xl border flex items-center justify-between gap-3", theme === 'dark' ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-200">Wibracje Haptyczne</p>
                      <p className="text-[11px] text-slate-400">Sprawdź silnik wibracji w smartfonie</p>
                    </div>
                    <button
                      onClick={() => triggerAndroidHaptic([30, 50, 30])}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700"
                    >
                      Testuj
                    </button>
                  </div>
                </div>
              </section>

              {/* Home Assistant & Smart Home Quick Launcher */}
              <section className={cn(
                "rounded-[32px] border p-6 shadow-sm transition-colors",
                theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-tight">Automatyka Smart Home & IoT</h3>
                      <p className="text-xs text-slate-400">Integracja z Home Assistant, webhooki i REST API</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      triggerAndroidHaptic(15);
                      setShowSmartHomeModal(true);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
                  >
                    Otwórz Panel IoT
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Adres Webhooka:</span>
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300 truncate max-w-xs">
                      {smartHomeSettings.webhookUrl || 'Nie skonfigurowano'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Moc instalacji (kWp):</span>
                    <span className="font-mono font-bold text-emerald-500">{smartHomeSettings.peakPowerKwp} kWp</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Lokalizacja:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{smartHomeSettings.cityName}</span>
                  </div>
                </div>
              </section>

              {/* Baseline meters calibration */}
              <section className={cn(
                "rounded-[32px] border p-6 shadow-sm transition-colors",
                theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
              )}>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                  Kalibracja Liczników (Stan na 31.12 roku poprzedniego)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Punkt Zero 1.8.0 (Pobranie)"
                    unit="kWh"
                    value={baselineFormData.baseline180}
                    onChange={(v: number) => setBaselineFormData(b => ({ ...b, baseline180: v }))}
                    theme={theme}
                  />
                  <InputField
                    label="Punkt Zero 2.8.0 (Oddanie)"
                    unit="kWh"
                    value={baselineFormData.baseline280}
                    onChange={(v: number) => setBaselineFormData(b => ({ ...b, baseline280: v }))}
                    theme={theme}
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      triggerAndroidHaptic(20);
                      saveBaseline();
                    }}
                    className="px-5 py-2.5 bg-slate-900 dark:bg-emerald-600 text-white font-bold rounded-xl text-xs hover:opacity-90 shadow-sm transition-all"
                  >
                    Zapisz Kalibrację Licznika
                  </button>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 3. Integracja Smart Home & IoT Modal */}
      <SmartHomeModal
        isOpen={showSmartHomeModal}
        onClose={() => setShowSmartHomeModal(false)}
        theme={theme}
        settings={smartHomeSettings}
        onSaveSettings={(newSettings) => {
          setSmartHomeSettings(newSettings);
          saveStoredSmartHomeSettings(newSettings);
        }}
        currentMetricsPayload={{
          ...currentMonthReport,
          year: selectedYear,
          month: selectedMonth,
          monthName: MONTHS[selectedMonth - 1],
          pricePerKwh: formData.pricePerKwh,
        }}
      />

      {/* Android Bottom Navigation Bar */}
      <AndroidBottomNav
        currentTab={view}
        onChangeTab={(tab) => {
          triggerAndroidHaptic(12);
          setView(tab);
        }}
        theme={theme}
      />

      {/* Android PWA Install Sheet Modal */}
      <AndroidInstallModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        theme={theme}
        deferredPrompt={deferredPrompt}
        onInstalled={() => setIsInstalled(true)}
      />
    </div>
  </AndroidShell>
  );
}

function InputField({ label, unit, value, onChange, icon, theme, step = 1 }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">{icon}{label}</label>
      <div className={cn("relative group transition-colors duration-500", theme === 'dark' ? "text-white" : "text-slate-900")}>
        <input 
          type="number" 
          value={value === 0 ? '' : (value ?? '')} 
          onChange={e => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))} 
          onFocus={e => { if (parseFloat(e.target.value) === 0 || value === 0) e.target.select(); }}
          step={step} 
          placeholder="0"
          className={cn(
            "w-full border rounded-xl px-4 py-3 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold placeholder:text-slate-300",
            theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
          )} 
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-[9px] font-black uppercase group-focus-within:text-emerald-500">{unit}</div>
      </div>
    </div>
  );
}

function TableRow({ label, value, unit, theme, valueColor = 'text-slate-700' }: any) {
  return (
    <tr className={cn("transition-colors border-b last:border-0", theme === 'dark' ? "hover:bg-slate-800/50 border-slate-800" : "hover:bg-slate-50 border-slate-100")}>
      <td className="px-8 py-4 font-medium text-slate-500 text-xs">{label}</td>
      <td className={cn("px-8 py-4 text-right font-bold text-base", valueColor)}>{value}</td>
      <td className="px-8 py-4 text-right text-slate-400 text-[9px] font-black uppercase">{unit}</td>
    </tr>
  );
}

function MetricCard({ title, value, subValue, description, trend, theme, color = 'blue' }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn(
      "rounded-3xl border p-8 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-500",
      theme === 'dark' ? "bg-slate-900 border-slate-800 hover:border-emerald-500/30" : "bg-white border-slate-100 hover:border-emerald-100"
    )}>
      <div className={cn("absolute -right-8 -top-8 w-24 h-24 blur-3xl opacity-10 rounded-full", color === 'emerald' ? "bg-emerald-500" : "bg-blue-500")} />
      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">{title}{trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}</h4>
      <div className={cn("text-4xl font-black font-mono tracking-tighter mb-1", color === 'emerald' ? "text-emerald-600" : (theme === 'dark' ? "text-blue-400" : "text-blue-600"))}>{value}</div>
      <div className="text-[10px] font-mono text-slate-400 font-bold">{subValue}</div>
      <p className="text-[10px] text-slate-400 mt-6 leading-relaxed">{description}</p>
    </motion.div>
  );
}

interface MetricInfoTooltipProps {
  title: string;
  meaning: string;
  formula: string;
  unit?: string;
  theme: 'light' | 'dark';
  align?: 'left' | 'center' | 'right';
}

function MetricInfoTooltip({ title, meaning, formula, unit, theme, align = 'left' }: MetricInfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        aria-label={`Informacja: ${title}`}
        className={cn(
          "w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer focus:outline-none ring-1",
          theme === 'dark' 
            ? "bg-slate-800/80 ring-slate-700/80 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 hover:ring-emerald-500/50" 
            : "bg-slate-100 ring-slate-200 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 hover:ring-emerald-300"
        )}
      >
        <Info className="w-2.5 h-2.5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 mt-2 p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md w-72 text-left pointer-events-auto",
              "top-full",
              align === 'right' ? "right-0" : (align === 'center' ? "left-1/2 -translate-x-1/2" : "left-0"),
              theme === 'dark'
                ? "bg-slate-950/95 border-slate-800 text-slate-200 shadow-black/80"
                : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-900/15"
            )}
          >
            {/* Arrow */}
            <div 
              className={cn(
                "absolute -top-1.5 w-3 h-3 rotate-45 border-l border-t",
                align === 'right' ? "right-3" : (align === 'center' ? "left-1/2 -translate-x-1/2" : "left-2.5"),
                theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"
              )} 
            />

            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800/80">
                <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {title}
                </span>
                {unit && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                    {unit}
                  </span>
                )}
              </div>

              <div>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Co oznacza?</p>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {meaning}
                </p>
              </div>

              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Jak jest obliczana?</p>
                <p className="text-[11px] font-mono leading-relaxed text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/15">
                  {formula}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

