import React from 'react';
import { 
  Sun, 
  Moon, 
  Share2, 
  Maximize2, 
  Minimize2, 
  Vibrate, 
  MonitorPlay, 
  DownloadCloud,
  Check,
  Smartphone
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  triggerAndroidHaptic, 
  requestAndroidWakeLock, 
  releaseAndroidWakeLock, 
  toggleAndroidFullscreen,
  shareAndroidReport 
} from '../lib/androidBridge';

interface AndroidQuickBarProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  wakeLockActive: boolean;
  onWakeLockChange: (active: boolean) => void;
  isFullscreen: boolean;
  onFullscreenChange: (active: boolean) => void;
  onOpenInstall: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  currentYear: number;
  currentMonthName: string;
  totalProduction: number;
  totalSavings: number;
  onNotification: (msg: string) => void;
}

export const AndroidQuickBar: React.FC<AndroidQuickBarProps> = ({
  theme,
  onToggleTheme,
  wakeLockActive,
  onWakeLockChange,
  isFullscreen,
  onFullscreenChange,
  onOpenInstall,
  isInstallable,
  isInstalled,
  currentYear,
  currentMonthName,
  totalProduction,
  totalSavings,
  onNotification,
}) => {
  const handleWakeLockToggle = async () => {
    triggerAndroidHaptic(20);
    if (wakeLockActive) {
      await releaseAndroidWakeLock();
      onWakeLockChange(false);
      onNotification('Wygaszanie ekranu: Standardowe (wg ustawień systemu Android)');
    } else {
      const success = await requestAndroidWakeLock();
      if (success) {
        onWakeLockChange(true);
        onNotification('Ekran stale włączony (idealny dla tabletu/telefonu na ścianie)');
      } else {
        onNotification('Funkcja WakeLock niedostępna w tej przeglądarce.');
      }
    }
  };

  const handleFullscreenToggle = async () => {
    triggerAndroidHaptic(15);
    const active = await toggleAndroidFullscreen();
    onFullscreenChange(active);
  };

  const handleShare = async () => {
    triggerAndroidHaptic(20);
    const res = await shareAndroidReport({
      title: `Monitor PV (${currentMonthName} ${currentYear})`,
      text: `Mój bilans fotowoltaiczny za ${currentMonthName} ${currentYear}: Produkcja ${totalProduction.toFixed(1)} kWh, Oszczędność: ${totalSavings.toFixed(2)} zł. Wygenerowano w aplikacji Monitor PV na Androida.`,
      url: window.location.href,
    });
    if (res === 'copied') {
      onNotification('Skopiowano podsumowanie do schowka Androida!');
    } else if (res) {
      onNotification('Udostępniono raport!');
    }
  };

  return (
    <div className="w-full flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-2 px-1 text-xs select-none">
      {/* Left: Device brand / OS badge */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold tracking-tight bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <Smartphone className="w-3 h-3" />
          <span>Android Edition</span>
        </span>
      </div>

      {/* Right: Quick Android toggles */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Screen WakeLock */}
        <button
          onClick={handleWakeLockToggle}
          title={wakeLockActive ? "Wyłącz stałe podświetlenie ekranu" : "Utrzymuj ekran zawsze włączony (tryb ścienny PV)"}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
            wakeLockActive
              ? "bg-amber-500/15 border-amber-500/40 text-amber-500 shadow-sm"
              : "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <MonitorPlay className="w-3 h-3" />
          <span className="hidden sm:inline">{wakeLockActive ? 'Ekran WŁ' : 'Ekran'}</span>
        </button>

        {/* Fullscreen */}
        <button
          onClick={handleFullscreenToggle}
          title="Przełącz tryb pełnoekranowy Androida"
          className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Android Share */}
        <button
          onClick={handleShare}
          title="Udostępnij raport przez aplikacje Androida"
          className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => {
            triggerAndroidHaptic(10);
            onToggleTheme();
          }}
          title="Zmień motyw"
          className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-yellow-500 transition-all"
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5 text-slate-700" />}
        </button>

        {/* Android Install Button if not already standalone */}
        {!isInstalled && (
          <button
            onClick={() => {
              triggerAndroidHaptic(15);
              onOpenInstall();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all animate-pulse"
          >
            <DownloadCloud className="w-3 h-3" />
            <span>Zainstaluj</span>
          </button>
        )}
      </div>
    </div>
  );
};
