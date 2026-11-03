import React from 'react';
import { 
  Sparkles, 
  Lightbulb, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Zap, 
  Clock, 
  Coins, 
  ArrowRight,
  Flame,
  Car,
  Home
} from 'lucide-react';
import { cn } from '../lib/utils';
import { SmartInsightResult } from '../lib/smartInsights';

interface SmartInsightsCardProps {
  insight: SmartInsightResult;
  theme: 'light' | 'dark';
  monthName: string;
}

export const SmartInsightsCard: React.FC<SmartInsightsCardProps> = ({ insight, theme, monthName }) => {
  const isDark = theme === 'dark';

  const badgeStyles = {
    warning: isDark 
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
      : 'bg-amber-50 text-amber-700 border-amber-200',
    success: isDark 
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
      : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: isDark 
      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
      : 'bg-blue-50 text-blue-700 border-blue-200',
  }[insight.level];

  const iconStyle = {
    warning: 'text-amber-500',
    success: 'text-emerald-500',
    info: 'text-blue-500',
  }[insight.level];

  return (
    <section className={cn(
      "rounded-[40px] p-8 relative overflow-hidden shadow-2xl transition-all duration-500 border",
      isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
    )}>
      {/* Decorative gradient blur background */}
      <div className={cn(
        "absolute top-0 right-0 w-64 h-64 blur-[90px] opacity-15 pointer-events-none rounded-full",
        insight.level === 'warning' ? "bg-amber-500" : insight.level === 'success' ? "bg-emerald-500" : "bg-blue-500"
      )} />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b pb-4 border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-transform hover:scale-105",
            insight.level === 'warning' 
              ? (isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")
              : insight.level === 'success'
              ? (isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700")
              : (isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-700")
          )}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <span>Wskazówka odnośnie wydajności</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-semibold text-slate-500 dark:text-slate-400">{monthName}</span>
            </div>
            <h4 className={cn("text-base font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {insight.title}
            </h4>
          </div>
        </div>

        <span className={cn("text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border shadow-sm", badgeStyles)}>
          {insight.badge}
        </span>
      </div>

      {/* Main message */}
      <div className={cn(
        "p-6 rounded-3xl border mb-6 relative overflow-hidden",
        isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50/70 border-slate-100"
      )}>
        <p className={cn(
          "text-sm sm:text-base leading-relaxed font-medium",
          isDark ? "text-slate-200" : "text-slate-800"
        )}>
          {insight.message}
        </p>

        {/* Estimated metrics bar if there is potential */}
        {insight.metrics.potentialSavingsPln > 0 && (
          <div className="mt-5 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Eksport do sieci
              </span>
              <span className="text-lg font-black font-mono text-blue-500">
                {insight.metrics.exportedKwh} <span className="text-xs">kWh</span>
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Aktualna AK
              </span>
              <span className="text-lg font-black font-mono text-slate-600 dark:text-slate-300">
                {insight.metrics.currentAkPercent}%
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Szacowana AK
              </span>
              <span className="text-lg font-black font-mono text-emerald-500">
                ~{insight.metrics.estimatedAkPercent}%
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Dodatkowy Zysk
              </span>
              <span className="text-lg font-black font-mono text-emerald-400">
                +{insight.metrics.potentialSavingsPln} zł<span className="text-[9px] text-slate-400 font-sans">/mc</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Recommended actions list */}
      {insight.actions && insight.actions.length > 0 && (
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            <span>Rekomendowane działania optymalizacyjne:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {insight.actions.map((act, i) => (
              <div 
                key={i}
                className={cn(
                  "p-3 rounded-2xl border flex items-start gap-3 transition-colors text-xs font-medium",
                  isDark 
                    ? "bg-slate-950/40 border-slate-800/60 hover:bg-slate-950 text-slate-300" 
                    : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700 shadow-sm"
                )}
              >
                <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500 mt-0.5 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <span>{act}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
