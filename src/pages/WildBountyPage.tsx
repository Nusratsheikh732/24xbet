import { ArrowLeft } from 'lucide-react';
import WildBountyGame from '@/components/WildBountyGame';

interface WildBountyPageProps {
  onBack: () => void;
}

export default function WildBountyPage({ onBack }: WildBountyPageProps) {
  return (
    <div className="fixed inset-0 z-50 bg-dark-bg flex flex-col max-w-md mx-auto overflow-hidden">
      <header className="shrink-0 bg-dark-card/95 backdrop-blur-sm border-b border-dark-border h-14 flex items-center gap-2.5 px-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="w-8 h-8 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 active:scale-90 transition-transform"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-base font-bold text-white leading-none">Wild Bounty Showdown</h1>
          <p className="text-[10px] text-neon-gold font-bold uppercase leading-none mt-0.5">Gold framed wilds up to x1024</p>
        </div>
      </header>
      <div className="flex-1 min-h-0">
        <WildBountyGame />
      </div>
    </div>
  );
}
