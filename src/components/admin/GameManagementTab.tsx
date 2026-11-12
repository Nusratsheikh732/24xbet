import { useState, useEffect } from 'react';
import { db, ref, get, set, onValue } from '@/lib/firebase';
import {
  Gamepad2,
  ToggleLeft,
  ToggleRight,
  Settings,
  Check,
  BarChart3,
  TrendingUp,
  Trophy,
  Calendar,
  X,
  AlertCircle,
} from 'lucide-react';

interface GameConfig {
  id: string;
  name: string;
  bnName: string;
  category: string;
  bnCategory: string;
  provider: string;
  rtp: number;
  active: boolean;
  minBet: number;
  maxBet: number;
  maxWinCap: number;
}

const DEFAULT_GAMES: GameConfig[] = [
  {
    id: 'online_slots',
    name: 'Online Slots',
    bnName: 'অনলাইন স্লট গেমস',
    category: 'Slots',
    bnCategory: 'স্লট',
    provider: 'In-house',
    rtp: 96.0,
    active: true,
    minBet: 0.5,
    maxBet: 5000,
    maxWinCap: 500000,
  },
];

const GAME_ICONS: Record<string, typeof Gamepad2> = {
  online_slots: Gamepad2,
};

const GAME_COLORS: Record<string, string> = {
  online_slots: '#ffd700',
};

interface GameStats {
  totalRounds: number;
  totalBet: number;
  totalWin: number;
  ggr: number;
}

interface ReportData {
  [gameId: string]: GameStats;
}

export default function GameManagementTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [games, setGames] = useState<GameConfig[]>(DEFAULT_GAMES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<GameConfig | null>(null);
  const [reportRange, setReportRange] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [reports, setReports] = useState<ReportData>({});
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'game_settings/game_management'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          const configs = data.configs as Record<string, Partial<GameConfig>> | undefined;
          if (configs) {
            setGames((prev) =>
              prev.map((g) => ({
                ...g,
                ...(configs[g.id] || {}),
              }))
            );
          }
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleToggleActive = async (gameId: string) => {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    const updated = { ...game, active: !game.active };
    setGames((prev) => prev.map((g) => (g.id === gameId ? updated : g)));
    await persistConfigs(games.map((g) => (g.id === gameId ? updated : g)));
  };

  const persistConfigs = async (configs: GameConfig[]) => {
    const map: Record<string, Partial<GameConfig>> = {};
    configs.forEach((g) => {
      map[g.id] = {
        active: g.active,
        minBet: g.minBet,
        maxBet: g.maxBet,
        maxWinCap: g.maxWinCap,
      };
    });
    setSaveError(false);
    try {
      await set(ref(db, 'game_settings/game_management'), {
        configs: map,
        updatedAt: Date.now(),
      });
    } catch {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
  };

  const handleSaveSettings = async () => {
    if (!editConfig) return;
    setSaving(true);
    const updatedGames = games.map((g) => (g.id === editConfig.id ? editConfig : g));
    setGames(updatedGames);
    await persistConfigs(updatedGames);
    setSaving(false);
    setSaved(true);
    setEditingId(null);
    setEditConfig(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const snap = await get(ref(db, 'game_settings/game_reports'));
      const data: ReportData = {};
      if (snap.exists()) {
        const raw = snap.val() as Record<string, unknown>;
        const now = Date.now();
        const rangeMs: Record<typeof reportRange, number> = {
          today: 24 * 60 * 60 * 1000,
          week: 7 * 24 * 60 * 60 * 1000,
          month: 30 * 24 * 60 * 60 * 1000,
          all: Infinity,
        };
        const cutoff = now - rangeMs[reportRange];

        DEFAULT_GAMES.forEach((g) => {
          const gameData = raw[g.id] as { rounds?: { ts: number; bet: number; win: number }[] } | undefined;
          if (gameData?.rounds) {
            const filtered = gameData.rounds.filter((r) => r.ts >= cutoff);
            const totalBet = filtered.reduce((s, r) => s + r.bet, 0);
            const totalWin = filtered.reduce((s, r) => s + r.win, 0);
            data[g.id] = {
              totalRounds: filtered.length,
              totalBet,
              totalWin,
              ggr: totalBet - totalWin,
            };
          } else {
            data[g.id] = { totalRounds: 0, totalBet: 0, totalWin: 0, ggr: 0 };
          }
        });
      } else {
        DEFAULT_GAMES.forEach((g) => {
          data[g.id] = { totalRounds: 0, totalBet: 0, totalWin: 0, ggr: 0 };
        });
      }
      setReports(data);
    } catch {
      const data: ReportData = {};
      DEFAULT_GAMES.forEach((g) => {
        data[g.id] = { totalRounds: 0, totalBet: 0, totalWin: 0, ggr: 0 };
      });
      setReports(data);
    }
    setReportsLoading(false);
  };

  useEffect(() => {
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportRange]);

  if (loading) {
    return <p className="text-center text-sm text-gray-500 py-8">Loading game management settings...</p>;
  }

  const activeCount = games.filter((g) => g.active).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-2">
          <Gamepad2 size={18} className="text-neon-green" />
          <h3 className="font-display text-base font-bold text-white">Game Management / গেম ম্যানেজমেন্ট</h3>
        </div>
        <p className="text-xs text-gray-500">
          Activate, deactivate, and configure game limits for all casino games. Changes take effect instantly across the platform.
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Total Games / মোট গেম</p>
            <p className="font-display text-lg font-bold text-white">{games.length}</p>
          </div>
          <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Active / সক্রিয়</p>
            <p className="font-display text-lg font-bold text-neon-green">{activeCount}</p>
          </div>
        </div>
      </div>

      {/* Game Cards */}
      {games.map((game) => {
        const Icon = GAME_ICONS[game.id] || Gamepad2;
        const color = GAME_COLORS[game.id] || '#00ff88';
        const isEditing = editingId === game.id;
        const stats = reports[game.id];

        return (
          <div
            key={game.id}
            className="bg-dark-card rounded-xl border border-dark-border overflow-hidden"
            style={game.active ? { borderColor: `${color}30` } : {}}
          >
            {/* Game header row */}
            <div className="p-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white truncate">{game.name}</p>
                  <span className="text-[10px] text-gray-500 font-semibold">({game.bnName})</span>
                </div>
                <p className="text-[10px] text-gray-500">
                  ID: {game.id} · {game.category} ({game.bnCategory}) · RTP {game.rtp}%
                </p>
              </div>
              <button
                onClick={() => handleToggleActive(game.id)}
                className="shrink-0 transition-transform active:scale-90"
                title={game.active ? 'Deactivate' : 'Activate'}
              >
                {game.active ? (
                  <ToggleRight size={32} className="text-neon-green" />
                ) : (
                  <ToggleLeft size={32} className="text-gray-600" />
                )}
              </button>
            </div>

            {/* Status badge */}
            <div className="px-3 pb-2">
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  game.active
                    ? 'bg-neon-green/15 text-neon-green'
                    : 'bg-neon-red/15 text-neon-red'
                }`}
              >
                {game.active ? 'ACTIVE / সক্রিয়' : 'INACTIVE / নিষ্ক্রিয়'}
              </span>
            </div>

            {/* Game details table */}
            <div className="px-3 pb-3">
              <div className="bg-dark-card2 rounded-lg border border-dark-border overflow-hidden">
                <table className="w-full text-[10px]">
                  <tbody>
                    <tr className="border-b border-dark-border/50">
                      <td className="px-2.5 py-1.5 text-gray-500 font-semibold">Game ID</td>
                      <td className="px-2.5 py-1.5 text-gray-300 font-mono">{game.id}</td>
                    </tr>
                    <tr className="border-b border-dark-border/50">
                      <td className="px-2.5 py-1.5 text-gray-500 font-semibold">Name / নাম</td>
                      <td className="px-2.5 py-1.5 text-gray-300">{game.name} ({game.bnName})</td>
                    </tr>
                    <tr className="border-b border-dark-border/50">
                      <td className="px-2.5 py-1.5 text-gray-500 font-semibold">Category / ক্যাটাগরি</td>
                      <td className="px-2.5 py-1.5 text-gray-300">{game.category} ({game.bnCategory})</td>
                    </tr>
                    <tr className="border-b border-dark-border/50">
                      <td className="px-2.5 py-1.5 text-gray-500 font-semibold">RTP</td>
                      <td className="px-2.5 py-1.5 text-gray-300">{game.rtp}%</td>
                    </tr>
                    <tr className="border-b border-dark-border/50">
                      <td className="px-2.5 py-1.5 text-gray-500 font-semibold">Provider</td>
                      <td className="px-2.5 py-1.5 text-gray-300">{game.provider}</td>
                    </tr>
                    <tr className="border-b border-dark-border/50">
                      <td className="px-2.5 py-1.5 text-gray-500 font-semibold">Min Bet / ন্যূনতম বাজি</td>
                      <td className="px-2.5 py-1.5 text-neon-gold font-bold">৳{isEditing && editConfig ? editConfig.minBet : game.minBet}</td>
                    </tr>
                    <tr className="border-b border-dark-border/50">
                      <td className="px-2.5 py-1.5 text-gray-500 font-semibold">Max Bet / সর্বোচ্চ বাজি</td>
                      <td className="px-2.5 py-1.5 text-neon-gold font-bold">৳{isEditing && editConfig ? editConfig.maxBet : game.maxBet}</td>
                    </tr>
                    <tr>
                      <td className="px-2.5 py-1.5 text-gray-500 font-semibold">Max Win Cap / সর্বোচ্চ জয়</td>
                      <td className="px-2.5 py-1.5 text-neon-gold font-bold">৳{isEditing && editConfig ? editConfig.maxWinCap : game.maxWinCap}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Settings editor */}
            {isEditing && editConfig && (
              <div className="px-3 pb-3 space-y-2.5 bg-dark-card2/30 p-3 border-t border-dark-border">
                <div className="flex items-center gap-2">
                  <Settings size={14} className="text-neon-gold" />
                  <h4 className="text-xs font-bold text-white">Configure / কনফিগার</h4>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 font-semibold block mb-1">Min Bet</label>
                    <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-2 py-1.5">
                      <span className="text-neon-gold text-[10px] font-bold mr-0.5">৳</span>
                      <input
                        type="number"
                        step="0.5"
                        value={editConfig.minBet}
                        onChange={(e) => setEditConfig({ ...editConfig, minBet: parseFloat(e.target.value) || 0 })}
                        className="bg-transparent text-white text-xs w-full outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-semibold block mb-1">Max Bet</label>
                    <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-2 py-1.5">
                      <span className="text-neon-gold text-[10px] font-bold mr-0.5">৳</span>
                      <input
                        type="number"
                        step="100"
                        value={editConfig.maxBet}
                        onChange={(e) => setEditConfig({ ...editConfig, maxBet: parseFloat(e.target.value) || 0 })}
                        className="bg-transparent text-white text-xs w-full outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-semibold block mb-1">Max Win Cap</label>
                    <div className="flex items-center bg-dark-card2 border border-dark-border rounded-lg px-2 py-1.5">
                      <span className="text-neon-gold text-[10px] font-bold mr-0.5">৳</span>
                      <input
                        type="number"
                        step="10000"
                        value={editConfig.maxWinCap}
                        onChange={(e) => setEditConfig({ ...editConfig, maxWinCap: parseFloat(e.target.value) || 0 })}
                        className="bg-transparent text-white text-xs w-full outline-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="flex-1 bg-neon-green text-dark-bg font-bold text-xs py-2 rounded-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    {saving ? 'Saving...' : <><Check size={13} /> Save</>}
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditConfig(null); }}
                    className="flex-1 bg-dark-card2 text-gray-400 font-semibold text-xs py-2 rounded-lg flex items-center justify-center gap-1"
                  >
                    <X size={13} /> Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!isEditing && (
              <div className="px-3 pb-3 flex gap-2">
                <button
                  onClick={() => { setEditingId(game.id); setEditConfig({ ...game }); }}
                  className="flex-1 bg-dark-card2 text-gray-300 text-xs font-semibold py-2 rounded-lg hover:bg-dark-border transition-colors flex items-center justify-center gap-1.5"
                >
                  <Settings size={13} /> Settings / সেটিংস
                </button>
              </div>
            )}

            {/* Reporting section */}
            <div className="px-3 pb-3">
              <div className="bg-dark-card2 rounded-lg border border-dark-border p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <BarChart3 size={13} className="text-neon-blue" />
                  <h4 className="text-[10px] font-bold text-white uppercase">Reporting / রিপোর্ট</h4>
                </div>
                {reportsLoading ? (
                  <p className="text-[10px] text-gray-600 text-center py-2">Loading...</p>
                ) : stats ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="text-center">
                      <p className="text-[8px] text-gray-500 uppercase">Rounds</p>
                      <p className="text-xs font-bold text-white">{stats.totalRounds}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-gray-500 uppercase">Total Bet</p>
                      <p className="text-xs font-bold text-neon-gold">৳{stats.totalBet.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-gray-500 uppercase">Total Win</p>
                      <p className="text-xs font-bold text-neon-green">৳{stats.totalWin.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] text-gray-500 uppercase">GGR</p>
                      <p className={`text-xs font-bold ${stats.ggr >= 0 ? 'text-neon-gold' : 'text-neon-red'}`}>
                        ৳{stats.ggr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-600 text-center py-2">No data</p>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Global reporting section */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-neon-gold" />
          <h4 className="text-sm font-bold text-white">Analytics / অ্যানালিটিক্স</h4>
        </div>
        <div className="flex items-center gap-1.5 mb-3">
          <Calendar size={13} className="text-gray-500" />
          <div className="flex gap-1 flex-1">
            {([
              { id: 'today' as const, label: 'Today / আজ' },
              { id: 'week' as const, label: 'Week / সপ্তাহ' },
              { id: 'month' as const, label: 'Month / মাস' },
              { id: 'all' as const, label: 'All / সব' },
            ]).map((r) => (
              <button
                key={r.id}
                onClick={() => setReportRange(r.id)}
                className={`flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-colors ${
                  reportRange === r.id
                    ? 'bg-neon-green text-dark-bg'
                    : 'bg-dark-card2 text-gray-400 border border-dark-border'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {reportsLoading ? (
          <p className="text-center text-xs text-gray-500 py-4">Loading analytics...</p>
        ) : (
          <div className="space-y-2">
            {games.map((game) => {
              const stats = reports[game.id];
              if (!stats) return null;
              const color = GAME_COLORS[game.id] || '#00ff88';
              return (
                <div key={game.id} className="flex items-center gap-2 bg-dark-card2 rounded-lg border border-dark-border p-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}18` }}
                  >
                    <TrendingUp size={12} style={{ color }} />
                  </div>
                  <span className="text-[10px] font-bold text-white flex-1">{game.name}</span>
                  <span className="text-[10px] text-gray-500">{stats.totalRounds} rounds</span>
                  <span className={`text-[10px] font-bold ${stats.ggr >= 0 ? 'text-neon-gold' : 'text-neon-red'}`}>
                    GGR ৳{stats.ggr.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save status toast */}
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
