import { useEffect } from 'react';
import { Bell, Trophy, CheckCircle2, ArrowDownCircle, ArrowUpCircle, Headphones } from 'lucide-react';
import ModalShell from '@/components/ModalShell';
import { useNotifications } from '@/context/NotificationContext';
import type { AppNotification } from '@/context/NotificationContext';

const ICON_MAP: Record<AppNotification['type'], { icon: typeof Bell; color: string; bg: string }> = {
  deposit: { icon: ArrowDownCircle, color: 'text-neon-green', bg: 'bg-neon-green/10' },
  withdraw: { icon: ArrowUpCircle, color: 'text-neon-gold', bg: 'bg-neon-gold/10' },
  admin: { icon: Bell, color: 'text-neon-blue', bg: 'bg-neon-blue/10' },
  support: { icon: Headphones, color: 'text-neon-green', bg: 'bg-neon-green/10' },
  prediction: { icon: Trophy, color: 'text-neon-gold', bg: 'bg-neon-gold/10' },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { notifications, markAllRead, refresh } = useNotifications();

  // Mark all as read when the modal opens
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Notifications"
      icon={<Bell size={20} className="text-neon-gold" />}
    >
      {notifications.length === 0 ? (
        <div className="text-center py-10">
          <Bell size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-semibold">No notifications yet</p>
          <p className="text-xs text-gray-600 mt-1">Your deposit, withdrawal, and support updates will appear here.</p>
        </div>
      ) : (
        <>
          {notifications.some((n) => !n.read) && (
            <button
              onClick={markAllRead}
              className="w-full text-xs text-neon-blue font-semibold py-2 mb-2 hover:text-neon-blue/80 transition-colors flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={14} /> Mark all as read
            </button>
          )}
          <div className="space-y-2">
            {notifications.map((n) => {
              const cfg = ICON_MAP[n.type] || ICON_MAP.admin;
              const Icon = cfg.icon;
              return (
                <div
                  key={n.id}
                  className={`bg-dark-card2 rounded-xl border p-3 flex items-start gap-3 transition-all ${
                    n.read ? 'border-dark-border' : 'border-neon-blue/30 bg-neon-blue/5'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={18} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{n.title}</p>
                      <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{n.body}</p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-neon-blue shrink-0 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </ModalShell>
  );
}
