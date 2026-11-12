import { useState, useEffect, useCallback } from 'react';
import { Check } from 'lucide-react';
import ModalShell from '@/components/ModalShell';
import { PROFILE_AVATARS } from '@/data/profileAvatars';
import { getTakenAvatars } from '@/lib/avatars';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatar: string;
  onSelect: (avatar: string) => Promise<void> | void;
  excludeUid?: string;
}

export default function AvatarPickerModal({
  isOpen,
  onClose,
  currentAvatar,
  onSelect,
  excludeUid,
}: AvatarPickerModalProps) {
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getTakenAvatars(excludeUid)
      .then(setTaken)
      .catch(() => setTaken(new Set()))
      .finally(() => setLoading(false));
  }, [isOpen, excludeUid]);

  const handleSelect = useCallback(
    async (avatar: string) => {
      if (avatar === currentAvatar || taken.has(avatar) || saving) return;
      setSaving(true);
      try {
        await onSelect(avatar);
        onClose();
      } finally {
        setSaving(false);
      }
    },
    [currentAvatar, taken, saving, onSelect, onClose],
  );

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Choose Avatar">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-neon-gold border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {PROFILE_AVATARS.map((avatar) => {
            const isCurrent = avatar === currentAvatar;
            const isTaken = taken.has(avatar);
            return (
              <button
                key={avatar}
                onClick={() => handleSelect(avatar)}
                disabled={isTaken || saving}
                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all active:scale-95 ${
                  isCurrent
                    ? 'border-neon-green ring-2 ring-neon-green/40'
                    : isTaken
                      ? 'border-dark-border opacity-40 cursor-not-allowed'
                      : 'border-dark-border hover:border-neon-gold/50'
                }`}
              >
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                {isCurrent && (
                  <div className="absolute inset-0 bg-neon-green/20 flex items-center justify-center">
                    <div className="w-6 h-6 bg-neon-green rounded-full flex items-center justify-center">
                      <Check size={14} className="text-dark-bg" strokeWidth={3} />
                    </div>
                  </div>
                )}
                {isTaken && !isCurrent && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-gray-400 uppercase">Taken</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      {saving && (
        <p className="text-center text-xs text-neon-gold font-bold mt-3 animate-pulse">Saving...</p>
      )}
    </ModalShell>
  );
}
