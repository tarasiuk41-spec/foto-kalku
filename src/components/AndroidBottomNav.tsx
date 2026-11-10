import React from 'react';
import { Zap, BarChart3, TrendingUp, Sun, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import { triggerAndroidHaptic } from '../lib/androidBridge';

export type AndroidTab = 'month' | 'year' | 'tariffs' | 'forecast' | 'settings';

interface AndroidBottomNavProps {
  currentTab: AndroidTab;
  onChangeTab: (tab: AndroidTab) => void;
  theme: 'light' | 'dark';
}

export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  currentTab,
  onChangeTab,
  theme,
}) => {
  const tabs = [
    {
      id: 'month' as AndroidTab,
      label: 'Miesiąc',
      sublabel: 'Odczyty',
      icon: Zap,
      activeColor: 'text-emerald-500',
      pillBg: 'bg-emerald-500/15 text-emerald-400',
    },
    {
      id: 'year' as AndroidTab,
      label: 'Rok',
      sublabel: 'Bilans 0.8',
      icon: BarChart3,
      activeColor: 'text-blue-500',
      pillBg: 'bg-blue-500/15 text-blue-400',
    },
    {
      id: 'tariffs' as AndroidTab,
      label: 'Taryfy',
      sublabel: 'PSE RCE',
      icon: TrendingUp,
      activeColor: 'text-amber-500',
      pillBg: 'bg-amber-500/15 text-amber-400',
    },
    {
      id: 'forecast' as AndroidTab,
      label: 'Prognoza',
      sublabel: 'Meteo',
      icon: Sun,
      activeColor: 'text-amber-400',
      pillBg: 'bg-amber-400/15 text-amber-300',
    },
    {
      id: 'settings' as AndroidTab,
      label: 'Smart Home',
      sublabel: 'Opcje',
      icon: Cpu,
      activeColor: 'text-purple-400',
      pillBg: 'bg-purple-500/15 text-purple-300',
    },
  ];

  const handleTabClick = (tabId: AndroidTab) => {
    triggerAndroidHaptic(15);
    onChangeTab(tabId);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 transition-colors backdrop-blur-xl border-t pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.15)]",
        theme === 'dark'
          ? "bg-slate-950/95 border-slate-800 text-slate-300"
          : "bg-white/95 border-slate-200 text-slate-600"
      )}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
      aria-label="Nawigacja Android"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 h-16 px-1">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center py-1 transition-all relative group select-none outline-none active:scale-95",
                isActive ? "font-bold" : "hover:text-slate-900 dark:hover:text-white opacity-75 hover:opacity-100"
              )}
            >
              {/* Material 3 active indicator pill */}
              <div
                className={cn(
                  "w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200 mb-0.5",
                  isActive
                    ? (theme === 'dark' ? tab.pillBg : "bg-slate-900 text-white shadow-sm")
                    : "bg-transparent group-hover:bg-slate-100 dark:group-hover:bg-slate-800/50"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform",
                    isActive ? (theme === 'dark' ? tab.activeColor : "text-white") : "text-slate-400",
                    isActive && "scale-110"
                  )}
                />
              </div>

              <span
                className={cn(
                  "text-[10px] tracking-tight leading-tight transition-colors line-clamp-1",
                  isActive
                    ? (theme === 'dark' ? "text-white font-black" : "text-slate-900 font-black")
                    : "text-slate-400 font-medium"
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Android Gesture Pill Bar Indicator */}
      <div className="w-full flex justify-center py-1">
        <div className="w-32 h-1 bg-slate-400/40 dark:bg-slate-600/50 rounded-full" />
      </div>
    </nav>
  );
};
