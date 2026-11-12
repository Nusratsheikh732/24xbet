import { useEffect, useState } from 'react';
import { ChevronLeft, Image, ExternalLink } from 'lucide-react';
import { db, onValue, ref } from '@/lib/firebase';

interface PromotionBanner {
  id: string;
  url: string;
  order: number;
  link?: string;
}

export default function PromotionBannersPage({ onBack }: { onBack: () => void }) {
  const [banners, setBanners] = useState<PromotionBanner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onValue(ref(db, 'game_settings/promotion_banners'), (snapshot) => {
      const value = snapshot.val() as { list?: PromotionBanner[] } | null;
      const list = Array.isArray(value?.list) ? value.list : [];
      setBanners([...list].sort((a, b) => a.order - b.order));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-[#07504d] pb-8 text-white">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-[#0b5c59]/95 px-4 py-4 backdrop-blur-sm">
        <button onClick={onBack} aria-label="Back" className="rounded-full p-1 text-white transition-transform active:scale-90">
          <ChevronLeft size={25} />
        </button>
        <h1 className="font-display text-xl font-bold tracking-wide">PROMOTION</h1>
      </header>

      <div className="flex gap-2 overflow-x-auto px-4 py-4 no-scrollbar">
        {['All', 'HOT', 'NEW', 'DOWNLOAD'].map((tab, index) => (
          <button
            key={tab}
            className={`shrink-0 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-bold shadow-md transition-colors ${
              index === 0 ? 'bg-[#087c78] text-[#ffe100]' : 'bg-[#086864] text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="space-y-5 px-4">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-white/70">Loading promotions...</div>
        ) : banners.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-center text-white/70">
            <Image size={38} className="mb-3 text-white/50" />
            <p className="text-sm font-semibold">No promotions available</p>
            <p className="mt-1 text-xs text-white/50">New banners will appear here when added by Admin.</p>
          </div>
        ) : (
          banners.map((banner, index) => (
            <article key={banner.id} className="overflow-hidden rounded-2xl border border-[#0a7772] bg-[#063c3b] shadow-xl shadow-black/20">
              <a
                href={banner.link || undefined}
                target={banner.link ? '_blank' : undefined}
                rel={banner.link ? 'noreferrer' : undefined}
                className={banner.link ? 'block' : 'block cursor-default'}
                onClick={(event) => { if (!banner.link) event.preventDefault(); }}
              >
                <img
                  src={banner.url}
                  alt={`Promotion ${index + 1}`}
                  className="aspect-[16/7] w-full object-cover"
                />
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">Promotion offer {index + 1}</p>
                  {banner.link && (
                    <span className="flex shrink-0 items-center gap-1 rounded-lg bg-[#ffd21c] px-4 py-2 text-xs font-bold text-[#805600]">
                      View <ExternalLink size={13} />
                    </span>
                  )}
                </div>
              </a>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
