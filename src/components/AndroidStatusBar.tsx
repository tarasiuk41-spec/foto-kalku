import React, { useState, useEffect } from 'react';
import { Wifi, Battery, BatteryCharging, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface AndroidStatusBarProps {
  theme: 'light' | 'dark';
  currentTime: Date;
  wakeLockActive?: boolean;
}

export const AndroidStatusBar: React.FC<AndroidStatusBarProps> = ({ theme, currentTime, wakeLockActive }) => {
  const [batteryLevel, setBatteryLevel] = useState<number>(88);
  const [isCharging, setIsCharging] = useState<boolean>(false);

  useEffect(() => {
    // Read real battery status if available in Chromium / Android browser
    if (typeof navigator !== 'undefined' && 'getBattery' in (navigator as any)) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(Math.round(battery.level * 100));
        setIsCharging(battery.charging);

        battery.addEventListener('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
        });
      }).catch(() => {});
    }
  }, []);

  const timeStr = currentTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  return (
    <div 
      className={cn(
        "w-full px-5 py-2 flex items-center justify-between text-xs select-none z-40 transition-colors shrink-0",
        theme === 'dark' 
          ? "bg-slate-950 text-slate-300 border-b border-slate-900/60" 
          : "bg-slate-900 text-slate-100"
      )}
    >
      {/* Left: Android Time & Status indicator */}
      <div className="flex items-center gap-2">
        <span className="font-bold font-mono tracking-tight text-[11px]">{timeStr}</span>
        {wakeLockActive && (
          <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            WAKELOCK
          </span>
        )}
      </div>

      {/* Center: Android Camera Punch-Hole & OS Indicator */}
      <div className="flex items-center gap-1.5">
        <div className="w-3.5 h-3.5 rounded-full bg-black ring-1 ring-slate-800 shadow-inner flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-900/80" />
        </div>
      </div>

      {/* Right: Android Status Icons (5G, WiFi, Battery) */}
      <div className="flex items-center gap-2 text-[10px] font-mono">
        <span className="text-[9px] font-black tracking-widest text-emerald-400">5G</span>
        <Wifi className="w-3.5 h-3.5 text-slate-300" />
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold">{batteryLevel}%</span>
          {isCharging ? (
            <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Battery className="w-3.5 h-3.5 text-slate-300" />
          )}
        </div>
      </div>
    </div>
  );
};
