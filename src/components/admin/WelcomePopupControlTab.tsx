import { useState, useEffect } from 'react';
import { db, ref, set, onValue } from '@/lib/firebase';
import { Image, Check, Settings, ToggleLeft, ToggleRight, Sparkles, Eye, AlertCircle } from 'lucide-react';

interface WelcomePopupSettings {
  enabled: boolean;
  imageUrl: string;
}

export default function WelcomePopupControlTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [previewKey, setPreviewKey] = useState(0);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'game_settings/welcome_popup'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          setEnabled(data.enabled ?? false);
          setImageUrl(data.imageUrl ?? '');
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/welcome_popup'), {
        enabled,
        imageUrl: imageUrl.trim(),
        updatedAt: Date.now(),
      });
      setSaved(true);
      setPreviewKey((k) => k + 1);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading welcome popup settings...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-neon-gold" />
          <h3 className="font-display text-base font-bold text-white">Welcome Popup Banner</h3>
        </div>
        <p className="text-xs text-gray-500">
          A promotional popup shown the first time a user enters the homepage each session. Paste a direct image URL and toggle it on or off.
        </p>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {enabled ? <ToggleRight size={32} className="text-neon-green" /> : <ToggleLeft size={32} className="text-gray-600" />}
            <div>
              <h4 className="text-sm font-bold text-white">Popup Status</h4>
              <p className="text-[10px] text-gray-500">{enabled ? 'Shown to users on first visit' : 'Disabled — not shown'}</p>
            </div>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition-colors ${
              enabled
                ? 'bg-neon-green/10 text-neon-green hover:bg-neon-green/20'
                : 'bg-dark-card2 text-gray-400 border border-dark-border hover:bg-dark-border'
            }`}
          >
            {enabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Image size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Banner Image URL</h4>
        </div>
        <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5">
          <Image size={16} className="text-gray-500 mr-2 shrink-0" />
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => { setImageUrl(e.target.value); setImgError(false); }}
            placeholder="Paste direct image URL (https://...)"
            className="bg-transparent text-white text-sm w-full outline-none placeholder:text-gray-600"
          />
        </div>
        <p className="text-xs text-gray-500">
          Paste a direct link to an image (e.g. ending in .jpg, .png). The image will appear centered on a blurred background.
        </p>
      </div>

      {imageUrl.trim() && (
        <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-neon-blue" />
            <h4 className="text-sm font-bold text-white">Live Preview</h4>
          </div>
          <div className="relative w-full rounded-xl overflow-hidden border border-dark-border bg-dark-bg">
            <img
              key={previewKey}
              src={imageUrl.trim()}
              alt="Welcome popup preview"
              className="w-full h-auto max-h-64 object-contain"
              onError={() => setImgError(true)}
            />
          </div>
          {imgError && (
            <p className="text-xs text-neon-red flex items-center gap-1.5">
              <Image size={12} /> Could not load this image. Check the URL is a direct image link.
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-neon-gold text-dark-bg font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-gold/90 disabled:opacity-50 neon-gold-glow flex items-center justify-center gap-2"
      >
        {saving ? 'Saving...' : saveError ? (
          <><AlertCircle size={18} strokeWidth={2.5} /> Save failed</>
        ) : saved ? (
          <><Check size={18} strokeWidth={2.5} /> Saved successfully!</>
        ) : (
          <><Settings size={18} strokeWidth={2.5} /> Save Settings</>
        )}
      </button>

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
