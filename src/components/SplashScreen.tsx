import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadeOut(true), 3000);
    const doneTimer = setTimeout(() => onComplete(), 3400);

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 100 / 34, 100));
    }, 90);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ background: '#1a0303' }}
    >
      {/* Full-screen casino splash image */}
      <img
        src="https://i.postimg.cc/k4f7qzVv/Chat-GPT-Image-Sep-26-2026-04-46-39-AM.png"
        alt="24XBET Casino"
        onLoad={() => setImgLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
      />

      {/* Dark gradient overlay at bottom for loading bar legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, transparent 55%, rgba(26,3,3,0.75) 82%, rgba(26,3,3,0.97) 100%)',
        }}
      />

      {/* Loading bar at bottom */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-56">
        <div
          className="h-1.5 rounded-full bg-black/50 overflow-hidden"
          style={{ border: '1px solid rgba(255,215,0,0.3)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-100 ease-linear"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #ffd700, #ff6b35)',
              boxShadow: '0 0 8px rgba(255,215,0,0.5)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span
            className="text-[10px] tracking-widest"
            style={{ fontFamily: 'Rajdhani, sans-serif', color: 'rgba(255,215,0,0.6)' }}
          >
            LOADING
          </span>
          <span
            className="text-[10px] tracking-widest"
            style={{ fontFamily: 'Rajdhani, sans-serif', color: 'rgba(255,215,0,0.6)' }}
          >
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
}
