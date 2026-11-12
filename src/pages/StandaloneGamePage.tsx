import { ChevronLeft } from 'lucide-react';

interface StandaloneGamePageProps {
  title: string;
  src: string;
  onBack: () => void;
}

export default function StandaloneGamePage({ title, src, onBack }: StandaloneGamePageProps) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#07110d]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-[#0b1a14] px-4">
        <button
          onClick={onBack}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-base font-bold tracking-wide text-white">{title}</h1>
      </header>
      <iframe src={src} title={title} className="h-full w-full flex-1 border-0" allow="autoplay" />
    </div>
  );
}
