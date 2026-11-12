import React from 'react';

export const SymbolGraphic: React.FC<{ id: string; goldFrame?: boolean }> = ({ id, goldFrame }) => {
  switch (id) {
    case 'WILD':
      return (
        <div className="relative w-full h-full flex flex-col items-center justify-end overflow-hidden rounded-md bg-gradient-to-b from-[#7a3b10] via-[#401b05] to-[#1a0902] border-2 border-[#ffd700] shadow-[inset_0_0_10px_#ffae00]">
          {/* Cowgirl Sheriff SVG Portrait */}
          <svg viewBox="0 0 80 80" className="w-full h-full absolute inset-0">
            <defs>
              <radialGradient id="wildGlow" cx="50%" cy="40%" r="55%">
                <stop offset="0%" stopColor="#ffe57f" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#3d1704" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="40" cy="36" r="34" fill="url(#wildGlow)" />
            {/* Hair */}
            <path d="M18 32 Q12 55 20 70 L60 70 Q68 55 62 32 Z" fill="#8d4918" />
            {/* Face */}
            <ellipse cx="40" cy="40" rx="13" ry="15" fill="#f5cba7" />
            {/* Eyes & Lips */}
            <circle cx="35" cy="38" r="1.6" fill="#2c1810" />
            <circle cx="45" cy="38" r="1.6" fill="#2c1810" />
            <path d="M36 47 Q40 50 44 47" stroke="#b8332a" strokeWidth="2" fill="none" />
            {/* White Sheriff Cowboy Hat */}
            <path d="M8 28 Q40 36 72 28 Q60 20 20 20 Z" fill="#f5ebd6" stroke="#c79c52" strokeWidth="1.5" />
            <path d="M23 23 Q30 8 40 12 Q50 8 57 23 Z" fill="#fff8eb" stroke="#c79c52" strokeWidth="1.5" />
            {/* Gold Sheriff Star on Hat */}
            <polygon points="40,14 42,18 46,18 43,21 44,25 40,22 36,25 37,21 34,18 38,18" fill="#ffd700" stroke="#965a00" strokeWidth="0.7" />
            {/* Silver Revolver */}
            <path d="M14 55 L26 38 L31 41 L21 59 Z" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          </svg>
          <div className="relative z-10 w-full text-center bg-gradient-to-r from-[#8f1d14] via-[#d9381e] to-[#8f1d14] border-t border-[#ffd700] py-[1px]">
            <span className="font-rye text-[11px] tracking-wider text-[#fff3a1] drop-shadow-[0_2px_2px_#000] font-black">
              WILD
            </span>
          </div>
        </div>
      );

    case 'SCATTER':
      return (
        <div className="relative w-full h-full flex flex-col items-center justify-end overflow-hidden rounded-md bg-gradient-to-b from-[#6e490a] via-[#382203] to-[#1c1001] border-2 border-[#ffea79] shadow-[0_0_12px_rgba(255,215,0,0.5)]">
          {/* Gold Bullion Bars SVG */}
          <svg viewBox="0 0 80 80" className="w-full h-full absolute inset-0">
            <defs>
              <linearGradient id="goldBar" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff6a9" />
                <stop offset="45%" stopColor="#ffd700" />
                <stop offset="100%" stopColor="#b87700" />
              </linearGradient>
            </defs>
            {/* Bottom Row Bars */}
            <polygon points="10,55 38,55 33,42 15,42" fill="url(#goldBar)" stroke="#784700" strokeWidth="1.2" />
            <polygon points="36,55 68,55 63,42 41,42" fill="url(#goldBar)" stroke="#784700" strokeWidth="1.2" />
            {/* Middle Row Bars */}
            <polygon points="18,43 46,43 41,30 23,30" fill="url(#goldBar)" stroke="#784700" strokeWidth="1.2" />
            <polygon points="44,43 66,43 61,30 49,30" fill="url(#goldBar)" stroke="#784700" strokeWidth="1.2" />
            {/* Top Bar */}
            <polygon points="28,31 54,31 49,17 33,17" fill="url(#goldBar)" stroke="#784700" strokeWidth="1.2" />
            {/* Sparkles */}
            <circle cx="24" cy="22" r="2" fill="#fff" />
            <circle cx="58" cy="26" r="2.5" fill="#fff" />
          </svg>
          <div className="relative z-10 w-full text-center bg-gradient-to-r from-[#783f04] via-[#b8650b] to-[#783f04] border-t border-[#ffd700] py-[1px]">
            <span className="font-rye text-[9.5px] tracking-wider text-[#fff8c4] drop-shadow-[0_2px_2px_#000] font-black">
              SCATTER
            </span>
          </div>
        </div>
      );

    case 'OUTLAW':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.85)]">
          {/* Brown Hat */}
          <path d="M10 28 Q40 34 70 28 Q58 18 22 18 Z" fill="#4a2511" stroke="#261105" strokeWidth="1.5" />
          <path d="M24 22 Q40 8 56 22 Z" fill="#5c2f16" stroke="#261105" strokeWidth="1.5" />
          {/* Head/Eyes */}
          <rect x="27" y="27" width="26" height="16" rx="4" fill="#d9a17c" />
          <circle cx="34" cy="34" r="2" fill="#1a0903" />
          <circle cx="46" cy="34" r="2" fill="#1a0903" />
          <path d="M30 30 L38 32 M50 30 L42 32" stroke="#2b1204" strokeWidth="2" />
          {/* Red Bandana Mask */}
          <path d="M23 40 L57 40 L52 64 L40 72 L28 64 Z" fill="#b81d13" stroke="#5e0b06" strokeWidth="1.5" />
          <path d="M28 47 Q40 53 52 47" stroke="#f2645a" strokeWidth="1.2" fill="none" />
          {/* Golden Gun beside Outlaw */}
          <path d="M15 68 L22 36 L27 37 L21 68 Z" fill="#d49b35" stroke="#523204" strokeWidth="1.2" />
        </svg>
      );

    case 'GUN':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.85)]">
          {/* Gloved Hand & Silver Revolver */}
          <path d="M14 26 L56 26 L56 35 L36 35 L32 45 L14 35 Z" fill="#94a3b8" stroke="#1e293b" strokeWidth="2" />
          <circle cx="36" cy="34" r="7" fill="#64748b" stroke="#1e293b" strokeWidth="1.5" />
          {/* Brown Grip & Glove */}
          <path d="M38 36 L58 46 L52 68 L34 56 Z" fill="#8c2d19" stroke="#3b0f06" strokeWidth="1.8" />
          {/* Bullets */}
          <rect x="20" y="48" width="5" height="13" rx="2" transform="rotate(-20 20 48)" fill="#eab308" stroke="#713f12" />
          <rect x="27" y="51" width="5" height="13" rx="2" transform="rotate(-15 27 51)" fill="#eab308" stroke="#713f12" />
        </svg>
      );

    case 'HAT':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.85)]">
          {/* Pink/Purple Cowboy Hat on Red Bandana */}
          <path d="M14 54 Q40 68 68 50 L56 68 L22 68 Z" fill="#a82020" />
          <path d="M8 44 Q40 58 72 38 Q62 26 18 32 Z" fill="#9d4edd" stroke="#480ca8" strokeWidth="2" />
          <path d="M22 36 Q32 14 44 22 Q54 16 58 34 Z" fill="#c77dff" stroke="#480ca8" strokeWidth="2" />
          {/* Hat Rope Band */}
          <path d="M22 36 Q40 42 58 34" stroke="#ffb703" strokeWidth="3" fill="none" strokeDasharray="4 2" />
        </svg>
      );

    case 'BOTTLE':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full drop-shadow-[0_3px_4px_rgba(0,0,0,0.85)]">
          {/* Whiskey Bottle */}
          <rect x="36" y="10" width="12" height="10" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1.5" />
          <path d="M34 20 L50 20 L58 34 L56 66 L28 66 L26 34 Z" fill="rgba(255,255,255,0.28)" stroke="#cbd5e1" strokeWidth="1.8" />
          <path d="M28 40 Q42 44 56 38 L54 64 L29 64 Z" fill="#b45309" />
          {/* Shot Glass */}
          <polygon points="14,46 32,46 29,67 17,67" fill="rgba(255,255,255,0.35)" stroke="#e2e8f0" strokeWidth="1.5" />
          <polygon points="16,53 30,53 28,65 18,65" fill="#d97706" />
        </svg>
      );

    case 'A':
    case 'K':
    case 'Q':
    case 'J': {
      const colors: Record<string, { fill: string; stroke: string }> = {
        A: { fill: '#facc15', stroke: '#854d0e' },
        K: { fill: '#ef4444', stroke: '#7f1d1d' },
        Q: { fill: '#4ade80', stroke: '#14532d' },
        J: { fill: '#60a5fa', stroke: '#1e3a8a' },
      };
      const c = colors[id];
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <span
            className="font-rye text-[34px] leading-none select-none font-black"
            style={{
              color: c.fill,
              WebkitTextStroke: `2px ${c.stroke}`,
              textShadow: '0 3px 5px rgba(0,0,0,0.9)',
            }}
          >
            {id}
          </span>
          {/* Keyhole Motif inside Royal Letters */}
          <span className="absolute w-1.5 h-2.5 rounded-full bg-black/70 border border-white/30" />
        </div>
      );
    }

    default:
      return null;
  }
};
