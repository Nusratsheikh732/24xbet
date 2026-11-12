import { useState, useEffect } from 'react';
import { db, ref, set, onValue } from '@/lib/firebase';
import { Image, Check, Settings, Trash2, Plus, X, ArrowUp, ArrowDown, Link2, AlertCircle } from 'lucide-react';

interface Banner {
  id: string;
  url: string;
  order: number;
  link?: string;
}

interface BannerControlTabProps {
  storagePath?: string;
  title?: string;
}

export default function BannerControlTab({
  storagePath = 'game_settings/banners',
  title = 'Home Page Banners',
}: BannerControlTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [urlError, setUrlError] = useState(false);

  useEffect(() => {
    const unsub = onValue(
      ref(db, storagePath),
      (snap) => {
        if (snap.exists()) {
          const list = (snap.val().list as Banner[] | undefined) ?? [];
          list.sort((a, b) => a.order - b.order);
          setBanners(list);
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const persist = async (updated: Banner[]) => {
    const sorted = [...updated].sort((a, b) => a.order - b.order);
    setBanners(sorted);
    setSaveError(false);
    try {
      await set(ref(db, storagePath), {
        list: sorted,
        updatedAt: Date.now(),
      });
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
  };

  const handleAdd = async () => {
    const url = newUrl.trim();
    if (!url) {
      setUrlError(true);
      return;
    }
    setUrlError(false);
    setSaving(true);
    const banner: Banner = {
      id: `b_${Date.now()}`,
      url,
      order: banners.length,
      link: '',
    };
    await persist([...banners, banner]);
    setNewUrl('');
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async (id: string) => {
    const updated = banners.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i }));
    await persist(updated);
  };

  const handleUpdateUrl = async (id: string, url: string) => {
    const updated = banners.map((b) => (b.id === id ? { ...b, url } : b));
    await persist(updated);
  };

  const handleUpdateLink = async (id: string, link: string) => {
    const updated = banners.map((b) => (b.id === id ? { ...b, link } : b));
    await persist(updated);
  };

  const handleMove = async (id: string, dir: 'up' | 'down') => {
    const sorted = [...banners].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const tmp = sorted[idx].order;
    sorted[idx].order = sorted[swapIdx].order;
    sorted[swapIdx].order = tmp;
    await persist(sorted);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading banner settings...</p>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Image size={18} className="text-neon-gold" />
          <h3 className="font-display text-base font-bold text-white">{title}</h3>
        </div>
        <p className="text-xs text-gray-500">
          Add promotional banners by pasting a direct image URL. Reorder them with the arrows, or delete them when no longer needed.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Total Banners</p>
            <p className="font-display text-lg font-bold text-white">{banners.length}</p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Status</p>
            <p className={`font-display text-lg font-bold ${banners.length > 0 ? 'text-neon-green' : 'text-gray-500'}`}>
              {banners.length > 0 ? 'Active' : 'Empty'}
            </p>
          </div>
        </div>
      </div>

      {/* Add new banner */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Plus size={16} className="text-neon-green" />
          <h4 className="text-sm font-bold text-white">Add New Banner</h4>
        </div>
        <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5">
          <Image size={16} className="text-gray-500 mr-2 shrink-0" />
          <input
            type="url"
            value={newUrl}
            onChange={(e) => { setNewUrl(e.target.value); setUrlError(false); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Paste direct image URL (https://...)"
            className="bg-transparent text-white text-sm w-full outline-none placeholder:text-gray-600"
          />
        </div>
        {urlError && <p className="text-xs text-neon-red">Please enter a valid image URL.</p>}
        <button
          onClick={handleAdd}
          disabled={saving || !newUrl.trim()}
          className="w-full bg-neon-green text-dark-bg font-bold text-sm py-2.5 rounded-lg active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
        >
          {saving ? 'Adding...' : <><Plus size={16} strokeWidth={2.5} /> Add Banner</>}
        </button>
      </div>

      {/* Banner list */}
      {banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Image size={36} className="text-gray-700 mb-3" />
          <p className="text-sm text-gray-500">No banners yet</p>
          <p className="text-xs text-gray-600 mt-1">Add a banner above to show it on the {title.toLowerCase()}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((banner, idx) => (
            <div key={banner.id} className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
              {/* Preview */}
              <div className="relative w-full aspect-[16/9] bg-dark-card2 overflow-hidden">
                <img
                  src={banner.url}
                  alt={`Banner ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = '0.3';
                  }}
                />
                <span className="absolute top-1.5 left-1.5 text-[9px] font-bold bg-black/70 text-white px-2 py-0.5 rounded-full">
                  #{idx + 1}
                </span>
              </div>

              {/* URL editor + controls */}
              <div className="p-3 space-y-2.5">
                <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-2.5 py-2">
                  <input
                    type="url"
                    value={banner.url}
                    onChange={(e) => handleUpdateUrl(banner.id, e.target.value)}
                    placeholder="Image URL"
                    className="bg-transparent text-white text-xs w-full outline-none"
                  />
                </div>
                <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-2.5 py-2">
                  <Link2 size={14} className="text-gray-500 mr-2 shrink-0" />
                  <input
                    type="url"
                    value={banner.link || ''}
                    onChange={(e) => handleUpdateLink(banner.id, e.target.value)}
                    placeholder="Click link URL (optional)"
                    className="bg-transparent text-white text-xs w-full outline-none"
                  />
                </div>
                {idx === 0 && !banner.link && (
                  <p className="text-[10px] text-neon-gold/80">
                    Banner 1 defaults to: https://appsgeyser.io/20222339/24xbet if no link is set.
                  </p>
                )}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleMove(banner.id, 'up')}
                    disabled={idx === 0}
                    className="w-9 h-9 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-border transition-colors disabled:opacity-30"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMove(banner.id, 'down')}
                    disabled={idx === banners.length - 1}
                    className="w-9 h-9 rounded-lg bg-dark-card2 border border-dark-border flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-border transition-colors disabled:opacity-30"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="flex-1 bg-neon-red/10 text-neon-red font-bold text-xs py-2 rounded-lg hover:bg-neon-red/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save toast */}
      {saved && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-neon-green text-dark-bg text-xs font-bold px-4 py-2 rounded-full neon-green-glow flex items-center gap-1.5 z-50">
          <Check size={14} strokeWidth={2.5} /> Saved successfully!
        </div>
      )}
      {saveError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-neon-red text-white text-xs font-bold px-4 py-2 rounded-full flex items-center gap-1.5 z-50">
          <AlertCircle size={14} strokeWidth={2.5} /> Failed to save. Check connection.
        </div>
      )}
    </div>
  );
}
