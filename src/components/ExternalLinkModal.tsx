import { useState } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';

interface ExternalLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export default function ExternalLinkModal({ isOpen, onClose, url, title, description, icon }: ExternalLinkModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm mx-auto bg-dark-card rounded-t-3xl border-t border-x border-dark-border p-6 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-4">
          {icon && (
            <div className="w-11 h-11 rounded-xl bg-dark-card2 flex items-center justify-center shrink-0 overflow-hidden border border-dark-border">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{description}</p>
          </div>
        </div>

        {/* URL display */}
        <div className="bg-dark-card2 rounded-xl border border-dark-border px-3 py-3 mb-4 flex items-center gap-2">
          <ExternalLink size={14} className="text-neon-blue shrink-0" />
          <p className="text-xs text-gray-300 break-all flex-1 leading-relaxed">{url}</p>
        </div>

        {/* Instructions */}
        <p className="text-xs text-gray-500 text-center mb-4 leading-relaxed">
          Copy the link below and paste it into your browser or the official app to open it.
        </p>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={`w-full flex items-center justify-center gap-2 font-bold py-3.5 rounded-xl transition-all active:scale-95 ${
            copied
              ? 'bg-neon-green text-dark-bg neon-green-glow'
              : 'bg-neon-blue/20 text-neon-blue border border-neon-blue/40 hover:bg-neon-blue/30'
          }`}
        >
          {copied ? (
            <>
              <Check size={18} /> Link Copied!
            </>
          ) : (
            <>
              <Copy size={18} /> Copy Link
            </>
          )}
        </button>
      </div>
    </div>
  );
}
