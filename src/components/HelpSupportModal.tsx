import { HelpCircle, Mail, Clock, Send, AlertCircle, Check, ChevronRight } from 'lucide-react';
import ModalShell from '@/components/ModalShell';
import ExternalLinkModal from '@/components/ExternalLinkModal';
import { useState } from 'react';
import { sendSupportMessage } from '@/lib/supportChat';
import { useAuth } from '@/context/AuthContext';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TELEGRAM_URL = 'https://t.me/Bd_24xbet';
const TELEGRAM_ICON = 'https://i.postimg.cc/Pr3scyhZ/images-(15).jpg';
const GMAIL_ADDRESS = '24xbetbd@gmail.com';
const GMAIL_ICON = 'https://i.postimg.cc/8cXKyyWJ/images-(5).png';

export default function HelpSupportModal({ isOpen, onClose }: HelpSupportModalProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(GMAIL_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = GMAIL_ADDRESS;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(false);
    try {
      await sendSupportMessage({ uid: user?.uid || '', name: user?.name || '', phone: user?.phone || '' }, message.trim());
      setSent(true);
      setMessage('');
      setTimeout(() => setSent(false), 3000);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Help & Support"
      icon={<HelpCircle size={20} className="text-neon-blue" />}
    >
      {/* Contact channels */}
      <div className="space-y-2 mb-4">
        {/* Telegram */}
        <button
          onClick={() => setTelegramModalOpen(true)}
          className="w-full bg-dark-card2 rounded-xl border border-dark-border p-3 flex items-center gap-3 hover:border-neon-blue/40 transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
            <img src={TELEGRAM_ICON} alt="Telegram" className="w-7 h-7 rounded-lg object-cover" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-white">Telegram</p>
            <p className="text-xs text-gray-400">@Bd_24xbet</p>
          </div>
          <ChevronRight size={18} className="text-gray-500 shrink-0" />
        </button>

        {/* Email with copy */}
        <button
          onClick={handleCopyEmail}
          className="w-full bg-dark-card2 rounded-xl border border-dark-border p-3 flex items-center gap-3 hover:border-neon-gold/40 transition-all active:scale-[0.98]"
        >
          <div className="w-10 h-10 rounded-xl bg-dark-card flex items-center justify-center shrink-0 overflow-hidden">
            <img src={GMAIL_ICON} alt="Gmail" className="w-6 h-6 rounded-lg object-cover" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-white">Email</p>
            <p className="text-xs text-gray-400">{GMAIL_ADDRESS}</p>
          </div>
          <div className="shrink-0">
            {copied ? (
              <div className="flex items-center gap-1 text-neon-green">
                <Check size={16} />
                <span className="text-xs font-bold">Copied!</span>
              </div>
            ) : (
              <Mail size={18} className="text-gray-500" />
            )}
          </div>
        </button>
      </div>

      {/* Copy toast */}
      {copied && (
        <div className="mb-3 bg-neon-green/10 border border-neon-green/30 rounded-xl px-3 py-2 flex items-center gap-2 animate-fade-in">
          <Check size={14} className="text-neon-green shrink-0" />
          <p className="text-xs text-neon-green font-semibold">Email copied to clipboard!</p>
        </div>
      )}

      {/* Support hours */}
      <div className="bg-neon-green/5 border border-neon-green/20 rounded-xl p-3 mb-4 flex items-center gap-2">
        <Clock size={16} className="text-neon-green shrink-0" />
        <p className="text-xs text-gray-300">Support team is available 24 hours, 7 days a week.</p>
      </div>

      {/* Send message */}
      <form onSubmit={handleSend}>
        <label className="text-xs text-gray-400 font-semibold block mb-1.5">Send us a message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue..."
          rows={3}
          className="w-full bg-dark-card2 rounded-xl border border-dark-border px-3 py-3 text-sm text-white outline-none resize-none"
        />
        {error && (
          <p className="text-xs text-neon-red flex items-center gap-1.5 mt-2">
            <AlertCircle size={14} /> Failed to send. Please try again.
          </p>
        )}
        <button
          type="submit"
          disabled={!message.trim() || sent || sending}
          className="w-full mt-3 bg-neon-green text-dark-bg font-bold py-3 rounded-xl transition-all active:scale-95 hover:bg-neon-green/90 disabled:opacity-50 neon-green-glow flex items-center justify-center gap-2"
        >
          {sent ? (
            <>
              <HelpCircle size={18} /> Message Sent!
            </>
          ) : sending ? (
            <>Sending...</>
          ) : (
            <>
              <Send size={18} /> Send Message
            </>
          )}
        </button>
      </form>
      <ExternalLinkModal
        isOpen={telegramModalOpen}
        onClose={() => setTelegramModalOpen(false)}
        url={TELEGRAM_URL}
        title="Telegram Support"
        description="Copy the link and open it in the Telegram app or your browser."
        icon={<img src={TELEGRAM_ICON} alt="Telegram" className="w-8 h-8 rounded-lg object-cover" />}
      />
    </ModalShell>
  );
}
