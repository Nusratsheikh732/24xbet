import { useEffect, useState } from 'react';

const LOADING_DURATION_MS = 3000;
const FADE_OUT_MS = 500;

export default function CoinTossLoader() {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const ratio = Math.min((now - start) / LOADING_DURATION_MS, 1);
      setProgress(Math.round(ratio * 100));
      if (ratio < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setFadingOut(true);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!fadingOut) return;
    const timer = window.setTimeout(() => setHidden(true), FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [fadingOut]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#07110d] transition-opacity duration-500 ${fadingOut ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      role="status"
      aria-label="Loading Coin Toss"
    >
      <img src="/SAVE_20261115_104425.jpg" alt="Coin Toss" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-[6%] flex justify-center px-8">
        <div className="h-2.5 w-full max-w-md overflow-hidden rounded-full bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.35)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-red-700 via-red-600 to-red-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
