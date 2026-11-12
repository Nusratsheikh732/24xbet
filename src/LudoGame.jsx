import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Volume2, VolumeX, Bot, Wifi } from "lucide-react";
import { joinQueue, getQueueRow, listSearchingQueue, purgeStaleSearches, leaveQueue, subscribeQueue, createMatch, markQueueRowsMatched, getMatch, appendMatchEvent, subscribeMatchEvents, claimMatchResult } from "@/lib/ludoOnline";
import { db, ref, get, onValue } from "@/lib/firebase";

/* =====================================================================
   LUDO  —  Bot + Online দুই মোড।
   Bot মোড: AI বট প্লেয়ার, difficulty admin থেকে control।
   Online মোড: সত্যিকারের অনলাইন প্লেয়ার, Firebase matchmaking।
   ===================================================================== */

/* ---------- CONFIG ---------- */
const BETS = [50, 100, 150, 200];
const PLAYER_COUNTS = [2, 3, 4];
const COMMISSION = 0; // 0 = জয়ী পুরো pool পায়। চাইলে 0.1 (10%) দিন
const TOKENS_TO_WIN = 4; // কয়টা গুটি ঘরে তুললে জয় (ক্লাসিক = 4)
const STEP_MS = 170; // প্রতি ঘর চলার সময়
const START_BALANCE = 990; // শুধু তখনই কাজ করে যখন সাইটের main balance প্রপ হিসেবে দেওয়া হয়নি
const STORE_KEY = "demo_ludo_balance_v1";
const SEARCH_TIMEOUT_MS = 30000; // 30 seconds max wait for real players

/* ---------- BOARD DATA ---------- */
const COLORS = ["red", "green", "yellow", "blue"]; // ঘড়ির কাঁটার দিকে চালের ক্রম
const HEX = { red: "#e8191f", green: "#00a24b", yellow: "#ffe01b", blue: "#29b0ff" };
const BASE_ACTIVE = { red: "#bf0f18", green: "#007536", yellow: "#d6b900", blue: "#0e6aa8" };
const LIGHT = { red: "#ff9a9c", green: "#6be19a", yellow: "#fff3a0", blue: "#b5e8ff" };
const DEEP = { red: "#8f0d12", green: "#00582a", yellow: "#a58700", blue: "#0a6bb5" };
const PLAYER_NO = { blue: 1, red: 2, green: 3, yellow: 4 };
const START_IDX = { red: 0, green: 13, yellow: 26, blue: 39 };
const BASE_ORIGIN = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] }; // [row, col]
const SEAT_COLORS = { 2: ["green", "blue"], 3: ["red", "green", "blue"], 4: ["red", "green", "yellow", "blue"] };
const HOME = 56;

const LOOP = (() => {
  const seq = [];
  for (let c = 0; c <= 5; c++) seq.push([6, c]);
  for (let r = 5; r >= 0; r--) seq.push([r, 6]);
  seq.push([0, 7], [0, 8]);
  for (let r = 1; r <= 5; r++) seq.push([r, 8]);
  for (let c = 9; c <= 14; c++) seq.push([6, c]);
  seq.push([7, 14], [8, 14]);
  for (let c = 13; c >= 9; c--) seq.push([8, c]);
  for (let r = 9; r <= 14; r++) seq.push([r, 8]);
  seq.push([14, 7], [14, 6]);
  for (let r = 13; r >= 9; r--) seq.push([r, 6]);
  for (let c = 5; c >= 0; c--) seq.push([8, c]);
  seq.push([7, 0]);
  return seq.slice(1).concat(seq.slice(0, 1)); // (6,1) = red start = index 0
})();
const LANES = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
};
const SAFE = new Set(COLORS.flatMap((c) => [START_IDX[c], (START_IDX[c] + 8) % 52]));
const absIdx = (c, r) => (START_IDX[c] + r) % 52;
// Quarter turns clockwise so the viewer's base sits bottom-left.
const boardRotation = (humanColor) => (humanColor ? (3 - COLORS.indexOf(humanColor) + 4) % 4 : 0);
const normalizeSeats = (seats, count) => {
  const colors = SEAT_COLORS[count];
  const normalized = seats.slice(0, count).map((seat, index) => ({
    ...seat,
    color: colors.includes(seat.color) ? seat.color : colors[index],
    human: seat.human !== false,
  }));
  return colors
    .map((color) => normalized.find((seat) => seat.color === color))
    .filter(Boolean);
};

/* ---------- BOT AI ---------- */
const BOT_NAMES = ["Bot Alpha", "Bot Beta", "Bot Gamma", "Bot Delta"];

// Score each possible move; higher = better for the bot.
function scoreMove(all, color, ti, d, accuracy) {
  const t = all[color][ti];
  const to = t === -1 ? 0 : t + d;
  let score = to;

  if (t === -1) score += 120;
  if (to === HOME) score += 150;

  if (to >= 1 && to <= 50) {
    const ai = absIdx(color, to);
    if (!SAFE.has(ai)) {
      let captures = 0;
      let threats = 0;
      Object.keys(all).forEach((o) => {
        if (o === color) return;
        all[o].forEach((ro) => {
          if (ro < 0 || ro > 50) return;
          if (absIdx(o, ro) === ai) captures++;
          for (let dd = 1; dd <= 6; dd++) {
            if (absIdx(o, ro + dd) === ai) {
              threats++;
              break;
            }
          }
        });
      });
      score += captures * 200 - threats * 12;
    }
  }

  if (to >= 1 && to <= 50 && SAFE.has(absIdx(color, to))) score += 40;

  if (to >= 0 && to <= 50) {
    const ai = absIdx(color, to);
    Object.keys(all).forEach((o) => {
      if (o === color) return;
      all[o].forEach((ro) => {
        if (ro < 0 || ro > 50) return;
        const ei = absIdx(o, ro);
        const dist = (ei - ai + 52) % 52;
        if (dist >= 1 && dist <= 6 && !SAFE.has(ei)) score += 25;
      });
    });
  }

  score += (rnd() * 2 - 1) * (12 + (100 - accuracy) * 0.8);

  return score;
}

function isCaptureSquare(all, color, ai) {
  if (SAFE.has(ai)) return false;
  return Object.keys(all).some(
    (o) => o !== color && all[o].some((ro) => ro >= 0 && ro <= 50 && absIdx(o, ro) === ai)
  );
}

// Bot keeps moving one lead token; other tokens move only to a Stop, a capture, or home.
function pickBotMove(all, color, d, accuracy) {
  const mv = movableTokens(all[color], d);
  if (mv.length === 0) return -1;
  if (mv.length === 1) return mv[0];

  let leader = -1;
  for (const ti of mv) {
    if (all[color][ti] < 0) continue;
    if (leader === -1 || all[color][ti] > all[color][leader]) leader = ti;
  }

  let best = mv[0];
  let bestScore = -Infinity;
  for (const ti of mv) {
    let s = scoreMove(all, color, ti, d, accuracy);
    const t = all[color][ti];
    if (t >= 0 && ti !== leader) {
      const to = t + d;
      const allowed =
        to === HOME || (to <= 50 && (SAFE.has(absIdx(color, to)) || isCaptureSquare(all, color, absIdx(color, to))));
      if (!allowed) s -= 150;
    }
    if (s > bestScore) {
      bestScore = s;
      best = ti;
    }
  }
  return best;
}

// Bot dice with luck modifier: higher luck = more 6s and high rolls
function botRollDie(luck) {
  const r = rnd();
  // luck% chance to bias toward 5-6
  if (r < luck / 100) {
    return 4 + Math.floor(rnd() * 3); // 4,5,6
  }
  return 1 + Math.floor(rnd() * 6);
}

/* ---------- GAME LOGIC (pure) ---------- */
function rnd() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  } catch (e) {
    return Math.random();
  }
}
const rollDie = () => 1 + Math.floor(rnd() * 6);
const round2 = (n) => Math.round(n * 100) / 100;
const money = (n) =>
  "৳" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function movableTokens(arr, d) {
  const res = [];
  arr.forEach((r, ti) => {
    if (r === HOME) return;
    if (r === -1) {
      if (d === 6) res.push(ti);
    } else if (r + d <= HOME) res.push(ti);
  });
  return res;
}

function applyMove(all, color, ti, d) {
  const t = all[color][ti];
  const to = t === -1 ? 0 : t + d;
  const path = [];
  if (t === -1) path.push(0);
  else for (let r = t + 1; r <= to; r++) path.push(r);
  const after = {};
  Object.keys(all).forEach((c) => {
    after[c] = all[c].slice();
  });
  after[color][ti] = to;
  const captured = [];
  if (to <= 50) {
    const ai = absIdx(color, to);
    if (!SAFE.has(ai)) {
      Object.keys(after).forEach((o) => {
        if (o === color) return;
        after[o].forEach((ro, tj) => {
          if (ro >= 0 && ro <= 50 && absIdx(o, ro) === ai) captured.push({ color: o, ti: tj });
        });
      });
    }
  }
  const final = {};
  Object.keys(after).forEach((c) => {
    final[c] = after[c].slice();
  });
  captured.forEach((cp) => {
    final[cp.color][cp.ti] = -1;
  });
  const finished = to === HOME;
  return { after, final, path, captured, finished, to, extra: d === 6 || captured.length > 0 || finished };
}


/* ---------- SOUND ---------- */
function makeSnd() {
  let ctx = null;
  let muted = false;
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
  const tone = (f, at, dur, type = "sine", vol = 0.15) => {
    if (!ctx || muted) return;
    try {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) {}
  };
  return {
    ensure,
    setMuted: (m) => {
      muted = m;
    },
    close: () => {
      try {
        ctx && ctx.close();
      } catch (e) {}
      ctx = null;
    },
    roll: () => {
      for (let i = 0; i < 8; i++) tone(180 + Math.random() * 280, i * 0.07, 0.05, "square", 0.07);
    },
    step: () => tone(520, 0, 0.05, "triangle", 0.12),
    capture: () => {
      tone(320, 0, 0.12, "sawtooth", 0.13);
      tone(180, 0.1, 0.22, "sawtooth", 0.13);
    },
    home: () => [660, 880, 1100].forEach((f, i) => tone(f, i * 0.08, 0.18, "sine", 0.15)),
    join: () => tone(740, 0, 0.12, "sine", 0.12),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.1, 0.28, "sine", 0.18)),
    lose: () => {
      tone(300, 0, 0.25, "sawtooth", 0.1);
      tone(200, 0.2, 0.4, "sawtooth", 0.1);
    },
  };
}
function useSnd() {
  const ref = useRef(null);
  if (!ref.current) ref.current = makeSnd();
  return ref.current;
}

/* ---------- VISUAL PIECES ---------- */
const starPts = (cx, cy, R, r) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    return `${(cx + rad * Math.cos(a)).toFixed(3)},${(cy + rad * Math.sin(a)).toFixed(3)}`;
  }).join(" ");

function tokenPos(color, r, ti) {
  if (r === -1) {
    const [r0, c0] = BASE_ORIGIN[color];
    return [c0 + (ti % 2 ? 4 : 2), r0 + (ti < 2 ? 2 : 4)];
  }
  if (r <= 50) {
    const [row, col] = LOOP[absIdx(color, r)];
    return [col + 0.5, row + 0.5];
  }
  if (r < HOME) {
    const [row, col] = LANES[color][r - 51];
    return [col + 0.5, row + 0.5];
  }
  const sp = (ti - 1.5) * 0.26;
  if (color === "red") return [6.7, 7.75 + sp];
  if (color === "yellow") return [8.3, 7.75 + sp];
  if (color === "green") return [7.5 + sp, 6.85];
  return [7.5 + sp, 8.45];
}

// gradients একবারই ডিফাইন হয়
function GameDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <linearGradient id="ludo-pin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#c6ccd6" />
        </linearGradient>
        {COLORS.map((c) => (
          <radialGradient key={c} id={"ludo-sph-" + c} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={LIGHT[c]} />
            <stop offset="45%" stopColor={HEX[c]} />
            <stop offset="100%" stopColor={DEEP[c]} />
          </radialGradient>
        ))}
        <linearGradient id="ludo-die" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d9dce1" />
        </linearGradient>
        <linearGradient id="ludo-arrow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd23a" />
          <stop offset="100%" stopColor="#ff8a00" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// গুটি: সাদা pin + রঙিন গোলক + নিচে রিং
function PinShape({ color, ring = true }) {
  return (
    <g>
      {ring && <circle cx="0" cy="0" r="0.5" fill={HEX[color]} stroke="#8a1c2b" strokeWidth="0.1" />}
      {ring && <circle cx="0" cy="0" r="0.3" fill={HEX[color]} stroke="#ffffff" strokeOpacity="0.45" strokeWidth="0.05" />}
      <path
        d="M0,0.04 C-0.1,-0.24 -0.52,-0.44 -0.52,-0.82 A0.52,0.52 0 0 1 0.52,-0.82 C0.52,-0.44 0.1,-0.24 0,0.04 Z"
        fill="url(#ludo-pin)"
        stroke="#7f8896"
        strokeWidth="0.05"
      />
      <circle cx="0" cy="-0.82" r="0.35" fill={`url(#ludo-sph-${color})`} />
      <circle cx="-0.12" cy="-0.95" r="0.09" fill="#ffffff" opacity="0.9" />
    </g>
  );
}

function Board({ seats, tokens, humanColor, movable, onPick, activeColor }) {
  const active = new Set(seats.map((s) => s.color));
  const items = [];
  seats.forEach((s) => (tokens[s.color] || []).forEach((r, ti) => items.push({ color: s.color, ti, r })));
  const groups = {};
  items.forEach((it) => {
    const k =
      it.r === -1
        ? `b${it.color}${it.ti}`
        : it.r === HOME
        ? `h${it.color}${it.ti}`
        : it.r <= 50
        ? `c${absIdx(it.color, it.r)}`
        : `l${it.color}${it.r}`;
    it.k = k;
    (groups[k] = groups[k] || []).push(it);
  });

  const LABELS = {
    red: { x: 0.42, y: 3, rot: -90, text: "Player 2" },
    green: { x: 12, y: 0.42, rot: 180, text: "Player 3" },
    yellow: { x: 14.58, y: 11.9, rot: 90, text: "Player 4" },
    blue: { x: 3, y: 14.58, rot: 0, text: "Player 1" },
  };
  const ARROWS = {
    red: { row: 7, col: 0, d: "M0.15,0.5 H0.78 M0.5,0.2 L0.82,0.5 L0.5,0.8" },
    green: { row: 0, col: 7, d: "M0.5,0.15 V0.78 M0.2,0.5 L0.5,0.82 L0.8,0.5" },
    yellow: { row: 7, col: 14, d: "M0.85,0.5 H0.22 M0.5,0.2 L0.18,0.5 L0.5,0.8" },
    blue: { row: 14, col: 7, d: "M0.5,0.85 V0.22 M0.2,0.5 L0.5,0.18 L0.8,0.5" },
  };

  const boardRot = boardRotation(humanColor) * 90;

  return (
    <svg viewBox="0 0 15 15" style={{ display: "block", width: "100%", overflow: "visible" }}>
      <rect x="0" y="0" width="15" height="15" fill="#ffffff" />
      <g transform={`rotate(${boardRot} 7.5 7.5)`}>

      {COLORS.map((c) => {
        const [r0, c0] = BASE_ORIGIN[c];
        const on = active.has(c);
        const hot = on && activeColor === c;
        return (
          <g key={c} opacity={on ? 1 : 0.35}>
            <rect x={c0} y={r0} width="6" height="6" fill={hot ? BASE_ACTIVE[c] : HEX[c]} />
            <rect x={c0 + 1} y={r0 + 1} width="4" height="4" fill="#ffffff" />
            {[0, 1, 2, 3].map((i) => {
              const [x, y] = tokenPos(c, -1, i);
              const hasTok = on && tokens[c] && tokens[c][i] === -1;
              return hasTok ? null : <circle key={i} cx={x} cy={y} r="0.58" fill={HEX[c]} />;
            })}
          </g>
        );
      })}

      {LOOP.map(([row, col], i) => {
        const owner = COLORS.find((c) => START_IDX[c] === i);
        return (
          <g key={"l" + i}>
            <rect
              x={col}
              y={row}
              width="1"
              height="1"
              fill={owner ? HEX[owner] : "#ffffff"}
              stroke="#c4c4c4"
              strokeWidth="0.05"
              opacity={owner && !active.has(owner) ? 0.45 : 1}
            />
            {SAFE.has(i) && !owner && (
              <polygon
                points={starPts(col + 0.5, row + 0.53, 0.36, 0.15)}
                fill="#ffffff"
                stroke={owner ? "#ffffff" : "#8f8f8f"}
                strokeWidth="0.04"
                strokeLinejoin="round"
                opacity={owner ? 0.9 : 1}
              />
            )}
          </g>
        );
      })}

      {COLORS.map((c) =>
        LANES[c].map(([row, col], i) => (
          <rect
            key={c + i}
            x={col}
            y={row}
            width="1"
            height="1"
            fill={HEX[c]}
            stroke="#c4c4c4"
            strokeWidth="0.05"
            opacity={active.has(c) ? 1 : 0.45}
          />
        ))
      )}

      {COLORS.map((c) => (
        <g key={"a" + c} transform={`translate(${ARROWS[c].col} ${ARROWS[c].row})`}>
          <path d={ARROWS[c].d} fill="none" stroke={HEX[c]} strokeWidth="0.09" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}

      <polygon points="6,6 6,9 7.5,7.5" fill={HEX.red} />
      <polygon points="6,6 9,6 7.5,7.5" fill={HEX.green} />
      <polygon points="9,6 9,9 7.5,7.5" fill={HEX.yellow} />
      <polygon points="6,9 9,9 7.5,7.5" fill={HEX.blue} />

      {COLORS.map((c) => {
        const L = LABELS[c];
        return (
          <text
            key={"t" + c}
            x={L.x}
            y={L.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="0.6"
            fontWeight="800"
            fill="#ffffff"
            stroke="#000000"
            strokeOpacity="0.35"
            strokeWidth="0.07"
            paintOrder="stroke"
            opacity={active.has(c) ? 1 : 0.4}
            transform={`rotate(${L.rot} ${L.x} ${L.y})`}
          >
            {L.text}
          </text>
        );
      })}

      {items.map((it) => {
        const grp = groups[it.k];
        const idx = grp.indexOf(it);
        const n = grp.length;
        let [x, y] = tokenPos(it.color, it.r, it.ti);
        if (n > 1 && it.r !== HOME) x += (idx - (n - 1) / 2) * 0.28;
        const sc = it.r === HOME ? 0.5 : n > 1 ? 0.8 : 1;
        const can = it.color === humanColor && movable.includes(it.ti);
        return (
          <g
            key={it.color + it.ti}
            style={{ transform: `translate(${x}px, ${y + 0.12}px) scale(${sc})`, transition: `transform ${STEP_MS + 10}ms linear` }}
          >
            <g transform={`rotate(${-boardRot})`}>
              <ellipse cx="0" cy="0.06" rx="0.46" ry="0.16" fill="#000000" opacity="0.22" />
              {can && <circle r="0.68" fill="none" stroke="#ffe34d" strokeWidth="0.1" className="ludo-ring" />}
              <PinShape color={it.color} />
            </g>
            {can && (
              <rect
                x="-0.65"
                y="-1.4"
                width="1.3"
                height="1.9"
                fill="transparent"
                style={{ cursor: "pointer" }}
                onClick={() => onPick(it.ti)}
              />
            )}
          </g>
        );
      })}
      </g>
    </svg>
  );
}

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function DieFace({ value }) {
  const P = PIPS[value] || [];
  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block" }}>
      <rect x="4" y="4" width="92" height="92" rx="20" fill="#b9bcc2" />
      <rect x="4" y="3" width="92" height="90" rx="20" fill="url(#ludo-die)" stroke="#a3a6ad" strokeWidth="2.5" />
      <rect x="9" y="8" width="82" height="40" rx="16" fill="#ffffff" opacity="0.55" />
      {P.map((i) => (
        <g key={i}>
          <circle cx={25 + 25 * (i % 3)} cy={25 + 25 * Math.floor(i / 3) + 1.5} r="10.5" fill="#000000" opacity="0.18" />
          <circle cx={25 + 25 * (i % 3)} cy={25 + 25 * Math.floor(i / 3)} r="10" fill="#0d0d0d" />
        </g>
      ))}
    </svg>
  );
}

function DiceBox({ value, rolling, dim, glow, onClick }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!rolling) {
      setShown(value);
      return;
    }
    const id = setInterval(() => setShown(1 + Math.floor(Math.random() * 6)), 80);
    return () => clearInterval(id);
  }, [rolling, value]);
  return (
    <div
      onClick={onClick || undefined}
      className={`${rolling ? "ludo-shake" : ""} ${glow ? "ludo-glow" : ""}`}
      style={{
        height: "122%",
        aspectRatio: "1 / 1",
        borderRadius: 12,
        border: "3px solid #f1c232",
        background: "linear-gradient(#fdecee,#e6b3b9)",
        padding: "9%",
        boxSizing: "border-box",
        cursor: onClick ? "pointer" : "default",
        opacity: dim && !rolling ? 0.6 : 1,
        boxShadow: "inset 0 2px 3px rgba(255,255,255,.85), 0 3px 6px rgba(0,0,0,.35)",
        flexShrink: 0,
      }}
    >
      {shown ? <DieFace value={shown} /> : null}
    </div>
  );
}

function SeatPanel({ seat, g, onRoll, flip, myUid }) {
  if (!seat) return <div style={{ width: "30%" }} />;
  const cur = g.seats[g.turn] || g.seats[0];
  const active = !g.over && cur?.color === seat.color;
  const home = g.tokens[seat.color].filter((r) => r === HOME).length;
  const val = active ? g.dices[seat.color] || null : null;
  const canTap = active && seat.human && g.canRoll;
  return (
    <div style={{ width: "30%", position: "relative" }}>
      <div
        style={{
          aspectRatio: "300 / 138",
          display: "flex",
          flexDirection: flip ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: flip ? "0 0 0 8%" : "0 8% 0 0",
          borderRadius: 9,
          border: "3px solid #f1c232",
          boxSizing: "border-box",
          background: flip
            ? "linear-gradient(270deg,#0a3a96,#1c64c6 50%,#8fc6ee)"
            : "linear-gradient(90deg,#0a3a96,#1c64c6 50%,#8fc6ee)",
          boxShadow: "0 3px 6px rgba(0,0,0,.35)",
        }}
      >
        <svg viewBox="-0.55 -1.3 1.1 1.4" style={{ height: "82%", flexShrink: 0, marginLeft: flip ? 0 : "6%", marginRight: flip ? "6%" : 0 }}>
          <PinShape color={seat.color} ring={false} />
        </svg>
        <DiceBox value={val} rolling={active && g.rolling} dim={false} glow={canTap} onClick={canTap ? onRoll : null} />
      </div>
      {active && (
        <svg
          viewBox="0 0 40 32"
          className="ludo-bob"
          style={{
            position: "absolute",
            top: "50%",
            marginTop: -12,
            width: "22%",
            [flip ? "right" : "left"]: "104%",
            transform: flip ? "scaleX(-1)" : "none",
          }}
        >
          <polygon points="0,16 18,0 18,9 40,9 40,23 18,23 18,32" fill="url(#ludo-arrow)" stroke="#a85a00" strokeWidth="2" />
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          top: -9,
          [flip ? "right" : "left"]: 6,
          background: "rgba(0,0,0,.62)",
          color: "#ffffff",
          fontSize: 9,
          fontWeight: 800,
          borderRadius: 6,
          padding: "1px 6px",
          whiteSpace: "nowrap",
          zIndex: 2,
        }}
      >
        {seat.uid === myUid ? "YOU" : (seat.name || "PLAYER").toUpperCase()} · 🏠{home}/{TOKENS_TO_WIN}
      </div>
    </div>
  );
}

function GameBg() {
  return (
    <svg
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <defs>
        <pattern id="ludo-bgp" width="240" height="240" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
          <rect width="240" height="240" fill="#27539c" />
          <rect x="18" y="18" width="204" height="204" rx="34" fill="#3367c0" stroke="#224890" strokeWidth="8" />
          {[[70, 70], [170, 70], [70, 170], [170, 170]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="19" fill="#1b3d82" />
          ))}
          <polygon points={starPts(120, 120, 22, 9)} fill="none" stroke="#8ab6ff" strokeOpacity="0.2" strokeWidth="3" />
        </pattern>
        <radialGradient id="ludo-vig" cx="50%" cy="45%" r="75%">
          <stop offset="50%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
        </radialGradient>
        <linearGradient id="ludo-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.4" />
          <stop offset="60%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#ludo-bgp)" />
      <rect width="100%" height="100%" fill="url(#ludo-top)" />
      <rect width="100%" height="100%" fill="url(#ludo-vig)" />
    </svg>
  );
}

function Shell({ children }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        margin: "0 auto",
        maxWidth: 448,
        zIndex: 50,
        color: "#ffffff",
        overflow: "hidden",
        background: "#1c4fa6",
      }}
    >
      <GameBg />
      <GameDefs />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}

const glass = {
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 16,
};
const chipStyle = (on) => ({
  borderRadius: 12,
  border: on ? "2px solid #ffd84a" : "2px solid rgba(255,255,255,0.18)",
  background: on ? "rgba(255,216,74,0.22)" : "rgba(255,255,255,0.07)",
  color: on ? "#ffe98a" : "#ffffff",
  fontWeight: 700,
  padding: "12px 0",
  cursor: "pointer",
});

/* ---------- HOME PAGE CARD ---------- */
export function LudoCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden rounded-2xl border border-sky-900/60 bg-gradient-to-br from-[#0e2a5c] via-[#0a1d42] to-[#0a0f1a] p-3 text-left"
    >
      <span className="rounded-full bg-sky-400 px-2 py-0.5 text-[10px] font-bold text-black">BOT + ONLINE</span>
      <svg viewBox="-1 -1 22 22" className="mx-auto mt-2 h-16 w-16">
        <rect x="0" y="0" width="20" height="20" rx="3" fill="#ffffff" />
        <rect x="0" y="0" width="8" height="8" rx="2" fill={HEX.red} />
        <rect x="12" y="0" width="8" height="8" rx="2" fill={HEX.green} />
        <rect x="12" y="12" width="8" height="8" rx="2" fill={HEX.yellow} />
        <rect x="0" y="12" width="8" height="8" rx="2" fill={HEX.blue} />
        <circle cx="10" cy="10" r="3" fill="#0b1d4d" />
      </svg>
      <div className="absolute inset-x-3 bottom-3 text-center text-base font-semibold text-white">Ludo</div>
    </button>
  );
}

/* ---------- MAIN ---------- */
export default function LudoGame({ onClose, balance, onBalanceChange, user }) {
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

  const [screen, setScreen] = useState("lobby"); // lobby | searching | playing | over
  const [mode, setMode] = useState("bot"); // bot | online
  const [count, setCount] = useState(2);
  const [bet, setBet] = useState(50);
  const [note, setNote] = useState("");
  const [joined, setJoined] = useState([]);
  const [g, setG] = useState(null);
  const [muted, setMuted] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const [noPlayersFound, setNoPlayersFound] = useState(false);
  const [botSettings, setBotSettings] = useState({ difficulty: "medium", overrideEnabled: false, forceResult: "none" });

  const gRef = useRef(null);
  const aliveRef = useRef(true);
  const runIdRef = useRef(0);
  const pendRef = useRef(null);
  const matchRef = useRef({ cancelled: false });
  const betRef = useRef(50);
  const queueIdRef = useRef(null);
  const searchTimerRef = useRef(null);
  const realtimeUnsubRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const pollFallbackRef = useRef(null);
  const eventsChannelRef = useRef(null);
  const lastEventSeqRef = useRef(0);
  const remoteRollResolverRef = useRef(null);
  const remotePickResolverRef = useRef(null);
  const snd = useSnd();

  const myUid = user?.uid || `guest_${Date.now()}`;
  const myName = user?.name || user?.email?.split("@")[0] || "You";

  const commit = (ng) => {
    gRef.current = ng;
    setG(ng);
  };
  const patch = (o) => commit({ ...gRef.current, ...o });
  const waitHuman = (kind) =>
    new Promise((res) => {
      pendRef.current = { kind, res };
    });
  const resolvePending = () => {
    const p = pendRef.current;
    pendRef.current = null;
    if (p) p.res(null);
  };

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      matchRef.current.cancelled = true;
      runIdRef.current++;
      resolvePending();
      if (remoteRollResolverRef.current) { remoteRollResolverRef.current = null; }
      if (remotePickResolverRef.current) { remotePickResolverRef.current = null; }
      if (eventsChannelRef.current) { try { eventsChannelRef.current(); } catch (e) {} eventsChannelRef.current = null; }
      cleanupSearch();
      snd.close();
    };
  }, []);

  // Fetch bot difficulty settings from Firebase
  useEffect(() => {
    const unsub = onValue(ref(db, "game_settings/ludo"), (snap) => {
      if (snap.exists()) {
        const s = snap.val();
        setBotSettings({
          difficulty: s.botDifficulty || "medium",
          overrideEnabled: s.overrideEnabled || false,
          forceResult: s.forceResult || "none",
        });
      }
    });
    return () => unsub();
  }, []);

  const cleanupSearch = () => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollFallbackRef.current) {
      clearInterval(pollFallbackRef.current);
      pollFallbackRef.current = null;
    }
    if (realtimeUnsubRef.current) {
      realtimeUnsubRef.current();
      realtimeUnsubRef.current = null;
    }
    // Remove our own queue row if still searching
    if (queueIdRef.current) {
      leaveQueue(queueIdRef.current).catch(() => {});
      queueIdRef.current = null;
    }
  };

  /* ----- matchmaking (real online players only, no bots) ----- */
  const startSearch = async () => {
    if (screen !== "lobby") return;
    if (bet > balRef.current) {
      setNote("ব্যালেন্স যথেষ্ট নয়");
      return;
    }
    snd.ensure();
    setNote("");
    setNoPlayersFound(false);
    setSearchElapsed(0);
    betRef.current = bet;
    setBal(balRef.current - bet);
    const token = { cancelled: false };
    matchRef.current = token;

    const myColor = SEAT_COLORS[count][0];
    const me = { color: myColor, human: true, name: myName, uid: myUid };
    setJoined([me]);
    setScreen("searching");

    // Clean up stale searching rows (older than 60s)
    try {
      await purgeStaleSearches(Date.now() - 60000);
    } catch (e) {}

    // Insert our own queue row
    let queueId = null;
    try {
      queueId = await joinQueue({
        player_uid: myUid,
        player_name: myName,
        player_count: count,
        bet_amount: bet,
        color: myColor,
      });
    } catch (e) {}

    if (!queueId) {
      setBal(balRef.current + bet);
      setNote("Search শুরু করা যায়নি। আবার চেষ্টা করুন।");
      setScreen("lobby");
      return;
    }
    queueIdRef.current = queueId;

    // Start elapsed timer
    const startTime = Date.now();
    pollIntervalRef.current = setInterval(() => {
      setSearchElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 500);

    // Subscribe to realtime changes on the queue
    realtimeUnsubRef.current = subscribeQueue(() => checkQueueState(token));

    // Also poll every 2 seconds as a fallback
    pollFallbackRef.current = setInterval(() => checkQueueState(token), 2000);

    // Do an immediate check
    checkQueueState(token);

    // Set timeout — if not enough players found, show "No players found"
    searchTimerRef.current = setTimeout(() => {
      if (token.cancelled) return;
      handleNoPlayersFound(token);
    }, SEARCH_TIMEOUT_MS);
  };

  const checkQueueState = async (token) => {
    if (token.cancelled || !queueIdRef.current) return;
    try {
      const ownRow = await getQueueRow(queueIdRef.current);

      if (ownRow?.status === "matched" && ownRow.match_id) {
        const match = await getMatch(ownRow.match_id);
        const players = match?.players ?? [];
        if (match && players.length >= count) {
          const seats = normalizeSeats(players, count);
          cleanupSearch();
          beginGame(seats, Number(match.bet_amount), match.id);
        }
        return;
      }

      const rows = await listSearchingQueue(count, betRef.current);
      if (token.cancelled) return;

      // Update joined list from queue rows (including ourselves)
      const colorOrder = SEAT_COLORS[count];
      const uniqueRows = rows.filter((row, index, all) => all.findIndex((candidate) => candidate.player_uid === row.player_uid) === index);
      const sortedRows = uniqueRows.sort((a, b) => {
        const ai = colorOrder.indexOf(a.color);
        const bi = colorOrder.indexOf(b.color);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
      const seats = normalizeSeats(
        sortedRows.map((r) => ({
          name: r.player_name,
          uid: r.player_uid,
          queueId: r.id,
        })),
        count,
      );
      setJoined(seats);

      // Check if we have enough players
      if (uniqueRows.length >= count) {
        // We are the earliest queued player (smallest created_at) → we create the match
        const myRow = rows.find((r) => r.id === queueIdRef.current);
        const isEarliest = myRow && rows.every((r) => r.created_at >= myRow.created_at);
        if (isEarliest) {
          await createMatchFromQueue(token, seats);
        }
      }
    } catch (e) {}
  };

  const createMatchFromQueue = async (token, seats) => {
    if (token.cancelled) return;
    token.cancelled = true;

    // Create the match record
    let matchId = null;
    try {
      matchId = await createMatch({
        player_count: count,
        bet_amount: betRef.current,
        created_by: myUid,
        players: seats.map((s) => ({ uid: s.uid, name: s.name, color: s.color })),
      });
    } catch (e) {}

    if (!matchId) {
      setNote("Match তৈরি করা যায়নি। আবার চেষ্টা করুন।");
      setBal(balRef.current + betRef.current);
      cleanupSearch();
      setScreen("lobby");
      return;
    }

    // Mark all queue rows as matched
    const queueIds = seats.map((s) => s.queueId);
    await markQueueRowsMatched(queueIds, matchId);

    cleanupSearch();
    beginGame(seats, betRef.current, matchId);
  };

  const handleNoPlayersFound = (token) => {
    token.cancelled = true;
    cleanupSearch();
    setBal(balRef.current + betRef.current);
    setNoPlayersFound(true);
    setScreen("lobby");
  };

  const cancelSearch = () => {
    matchRef.current.cancelled = true;
    cleanupSearch();
    setBal(balRef.current + betRef.current);
    setScreen("lobby");
  };

  /* ----- bot mode: start immediately with bot seats ----- */
  const startBotGame = () => {
    if (bet > balRef.current) {
      setNote("ব্যালেন্স যথেষ্ট নয়");
      return;
    }
    snd.ensure();
    setNote("");
    betRef.current = bet;
    setBal(balRef.current - bet);

    const colors = SEAT_COLORS[count];
    const seats = colors.map((c, i) => ({
      color: c,
      human: i === 0,
      name: i === 0 ? myName : BOT_NAMES[i] || `Bot ${i}`,
      uid: i === 0 ? myUid : `bot_${Date.now()}_${i}`,
    }));
    beginGame(seats, bet, null);
  };

  const beginGame = (rawSeats, b, matchId) => {
    const seats = normalizeSeats(rawSeats, count);
    if (seats.length !== count || seats.some((seat) => !seat.uid || !SEAT_COLORS[count].includes(seat.color))) {
      setNote("Match data সঠিক নয়। আবার চেষ্টা করুন।");
      setScreen("lobby");
      return;
    }
    const tokens = {};
    seats.forEach((s) => {
      tokens[s.color] = [-1, -1, -1, -1];
    });
    // Deterministic turn: based on matchId hash so all players agree on the same starting turn.
    const startTurn = matchId ? Math.abs(hashString(matchId)) % seats.length : Math.floor(rnd() * seats.length);
    commit({
      seats,
      tokens,
      turn: startTurn,
      dices: {},
      rolling: false,
      canRoll: false,
      movable: [],
      msg: "",
      bet: b,
      over: null,
      matchId: matchId || null,
    });
    lastEventSeqRef.current = 0;
    setupEventsChannel(matchId);
    // The match creator emits the authoritative 'start' event so all players sync to the same turn.
    if (seats[0] && seats[0].uid === myUid) {
      emitEvent(matchId, "start", { turn: startTurn }).catch(() => {});
    }
    setScreen("playing");
  };

  const hashString = (s) => {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return h;
  };

  const emitEvent = async (matchId, kind, payload) => {
    if (!matchId) return;
    const seq = lastEventSeqRef.current + 1;
    try {
      await appendMatchEvent(matchId, { seq, actor_uid: myUid, kind, payload });
      lastEventSeqRef.current = Math.max(lastEventSeqRef.current, seq);
    } catch (e) {}
  };

  const setupEventsChannel = (matchId) => {
    if (eventsChannelRef.current) {
      try { eventsChannelRef.current(); } catch (e) {}
      eventsChannelRef.current = null;
    }
    if (!matchId) return;
    eventsChannelRef.current = subscribeMatchEvents(matchId, (ev) => handleRemoteEvent(ev));
  };

  const handleRemoteEvent = (ev) => {
    if (!ev || ev.actor_uid === myUid) return;
    if (ev.seq <= lastEventSeqRef.current) return;
    lastEventSeqRef.current = ev.seq;
    if (ev.kind === "roll") {
      // Remote player rolled — resolve the local "wait for remote roll".
      if (remoteRollResolverRef.current) {
        const res = remoteRollResolverRef.current;
        remoteRollResolverRef.current = null;
        res(ev.payload.die);
      }
    } else if (ev.kind === "pick") {
      if (remotePickResolverRef.current) {
        const res = remotePickResolverRef.current;
        remotePickResolverRef.current = null;
        res(ev.payload.tokenIndex);
      }
    } else if (ev.kind === "start") {
      const cur = gRef.current;
      if (cur && typeof ev.payload.turn === "number") {
        commit({ ...cur, turn: ev.payload.turn });
      }
    } else if (ev.kind === "finish") {
      const cur = gRef.current;
      if (cur && ev.payload.winner) {
        const winnerSeat = cur.seats.find((s) => s.uid === ev.payload.winner.uid);
        if (winnerSeat) finishGame(winnerSeat);
      }
    }
  };

  const finishGame = (winner) => {
    const cur = gRef.current;
    const prize = round2(cur.bet * cur.seats.length * (1 - COMMISSION));
    const isMyWin = winner.uid === myUid;
    if (isMyWin) {
      setBal(balRef.current + prize);
      snd.win();
    } else snd.lose();
    commit({ ...cur, movable: [], canRoll: false, rolling: false, over: { winner, prize } });
    if (cur.matchId && isMyWin) {
      claimMatchResult(cur.matchId, {
        winner_uid: myUid,
        winner_name: winner.name,
        bet_amount: cur.bet,
        reward_amount: prize,
        player_count: cur.seats.length,
      }).catch(() => {});
    }
    // Broadcast finish so all players end the game.
    if (cur.matchId) {
      emitEvent(cur.matchId, "finish", { winner: { uid: winner.uid, name: winner.name } }).catch(() => {});
    }
    setScreen("over");
  };

  /* ----- game loop ----- */
  const runLoop = async (id) => {
    const live = () => aliveRef.current && runIdRef.current === id;
    let sixes = 0;
    const nextTurn = () => {
      const cur = gRef.current;
      commit({ ...cur, turn: (cur.turn + 1) % cur.seats.length });
      sixes = 0;
    };
    while (live()) {
      const cur = gRef.current;
      const seat = cur.seats[cur.turn];
      const isMyTurn = seat.uid === myUid;
      const isBot = !seat.human && seat.uid !== myUid;
      patch({
        msg: isMyTurn ? "আপনার চাল, dice-এ চাপ দিন" : isBot ? `${seat.name} ভাবছে...` : `${seat.name}-এর চাল অপেক্ষা করা হচ্ছে...`,
        canRoll: isMyTurn,
        movable: [],
        dices: { ...cur.dices, [seat.color]: null },
      });
      let d;
      if (isMyTurn) {
        const ok = await waitHuman("roll");
        if (!live() || !ok) return;
        patch({ canRoll: false, rolling: true });
        snd.roll();
        await sleep(650);
        if (!live()) return;
        d = rollDie();
        // Broadcast my roll to other players.
        if (cur.matchId) emitEvent(cur.matchId, "roll", { die: d }).catch(() => {});
      } else if (isBot) {
        // Bot auto-rolls after a short delay
        await sleep(600 + rnd() * 600);
        if (!live()) return;
        patch({ rolling: true });
        snd.roll();
        await sleep(650);
        if (!live()) return;
        const botLuck = { easy: 10, medium: 25, hard: 45, impossible: 70 }[botSettings.difficulty] || 25;
        d = botRollDie(botLuck);
      } else {
        // Wait for the remote player's roll via the events channel.
        d = await new Promise((res) => {
          remoteRollResolverRef.current = res;
        });
        if (!live()) return;
        patch({ rolling: true });
        snd.roll();
        await sleep(650);
        if (!live()) return;
      }
      const who = isMyTurn ? "আপনার" : `${seat.name}-এর`;
      patch({ rolling: false, dices: { ...gRef.current.dices, [seat.color]: d }, msg: `${who} ${d} পড়েছে` });
      await sleep(500);
      if (!live()) return;

      if (d === 6) sixes++;
      else sixes = 0;
      if (sixes >= 3) {
        patch({ msg: "৩ বার 6! চাল বাতিল" });
        await sleep(1000);
        if (!live()) return;
        nextTurn();
        continue;
      }

      const mv = movableTokens(gRef.current.tokens[seat.color], d);
      if (mv.length === 0) {
        patch({ msg: `${who} ${d} পড়েছে, কোনো চাল নেই` });
        await sleep(900);
        if (!live()) return;
        nextTurn();
        continue;
      }

      let ti;
      patch({
        movable: isMyTurn ? mv : [],
        msg: isMyTurn
          ? (mv.length > 1 ? `আপনার ${d} পড়েছে, একটি গুটি বেছে নিন` : `আপনার ${d} পড়েছে`)
          : isBot ? `${seat.name} গুটি বাছছে...` : `${seat.name}-এর চাল অপেক্ষা করা হচ্ছে...`,
      });
      if (isMyTurn) {
        if (mv.length === 1) {
          await sleep(500);
          ti = mv[0];
        } else {
          ti = await waitHuman("pick");
          if (!live() || ti == null) return;
        }
        // Broadcast my pick to other players.
        if (cur.matchId) emitEvent(cur.matchId, "pick", { tokenIndex: ti }).catch(() => {});
      } else if (isBot) {
        await sleep(400 + rnd() * 500);
        if (!live()) return;
        const botAccuracy = { easy: 30, medium: 60, hard: 85, impossible: 98 }[botSettings.difficulty] || 60;
        ti = pickBotMove(gRef.current.tokens, seat.color, d, botAccuracy);
      } else {
        // Wait for the remote player's pick via the events channel.
        ti = await new Promise((res) => {
          remotePickResolverRef.current = res;
        });
        if (!live() || ti == null) return;
      }
      patch({ movable: [] });
      if (!live()) return;

      const res = applyMove(gRef.current.tokens, seat.color, ti, d);
      for (const r of res.path) {
        const t = gRef.current.tokens;
        commit({ ...gRef.current, tokens: { ...t, [seat.color]: t[seat.color].map((x, i) => (i === ti ? r : x)) } });
        snd.step();
        await sleep(STEP_MS);
        if (!live()) return;
      }
      if (res.captured.length) {
        snd.capture();
        commit({ ...gRef.current, tokens: res.final, msg: "গুটি কাটা পড়েছে! আবার চাল" });
        await sleep(550);
        if (!live()) return;
      }
      if (res.finished) {
        snd.home();
        patch({ msg: "গুটি ঘরে পৌঁছেছে!" });
      }
      const homeCount = gRef.current.tokens[seat.color].filter((r) => r === HOME).length;
      if (homeCount >= TOKENS_TO_WIN) {
        // Check manual override
        if (botSettings.overrideEnabled && botSettings.forceResult !== "none") {
          const playerSeat = gRef.current.seats.find((s) => s.uid === myUid);
          const botSeat = gRef.current.seats.find((s) => s.uid !== myUid && !s.human);
          if (botSettings.forceResult === "bot_win" && botSeat) {
            finishGame(botSeat);
          } else if (botSettings.forceResult === "player_win" && playerSeat) {
            finishGame(playerSeat);
          } else {
            finishGame(seat);
          }
        } else {
          finishGame(seat);
        }
        return;
      }
      if (res.extra) {
        if (!res.captured.length && !res.finished) patch({ msg: "6 পেয়েছেন, আবার চাল!" });
        await sleep(450);
        if (!live()) return;
        continue;
      }
      nextTurn();
    }
  };

  useEffect(() => {
    if (screen !== "playing") return;
    const id = ++runIdRef.current;
    runLoop(id);
    return () => {
      runIdRef.current++;
      resolvePending();
    };
  }, [screen]);

  /* ----- human input ----- */
  const onRoll = () => {
    const p = pendRef.current;
    if (p && p.kind === "roll") {
      pendRef.current = null;
      snd.ensure();
      p.res(true);
    }
  };
  const onPick = (ti) => {
    const p = pendRef.current;
    if (p && p.kind === "pick" && gRef.current.movable.includes(ti)) {
      pendRef.current = null;
      p.res(ti);
    }
  };

  const toLobby = () => {
    if (eventsChannelRef.current) { try { eventsChannelRef.current(); } catch (e) {} eventsChannelRef.current = null; }
    if (remoteRollResolverRef.current) { remoteRollResolverRef.current = null; }
    if (remotePickResolverRef.current) { remotePickResolverRef.current = null; }
    setG(null);
    gRef.current = null;
    setScreen("lobby");
  };
  const forfeit = () => {
    runIdRef.current++;
    resolvePending();
    setConfirmQuit(false);
    toLobby();
  };
  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    snd.setMuted(m);
  };
  const back = () => {
    if (screen === "lobby") onClose && onClose();
    else if (screen === "searching") cancelSearch();
    else if (screen === "playing") setConfirmQuit(true);
    else if (screen === "over") toLobby();
  };

  /* ---------- RENDER ---------- */
  const prizeFor = (b, n) => round2(b * n * (1 - COMMISSION));

  const styleTag = (
    <style>{`
      @keyframes ludo-ring { 0%,100% { transform: scale(.85); opacity: 1; } 50% { transform: scale(1.2); opacity: .5; } }
      .ludo-ring { animation: ludo-ring .8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      @keyframes ludo-shake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-10deg) scale(1.05); } 75% { transform: rotate(10deg) scale(1.05); } }
      .ludo-shake { animation: ludo-shake .16s linear infinite; }
      @keyframes ludo-glow { 0%,100% { box-shadow: 0 0 0 0 rgba(253,224,71,.9); } 50% { box-shadow: 0 0 0 8px rgba(253,224,71,0); } }
      .ludo-glow { animation: ludo-glow 1s ease-out infinite; }
      @keyframes ludo-bob { 0%,100% { margin-left: 0; } 50% { margin-left: 5px; } }
      .ludo-bob { animation: ludo-bob .7s ease-in-out infinite; }
      @keyframes ludo-spin { to { transform: rotate(360deg); } }
    `}</style>
  );

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {(onClose || screen !== "lobby") && (
          <button onClick={back} style={{ padding: 6, borderRadius: 999, background: "transparent", color: "#fff" }}>
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <span style={{ fontSize: 16, fontWeight: 800 }}>Ludo</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={toggleMute} style={{ padding: 6, background: "transparent", color: "#fff" }}>
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <div
          style={{
            border: "1px solid rgba(255,255,255,.25)",
            background: "rgba(0,0,0,.3)",
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {money(bal)}
        </div>
      </div>
    </div>
  );

  /* lobby */
  if (screen === "lobby") {
    const modeBtnStyle = (active, color) => ({
      flex: 1,
      borderRadius: 12,
      border: active ? `2px solid ${color}` : "2px solid rgba(255,255,255,0.18)",
      background: active ? `${color}22` : "rgba(255,255,255,0.07)",
      color: active ? color : "#fff",
      fontWeight: 700,
      padding: "12px 8px",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 4,
      fontSize: 13,
      transition: "all .2s",
    });
    return (
      <Shell>
        {styleTag}
        {header}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 24px" }}>
          {/* Mode selector */}
          <div style={{ ...glass, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "rgba(255,255,255,.85)" }}>গেম মোড</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setMode("bot")} style={modeBtnStyle(mode === "bot", "#a78bfa")}>
                <Bot size={20} />
                Bot
                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>AI প্লেয়ারের সাথে</span>
              </button>
              <button onClick={() => setMode("online")} style={modeBtnStyle(mode === "online", "#34d399")}>
                <Wifi size={20} />
                Online
                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>আসল প্লেয়ার</span>
              </button>
            </div>
          </div>

          <div style={{ ...glass, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "rgba(255,255,255,.85)" }}>কতজন খেলবে?</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {PLAYER_COUNTS.map((n) => (
                <button key={n} onClick={() => setCount(n)} style={chipStyle(count === n)}>
                  {n} জন
                </button>
              ))}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, margin: "16px 0 8px", color: "rgba(255,255,255,.85)" }}>Bet amount</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {BETS.map((b) => (
                <button key={b} onClick={() => setBet(b)} style={chipStyle(bet === b)}>
                  ৳{b}
                </button>
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(0,0,0,.3)",
                borderRadius: 12,
                padding: "10px 12px",
              }}
            >
              <span style={{ fontSize: 14, color: "rgba(255,255,255,.75)" }}>জয়ী পাবে (Prize)</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#6ee7b7" }}>{money(prizeFor(bet, count))}</span>
            </div>
          </div>

          {noPlayersFound && (
            <div
              style={{
                marginTop: 12,
                textAlign: "center",
                background: "rgba(244,63,94,.25)",
                color: "#fecdd3",
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              No players found. Try again.
            </div>
          )}

          {note && (
            <div
              style={{
                marginTop: 12,
                textAlign: "center",
                background: "rgba(244,63,94,.25)",
                color: "#fecdd3",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {note}
            </div>
          )}

          {mode === "bot" ? (
            <>
              <button
                onClick={startBotGame}
                style={{
                  marginTop: 16,
                  width: "100%",
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #7c3aed, #a78bfa)",
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 800,
                  padding: "16px 0",
                  boxShadow: "0 6px 18px rgba(124,58,237,.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Bot size={22} /> Play with Bot
              </button>
              <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.7)" }}>
                Bot মোড · Bet আগেই কাটা হয় · জিতলে Prize ব্যালেন্সে যোগ হয়
              </div>
            </>
          ) : (
            <>
              <button
                onClick={startSearch}
                style={{
                  marginTop: 16,
                  width: "100%",
                  borderRadius: 16,
                  background: "#10b981",
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 800,
                  padding: "16px 0",
                  boxShadow: "0 6px 18px rgba(16,185,129,.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Wifi size={22} /> Play Online
              </button>
              <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,.7)" }}>
                Online মোড · Bet আগেই কাটা হয় · জিতলে Prize ব্যালেন্সে যোগ হয়
              </div>
              <div style={{ marginTop: 6, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,.5)" }}>
                Online মোডে শুধুমাত্র সত্যিকারের প্লেয়ার
              </div>
            </>
          )}
        </div>
      </Shell>
    );
  }

  /* searching */
  if (screen === "searching") {
    const slots = SEAT_COLORS[count];
    return (
      <Shell>
        {styleTag}
        {header}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 999,
              border: "4px solid rgba(255,255,255,.22)",
              borderTopColor: "#ffd84a",
              marginBottom: 20,
              animation: "ludo-spin 0.9s linear infinite",
            }}
          />
          <div style={{ fontSize: 20, fontWeight: 800 }}>প্লেয়ার খোঁজা হচ্ছে...</div>
          <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,.75)" }}>Searching for real players</div>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "#ffd84a" }}>
            {Math.floor(searchElapsed / 60)}:{String(searchElapsed % 60).padStart(2, "0")} / {Math.floor(SEARCH_TIMEOUT_MS / 60)}:{String((SEARCH_TIMEOUT_MS / 1000) % 60).padStart(2, "0")}
          </div>
          <div style={{ marginTop: 24, width: "100%", maxWidth: 320, display: "grid", gap: 8 }}>
            {slots.map((c) => {
              const s = joined.find((j) => j.color === c);
              return (
                <div
                  key={c}
                  style={{
                    ...glass,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 999,
                      border: "2px solid #fff",
                      background: s ? HEX[c] : "transparent",
                      opacity: s ? 1 : 0.4,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 700, opacity: s ? 1 : 0.5 }}>
                    {s ? (s.uid === myUid ? "You" : s.name) : "খোঁজা হচ্ছে..."}
                  </span>
                  {s && <span style={{ color: "#6ee7b7" }}>✓</span>}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, ...glass, borderRadius: 12, padding: "8px 16px", fontSize: 14 }}>
            Bet {money(betRef.current)} · Prize {money(prizeFor(betRef.current, count))}
          </div>
          <button
            onClick={cancelSearch}
            style={{
              marginTop: 24,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.35)",
              background: "transparent",
              color: "rgba(255,255,255,.9)",
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Cancel (টাকা ফেরত)
          </button>
        </div>
      </Shell>
    );
  }

  /* playing / over */
  if (!g) {
    return (
      <Shell>
        {styleTag}
        {header}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ ...glass, width: "100%", padding: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>গেম লোড হচ্ছে...</div>
            <div style={{ marginTop: 6, color: "rgba(255,255,255,.75)", fontSize: 13 }}>Match state পাওয়া যায়নি। আবার চেষ্টা করুন।</div>
            <button onClick={toLobby} style={{ marginTop: 16, borderRadius: 12, background: "#10b981", color: "#fff", padding: "10px 24px", fontSize: 14, fontWeight: 800 }}>
              Lobby-তে ফিরুন
            </button>
          </div>
        </div>
      </Shell>
    );
  }
  const seatOf = (c) => g.seats.find((s) => s.color === c) || null;
  const cur = g.seats[g.turn] || g.seats[0];
  const humanMovable = cur && cur.uid === myUid && !g.over ? g.movable : [];
  const humanColor = g.seats.find((seat) => seat.uid === myUid)?.color;
  const colorAtBoardPos = (pos) => COLORS[(pos - boardRotation(humanColor) + 4) % 4];
  const activeColor = g.over ? null : cur?.color;

  return (
    <Shell>
      {styleTag}
      {header}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingBottom: 60,
        }}
      >
        <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,.85)", marginBottom: 16 }}>
          Bet {money(g.bet)} · Prize <b style={{ color: "#6ee7b7" }}>{money(prizeFor(g.bet, g.seats.length))}</b> · {g.seats.length} জন
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8%", marginBottom: 16 }}>
          <SeatPanel seat={seatOf(colorAtBoardPos(0))} g={g} onRoll={onRoll} myUid={myUid} />
          <SeatPanel seat={seatOf(colorAtBoardPos(1))} g={g} onRoll={onRoll} flip myUid={myUid} />
        </div>

        <div style={{ padding: "0 2%", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.5))" }}>
          <Board
            seats={g.seats}
            tokens={g.tokens}
            humanColor={humanColor}
            movable={humanMovable}
            onPick={onPick}
            activeColor={activeColor}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 8%", marginTop: 20 }}>
          <SeatPanel seat={seatOf(colorAtBoardPos(3))} g={g} onRoll={onRoll} myUid={myUid} />
          <SeatPanel seat={seatOf(colorAtBoardPos(2))} g={g} onRoll={onRoll} flip myUid={myUid} />
        </div>

        <div
          style={{
            margin: "16px 16px 0",
            minHeight: 32,
            borderRadius: 999,
            background: "rgba(0,0,0,.35)",
            padding: "6px 14px",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {g.over ? "গেম শেষ" : g.msg || " "}
        </div>
      </div>

      {!g.over && (
        <button
          onClick={() => setConfirmQuit(true)}
          style={{
            position: "absolute",
            left: 14,
            bottom: 14,
            width: 46,
            height: 46,
            borderRadius: 12,
            border: "3px solid #f1c232",
            background: "linear-gradient(#1c58c0,#0a2f7a)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            zIndex: 5,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 22, height: 4, borderRadius: 2, background: "#ffe27a" }} />
          ))}
        </button>
      )}

      {confirmQuit && !g.over && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            background: "rgba(0,0,0,.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 32px",
          }}
        >
          <div style={{ width: "100%", borderRadius: 16, background: "#101a33", padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>গেম ছেড়ে দেবেন?</div>
            <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,.75)" }}>
              ছেড়ে দিলে Bet {money(g.bet)} ফেরত পাবেন না।
            </div>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button
                onClick={() => setConfirmQuit(false)}
                style={{ borderRadius: 12, background: "#10b981", color: "#fff", padding: "10px 0", fontSize: 14, fontWeight: 800 }}
              >
                খেলা চালান
              </button>
              <button
                onClick={forfeit}
                style={{ borderRadius: 12, background: "#f43f5e", color: "#fff", padding: "10px 0", fontSize: 14, fontWeight: 800 }}
              >
                ছেড়ে দিন
              </button>
            </div>
          </div>
        </div>
      )}

      {g.over && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 60,
            background: "rgba(0,0,0,.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 32px",
          }}
        >
          <div style={{ ...glass, background: "#101a33", width: "100%", padding: 24, textAlign: "center" }}>
            {g.over.winner.uid === myUid ? (
              <>
                <div style={{ fontSize: 40 }}>🎉</div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800, color: "#6ee7b7" }}>আপনি জিতেছেন!</div>
                <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800 }}>+{money(g.over.prize)}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40 }}>😔</div>
                <div style={{ marginTop: 8, fontSize: 20, fontWeight: 800, color: "#fda4af" }}>{g.over.winner.name} জিতেছে</div>
                <div style={{ marginTop: 4, fontSize: 14, color: "rgba(255,255,255,.75)" }}>Bet {money(g.bet)} হারিয়েছেন</div>
              </>
            )}
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: onClose ? "1fr 1fr" : "1fr", gap: 12 }}>
              <button
                onClick={toLobby}
                style={{ borderRadius: 12, background: "#10b981", color: "#fff", padding: "12px 0", fontSize: 14, fontWeight: 800 }}
              >
                আবার খেলুন
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.35)",
                    background: "transparent",
                    color: "#fff",
                    padding: "12px 0",
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  বের হন
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
