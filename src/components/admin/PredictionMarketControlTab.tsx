import { useState, useEffect } from 'react';
import { BarChart3, Plus, Trash2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import {
  subscribeMarkets,
  createPredictionMarket,
  deletePredictionMarket,
  resolvePredictionMarket,
  type PredictionMarket,
} from '@/lib/predictionMarket';

const CATEGORIES = ['Crypto', 'Sports', 'Politics', 'Entertainment', 'Finance', 'Tech', 'Other'];

export default function PredictionMarketControlTab() {
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Crypto');
  const [yesLabel, setYesLabel] = useState('Yes');
  const [noLabel, setNoLabel] = useState('No');
  const [oddsYes, setOddsYes] = useState('50');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const unsub = subscribeMarkets((list) => {
      setMarkets(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setTitle('');
    setCategory('Crypto');
    setYesLabel('Yes');
    setNoLabel('No');
    setOddsYes('50');
    setEndDate('');
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!title.trim() || !endDate.trim()) {
      setActionMsg({ kind: 'error', text: 'Title and end date are required' });
      setTimeout(() => setActionMsg(null), 3000);
      return;
    }
    const yesPct = Math.max(1, Math.min(99, parseFloat(oddsYes) || 50)) / 100;
    setSaving(true);
    try {
      await createPredictionMarket({
        title: title.trim(),
        category,
        option_yes_label: yesLabel.trim() || 'Yes',
        option_no_label: noLabel.trim() || 'No',
        odds_yes: yesPct,
        end_date: new Date(endDate).toISOString(),
      });
      setActionMsg({ kind: 'success', text: 'Prediction market created!' });
      setTimeout(() => setActionMsg(null), 2500);
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create market';
      setActionMsg({ kind: 'error', text: msg });
      setTimeout(() => setActionMsg(null), 4000);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePredictionMarket(id);
      setActionMsg({ kind: 'success', text: 'Market deleted' });
      setTimeout(() => setActionMsg(null), 2500);
    } catch {
      setActionMsg({ kind: 'error', text: 'Failed to delete' });
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const handleResolve = async (id: string, resolution: 'yes' | 'no') => {
    try {
      await resolvePredictionMarket(id, resolution);
      setActionMsg({ kind: 'success', text: `Resolved as ${resolution === 'yes' ? 'Yes' : 'No'}` });
      setTimeout(() => setActionMsg(null), 2500);
    } catch {
      setActionMsg({ kind: 'error', text: 'Failed to resolve' });
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  if (loading) return <p className="text-center text-sm text-gray-500 py-8">Loading prediction markets...</p>;

  return (
    <div className="space-y-4">
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={18} className="text-neon-blue" />
          <h3 className="font-display text-base font-bold text-white">Prediction Market Control</h3>
        </div>
        <p className="text-xs text-gray-500">
          Create, resolve, and delete prediction market events. Events appear live on the homepage for all users.
        </p>
      </div>

      {/* Action message */}
      {actionMsg && (
        <div className={`rounded-xl px-3 py-2.5 text-xs font-semibold flex items-center gap-2 ${
          actionMsg.kind === 'success' ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'
        }`}>
          {actionMsg.kind === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {actionMsg.text}
        </div>
      )}

      {/* Add new market */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-neon-blue/10 border border-neon-blue/30 text-neon-blue font-bold py-3 rounded-xl active:scale-95 hover:bg-neon-blue/20 transition-all flex items-center justify-center gap-2"
        >
          <Plus size={18} strokeWidth={2.5} />
          Add New Prediction
        </button>
      ) : (
        <div className="bg-dark-card rounded-xl border border-neon-blue/30 p-4 space-y-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus size={16} className="text-neon-blue" />
            New Prediction Market
          </h4>

          {/* Title */}
          <div>
            <label className="text-xs text-gray-500 font-semibold">Title / Question</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Will BTC hit $100k by December?"
              className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-blue/40 mt-1"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-gray-500 font-semibold">Category</label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`text-[11px] font-bold px-2.5 py-1.5 rounded-md transition-all ${
                    category === c
                      ? 'bg-neon-blue text-dark-bg'
                      : 'bg-dark-card2 border border-dark-border text-gray-400'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Outcome labels */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 font-semibold">Yes Label</label>
              <input
                value={yesLabel}
                onChange={(e) => setYesLabel(e.target.value)}
                className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40 mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-semibold">No Label</label>
              <input
                value={noLabel}
                onChange={(e) => setNoLabel(e.target.value)}
                className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-red/40 mt-1"
              />
            </div>
          </div>

          {/* Odds */}
          <div>
            <label className="text-xs text-gray-500 font-semibold">
              Yes Probability: <span className="text-neon-green font-bold">{oddsYes}%</span>
              <span className="text-neon-red font-bold ml-2">No: {100 - (parseInt(oddsYes) || 50)}%</span>
            </label>
            <input
              type="range"
              min="1"
              max="99"
              value={oddsYes}
              onChange={(e) => setOddsYes(e.target.value)}
              className="w-full accent-neon-blue mt-2"
            />
          </div>

          {/* End date */}
          <div>
            <label className="text-xs text-gray-500 font-semibold">End Date & Time</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-blue/40 mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 bg-neon-blue text-dark-bg font-bold py-2.5 rounded-lg active:scale-95 hover:bg-neon-blue/90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Creating...' : 'Create Market'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 bg-dark-card2 border border-dark-border text-gray-400 font-bold py-2.5 rounded-lg active:scale-95 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing markets */}
      <div className="space-y-2">
        {markets.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 size={36} className="text-gray-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-semibold">No prediction markets yet</p>
          </div>
        ) : (
          markets.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl border p-3 ${
                m.status === 'active' ? 'border-dark-border bg-dark-card' : 'border-dark-border/50 bg-dark-card2 opacity-70'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-neon-blue bg-neon-blue/10 px-1.5 py-0.5 rounded-full">
                    {m.category}
                  </span>
                  <p className="text-sm font-bold text-white mt-1.5 leading-snug">{m.title}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-gray-500" />
                      <span className="text-[10px] text-gray-500 font-semibold">{fmtDate(m.end_date)}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      m.status === 'active'
                        ? 'bg-neon-green/10 text-neon-green'
                        : m.status === 'resolved'
                        ? 'bg-neon-gold/10 text-neon-gold'
                        : 'bg-gray-500/10 text-gray-500'
                    }`}>
                      {m.status.toUpperCase()}
                    </span>
                  </div>
                  {/* Odds display */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] font-bold text-neon-green">{m.option_yes_label} {Math.round(m.odds_yes * 100)}%</span>
                    <span className="text-[10px] font-bold text-neon-red">{m.option_no_label} {Math.round(m.odds_no * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 mt-2.5">
                {m.status === 'active' && (
                  <>
                    <button
                      onClick={() => handleResolve(m.id, 'yes')}
                      className="flex-1 bg-neon-green/10 text-neon-green font-bold text-[11px] py-1.5 rounded-lg active:scale-95 hover:bg-neon-green/20 transition-all flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={13} />
                      Resolve Yes
                    </button>
                    <button
                      onClick={() => handleResolve(m.id, 'no')}
                      className="flex-1 bg-neon-red/10 text-neon-red font-bold text-[11px] py-1.5 rounded-lg active:scale-95 hover:bg-neon-red/20 transition-all flex items-center justify-center gap-1"
                    >
                      <XCircle size={13} />
                      Resolve No
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(m.id)}
                  className="px-3 bg-dark-card2 border border-dark-border text-gray-500 font-bold text-[11px] py-1.5 rounded-lg active:scale-95 hover:text-neon-red hover:border-neon-red/30 transition-all flex items-center justify-center gap-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
