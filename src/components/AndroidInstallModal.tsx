import React from 'react';
import { Smartphone, Download, Check, X, ShieldCheck, Zap, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { triggerAndroidHaptic } from '../lib/androidBridge';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  deferredPrompt: any;
  onInstalled: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({
  isOpen,
  onClose,
  theme,
  deferredPrompt,
  onInstalled,
}) => {
  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    triggerAndroidHaptic(25);
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        onInstalled();
        onClose();
      }
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            "w-full max-w-md rounded-t-[32px] sm:rounded-[32px] border p-6 shadow-2xl relative overflow-hidden",
            theme === 'dark' ? "bg-slate-950 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
          )}
        >
          {/* Header pill indicator for bottom sheet gesture on mobile */}
          <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

          {/* Close button */}
          <button
            onClick={() => {
              triggerAndroidHaptic(10);
              onClose();
            }}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight uppercase">Instalacja na Androidzie</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">PWA • Tryb pełnoekranowy • Offline</p>
            </div>
          </div>

          <div className="space-y-3 mb-6 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <Zap className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">Dostęp z pulpitu smartfona</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Działa jako samodzielna aplikacja Android bez pasków przeglądarki.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <HardDrive className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">Szybki start & pamięć offline</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Błyskawiczne wczytywanie i dostęp do ostatnich odczytów nawet bez zasięgu.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">Wibracje haptyczne i WakeLock</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                  Natywna haptyka przycisków oraz stałe podświetlenie dla tabletów ściennych.
                </p>
              </div>
            </div>
          </div>

          {/* Action button */}
          {deferredPrompt ? (
            <button
              onClick={handleNativeInstall}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Dodaj do ekranu głównego Android</span>
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Jak zainstalować w przeglądarce Chrome na Androidzie:
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dotknij menu z trzema kropkami <strong className="text-emerald-500">⋮</strong> w prawym górnym rogu Chrome, a następnie wybierz <strong className="text-emerald-500">„Zainstaluj aplikację”</strong> lub <strong className="text-emerald-500">„Dodaj do ekranu głównego”</strong>.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
