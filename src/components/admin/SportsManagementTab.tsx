import { useState } from 'react';
import { db, ref, get, set, update, push, remove } from '@/lib/firebase';
import { Trophy, Plus, Trash2, Check, X, Calendar, Clock, TrendingUp, Save, Loader2 } from 'lucide-react';
import { useSportsMatches, type SportsMatch, type SportCategory, type MatchStatus, type MatchResult } from '@/hooks/useSportsMatches';
import { teamLogos } from '@/data/teamLogos';

const SPORT_COLORS: Record<SportCategory, string> = {
  football: '#00ff88',
  cricket: '#ff9500',
};

const STATUS_STYLES: Record<MatchStatus, string> = {
  upcoming: 'bg-neon-blue/20 text-neon-blue',
  live: 'bg-neon-red/20 text-neon-red',
  finished: 'bg-gray-600/30 text-gray-400',
};

const RESULT_LABELS: Record<MatchResult, string> = {
  pending: 'Pending',
  home: 'Home Win',
  draw: 'Draw',
  away: 'Away Win',
};

const RESULT_STYLES: Record<MatchResult, string> = {
  pending: 'bg-gray-600/30 text-gray-400',
  home: 'bg-neon-green/15 text-neon-green',
  draw: 'bg-neon-gold/15 text-neon-gold',
  away: 'bg-neon-blue/15 text-neon-blue',
};

export default function SportsManagementTab() {
  const { matches, loading } = useSportsMatches();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingOddsId, setEditingOddsId] = useState<string | null>(null);
  const [oddsDraft, setOddsDraft] = useState({ home: '', draw: '', away: '' });
  const [savingOdds, setSavingOdds] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<SportCategory | 'all'>('all');

  // Add form state
  const [form, setForm] = useState({
    league: '',
    homeTeam: '',
    awayTeam: '',
    category: 'football' as SportCategory,
    matchDate: '',
    matchTime: '',
    homeOdds: '2.00',
    drawOdds: '3.00',
    awayOdds: '2.50',
    format: '',
    venue: '',
  });

  const handleAddMatch = async () => {
    if (!form.homeTeam.trim() || !form.awayTeam.trim() || !form.matchDate || !form.matchTime) return;
    const newRef = push(ref(db, 'sports_matches'));
    await set(newRef, {
      league: form.league.trim() || 'Friendly',
      homeTeam: form.homeTeam.trim(),
      awayTeam: form.awayTeam.trim(),
      category: form.category,
      homeOdds: parseFloat(form.homeOdds) || 2,
      drawOdds: parseFloat(form.drawOdds) || 3,
      awayOdds: parseFloat(form.awayOdds) || 2,
      matchDate: form.matchDate,
      matchTime: form.matchTime,
      status: 'upcoming',
      result: 'pending',
      format: form.format.trim() || '',
      venue: form.venue.trim() || '',
      createdAt: Date.now(),
    });
    setForm({
      league: '',
      homeTeam: '',
      awayTeam: '',
      category: 'football',
      matchDate: '',
      matchTime: '',
      homeOdds: '2.00',
      drawOdds: '3.00',
      awayOdds: '2.50',
      format: '',
      venue: '',
    });
    setShowAddForm(false);
  };

  const handleDeleteMatch = async (id: string) => {
    await remove(ref(db, `sports_matches/${id}`));
  };

  const handleSetStatus = async (match: SportsMatch, status: MatchStatus) => {
    await update(ref(db, `sports_matches/${match.id}`), { status });
  };

  const handleSetResult = async (match: SportsMatch, result: MatchResult) => {
    if (result === 'pending') {
      await update(ref(db, `sports_matches/${match.id}`), {
        result,
        status: 'upcoming',
      });
      return;
    }

    setSettlingId(match.id);

    await update(ref(db, `sports_matches/${match.id}`), {
      result,
      status: 'finished',
    });

    // Fetch all predictions for this match
    const predSnap = await get(ref(db, 'sports_predictions'));
    const settlePromises: Promise<void>[] = [];

    if (predSnap.exists()) {
      const allPreds = predSnap.val();
      for (const predId in allPreds) {
        const predData = allPreds[predId];
        if (predData.matchId !== match.id) continue;
        const won = predData.selection === result;
        const payout = won ? predData.amount * predData.odds : 0;

        settlePromises.push(
          (async () => {
            await update(ref(db, `sports_predictions/${predId}`), {
              status: won ? 'won' : 'lost',
              payout,
            });

            if (won) {
              const userSnap = await get(ref(db, `users/${predData.userId}`));
              if (userSnap.exists()) {
                const currentBalance = userSnap.val().balance || 0;
                await update(ref(db, `users/${predData.userId}`), { balance: currentBalance + payout });
              }
            }
          })(),
        );
      }
    }

    await Promise.all(settlePromises);
    setSettlingId(null);
  };

  const startEditOdds = (match: SportsMatch) => {
    setEditingOddsId(match.id);
    setOddsDraft({
      home: match.homeOdds.toString(),
      draw: match.drawOdds.toString(),
      away: match.awayOdds.toString(),
    });
  };

  const saveOdds = async (id: string) => {
    setSavingOdds(true);
    await update(ref(db, `sports_matches/${id}`), {
      homeOdds: parseFloat(oddsDraft.home) || 2,
      drawOdds: parseFloat(oddsDraft.draw) || 3,
      awayOdds: parseFloat(oddsDraft.away) || 2,
    });
    setSavingOdds(false);
    setEditingOddsId(null);
  };

  const filtered = filter === 'all' ? matches : matches.filter((m) => m.category === filter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Trophy size={18} className="text-neon-gold" />
          <h3 className="font-display text-base font-bold text-white">Sports Prediction Management</h3>
        </div>
        <p className="text-xs text-gray-500">
          Add and remove matches, set results to settle bets, and control odds in real time.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total</p>
          <p className="font-display text-lg font-bold text-white">{matches.length}</p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Live</p>
          <p className="font-display text-lg font-bold text-neon-red">
            {matches.filter((m) => m.status === 'live').length}
          </p>
        </div>
        <div className="bg-dark-card rounded-lg border border-dark-border p-2.5 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Settled</p>
          <p className="font-display text-lg font-bold text-neon-green">
            {matches.filter((m) => m.result !== 'pending').length}
          </p>
        </div>
      </div>

      {/* Add Match button + filter */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex-1 bg-neon-green text-dark-bg font-bold text-sm py-2.5 rounded-xl active:scale-95 flex items-center justify-center gap-1.5"
        >
          {showAddForm ? <X size={16} /> : <Plus size={16} />}
          {showAddForm ? 'Cancel' : 'Add Match'}
        </button>
        <div className="flex gap-1">
          {(['all', 'football', 'cricket'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold capitalize transition-all ${
                filter === f
                  ? 'bg-dark-card2 text-white border border-dark-border'
                  : 'bg-dark-card text-gray-500 border border-transparent'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Add Match Form */}
      {showAddForm && (
        <div className="bg-dark-card rounded-xl border border-dark-border p-4 space-y-3 animate-scale-in">
          <h4 className="text-sm font-bold text-white">New Match</h4>

          {/* Category toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(['football', 'cricket'] as SportCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setForm((p) => ({ ...p, category: cat }))}
                className={`text-sm font-bold py-2.5 rounded-lg capitalize transition-all ${
                  form.category === cat
                    ? 'text-dark-bg'
                    : 'bg-dark-card2 text-gray-400 border border-dark-border'
                }`}
                style={form.category === cat ? { backgroundColor: SPORT_COLORS[cat] } : {}}
              >
                {cat}
              </button>
            ))}
          </div>

          <input
            value={form.league}
            onChange={(e) => setForm((p) => ({ ...p, league: e.target.value }))}
            placeholder="League (e.g. Premier League)"
            className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.homeTeam}
              onChange={(e) => setForm((p) => ({ ...p, homeTeam: e.target.value }))}
              placeholder="Home team"
              className="bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40"
            />
            <input
              value={form.awayTeam}
              onChange={(e) => setForm((p) => ({ ...p, awayTeam: e.target.value }))}
              placeholder="Away team"
              className="bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 font-semibold">Date</label>
              <input
                type="date"
                value={form.matchDate}
                onChange={(e) => setForm((p) => ({ ...p, matchDate: e.target.value }))}
                className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-semibold">Time</label>
              <input
                type="time"
                value={form.matchTime}
                onChange={(e) => setForm((p) => ({ ...p, matchTime: e.target.value }))}
                className="w-full bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40"
              />
            </div>
          </div>

          {form.category === 'cricket' && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.format}
                onChange={(e) => setForm((p) => ({ ...p, format: e.target.value }))}
                placeholder="Format (ODI, T20, Test)"
                className="bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40"
              />
              <input
                value={form.venue}
                onChange={(e) => setForm((p) => ({ ...p, venue: e.target.value }))}
                placeholder="Venue"
                className="bg-dark-card2 border border-dark-border rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-neon-green/40"
              />
            </div>
          )}

          {/* Odds inputs */}
          <div>
            <label className="text-[10px] text-gray-500 font-semibold flex items-center gap-1 mb-1">
              <TrendingUp size={11} /> Betting Odds
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-dark-card2 border border-dark-border rounded-lg px-2 py-2 flex items-center">
                <span className="text-[10px] text-gray-500 mr-1">H</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.homeOdds}
                  onChange={(e) => setForm((p) => ({ ...p, homeOdds: e.target.value }))}
                  className="bg-transparent text-white text-sm w-full outline-none"
                />
              </div>
              <div className="bg-dark-card2 border border-dark-border rounded-lg px-2 py-2 flex items-center">
                <span className="text-[10px] text-gray-500 mr-1">D</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.drawOdds}
                  onChange={(e) => setForm((p) => ({ ...p, drawOdds: e.target.value }))}
                  className="bg-transparent text-white text-sm w-full outline-none"
                />
              </div>
              <div className="bg-dark-card2 border border-dark-border rounded-lg px-2 py-2 flex items-center">
                <span className="text-[10px] text-gray-500 mr-1">A</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.awayOdds}
                  onChange={(e) => setForm((p) => ({ ...p, awayOdds: e.target.value }))}
                  className="bg-transparent text-white text-sm w-full outline-none"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleAddMatch}
            disabled={!form.homeTeam.trim() || !form.awayTeam.trim() || !form.matchDate || !form.matchTime}
            className="w-full bg-neon-green text-dark-bg font-bold py-2.5 rounded-xl active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Plus size={16} /> Create Match
          </button>
        </div>
      )}

      {/* Match List */}
      {loading ? (
        <p className="text-center text-sm text-gray-500 py-8">Loading matches...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-8">No matches found</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((match) => {
            const sportColor = SPORT_COLORS[match.category];
            const isEditing = editingOddsId === match.id;
            return (
              <div key={match.id} className="bg-dark-card rounded-xl border border-dark-border p-3 space-y-2.5">
                {/* Header row */}
                <div className="flex items-start gap-2.5">
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(() => {
                      const homeLogo = teamLogos[match.homeTeam];
                      const awayLogo = teamLogos[match.awayTeam];
                      if (homeLogo || awayLogo) {
                        return (
                          <div className="flex items-center gap-0.5">
                            {homeLogo ? (
                              <img src={homeLogo} alt={match.homeTeam} className="w-7 h-7 rounded-full object-contain bg-white/90" loading="lazy" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-dark-card2 flex items-center justify-center text-[8px] font-bold text-gray-400">{match.homeTeam.slice(0, 2).toUpperCase()}</div>
                            )}
                            {awayLogo ? (
                              <img src={awayLogo} alt={match.awayTeam} className="w-7 h-7 rounded-full object-contain bg-white/90" loading="lazy" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-dark-card2 flex items-center justify-center text-[8px] font-bold text-gray-400">{match.awayTeam.slice(0, 2).toUpperCase()}</div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-dark-bg"
                          style={{ backgroundColor: sportColor }}
                        >
                          {match.category === 'football' ? '⚽' : '🏏'}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {match.homeTeam} vs {match.awayTeam}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {match.league}
                      {match.format ? ` · ${match.format}` : ''}
                      {match.venue ? ` · ${match.venue}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[match.status]}`}>
                        {match.status}
                      </span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${RESULT_STYLES[match.result]}`}>
                        {RESULT_LABELS[match.result]}
                      </span>
                      <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                        <Calendar size={9} /> {match.matchDate}
                      </span>
                      <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                        <Clock size={9} /> {match.matchTime}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMatch(match.id)}
                    className="shrink-0 w-8 h-8 rounded-lg bg-neon-red/10 text-neon-red flex items-center justify-center hover:bg-neon-red/20 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Odds section */}
                <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5">
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp size={12} className="text-neon-gold" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Odds</span>
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <div className="flex items-center bg-dark-card border border-dark-border rounded px-2 py-1.5">
                          <span className="text-[9px] text-gray-500 mr-1">H</span>
                          <input
                            type="number"
                            step="0.01"
                            value={oddsDraft.home}
                            onChange={(e) => setOddsDraft((p) => ({ ...p, home: e.target.value }))}
                            className="bg-transparent text-white text-xs w-full outline-none"
                          />
                        </div>
                        <div className="flex items-center bg-dark-card border border-dark-border rounded px-2 py-1.5">
                          <span className="text-[9px] text-gray-500 mr-1">D</span>
                          <input
                            type="number"
                            step="0.01"
                            value={oddsDraft.draw}
                            onChange={(e) => setOddsDraft((p) => ({ ...p, draw: e.target.value }))}
                            className="bg-transparent text-white text-xs w-full outline-none"
                          />
                        </div>
                        <div className="flex items-center bg-dark-card border border-dark-border rounded px-2 py-1.5">
                          <span className="text-[9px] text-gray-500 mr-1">A</span>
                          <input
                            type="number"
                            step="0.01"
                            value={oddsDraft.away}
                            onChange={(e) => setOddsDraft((p) => ({ ...p, away: e.target.value }))}
                            className="bg-transparent text-white text-xs w-full outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveOdds(match.id)}
                          disabled={savingOdds}
                          className="flex-1 bg-neon-green text-dark-bg font-bold text-[10px] py-1.5 rounded-md flex items-center justify-center gap-1"
                        >
                          <Save size={11} /> Save
                        </button>
                        <button
                          onClick={() => setEditingOddsId(null)}
                          className="flex-1 bg-dark-card text-gray-400 font-semibold text-[10px] py-1.5 rounded-md"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="grid grid-cols-3 gap-1.5 flex-1">
                        <div className="text-center">
                          <p className="text-[9px] text-gray-500">Home</p>
                          <p className="text-xs font-bold text-neon-green">{match.homeOdds.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-gray-500">Draw</p>
                          <p className="text-xs font-bold text-neon-gold">{match.drawOdds.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-gray-500">Away</p>
                          <p className="text-xs font-bold text-neon-blue">{match.awayOdds.toFixed(2)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => startEditOdds(match)}
                        className="shrink-0 ml-2 text-[10px] font-bold text-gray-400 bg-dark-card border border-dark-border px-2.5 py-1.5 rounded-md hover:text-white transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Status controls */}
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">Match Status</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['upcoming', 'live', 'finished'] as MatchStatus[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSetStatus(match, s)}
                        disabled={settlingId === match.id}
                        className={`text-[10px] font-bold py-1.5 rounded-md capitalize transition-all ${
                          match.status === s
                            ? STATUS_STYLES[s] + ' border border-current'
                            : 'bg-dark-card2 text-gray-500 border border-dark-border'
                        } ${settlingId === match.id ? 'opacity-50' : ''}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Result controls */}
                <div>
                  <p className="text-[10px] text-gray-500 font-semibold mb-1">Declare Result</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['pending', 'home', 'draw', 'away'] as MatchResult[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => handleSetResult(match, r)}
                        disabled={settlingId === match.id}
                        className={`text-[10px] font-bold py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
                          match.result === r
                            ? RESULT_STYLES[r] + ' border border-current'
                            : 'bg-dark-card2 text-gray-500 border border-dark-border'
                        } ${settlingId === match.id ? 'opacity-50' : ''}`}
                      >
                        {settlingId === match.id && match.result !== r ? null : null}
                        {r === 'pending' ? 'Reset' : r === 'home' ? 'Home' : r === 'draw' ? 'Draw' : 'Away'}
                      </button>
                    ))}
                  </div>
                  {settlingId === match.id && (
                    <p className="text-[10px] text-neon-gold flex items-center gap-1 mt-1.5 animate-pulse">
                      <Loader2 size={10} className="animate-spin" />
                      Settling predictions & crediting winners...
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
