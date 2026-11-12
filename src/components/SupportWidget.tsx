import { useState, useEffect, useRef, useCallback } from 'react';
import { Headphones, X, Send, MessageCircle } from 'lucide-react';
import { db, ref, onValue } from '@/lib/firebase';
import { sendSupportMessage, type SupportMessageRecord } from '@/lib/supportChat';
import { useAuth } from '@/context/AuthContext';

interface ChatMessage {
  id: string;
  sender: 'user' | 'admin';
  text: string;
  createdAt: number;
}

export default function SupportWidget() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [showUnreadPulse, setShowUnreadPulse] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const lastScrollYRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;

  // Scroll behavior: show on page load, hide on scroll down, show on scroll up
  useEffect(() => {
    setVisible(true);
    setShowUnreadPulse(true);

    const handleScroll = () => {
      const currentY = window.scrollY;
      const lastY = lastScrollYRef.current;
      const scrollingDown = currentY > lastY && currentY > 50;

      if (scrollingDown) {
        setVisible(false);
      } else if (currentY < lastY) {
        setVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Listen to chat messages in real time
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onValue(
      ref(db, `support/messages/${user.uid}`),
      (snap) => {
        const raw = (snap.val() || {}) as Record<string, Partial<SupportMessageRecord>>;
        const list: ChatMessage[] = Object.entries(raw)
          .filter(([, m]) => m && typeof m.text === 'string')
          .map(([id, m]): ChatMessage => ({
            id,
            sender: m.sender === 'admin' ? 'admin' : 'user',
            text: m.text as string,
            createdAt: Number(m.createdAt) || 0,
          }))
          .sort((a, b) => a.createdAt - b.createdAt);
        setMessages(list);
        const lastMsg = list[list.length - 1];
        if (lastMsg && lastMsg.sender === 'admin' && !chatOpenRef.current) {
          setShowUnreadPulse(true);
        }
      },
      () => setMessages([]),
    );

    return () => unsubscribe();
  }, [user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  const handleOpenChat = useCallback(() => {
    setChatOpen(true);
    setShowUnreadPulse(false);
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    window.history.pushState({ supportChat: true }, '');
    const handlePopState = () => setChatOpen(false);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      const st = window.history.state as { supportChat?: boolean } | null;
      if (st?.supportChat) window.history.back();
    };
  }, [chatOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user || sending) return;

    setSending(true);
    setInput('');

    try {
      await sendSupportMessage({ uid: user.uid, name: user.name, phone: user.phone }, text);
    } catch {
      // Silently ignore — message still shows in UI via local state
    }

    setSending(false);
  };

  if (!user) return null;

  return (
    <>
      {/* Floating support icon */}
      <button
        onClick={handleOpenChat}
        className={`fixed right-3 z-[10001] transition-all duration-500 ${
          visible
            ? 'opacity-100 translate-y-0 scale-100'
            : 'opacity-0 translate-y-8 scale-75 pointer-events-none'
        }`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
        aria-label="Customer Support"
      >
        <div className="relative">
          {/* Main button */}
          <div className="relative w-[68px] h-[68px] flex items-center justify-center active:scale-90 transition-transform">
            <img src="https://i.postimg.cc/0NZwzgSX/service-7512d9f5.png" alt="Customer Support" className="h-full w-full object-contain" />
          </div>

          {/* Unread pulse badge */}
          {showUnreadPulse && !chatOpen && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-neon-red flex items-center justify-center animate-ping-slow">
              <span className="text-[9px] font-bold text-white">1</span>
            </div>
          )}
        </div>
      </button>

      {/* Chat modal */}
      {chatOpen && (
        <div
          className="fixed inset-0 z-[10002] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
          onClick={() => setChatOpen(false)}
        >
          <div
            className="bg-dark-card w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-dark-border animate-fade-in-up flex flex-col overflow-hidden"
            style={{ maxHeight: '85vh', height: '85vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Chat header */}
            <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-dark-border"
              style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.08), transparent)' }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(145deg, #00ff88, #00cc6a)' }}
                  >
                    <Headphones size={18} className="text-dark-bg" strokeWidth={2.5} />
                  </div>
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-neon-green border-2 border-dark-card" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-white leading-none">24xBet Support</p>
                  <p className="text-[10px] text-neon-green font-semibold mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse-soft" />
                    Online · We typically reply instantly
                  </p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-dark-card2 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(145deg, rgba(0,255,136,0.1), rgba(0,255,136,0.02))' }}
                  >
                    <MessageCircle size={28} className="text-neon-green/60" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Welcome to 24xBet Live Chat</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Have a question? Send us a message and our team will reply right away.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${
                      msg.sender === 'user'
                        ? 'bg-neon-green text-dark-bg rounded-br-md'
                        : 'bg-dark-card2 text-gray-200 border border-dark-border rounded-bl-md'
                    }`}
                  >
                    {msg.sender === 'admin' && (
                      <p className="text-[9px] font-bold text-neon-green mb-0.5 flex items-center gap-1">
                        <Headphones size={10} /> Support
                      </p>
                    )}
                    <p className="text-sm leading-relaxed break-words">{msg.text}</p>
                    <p className={`text-[8px] mt-1 ${msg.sender === 'user' ? 'text-dark-bg/50' : 'text-gray-600'}`}>
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="shrink-0 p-3 border-t border-dark-border bg-dark-card2/50">
              <div className="flex items-end gap-2">
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(145deg, #00ff88, #00cc6a)',
                    boxShadow: '0 4px 12px rgba(0,255,136,0.25)',
                  }}
                >
                  <Send size={18} className="text-dark-bg" strokeWidth={2.5} />
                </button>
                <div className="flex-1 bg-dark-card2 rounded-2xl border border-dark-border flex items-center px-3 py-2.5 focus-within:border-neon-green/30 transition-colors">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Type your message..."
                    className="bg-transparent text-white text-sm w-full outline-none placeholder:text-gray-600"
                    disabled={sending}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
