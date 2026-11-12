import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { db, ref, get, onValue } from "@/lib/firebase";

/* =====================================================================
   SPIN WHEEL
   ফলাফল সম্পূর্ণ random (crypto random), নিচের weight অনুযায়ী।
   ===================================================================== */

/* ---------- CONFIG ---------- */
// weight = সুযোগ (মোট 100)। চাইলে বদলাতে পারবেন।
const SEGMENTS = [
  { label: ["Bad luck"], mult: 0, weight: 15, bg: "#1b1f2e", fg: "#ffffff", blnt: true },
  { label: ["1.5x"], mult: 1.5, weight: 12, bg: "#0c8f3a", fg: "#eafff0" },
  { label: ["0x"], mult: 0, weight: 14, bg: "#7c0d3b", fg: "#ff9bb5" },
  { label: ["2x"], mult: 2, weight: 10, bg: "#0a8650", fg: "#f0fff6" },
  { label: ["0.1x"], mult: 0.1, weight: 8, bg: "#69301a", fg: "#ffe9b0" },
  { label: ["3x"], mult: 3, weight: 4, bg: "#7b22e6", fg: "#ffffff" },
  { label: ["0.5x"], mult: 0.5, weight: 15, bg: "#7a5a08", fg: "#fff3a8" },
  { label: ["2.5x"], mult: 2.5, weight: 6, bg: "#07a46b", fg: "#ffffff" },
  { label: ["1.1x"], mult: 1.1, weight: 14, bg: "#0c5c3b", fg: "#c9ffe6" },
  { label: ["5x"], mult: 5, weight: 2, bg: "#ee7410", fg: "#ffffff" },
];
const N = SEGMENTS.length;
const SEG = 360 / N;
const TOTAL_W = SEGMENTS.reduce((s, x) => s + x.weight, 0);
const RTP = (SEGMENTS.reduce((s, x) => s + x.mult * x.weight, 0) / TOTAL_W) * 100;
const MIN_BET = 10;
const SPIN_MS = 5200;
const START_BALANCE = 990; // শুধু তখনই কাজ করে যখন সাইটের main balance প্রপ হিসেবে দেওয়া হয়নি
const STORE_KEY = "demo_wheel_balance_v1";
const PCTS = [1, 5, 10, 20, 50, 100];

/* ---------- HELPERS ---------- */
const round2 = (n) => Math.round(n * 100) / 100;
const money = (n) =>
  "৳" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pt = (r, a) => [r * Math.sin((a * Math.PI) / 180), -r * Math.cos((a * Math.PI) / 180)];
const slicePath = (r, a0, a1) => {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  return `M0,0 L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
};
const STAGE_BG = {
  background:
    "repeating-conic-gradient(from 0deg at 50% 46%, rgba(255,255,255,0.20) 0deg 5deg, rgba(255,255,255,0) 5deg 10deg), radial-gradient(circle at 50% 46%, #ffe08a 0%, #f9a825 55%, #e8760c 100%)",
};
// [left%, top%, size px, delay s]
const SPARKS = [
  [8, 10, 2.2, 0], [22, 6, 1.6, 0.6], [40, 12, 2, 1.1], [61, 5, 1.6, 0.3], [80, 11, 2.2, 0.9],
  [93, 8, 1.8, 0.5], [5, 32, 1.6, 1.2], [95, 30, 2, 0.2], [10, 56, 2, 0.7], [90, 54, 1.6, 1.4],
  [6, 78, 1.8, 0.4], [94, 76, 2.2, 1], [18, 92, 1.6, 0.8], [82, 90, 2, 0.1], [50, 3, 1.4, 1.3],
];
const BULBS = Array.from({ length: 20 }, (_, i) => pt(112, i * 18));
// লেখা যেন কখনো উল্টো না থাকে
const labelRot = (c) => {
  let a = c - 90;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  if (a > 90 || a < -90) return { rot: c + 90, sign: -1 };
  return { rot: c - 90, sign: 1 };
};
function rnd() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  } catch (e) {
    return Math.random();
  }
}
function pickIndex(segments, totalW) {
  let r = rnd() * totalW;
  for (let i = 0; i < segments.length; i++) {
    r -= segments[i].weight;
    if (r < 0) return i;
  }
  return segments.length - 1;
}

/* ---------- SOUND (Web Audio, কোনো ফাইল লাগে না) ---------- */
function makeSound() {
  let ctx = null;
  let muted = false;
  let wh = null;
  let lastTick = 0;

  const ensure = () => {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      }
      if (ctx && ctx.state === "suspended") ctx.resume();
    } catch (e) {}
    return ctx;
  };

  // চরকির পেগ কাঁটা পার হলে "টক" শব্দ
  const tick = () => {
    if (!ctx || muted) return;
    const now = performance.now();
    if (now - lastTick < 22) return;
    lastTick = now;
    try {
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(950 + Math.random() * 140, t);
      o.frequency.exponentialRampToValueAtTime(360, t + 0.045);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.07);
    } catch (e) {}
  };

  // ঘোরার "শশশ" হাওয়ার শব্দ (গতির সাথে কমে)
  const whooshStart = () => {
    if (!ctx || muted) return;
    try {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 500;
      f.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start();
      wh = { src, f, g };
    } catch (e) {
      wh = null;
    }
  };
  const whooshSet = (r) => {
    if (!wh) return;
    try {
      wh.g.gain.value = 0.07 * r;
      wh.f.frequency.value = 250 + 1100 * r;
    } catch (e) {}
  };
  const whooshStop = () => {
    if (!wh) return;
    try {
      wh.src.stop();
      wh.src.disconnect();
    } catch (e) {}
    wh = null;
  };

  const play = (freq, at, dur, type = "sine", vol = 0.2) => {
    try {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) {}
  };
  const win = (mult) => {
    if (!ctx || muted) return;
    const f = mult >= 3 ? [523, 659, 784, 1047, 1319] : mult >= 1.5 ? [523, 659, 784, 1047] : [523, 659, 784];
    f.forEach((x, i) => play(x, i * 0.1, 0.25));
  };
  const lose = () => {
    if (!ctx || muted) return;
    play(300, 0, 0.25, "sawtooth", 0.12);
    play(200, 0.18, 0.4, "sawtooth", 0.12);
  };
  const setMuted = (m) => {
    muted = m;
    if (m) whooshStop();
  };
  const close = () => {
    whooshStop();
    try {
      ctx && ctx.close();
    } catch (e) {}
    ctx = null;
  };
  return { ensure, tick, whooshStart, whooshSet, whooshStop, win, lose, setMuted, close };
}

function useSound() {
  const ref = useRef(null);
  if (!ref.current) ref.current = makeSound();
  return ref.current;
}

/* ---------- HOME PAGE CARD (গেমস গ্রিডের জন্য) ---------- */
export function SpinWheelCard({ onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`relative group active:scale-95 transition-transform ${className}`}
    >
      <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-dark-card2 border border-dark-border group-hover:border-neon-green/30 transition-colors">
        <img
          src="https://i.postimg.cc/cJjVQZTT/Chat-GPT-Image-Oct-9-2026-02-19-02-AM.png"
          alt="Spin Wheel"
          loading="lazy"
          className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/40 to-transparent" />

        <span className="absolute top-1.5 left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-neon-blue text-dark-bg">
          NEW
        </span>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-9 h-9 rounded-full bg-neon-green/90 flex items-center justify-center neon-green-glow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-dark-bg">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-[11px] font-bold text-white truncate leading-tight">Spin Wheel</p>
        </div>
      </div>
    </button>
  );
}

/* ---------- GAME ---------- */
export default function SpinWheelGame({ onClose, balance, onBalanceChange }) {
  const controlled = typeof balance === "number" && typeof onBalanceChange === "function";
  const [local, setLocal] = useState(() => {
    try {
      const v = parseFloat(localStorage.getItem(STORE_KEY));
      return isNaN(v) ? START_BALANCE : v;
    } catch (e) {
      return START_BALANCE;
    }
  });
  const bal = controlled ? balance : local;
  const balRef = useRef(bal);
  balRef.current = bal;

  const [shown, setShown] = useState(null);
  const [amount, setAmount] = useState("20");
  const [spinning, setSpinning] = useState(false);
  const [leverPulled, setLeverPulled] = useState(false);
  const [result, setResult] = useState(null);
  const [hist, setHist] = useState([]);
  const [muted, setMuted] = useState(false);
  const [activeSegments, setActiveSegments] = useState(SEGMENTS);
  const [activeTotalW, setActiveTotalW] = useState(TOTAL_W);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [forceOutcome, setForceOutcome] = useState('none');
  const wheelRef = useRef(null);
  const pointerRef = useRef(null);
  const rotRef = useRef(0);
  const rafRef = useRef(0);
  const sound = useSound();

  useEffect(() => {
    const unsub = onValue(ref(db, 'game_settings/spinwheel'), (snap) => {
      if (snap.exists()) {
        const s = snap.val();
        if (Array.isArray(s.segments) && s.segments.length > 0) {
          const merged = s.segments.map((seg, i) => {
            const def = SEGMENTS[i] || {};
            return {
              label: seg.label ? (typeof seg.label === 'string' ? [seg.label] : seg.label) : def.label,
              mult: typeof seg.mult === 'number' ? seg.mult : def.mult,
              weight: typeof seg.weight === 'number' ? seg.weight : def.weight,
              bg: def.bg || '#1b1f2e',
              fg: def.fg || '#ffffff',
              blnt: def.blnt || false,
            };
          });
          const tw = merged.reduce((acc, x) => acc + x.weight, 0);
          setActiveSegments(merged);
          setActiveTotalW(tw);
        }
        setOverrideEnabled(s.overrideEnabled ?? false);
        setForceOutcome(s.forceOutcome ?? 'none');
      }
    });
    return () => unsub();
  }, []);

  const setBal = (v) => {
    const nv = round2(v);
    balRef.current = nv;
    if (controlled) onBalanceChange(nv);
    else {
      setLocal(nv);
      try {
        localStorage.setItem(STORE_KEY, String(nv));
      } catch (e) {}
    }
  };

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      sound.close();
    },
    []
  );

  const options = [];
  {
    const seen = new Set();
    PCTS.forEach((p) => {
      const v = Math.floor((bal * p) / 100);
      if (v >= 1 && !seen.has(v)) {
        seen.add(v);
        options.push({ p, v });
      }
    });
  }

  const spin = () => {
    if (spinning) return;
    const bet = round2(parseFloat(amount) || 0);
    const before = balRef.current;
    if (bet < MIN_BET) {
      setResult({ kind: "info", text: `সর্বনিম্ন bet ৳${MIN_BET}` });
      return;
    }
    if (bet > before) {
      setResult({ kind: "info", text: "ব্যালেন্স যথেষ্ট নয়" });
      return;
    }
    sound.ensure();

    // Determine result index based on override settings
    let idx;
    if (overrideEnabled && forceOutcome === 'win') {
      const winners = activeSegments.map((s, i) => ({ s, i })).filter((x) => x.s.mult >= 1);
      idx = winners.length > 0 ? winners[Math.floor(rnd() * winners.length)].i : pickIndex(activeSegments, activeTotalW);
    } else if (overrideEnabled && forceOutcome === 'loss') {
      const losers = activeSegments.map((s, i) => ({ s, i })).filter((x) => x.s.mult < 1);
      idx = losers.length > 0 ? losers[Math.floor(rnd() * losers.length)].i : pickIndex(activeSegments, activeTotalW);
    } else if (overrideEnabled && forceOutcome === 'medium') {
      // Medium: 50/50 between win and loss segments
      const winners = activeSegments.map((s, i) => ({ s, i })).filter((x) => x.s.mult >= 1);
      const losers = activeSegments.map((s, i) => ({ s, i })).filter((x) => x.s.mult < 1);
      if (rnd() < 0.5 && winners.length > 0) {
        idx = winners[Math.floor(rnd() * winners.length)].i;
      } else if (losers.length > 0) {
        idx = losers[Math.floor(rnd() * losers.length)].i;
      } else {
        idx = pickIndex(activeSegments, activeTotalW);
      }
    } else {
      idx = pickIndex(activeSegments, activeTotalW);
    }
    const sg = activeSegments[idx];
    const payout = round2(bet * sg.mult);
    setBal(before - bet + payout);
    setShown(round2(before - bet));
    setSpinning(true);
    setResult(null);

    const from = rotRef.current;
    const cur = ((from % 360) + 360) % 360;
    const seg = 360 / activeSegments.length;
    const jitter = (rnd() - 0.5) * (seg * 0.7);
    const targetMod = (((360 - (idx * seg + seg / 2 + jitter)) % 360) + 360) % 360;
    const delta = ((targetMod - cur + 360) % 360) + 360 * (5 + Math.floor(rnd() * 3));
    const t0 = performance.now();
    let lastK = Math.floor(from / seg);
    let pAng = 0;
    sound.whooshStart();

    const finish = () => {
      rotRef.current = (from + delta) % 360;
      if (wheelRef.current) wheelRef.current.setAttribute("transform", `rotate(${rotRef.current})`);
      if (pointerRef.current) pointerRef.current.setAttribute("transform", "rotate(0 0 -118)");
      sound.whooshStop();
      setShown(null);
      setSpinning(false);
      const net = round2(payout - bet);
      setResult({
        kind: sg.mult >= 1 ? "win" : "loss",
        blnt: !!sg.blnt,
        mult: sg.mult,
        payout,
        net,
      });
      setHist((h) => [{ id: Date.now() + Math.random(), mult: sg.mult, blnt: !!sg.blnt }, ...h].slice(0, 12));
      if (sg.mult >= 1) sound.win(sg.mult);
      else sound.lose();
      try {
        if (navigator.vibrate) navigator.vibrate(sg.mult >= 1 ? [40, 30, 40] : 20);
      } catch (e) {}
    };

    const frame = (now) => {
      const t = Math.min(1, (now - t0) / SPIN_MS);
      const e = 1 - Math.pow(1 - t, 4);
      const R = from + delta * e;
      if (wheelRef.current) wheelRef.current.setAttribute("transform", `rotate(${R})`);
      const k = Math.floor(R / seg);
      if (k !== lastK) {
        sound.tick();
        lastK = k;
        pAng = -15;
      }
      pAng *= 0.8;
      if (pointerRef.current) pointerRef.current.setAttribute("transform", `rotate(${pAng.toFixed(2)} 0 -118)`);
      sound.whooshSet(Math.pow(1 - t, 3));
      if (t < 1) rafRef.current = requestAnimationFrame(frame);
      else finish();
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    sound.setMuted(m);
  };

  const handleLeverSpin = () => {
    if (spinning || leverPulled) return;
    setLeverPulled(true);
    setTimeout(() => { spin(); }, 250);
    setTimeout(() => { setLeverPulled(false); }, 800);
  };

  const resultBox = () => {
    if (spinning) return { cls: "bg-white/5 text-slate-300", text: "চরকি ঘুরছে..." };
    if (!result) return { cls: "bg-white/5 text-slate-400", text: "Bet দিয়ে SPIN চাপুন" };
    if (result.kind === "info") return { cls: "bg-amber-400/10 text-amber-200", text: result.text };
    if (result.kind === "win")
      return {
        cls: "bg-emerald-500/15 text-emerald-300",
        text: `🎉 ${result.mult}x · জিতেছেন +${money(result.net)}`,
      };
    if (result.blnt) return { cls: "bg-rose-500/10 text-rose-300", text: "Bad luck" };
    if (result.mult === 0) return { cls: "bg-rose-500/10 text-rose-300", text: `0x · হেরেছেন ${money(Math.abs(result.net))}` };
    return {
      cls: "bg-amber-400/10 text-amber-200",
      text: `${result.mult}x · ${money(result.payout)} ফেরত (${money(result.net)})`,
    };
  };
  const rb = resultBox();

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-[#070b14] text-white">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} disabled={spinning} className="rounded-full p-1.5 active:bg-white/10 disabled:opacity-40">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <span className="text-base font-bold">Spin Wheel</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleMute} className="rounded-full p-1.5 active:bg-white/10">
            {muted ? <VolumeX className="h-5 w-5 text-slate-400" /> : <Volume2 className="h-5 w-5 text-emerald-400" />}
          </button>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold">
            {money(shown != null ? shown : bal)}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
        <style>{`
          @keyframes sw-twinkle { 0%,100% { opacity: .15; transform: scale(.7); } 50% { opacity: 1; transform: scale(1.4); } }
          @keyframes sw-bulb { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
          .sw-spark { animation: sw-twinkle 2.2s ease-in-out infinite; }
          .sw-bulb-a { animation: sw-bulb .9s ease-in-out infinite; }
          .sw-bulb-b { animation: sw-bulb .9s ease-in-out .45s infinite; }
          .sw-fast .sw-bulb-a, .sw-fast .sw-bulb-b { animation-duration: .25s; }
          @keyframes sw-lever-pull {
            0% { transform: translateY(0); }
            30% { transform: translateY(24px); }
            55% { transform: translateY(24px); }
            100% { transform: translateY(0); }
          }
          @keyframes sw-lever-glow {
            0%, 100% { opacity: .4; }
            50% { opacity: 1; }
          }
          .sw-lever-pull { animation: sw-lever-pull 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
          .sw-lever-glow-a { animation: sw-lever-glow 1.2s ease-in-out infinite; }
          .sw-lever-glow-b { animation: sw-lever-glow 1.2s ease-in-out .6s infinite; }
        `}</style>

        {/* history */}
        <div className="mb-2 flex min-h-[28px] items-center gap-1.5 overflow-x-auto">
          {hist.length === 0 ? (
            <span className="text-[11px] text-slate-600">এখনো কোনো spin হয়নি</span>
          ) : (
            hist.map((h) => (
              <span
                key={h.id}
                className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-bold ${
                  h.mult >= 1
                    ? "bg-emerald-500/15 text-emerald-300"
                    : h.mult > 0
                    ? "bg-amber-400/15 text-amber-200"
                    : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {h.blnt ? "✕" : `${h.mult}x`}
              </span>
            ))
          )}
        </div>

        {/* wheel */}
        <div className="relative overflow-hidden rounded-3xl border border-amber-300/30 px-2 pb-1 pt-2" style={STAGE_BG}>
          {SPARKS.map((sp, i) => (
            <span
              key={i}
              className="sw-spark pointer-events-none absolute rounded-full bg-white"
              style={{ left: sp[0] + "%", top: sp[1] + "%", width: sp[2], height: sp[2], animationDelay: sp[3] + "s" }}
            />
          ))}
          <svg
            viewBox="-122 -128 244 288"
            className={`relative mx-auto block w-full max-w-[270px] ${spinning ? "sw-fast" : ""}`}
          >
            <defs>
              <linearGradient id="sw-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fff3b0" />
                <stop offset="30%" stopColor="#f0b90b" />
                <stop offset="60%" stopColor="#a86b00" />
                <stop offset="100%" stopColor="#ffd966" />
              </linearGradient>
              <radialGradient id="sw-hub" cx="35%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#fff6c8" />
                <stop offset="50%" stopColor="#e5a800" />
                <stop offset="100%" stopColor="#7a4a00" />
              </radialGradient>
              <radialGradient id="sw-shade" cx="50%" cy="50%" r="50%">
                <stop offset="55%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
              </radialGradient>
              <linearGradient id="sw-stand" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0d0d0d" />
                <stop offset="45%" stopColor="#3a3a3a" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </linearGradient>
              <radialGradient id="sw-bulb">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="60%" stopColor="#fff2a8" />
                <stop offset="100%" stopColor="#ffc61a" />
              </radialGradient>
            </defs>

            {/* stand */}
            <ellipse cx="0" cy="159" rx="64" ry="4" fill="#000000" opacity="0.25" />
            <path d="M-24,100 C-24,128 -44,138 -50,146 L50,146 C44,138 24,128 24,100 Z" fill="url(#sw-stand)" />
            <rect x="-58" y="144" width="116" height="14" rx="4" fill="url(#sw-stand)" />
            <rect x="-58" y="144" width="116" height="2.5" rx="1" fill="#666666" opacity="0.6" />

            {/* gold ring + bulbs */}
            <circle r="118" fill="url(#sw-gold)" />
            <circle r="106" fill="#3b2a06" />
            <circle r="104" fill="#161b27" />
            {BULBS.map(([bx, by], i) => (
              <circle
                key={"b" + i}
                cx={bx}
                cy={by}
                r="3"
                fill="url(#sw-bulb)"
                className={i % 2 ? "sw-bulb-b" : "sw-bulb-a"}
              />
            ))}
            <circle r="118" fill="none" stroke="#7a4a00" strokeWidth="1" />

            {/* rotating face */}
            <g ref={wheelRef}>
              {activeSegments.map((s, i) => {
                const a0 = i * (360 / activeSegments.length);
                const a1 = (i + 1) * (360 / activeSegments.length);
                const c = a0 + (360 / activeSegments.length) / 2;
                const lr = labelRot(c);
                return (
                  <g key={i}>
                    <path d={slicePath(100, a0, a1)} fill={s.bg} stroke="#0b0f18" strokeWidth="1.2" />
                    <g transform={`rotate(${lr.rot})`}>
                      {s.label.length === 2 ? (
                        <>
                          <text x={lr.sign * 58} y="-1.5" textAnchor="middle" fontSize="6.6" fontWeight="800" fill={s.fg}>
                            {s.label[0]}
                          </text>
                          <text x={lr.sign * 58} y="6.6" textAnchor="middle" fontSize="6.6" fontWeight="800" fill={s.fg}>
                            {s.label[1]}
                          </text>
                        </>
                      ) : (
                        <text
                          x={lr.sign * (s.label[0].length > 4 ? 56 : 62)}
                          y={s.label[0].length > 4 ? 3 : 5}
                          textAnchor="middle"
                          fontSize={s.label[0].length > 4 ? 7 : 15}
                          fontWeight="800"
                          fill={s.fg}
                        >
                          {s.label[0]}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
              {activeSegments.map((_, i) => {
                const seg = 360 / activeSegments.length;
                const [px, py] = pt(96, i * seg);
                return <circle key={"p" + i} cx={px} cy={py} r="2.6" fill="url(#sw-hub)" stroke="#5a3a00" strokeWidth="0.8" />;
              })}
            </g>
            <circle r="100" fill="url(#sw-shade)" />

            {/* hub */}
            <circle r="22" fill="url(#sw-gold)" stroke="#7a4a00" strokeWidth="1.2" />
            <circle r="15" fill="url(#sw-hub)" stroke="#5a3a00" strokeWidth="1" />
            <circle r="6" fill="url(#sw-hub)" />
            <circle cx="-2" cy="-2.5" r="2" fill="#ffffff" opacity="0.7" />

            {/* pointer */}
            <g ref={pointerRef}>
              <path
                d="M-11,-127 Q-11,-108 0,-90 Q11,-108 11,-127 Z"
                fill="url(#sw-gold)"
                stroke="#6a3f00"
                strokeWidth="1.2"
              />
              <circle cy="-112" r="3" fill="url(#sw-bulb)" />
            </g>
          </svg>
        </div>

        {/* result */}
        <div className={`mt-2 rounded-xl px-3 py-2.5 text-center text-sm font-bold ${rb.cls}`}>{rb.text}</div>

        {/* bet */}
        <div className="mt-3 space-y-2">
          <input
            inputMode="decimal"
            value={amount}
            disabled={spinning}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={`Bet amount ৳ (min ৳${MIN_BET})`}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 disabled:opacity-50"
          />
          <div className="grid grid-cols-6 gap-1.5">
            {options.map((o) => (
              <button
                key={o.p}
                disabled={spinning}
                onClick={() => setAmount(String(o.v))}
                className={`rounded-lg border py-1.5 text-center disabled:opacity-50 ${
                  parseFloat(amount) === o.v ? "border-emerald-400 bg-emerald-400/15" : "border-white/10 bg-white/5"
                }`}
              >
                <div className="text-[11px] font-bold">৳{o.v.toLocaleString("en-US")}</div>
              </button>
            ))}
          </div>
          {/* Slot Machine Lever Spin Control */}
          <button
            onClick={handleLeverSpin}
            disabled={spinning || leverPulled}
            className="relative w-full overflow-hidden transition-transform active:scale-[0.99] disabled:opacity-70"
            style={{
              height: 64,
              borderRadius: 16,
              border: "2px solid rgba(240,185,11,0.45)",
              background: "linear-gradient(180deg, #ffe27a 0%, #f4c430 50%, #d9a514 100%)",
              boxShadow: spinning
                ? "0 0 25px rgba(245,197,24,0.45), inset 0 2px 4px rgba(105,70,0,0.35)"
                : "0 0 15px rgba(245,197,24,0.35), inset 0 2px 4px rgba(105,70,0,0.35)",
            }}
          >
            {/* Top neon strip */}
            <div className="absolute inset-x-0 top-0 h-[2px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.8), transparent)" }}
            />
            {/* Bottom neon strip */}
            <div className="absolute inset-x-0 bottom-0 h-[2px]"
              style={{ background: "linear-gradient(90deg, transparent, rgba(245,197,24,0.8), transparent)" }}
            />
            {/* Corner rivet lights */}
            <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 sw-lever-glow-a" />
            <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 sw-lever-glow-b" />

            <div className="flex items-center h-full px-1">
              {/* Left: Arcade SPIN display */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <span
                  className={`text-2xl font-black tracking-[0.2em] leading-none ${spinning ? "text-amber-950" : "text-emerald-950"}`}
                  style={{
                    textShadow: spinning
                      ? "0 0 12px rgba(245,197,24,0.6), 0 0 4px rgba(245,197,24,0.8)"
                      : "0 0 12px rgba(16,185,129,0.6), 0 0 4px rgba(16,185,129,0.8)",
                  }}
                >
                  {spinning ? "SPINNING" : "SPIN"}
                </span>
                <span className="text-[8px] text-slate-500 font-bold tracking-[0.15em] uppercase mt-0.5">
                  {leverPulled ? "Pulled!" : spinning ? "\u00b7\u00b7\u00b7" : "Pull Lever"}
                </span>
              </div>

              {/* Chrome divider */}
              <div className="h-10 w-[2px] mx-1"
                style={{ background: "linear-gradient(180deg, transparent, rgba(200,200,200,0.35), transparent)" }}
              />

              {/* Right: Slot machine lever mechanism */}
              <div className="relative w-[76px] h-full flex items-center justify-center">
                {/* Lever track recess */}
                <div
                  className="absolute right-4 top-2 bottom-2 w-[10px] rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #000 0%, #0a0a0a 30%, #141414 50%, #0a0a0a 70%, #000 100%)",
                    boxShadow: "inset 0 0 6px rgba(0,0,0,0.9), inset 1px 0 0 rgba(255,255,255,0.04)",
                  }}
                />
                {/* Lever arm + knob */}
                <div
                  className={leverPulled ? "sw-lever-pull" : ""}
                  style={{ position: "absolute", right: "9px", top: "5px" }}
                >
                  {/* Chrome rod */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 w-[5px] rounded-full"
                    style={{
                      height: 22,
                      top: 8,
                      background: "linear-gradient(90deg, #333 0%, #999 25%, #ddd 50%, #999 75%, #333 100%)",
                      boxShadow: "0 0 2px rgba(0,0,0,0.5)",
                    }}
                  />
                  {/* Ball knob */}
                  <div
                    className="relative w-[24px] h-[24px] rounded-full"
                    style={{
                      background: "radial-gradient(circle at 35% 30%, #ff8888 0%, #e03131 25%, #c92a2a 50%, #962020 75%, #5c0e0e 100%)",
                      boxShadow:
                        "0 3px 8px rgba(0,0,0,0.6), inset -2px -3px 6px rgba(0,0,0,0.4), inset 2px 2px 6px rgba(255,255,255,0.25), 0 0 10px rgba(255,40,40,0.4)",
                    }}
                  >
                    {/* Specular highlight */}
                    <div
                      className="absolute rounded-full bg-white/70"
                      style={{ width: 7, height: 5, top: 3, left: 6, filter: "blur(1px)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
