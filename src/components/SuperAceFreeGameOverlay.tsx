import { useEffect, useRef, useState } from 'react';

const FREE_GAME_IMAGE_URL = 'https://i.postimg.cc/2yvr0LFZ/IMG-52cf522f-5ce4-40b9-95f5-30158ae5aa9f.jpg';
const FREE_GAME_WIN_IMAGE_URL = 'https://i.postimg.cc/hvxc2Qbf/1793399588351.jpg';
const FREE_GAME_SCATTER_SOUND_URL = '/Super_Ace_Scatter_sound copy.mp3';
const FREE_GAME_INTRO_FALLBACK_MS = 30000;
const FREE_GAME_COUNT_SOUND_URL = '/Super_Ace_টাকা_গননা.mp3';

interface FreeGameIntroOverlayProps {
  onComplete: () => void;
}

export function FreeGameIntroOverlay({ onComplete }: FreeGameIntroOverlayProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let finished = false;
    const audio = new Audio(FREE_GAME_SCATTER_SOUND_URL);
    const finish = () => {
      if (finished) return;
      finished = true;
      onCompleteRef.current();
    };
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    const fallbackTimer = window.setTimeout(finish, FREE_GAME_INTRO_FALLBACK_MS);
    audio.play().catch(finish);

    return () => {
      window.clearTimeout(fallbackTimer);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label="Free game"
    >
      <img
        src={FREE_GAME_IMAGE_URL}
        alt="Congratulations, free game"
        className="h-full w-full object-contain"
      />
    </div>
  );
}

interface FreeGameWinOverlayProps {
  amount: number;
  onComplete: () => void;
}

export function FreeGameWinOverlay({ amount, onComplete }: FreeGameWinOverlayProps) {
  const [displayAmount, setDisplayAmount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const duration = 2400;
    const startedAt = performance.now();
    const audio = new Audio(FREE_GAME_COUNT_SOUND_URL);
    audio.loop = true;
    audio.play().catch(() => {});
    const counter = window.setInterval(() => {
      const progress = Math.min((performance.now() - startedAt) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(amount * easedProgress);
      if (progress >= 1) {
        window.clearInterval(counter);
        audio.pause();
      }
    }, 40);
    const closeTimer = window.setTimeout(() => {
      setDisplayAmount(amount);
      onCompleteRef.current();
    }, duration + 2000);

    return () => {
      window.clearInterval(counter);
      window.clearTimeout(closeTimer);
      audio.pause();
    };
  }, [amount]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Free game winnings"
    >
      <div className="relative h-full w-full max-w-md">
        <img
          src={FREE_GAME_WIN_IMAGE_URL}
          alt="Free game winnings"
          className="h-full w-full object-contain"
        />
        <p
          className="pointer-events-none absolute left-1/2 top-[44%] w-[82%] -translate-x-1/2 -translate-y-1/2 text-center font-display text-[clamp(2rem,10vw,4rem)] font-black tabular-nums text-[#fff36a]"
          style={{ textShadow: '0 3px 0 #6c1600, 0 0 10px rgba(255,255,180,.9)' }}
        >
          ৳{displayAmount.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
