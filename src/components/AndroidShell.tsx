import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  QrCode, 
  Maximize2, 
  Check, 
  X, 
  Tablet, 
  Info,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { isAndroidDevice } from '../lib/androidBridge';
import { AndroidStatusBar } from './AndroidStatusBar';

export type AndroidDevicePreset = 'pixel8' | 'galaxy' | 'tablet' | 'fullscreen';

interface AndroidShellProps {
  children: React.ReactNode;
  theme: 'light' | 'dark';
  currentTime: Date;
  wakeLockActive: boolean;
}

export const AndroidShell: React.FC<AndroidShellProps> = ({
  children,
  theme,
  currentTime,
  wakeLockActive,
}) => {
  const [isNativeAndroid, setIsNativeAndroid] = useState<boolean>(false);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);
  const [devicePreset, setDevicePreset] = useState<AndroidDevicePreset>('pixel8');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [showAndroidInfo, setShowAndroidInfo] = useState<boolean>(false);

  useEffect(() => {
    const checkPlatform = () => {
      const android = isAndroidDevice();
      setIsNativeAndroid(android);
      setIsMobileScreen(window.innerWidth <= 768);
    };

    checkPlatform();
    window.addEventListener('resize', checkPlatform);
    return () => window.removeEventListener('resize', checkPlatform);
  }, []);

  // If user is directly on an Android device or on a mobile screen, render full-bleed native Android UI
  if (isNativeAndroid || isMobileScreen || devicePreset === 'fullscreen') {
    return (
      <div className={cn("min-h-screen w-full flex flex-col selection:bg-emerald-500/20", theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900")}>
        <AndroidStatusBar theme={theme} currentTime={currentTime} wakeLockActive={wakeLockActive} />
        <div className="flex-1 w-full pb-20">
          {children}
        </div>
      </div>
    );
  }

  // Desktop / Non-Android screen: Render inside an authentic Android Smartphone / Tablet Device Shell
  const getContainerStyles = () => {
    switch (devicePreset) {
      case 'galaxy':
        return { width: '390px', height: '844px', radius: 'rounded-[46px]' };
      case 'tablet':
        return { width: '768px', height: '920px', radius: 'rounded-[36px]' };
      case 'pixel8':
      default:
        return { width: '412px', height: '892px', radius: 'rounded-[50px]' };
    }
  };

  const currentStyles = getContainerStyles();

  return (
    <div className={cn(
      "min-h-screen w-full flex flex-col items-center justify-start py-6 px-4 selection:bg-emerald-500/20 font-sans transition-colors duration-500",
      theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-900 text-slate-100"
    )}>
      {/* Top Banner explaining Android-Only Architecture */}
      <header className="w-full max-w-4xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs">Aplikacja dedykowana wyłącznie dla systemu Android</span>
              <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Android 14+ / M3
              </span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Wykryto przeglądarkę desktopową. Poniżej aktywny jest wbudowany symulator urządzenia Android z pełną obsługą gestów.
            </p>
          </div>
        </div>

        {/* Device Switcher & QR Code button */}
        <div className="flex items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-medium">
            <button
              onClick={() => setDevicePreset('pixel8')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all",
                devicePreset === 'pixel8' ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
              )}
            >
              Pixel 8
            </button>
            <button
              onClick={() => setDevicePreset('galaxy')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all",
                devicePreset === 'galaxy' ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
              )}
            >
              Galaxy S24
            </button>
            <button
              onClick={() => setDevicePreset('tablet')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1",
                devicePreset === 'tablet' ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
              )}
            >
              <Tablet className="w-3 h-3" />
              Tablet 10"
            </button>
            <button
              onClick={() => setDevicePreset('fullscreen')}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1",
                devicePreset === 'fullscreen' ? "bg-emerald-600 text-white font-bold" : "text-slate-400 hover:text-white"
              )}
              title="Pełny widok bez ramki telefonu"
            >
              <Maximize2 className="w-3 h-3" />
              Pełny
            </button>
          </div>

          {/* QR Code to open on real Android */}
          <button
            onClick={() => setShowQrModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-all border border-slate-700 shadow-sm"
            title="Otwórz na telefonie z Androidem"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>Skanuj kod QR</span>
          </button>
        </div>
      </header>

      {/* Android Smartphone / Tablet Hardware Frame */}
      <div 
        className={cn(
          "relative transition-all duration-300 shadow-[0_25px_80px_rgba(0,0,0,0.8),0_0_0_12px_#1e293b,0_0_0_14px_#334155] border-4 border-slate-950 overflow-hidden flex flex-col",
          currentStyles.radius,
          theme === 'dark' ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
        )}
        style={{
          width: currentStyles.width,
          height: currentStyles.height,
          maxHeight: 'calc(100vh - 120px)',
        }}
      >
        {/* Physical Phone Top Speaker & Punchhole Bar */}
        <div className="w-full bg-slate-950 pt-2 pb-1 flex items-center justify-center select-none shrink-0 z-50">
          <div className="w-14 h-1 bg-slate-800 rounded-full" />
        </div>

        {/* Android Status Bar */}
        <AndroidStatusBar theme={theme} currentTime={currentTime} wakeLockActive={wakeLockActive} />

        {/* Device screen scrollable viewport */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-24 relative">
          {children}
        </div>

        {/* Android Virtual Gesture Pill Bar at the bottom of device */}
        <div className="w-full py-1.5 bg-slate-950 flex items-center justify-center shrink-0 z-50 border-t border-slate-900">
          <div className="w-36 h-1 bg-slate-500/60 rounded-full" />
        </div>
      </div>

      {/* QR Code Modal for Android devices */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-[32px] bg-slate-900 border border-slate-800 p-6 shadow-2xl text-center relative text-white">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold mb-1">Otwórz na telefonie z Androidem</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Zeskanuj aparat telefonu z systemem Android, aby uruchomić aplikację bezpośrednio na swoim smartfonie i zainstalować na pulpicie.
            </p>

            {/* Generated QR Code preview box */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-lg mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : 'https://ais-dev-lgi3gagtw4doreirtvzwyp-800857181017.europe-west2.run.app')}`}
                alt="QR Code dla Androida"
                className="w-44 h-44 rounded-lg block"
              />
            </div>

            <p className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 rounded-xl p-2.5 break-all">
              {typeof window !== 'undefined' ? window.location.href : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
