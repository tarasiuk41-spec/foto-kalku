// Android-specific bridges, platform detection, and device hardware APIs

export const isAndroidDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
};

export const isMobileViewport = (): boolean => {
  if (typeof window === 'undefined') return true;
  return window.innerWidth <= 768;
};

export const isStandalonePWA = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
};

// Android Haptic feedback (Vibration API)
export const triggerAndroidHaptic = (pattern: number | number[] = 15) => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Haptics might be blocked by user gesture restrictions
    }
  }
};

// Android Screen Wake Lock (prevents screen dimming on Android wall/counter displays)
let wakeLockSentinel: any = null;

export const requestAndroidWakeLock = async (): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      return false;
    }
  }
  return false;
};

export const releaseAndroidWakeLock = async () => {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    } catch (err) {
      console.warn('Failed to release wake lock:', err);
    }
  }
};

export const isWakeLockActive = (): boolean => {
  return wakeLockSentinel !== null && !wakeLockSentinel.released;
};

// Android Fullscreen Mode
export const toggleAndroidFullscreen = async (): Promise<boolean> => {
  if (typeof document === 'undefined') return false;
  try {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        return true;
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return false;
      }
    }
  } catch (err) {
    console.warn('Fullscreen error:', err);
  }
  return !!document.fullscreenElement;
};

// Native Android Web Share API
export const shareAndroidReport = async (shareData: { title: string; text: string; url?: string }) => {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('Native share failed:', e);
      }
    }
  }
  // Fallback to clipboard
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url || window.location.href}`);
      return 'copied';
    } catch (e) {}
  }
  return false;
};
