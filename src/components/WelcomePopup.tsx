import { useState, useEffect, useRef } from 'react';
import { db, ref, onValue } from '@/lib/firebase';
import { X, Gift } from 'lucide-react';

interface WelcomePopupSettings {
  enabled: boolean;
  imageUrl: string;
}

const AUTO_POPUP_INTERVAL = 4000;

const DEFAULT_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">' +
      '<rect width="600" height="800" fill="#0d0d1a"/>' +
      '<text x="300" y="400" font-size="48" fill="#ffd700" text-anchor="middle" font-family="sans-serif" font-weight="bold">Welcome!</text>' +
      '<text x="300" y="460" font-size="24" fill="#888" text-anchor="middle" font-family="sans-serif">Set your banner in Admin</text>' +
      '</svg>'
  );

export default function WelcomePopup() {
  const [settings, setSettings] = useState<WelcomePopupSettings>({ enabled: false, imageUrl: '' });
  const [visible, setVisible] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'game_settings/welcome_popup'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          setSettings({
            enabled: data.enabled ?? false,
            imageUrl: data.imageUrl ?? '',
          });
        } else {
          setSettings({ enabled: false, imageUrl: '' });
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const canShow = settings.enabled && !!settings.imageUrl;

  const handleClose = () => {
    setVisible(false);
  };

  // Auto-popup: show immediately on first load, then re-show every 4 seconds after closing
  useEffect(() => {
    if (!canShow) {
      setVisible(false);
      return;
    }

    // Show on mount
    setVisible(true);

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [canShow]);

  // When popup is closed, start a 4-second timer to re-show it
  useEffect(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current);
      autoTimerRef.current = null;
    }

    if (canShow && !visible) {
      autoTimerRef.current = setTimeout(() => {
        setVisible(true);
      }, AUTO_POPUP_INTERVAL);
    }

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [canShow, visible]);

  useEffect(() => {
    if (!visible) return;
    window.history.pushState({ welcomePopup: true }, '');
    const handlePopState = () => {
      setVisible(false);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      const st = window.history.state as { welcomePopup?: boolean } | null;
      if (st?.welcomePopup) window.history.back();
    };
  }, [visible]);

  const imgUrl = settings.imageUrl || DEFAULT_IMAGE;

  if (!visible) return null;

  return (
        <div className="fixed inset-0 z-[10100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

          <div className="relative w-full max-w-sm animate-fade-in-up">
            <div className="relative rounded-2xl overflow-hidden border border-neon-gold/40 shadow-2xl">
              <img
                src={imgUrl}
                alt="Welcome"
                className="w-full h-auto max-h-[80vh] object-contain bg-dark-bg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
                }}
              />

              <button
                onClick={handleClose}
                aria-label="Close"
                className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition-transform hover:bg-black/90 border border-white/20"
              >
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <button
              onClick={handleClose}
              className="mt-3 w-full bg-neon-gold text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-gold/90 neon-gold-glow flex items-center justify-center gap-2"
            >
              <Gift size={18} strokeWidth={2.5} />
              Continue
            </button>
          </div>
        </div>
  );
}
