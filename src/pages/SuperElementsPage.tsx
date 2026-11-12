import { ArrowLeft, Menu, Wallet } from 'lucide-react';
import SuperElementsGame from '@/components/SuperElementsGame';
import { useLanguage } from '@/context/LanguageContext';

interface SuperElementsPageProps {
  balance: number;
  onBetPlaced: (amount: number) => void;
  onWin: (amount: number) => void;
  onBack: () => void;
}

function SlotMachine({ color, screenColor, glowColor, accentColor }: { color: string; screenColor: string; glowColor: string; accentColor: string }) {
  return (
    <div
      className="relative rounded-t-lg"
      style={{
        width: 18,
        height: 30,
        background: `linear-gradient(180deg, ${color} 0%, #0a0204 100%)`,
        border: '0.5px solid #5a3a1a',
        boxShadow: `0 0 8px ${glowColor}, inset 0 0 4px rgba(0,0,0,0.5)`,
      }}
    >
      <div className="absolute top-0.5 left-0.5 right-0.5 h-1.5 rounded-sm" style={{ background: accentColor, boxShadow: `0 0 4px ${glowColor}` }} />
      <div className="absolute top-3 left-1 right-1 h-5 rounded-sm flex justify-around items-center px-0.5"
        style={{ background: screenColor, border: '0.5px solid rgba(255,255,255,0.1)', boxShadow: 'inset 0 0 4px rgba(0,0,0,0.3)' }}>
        <div className="w-1 h-2 rounded-sm" style={{ background: accentColor, boxShadow: `0 0 3px ${glowColor}` }} />
        <div className="w-1 h-2 rounded-sm bg-[#ffd700]/70" style={{ boxShadow: '0 0 3px rgba(255,215,0,0.5)' }} />
        <div className="w-1 h-2 rounded-sm" style={{ background: accentColor, boxShadow: `0 0 3px ${glowColor}` }} />
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#1a0a04] rounded-sm" />
    </div>
  );
}

function GamingTable({ shape, feltColor, borderColor }: { shape: 'round' | 'oval' | 'rect'; feltColor: string; borderColor: string }) {
  const radius = shape === 'round' ? '50%' : shape === 'oval' ? '50%' : '8px';
  const w = shape === 'round' ? 28 : shape === 'oval' ? 32 : 30;
  const h = shape === 'round' ? 14 : shape === 'oval' ? 16 : 12;
  return (
    <div
      className="relative"
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: `radial-gradient(ellipse 60% 80% at 50% 45%, ${feltColor} 0%, #062004 100%)`,
        border: `1.5px solid ${borderColor}`,
        boxShadow: `0 0 8px ${feltColor}33, inset 0 0 6px rgba(0,0,0,0.4)`,
      }}
    >
      <div className="absolute inset-1 rounded-full" style={{ border: `0.5px solid ${borderColor}33` }} />
    </div>
  );
}

function CasinoChip({ color, size }: { color: string; size: number }) {
  return (
    <div
      className="rounded-full relative"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 40% 40%, ${color}, ${color}99 60%, ${color}44 100%)`,
        border: '1.5px dashed rgba(255,255,255,0.3)',
        boxShadow: '0 1.5px 3px rgba(0,0,0,0.5), inset 0 0 3px rgba(0,0,0,0.3)',
      }}
    >
      <div className="absolute inset-1 rounded-full" style={{ border: `0.5px solid ${color}66` }} />
    </div>
  );
}

function CasinoBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#08020a' }}>
      {/* === SKY / CEILING === */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #1a0408 0%, #120308 30%, #0a0206 55%, #08020a 100%)' }} />

      {/* Warm ceiling light wash — wide spread, not a cone */}
      <div className="absolute top-0 left-0 right-0 h-2/5" style={{ background: 'radial-gradient(ellipse 120% 90% at 50% -10%, rgba(255,170,30,0.18) 0%, rgba(255,130,20,0.08) 35%, transparent 65%)' }} />

      {/* === CHANDELIERS — 3 across the ceiling, wide spread === */}
      {/* Center chandelier — large */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
        <div className="w-[2px] h-5 bg-gradient-to-b from-[#5a4220] to-[#8a6a30]" />
        <div className="relative w-24 h-9" style={{
          background: 'radial-gradient(ellipse 50% 100% at 50% 0%, #ffd700 0%, #b8860b 40%, #4a3010 80%, transparent 100%)',
          borderRadius: '0 0 50% 50% / 0 0 100% 100%',
          boxShadow: '0 0 35px rgba(255,180,40,0.3), 0 0 70px rgba(255,140,20,0.12)',
        }}>
          <div className="absolute bottom-1 left-2.5 w-1.5 h-1.5 rounded-full bg-[#ffe070] shadow-[0_0_6px_3px_rgba(255,200,60,0.6)]" />
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#fff0a0] shadow-[0_0_8px_4px_rgba(255,210,80,0.7)]" />
          <div className="absolute bottom-1 right-2.5 w-1.5 h-1.5 rounded-full bg-[#ffe070] shadow-[0_0_6px_3px_rgba(255,200,60,0.6)]" />
        </div>
        <div className="w-28 h-16 -mt-0.5" style={{ background: 'linear-gradient(180deg, rgba(255,190,50,0.14) 0%, transparent 100%)', clipPath: 'polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)' }} />
      </div>

      {/* Left chandelier */}
      <div className="absolute top-0 left-[18%] flex flex-col items-center pointer-events-none">
        <div className="w-[2px] h-3 bg-gradient-to-b from-[#5a4220] to-[#8a6a30]" />
        <div className="relative w-14 h-6" style={{
          background: 'radial-gradient(ellipse 50% 100% at 50% 0%, #ffd700 0%, #b8860b 40%, #4a3010 80%, transparent 100%)',
          borderRadius: '0 0 50% 50% / 0 0 100% 100%',
          boxShadow: '0 0 20px rgba(255,180,40,0.2)',
        }}>
          <div className="absolute bottom-0.5 left-1.5 w-1 h-1 rounded-full bg-[#ffe070] shadow-[0_0_4px_2px_rgba(255,200,60,0.5)]" />
          <div className="absolute bottom-0.5 right-1.5 w-1 h-1 rounded-full bg-[#ffe070] shadow-[0_0_4px_2px_rgba(255,200,60,0.5)]" />
        </div>
        <div className="w-16 h-10 -mt-0.5" style={{ background: 'linear-gradient(180deg, rgba(255,190,50,0.10) 0%, transparent 100%)', clipPath: 'polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)' }} />
      </div>

      {/* Right chandelier */}
      <div className="absolute top-0 right-[18%] flex flex-col items-center pointer-events-none">
        <div className="w-[2px] h-3 bg-gradient-to-b from-[#5a4220] to-[#8a6a30]" />
        <div className="relative w-14 h-6" style={{
          background: 'radial-gradient(ellipse 50% 100% at 50% 0%, #ffd700 0%, #b8860b 40%, #4a3010 80%, transparent 100%)',
          borderRadius: '0 0 50% 50% / 0 0 100% 100%',
          boxShadow: '0 0 20px rgba(255,180,40,0.2)',
        }}>
          <div className="absolute bottom-0.5 left-1.5 w-1 h-1 rounded-full bg-[#ffe070] shadow-[0_0_4px_2px_rgba(255,200,60,0.5)]" />
          <div className="absolute bottom-0.5 right-1.5 w-1 h-1 rounded-full bg-[#ffe070] shadow-[0_0_4px_2px_rgba(255,200,60,0.5)]" />
        </div>
        <div className="w-16 h-10 -mt-0.5" style={{ background: 'linear-gradient(180deg, rgba(255,190,50,0.10) 0%, transparent 100%)', clipPath: 'polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)' }} />
      </div>

      {/* === NEON CASINO SIGN — top center === */}
      <div className="absolute top-[14%] left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-sm" style={{ background: 'rgba(20,4,8,0.7)', border: '0.5px solid rgba(255,215,0,0.3)', boxShadow: '0 0 12px rgba(255,50,0,0.15)' }}>
          <div className="w-1 h-1 rounded-full bg-[#ff3000] shadow-[0_0_4px_2px_rgba(255,50,0,0.6)]" />
          <span className="text-[6px] font-bold tracking-[0.15em] text-[#ffaa00]" style={{ textShadow: '0 0 4px rgba(255,170,0,0.6)' }}>CASINO</span>
          <div className="w-1 h-1 rounded-full bg-[#ff3000] shadow-[0_0_4px_2px_rgba(255,50,0,0.6)]" />
        </div>
      </div>

      {/* === BACK WALL — distant slot machine row === */}
      {/* Row of slot machines across the back, receding with perspective via size/opacity */}
      <div className="absolute top-[20%] left-0 right-0 flex justify-around items-end px-2 pointer-events-none opacity-75">
        <SlotMachine color="#2a0a0a" screenColor="#0a1a0a" glowColor="rgba(255,100,20,0.12)" accentColor="#ff5722" />
        <div className="flex gap-0.5">
          <SlotMachine color="#1a0a1a" screenColor="#0a0a1a" glowColor="rgba(120,50,200,0.10)" accentColor="#7c3aed" />
          <SlotMachine color="#2a0a0a" screenColor="#0a1a0a" glowColor="rgba(255,100,20,0.12)" accentColor="#ff5722" />
        </div>
        <SlotMachine color="#0a1a1a" screenColor="#0a1a14" glowColor="rgba(0,200,150,0.10)" accentColor="#00cc88" />
        <div className="flex gap-0.5">
          <SlotMachine color="#1a0a1a" screenColor="#0a0a1a" glowColor="rgba(120,50,200,0.10)" accentColor="#7c3aed" />
          <SlotMachine color="#2a0a0a" screenColor="#0a1a0a" glowColor="rgba(255,100,20,0.12)" accentColor="#ff5722" />
        </div>
        <SlotMachine color="#0a1a1a" screenColor="#0a1a14" glowColor="rgba(0,200,150,0.10)" accentColor="#00cc88" />
      </div>

      {/* === MID-GROUND — gaming tables spread wide across the floor === */}
      {/* Left side — roulette table */}
      <div className="absolute top-[42%] left-[3%] pointer-events-none opacity-90">
        <GamingTable shape="round" feltColor="#0a4a20" borderColor="#5a4220" />
      </div>

      {/* Center-left — blackjack table */}
      <div className="absolute top-[48%] left-[12%] pointer-events-none opacity-85">
        <GamingTable shape="rect" feltColor="#0a3a1a" borderColor="#4a3010" />
      </div>

      {/* Center-right — poker table */}
      <div className="absolute top-[42%] right-[3%] pointer-events-none opacity-90">
        <GamingTable shape="oval" feltColor="#1a3a18" borderColor="#3a2a10" />
      </div>

      {/* Center — small blackjack table further back */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 pointer-events-none opacity-70">
        <GamingTable shape="oval" feltColor="#0a3a1a" borderColor="#4a3010" />
      </div>

      {/* === FOREGROUND SLOT MACHINES — larger, closer on left and right === */}
      {/* Left foreground slot machine */}
      <div className="absolute bottom-[20%] left-[2%] pointer-events-none opacity-95">
        <div className="relative" style={{ width: 22, height: 36, background: 'linear-gradient(180deg, #2a0a0a 0%, #1a0608 50%, #0d0306 100%)', border: '1px solid #5a3a1a', borderRadius: '6px 6px 3px 3px', boxShadow: '0 0 12px rgba(255,100,20,0.15), inset 0 0 6px rgba(0,0,0,0.5)' }}>
          <div className="absolute top-1 left-1 right-1 h-2 rounded-sm flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #ff3000, #cc1000)', boxShadow: '0 0 6px rgba(255,50,0,0.4)' }}>
            <div className="w-1 h-1 rounded-full bg-[#ffdd00] shadow-[0_0_3px_2px_rgba(255,220,0,0.6)]" />
          </div>
          <div className="absolute top-4 left-1 right-1 h-7 rounded-sm flex justify-around items-center px-0.5" style={{ background: 'linear-gradient(180deg, #0a1a0a, #061206)', border: '0.5px solid #2a4a2a', boxShadow: 'inset 0 0 4px rgba(0,255,100,0.15)' }}>
            <div className="w-1.5 h-2.5 bg-[#ff5722]/80 rounded-sm" style={{ boxShadow: '0 0 3px rgba(255,87,34,0.5)' }} />
            <div className="w-1.5 h-2.5 bg-[#ffd700]/80 rounded-sm" style={{ boxShadow: '0 0 3px rgba(255,215,0,0.5)' }} />
            <div className="w-1.5 h-2.5 bg-[#ff5722]/80 rounded-sm" style={{ boxShadow: '0 0 3px rgba(255,87,34,0.5)' }} />
          </div>
          <div className="absolute right-[-1px] top-6 w-0.5 h-6 bg-gradient-to-b from-[#8a6a30] to-[#5a4220] rounded-full" />
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#1a0a04] rounded-sm border border-[#3a2a10]" />
        </div>
      </div>

      {/* Right foreground slot machine */}
      <div className="absolute bottom-[20%] right-[2%] pointer-events-none opacity-95">
        <div className="relative" style={{ width: 22, height: 36, background: 'linear-gradient(180deg, #1a0a1a 0%, #100610 50%, #0a0306 100%)', border: '1px solid #4a2a4a', borderRadius: '6px 6px 3px 3px', boxShadow: '0 0 12px rgba(120,50,200,0.12), inset 0 0 6px rgba(0,0,0,0.5)' }}>
          <div className="absolute top-1 left-1 right-1 h-2 rounded-sm flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #6a10cc, #4a0088)', boxShadow: '0 0 6px rgba(120,30,200,0.35)' }}>
            <div className="w-1 h-1 rounded-full bg-[#ffdd00] shadow-[0_0_3px_2px_rgba(255,220,0,0.6)]" />
          </div>
          <div className="absolute top-4 left-1 right-1 h-7 rounded-sm flex justify-around items-center px-0.5" style={{ background: 'linear-gradient(180deg, #0a0a1a, #060612)', border: '0.5px solid #2a2a4a', boxShadow: 'inset 0 0 4px rgba(80,80,255,0.15)' }}>
            <div className="w-1.5 h-2.5 bg-[#29b6f6]/80 rounded-sm" style={{ boxShadow: '0 0 3px rgba(41,182,246,0.5)' }} />
            <div className="w-1.5 h-2.5 bg-[#ffd700]/80 rounded-sm" style={{ boxShadow: '0 0 3px rgba(255,215,0,0.5)' }} />
            <div className="w-1.5 h-2.5 bg-[#29b6f6]/80 rounded-sm" style={{ boxShadow: '0 0 3px rgba(41,182,246,0.5)' }} />
          </div>
          <div className="absolute right-[-1px] top-6 w-0.5 h-6 bg-gradient-to-b from-[#8a6a30] to-[#5a4220] rounded-full" />
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#1a0a04] rounded-sm border border-[#3a2a10]" />
        </div>
      </div>

      {/* === CASINO CHIPS — scattered across the floor === */}
      {/* Left foreground chips */}
      <div className="absolute bottom-[14%] left-[8%] pointer-events-none">
        <div className="relative" style={{ width: 16, height: 6 }}>
          <div className="absolute bottom-0 rounded-full" style={{ width: 16, height: 5, background: 'radial-gradient(circle, #c01818, #800808)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
          <div className="absolute bottom-1.5 rounded-full" style={{ width: 16, height: 5, background: 'radial-gradient(circle, #d02020, #900a0a)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
          <div className="absolute bottom-3 rounded-full" style={{ width: 16, height: 5, background: 'radial-gradient(circle, #e02828, #a01010)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
        </div>
      </div>
      {/* Right foreground chip stack */}
      <div className="absolute bottom-[14%] right-[8%] pointer-events-none">
        <div className="relative" style={{ width: 14, height: 5 }}>
          <div className="absolute bottom-0 rounded-full" style={{ width: 14, height: 4, background: 'radial-gradient(circle, #b8860b, #6a4a00)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
          <div className="absolute bottom-1 rounded-full" style={{ width: 14, height: 4, background: 'radial-gradient(circle, #c9960c, #7a5a00)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
          <div className="absolute bottom-2 rounded-full" style={{ width: 14, height: 4, background: 'radial-gradient(circle, #d4a014, #8a6a00)', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
        </div>
      </div>
      {/* Scattered single chips */}
      <div className="absolute bottom-[18%] left-[16%] pointer-events-none opacity-90"><CasinoChip color="#e02020" size={7} /></div>
      <div className="absolute bottom-[16%] right-[16%] pointer-events-none opacity-90"><CasinoChip color="#ffd700" size={6} /></div>
      <div className="absolute top-[55%] left-[6%] pointer-events-none opacity-80"><CasinoChip color="#29b6f6" size={5} /></div>
      <div className="absolute top-[55%] right-[6%] pointer-events-none opacity-80"><CasinoChip color="#00cc88" size={5} /></div>

      {/* === RED LUXURY CARPET — wide floor area at bottom === */}
      <div className="absolute bottom-0 left-0 right-0 h-[28%]" style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(50,6,6,0.3) 15%, rgba(70,8,8,0.55) 40%, rgba(45,4,4,0.75) 100%)' }}>
        {/* Diamond pattern carpet */}
        <div className="absolute inset-0 opacity-25" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,215,0,0.08) 0px, rgba(255,215,0,0.08) 1px, transparent 1px, transparent 14px), repeating-linear-gradient(-45deg, rgba(255,215,0,0.08) 0px, rgba(255,215,0,0.08) 1px, transparent 1px, transparent 14px)',
        }} />
        {/* Gold border line at top of carpet */}
        <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.25) 15%, rgba(255,215,0,0.4) 50%, rgba(255,215,0,0.25) 85%, transparent)' }} />
      </div>

      {/* === GOLD DECORATIVE TRIM === */}
      {/* Top gold trim */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px]" style={{ background: 'linear-gradient(90deg, transparent 5%, #8a6a30 15%, #ffd700 50%, #8a6a30 85%, transparent 95%)', boxShadow: '0 0 3px rgba(255,215,0,0.15)' }} />

      {/* === WARM LIGHT POOLS on floor — multiple sources === */}
      <div className="absolute bottom-0 left-[15%] w-1/3 h-1/4" style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgba(255,150,30,0.06) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 right-[15%] w-1/3 h-1/4" style={{ background: 'radial-gradient(ellipse 70% 100% at 50% 100%, rgba(255,150,30,0.06) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1/3" style={{ background: 'radial-gradient(ellipse 60% 100% at 50% 100%, rgba(255,160,30,0.07) 0%, transparent 70%)' }} />

      {/* === NEON ACCENTS — thin glowing lines on sides === */}
      <div className="absolute left-0 top-[30%] bottom-[30%] w-[1.5px]" style={{ background: 'linear-gradient(180deg, transparent, #ff3000 20%, #ff5000 50%, #ff3000 80%, transparent)', boxShadow: '0 0 5px rgba(255,50,0,0.3)' }} />
      <div className="absolute right-0 top-[30%] bottom-[30%] w-[1.5px]" style={{ background: 'linear-gradient(180deg, transparent, #ffaa00 20%, #ffcc00 50%, #ffaa00 80%, transparent)', boxShadow: '0 0 5px rgba(255,170,0,0.3)' }} />

      {/* === SUBTLE VIGNETTE — light, no blur === */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 110% 90% at 50% 42%, transparent 55%, rgba(0,0,0,0.2) 100%)' }} />
    </div>
  );
}

export default function SuperElementsPage({ balance, onBetPlaced, onWin, onBack }: SuperElementsPageProps) {
  const { t, bn } = useLanguage();
  return (
    <div className="fixed inset-0 z-50 flex flex-col max-w-md mx-auto overflow-hidden"
      style={{ background: '#0a0408' }}
    >
      {/* CSS casino background */}
      <CasinoBackground />

      <header className="shrink-0 border-b h-14 flex items-center justify-between px-3 relative z-10"
        style={{ background: 'rgba(10,4,8,0.50)', borderBottom: '2px solid #5a3a1a' }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg border flex items-center justify-center text-[#8a6a4a] active:scale-90 transition-transform"
            style={{ background: '#2a1c12', borderColor: '#5a3a1a' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-neon-gold/40 flex items-center justify-center shrink-0 p-0.5"
            style={{ background: 'linear-gradient(135deg, #3a2818, #1a1208)' }}
          >
            <img src="https://i.postimg.cc/N0RyZFLX/images-(5).jpg" alt="Super Elements" className="w-full h-full object-cover rounded-md" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold text-white leading-none">{t('superElements.title')}</h1>
            <p className="text-[10px] text-[#ff6f00] font-bold uppercase leading-none mt-0.5">{t('superElements.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border"
            style={{ background: '#2a1c12', borderColor: '#5a3a1a' }}
          >
            <Wallet size={14} className="text-neon-green" />
            <span className="text-sm font-bold text-white tabular-nums leading-none">
              {bn(balance.toFixed(2))}
            </span>
            <span className="text-[10px] text-[#8a6a4a] font-semibold leading-none">BDT</span>
          </div>
          <button className="w-8 h-8 rounded-lg border flex items-center justify-center text-[#8a6a4a] active:scale-90 transition-transform"
            style={{ background: '#2a1c12', borderColor: '#5a3a1a' }}
          >
            <Menu size={16} />
          </button>
        </div>
      </header>

      <SuperElementsGame
        balance={balance}
        onBetPlaced={onBetPlaced}
        onWin={onWin}
      />
    </div>
  );
}
