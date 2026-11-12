import { useState, useEffect } from 'react';
import { db, ref, onValue } from '@/lib/firebase';
import { MessageSquare, Lightbulb, User } from 'lucide-react';

interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  type: string;
  text: string;
  createdAt: number;
}

export default function AirdropFeedbackTab() {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'advice' | 'suggestion'>('all');

  useEffect(() => {
    const unsub = onValue(ref(db, 'airdrop_feedback'), (snap) => {
      const items: FeedbackItem[] = [];
      if (snap.exists()) {
        const all = snap.val();
        for (const id in all) {
          const data = all[id];
          items.push({
            id,
            userId: data.userId || '',
            userName: data.userName || '',
            type: data.type || '',
            text: data.text || '',
            createdAt: data.createdAt || 0,
          });
        }
        items.sort((a, b) => b.createdAt - a.createdAt);
      }
      setFeedback(items);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = filter === 'all' ? feedback : feedback.filter((f) => f.type === filter);

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading feedback...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare size={18} className="text-neon-green" />
          <h3 className="font-display text-base font-bold text-white">Airdrop Feedback</h3>
        </div>
        <p className="text-xs text-gray-500">
          User-submitted advice and suggestions from the Airdrop tasks.
        </p>
      </div>

      <div className="flex gap-2">
        {(['all', 'advice', 'suggestion'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors capitalize ${
              filter === f
                ? 'bg-neon-green text-dark-bg'
                : 'bg-dark-card text-gray-400 border border-dark-border hover:text-white'
            }`}
          >
            {f === 'all' ? 'All' : f === 'advice' ? 'Advice' : 'Suggestions'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">No feedback yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-dark-card2 rounded-xl border border-dark-border p-4">
              <div className="flex items-center gap-2 mb-2">
                {item.type === 'advice' ? (
                  <MessageSquare size={16} className="text-neon-blue shrink-0" />
                ) : (
                  <Lightbulb size={16} className="text-neon-gold shrink-0" />
                )}
                <span className="text-xs font-bold text-white capitalize">{item.type}</span>
                <span className="text-[10px] text-gray-600 ml-auto">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <User size={12} className="text-gray-500" />
                <span className="text-xs text-gray-400 font-semibold">{item.userName || 'Unknown user'}</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{item.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
