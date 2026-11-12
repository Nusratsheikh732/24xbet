import { useState, useEffect, useRef, useMemo } from "react";
import { TrendingUp, ArrowLeft, Home, Wallet, PieChart } from "lucide-react";
import { db, ref, onValue } from "@/lib/firebase";

/* =====================================================================
   TRADING MODULE
   Price: Bybit public feed (API key লাগে না)।
   ===================================================================== */

/* ---------- CONFIG (এখানে বদলাতে পারবেন) ---------- */
const COINS = ["BTC", "ETH", "SUI", "BNB", "XRP", "ZEC", "ARB", "APT", "SOL", "XAUT", "DOGE", "PEPE", "TRUMP"];
const USDT_BDT = 120; // 1 USDT = ৳120 (ডেমো রেট)
const START_BALANCE = 0;
const START_MAIN = 990;
const SPOT_MIN = 600; // Spot-এ সর্বনিম্ন ট্রেড ৳600
const SPOT_FEE = 0.001; // 0.1%
const FUT_FEE = 0.0006; // 0.06%
const MAINT = 0.005; // maintenance margin 0.5%
const MIN_MARGIN = 10; // Future-এ সর্বনিম্ন margin ৳10
const PRED_TIMES = [
  { label: "5 sec", s: 5 },
  { label: "15 sec", s: 15 },
  { label: "30 sec", s: 30 },
  { label: "1 min", s: 60 },
  { label: "15 min", s: 900 },
  { label: "1 hour", s: 3600 },
];
const PCTS = [1, 5, 10, 20, 50, 100];
const STORE_KEY = "demo_trading_v1";

/* ---------- HELPERS ---------- */
const uid = () => Math.random().toString(36).slice(2, 9);
const fmtPrice = (p) => {
  if (p == null) return "--";
  if (p >= 100) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.01) return p.toFixed(5);
  if (p >= 0.0001) return p.toFixed(7);
  return p.toFixed(9);
};
const money = (n) =>
  "৳" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sgn = (n) => (n >= 0 ? "+" : "-") + money(Math.abs(n));
const pnlColor = (n) => (n > 0 ? "text-emerald-400" : n < 0 ? "text-rose-400" : "text-slate-300");
const fmtLeft = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};
const posPnl = (ps, mark) => (ps.side === "long" ? mark - ps.entry : ps.entry - mark) * ps.size * USDT_BDT;
const liqPrice = (side, entry, lev) =>
  side === "long" ? entry * (1 - 1 / lev + MAINT) : entry * (1 + 1 / lev - MAINT);

const freshWallet = () => ({ balance: START_BALANCE, main: START_MAIN, holdings: {}, positions: [], bets: [], history: [] });
const loadWallet = () => {
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (s) return { ...freshWallet(), ...JSON.parse(s) };
  } catch (e) {}
  return freshWallet();
};

/* ---------- MARKET DATA (Bybit public) ---------- */
function useMarket() {
  const pricesRef = useRef({});
  const histRef = useRef({});
  const lastMsg = useRef(0);
  const [prices, setPrices] = useState({});
  const [live, setLive] = useState(false);

  useEffect(() => {
    let ws = null;
    let closed = false;
    let retry = null;
    let ping = null;

    const onTick = (coin, last, chg) => {
      const now = Date.now();
      lastMsg.current = now;
      pricesRef.current[coin] = { last, chg, t: now };
      const h = (histRef.current[coin] = histRef.current[coin] || []);
      const lp = h[h.length - 1];
      if (!lp || now - lp[0] >= 500) {
        h.push([now, last]);
        if (h.length > 1200) h.splice(0, h.length - 1200);
      }
    };

    const connect = () => {
      try {
        ws = new WebSocket("wss://stream.bybit.com/v5/public/spot");
      } catch (e) {
        return;
      }
      ws.onopen = () => {
        const args = COINS.map((c) => "tickers." + c + "USDT");
        for (let i = 0; i < args.length; i += 10) {
          ws.send(JSON.stringify({ op: "subscribe", args: args.slice(i, i + 10) }));
        }
        ping = setInterval(() => {
          try {
            ws.send(JSON.stringify({ op: "ping" }));
          } catch (e) {}
        }, 20000);
      };
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.topic && m.topic.indexOf("tickers.") === 0 && m.data && m.data.lastPrice) {
            const coin = m.data.symbol.slice(0, -4);
            if (COINS.includes(coin)) {
              onTick(coin, parseFloat(m.data.lastPrice), parseFloat(m.data.price24hPcnt || 0) * 100);
            }
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        clearInterval(ping);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch (e) {}
      };
    };

    const rest = async () => {
      try {
        const r = await fetch("https://api.bybit.com/v5/market/tickers?category=spot");
        const j = await r.json();
        (j.result.list || []).forEach((d) => {
          if (d.symbol.endsWith("USDT")) {
            const coin = d.symbol.slice(0, -4);
            if (COINS.includes(coin)) onTick(coin, parseFloat(d.lastPrice), parseFloat(d.price24hPcnt || 0) * 100);
          }
        });
      } catch (e) {}
    };

    connect();
    rest();
    const restTimer = setInterval(() => {
      if (Date.now() - lastMsg.current > 5000) rest();
    }, 5000);
    const flush = setInterval(() => {
      setPrices({ ...pricesRef.current });
      setLive(Date.now() - lastMsg.current < 8000);
    }, 500);

    return () => {
      closed = true;
      clearTimeout(retry);
      clearInterval(ping);
      clearInterval(restTimer);
      clearInterval(flush);
      try {
        ws && ws.close();
      } catch (e) {}
    };
  }, []);

  return { prices, pricesRef, histRef, live };
}

// expiry মুহূর্তের price (ব্যাকগ্রাউন্ডে থাকলেও ঠিক সময়ের price নেয়)
function priceAt(histRef, pricesRef, coin, t) {
  const h = histRef.current[coin] || [];
  for (let i = h.length - 1; i >= 0; i--) {
    if (h[i][0] <= t) {
      if (t - h[i][0] <= 5000) return h[i][1];
      break;
    }
  }
  const cur = pricesRef.current[coin];
  if (cur && Date.now() - t < 3000) return cur.last;
  return null;
}

function useNow(ms = 250) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

/* ---------- SETTLEMENT (idempotent) ---------- */
let tradingRtp = 90;
function settleAll(prev, betRes, posRes) {
  const n = {
    ...prev,
    bets: [...prev.bets],
    positions: [...prev.positions],
    history: [...prev.history],
  };
  const now = Date.now();

  betRes.forEach((r) => {
    const i = n.bets.findIndex((b) => b.id === r.id);
    if (i < 0) return;
    const b = n.bets[i];
    n.bets.splice(i, 1);
    const tl = (PRED_TIMES.find((t) => t.s === b.secs) || {}).label || b.secs + "s";
    let back = 0;
    let pnl = 0;
    let text;
    if (r.void) {
      back = b.amount;
      text = "Void, refund";
    } else if (r.price === b.entry) {
      back = b.amount;
      text = "Tie, refund";
    } else {
      const wentUp = r.price > b.entry;
      const win = (b.side === "up") === wentUp;
      if (win) {
        back = b.amount * (1 + tradingRtp / 100);
        pnl = back - b.amount;
        text = "Won";
      } else {
        pnl = -b.amount;
        text = "Lost";
      }
    }
    n.balance += back;
    n.history.unshift({
      id: uid(),
      type: "prediction",
      coin: b.coin,
      text: `${b.side.toUpperCase()} ${tl} ${text}`,
      pnl,
      auto: true,
      time: now,
    });
  });

  posRes.forEach((r) => {
    const i = n.positions.findIndex((p) => p.id === r.id);
    if (i < 0) return;
    const ps = n.positions[i];
    n.positions.splice(i, 1);
    let pnl;
    let back;
    if (r.reason === "Liquidated") {
      pnl = -ps.margin;
      back = 0;
    } else {
      const fee = ps.size * r.price * USDT_BDT * FUT_FEE;
      pnl = posPnl(ps, r.price) - fee;
      back = Math.max(0, ps.margin + pnl);
      if (back === 0) pnl = -ps.margin;
    }
    n.balance += back;
    n.history.unshift({
      id: uid(),
      type: "future",
      coin: ps.coin,
      text: `${ps.side.toUpperCase()} ${ps.lev}x ${r.reason}`,
      pnl,
      auto: r.reason !== "Closed",
      time: now,
    });
  });

  n.history = n.history.slice(0, 100);
  return n;
}

/* ---------- SMALL UI PIECES ---------- */
const AV_COLORS = ["#f59e0b", "#6366f1", "#06b6d4", "#ec4899", "#10b981", "#f97316", "#8b5cf6", "#3b82f6"];
const COIN_ICONS = {
  DOGE: "https://i.postimg.cc/vBKnm2Mz/images-(1)-(4).jpg",
  XAUT: "https://i.postimg.cc/Bb1KP5QK/images-(10).png",
  PEPE: "https://i.postimg.cc/J0BkH34B/images-(11).png",
  SOL: "https://i.postimg.cc/W1V5jzX9/images-(1)-(1).jpg",
  TRUMP: "https://i.postimg.cc/sD7Tt79q/images-(1)-(2).jpg",
  XRP: "https://i.postimg.cc/PrYSBYzV/images-(1)-(3).jpg",
  SUI: "https://i.postimg.cc/rwTfcsQQ/images-(4).png",
  BNB: "https://i.postimg.cc/L8SxR5Nv/images-(5).png",
  ARB: "https://i.postimg.cc/Mpw9xHd5/images-(6).png",
  APT: "https://i.postimg.cc/fTm86mjP/images-(7).png",
  ETH: "https://i.postimg.cc/15wvLwcj/images-(8).png",
  BTC: "https://i.postimg.cc/qRxdpqKh/images-(1)-(1).png",
};
function Avatar({ coin, size = 36 }) {
  const [bad, setBad] = useState(false);
  const src = COIN_ICONS[coin];
  if (src && !bad) {
    return (
      <img
        src={src}
        alt={coin}
        onError={() => setBad(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const c = AV_COLORS[coin.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV_COLORS.length];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{ width: size, height: size, background: c }}
    >
      {coin.slice(0, 3)}
    </span>
  );
}

function Chips({ items, value, onPick, cols = 3 }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onPick(it.key)}
          className={`rounded-xl border px-2 py-2.5 text-sm font-semibold ${
            value === it.key
              ? "border-emerald-400 bg-emerald-400/15 text-emerald-300"
              : "border-white/10 bg-white/5 text-slate-200"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Sheet({ onClose, children }) {
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/70" onClick={onClose}>
      <div
        className="max-h-[85%] w-full overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0e1522] p-4 pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ---------- LIVE CHART ---------- */
const CHART_TFS = [
  { key: "15m", label: "15m", sec: 900, k: "15" },
  { key: "1h", label: "1h", sec: 3600, k: "60" },
];
const UP_C = "#20b26c";
const DN_C = "#ef454a";
function sma(arr, p) {
  return arr.map((_, i) => {
    if (i < p - 1) return null;
    let s = 0;
    for (let j = i - p + 1; j <= i; j++) s += arr[j];
    return s / p;
  });
}
function LiveChart({ coin, pricesRef, marks = [] }) {
  const [, force] = useState(0);
  const [tfKey, setTfKey] = useState("15m");
  const [seed, setSeed] = useState({ key: "", coin: "", c: [] });
  const tf = CHART_TFS.find((t) => t.key === tfKey) || CHART_TFS[0];
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let off = false;
    const load = async () => {
      try {
        const r = await fetch(
          `https://api.bybit.com/v5/market/kline?category=spot&symbol=${coin}USDT&interval=${tf.k}&limit=100`
        );
        const j = await r.json();
        const c = (j.result.list || [])
          .map((k) => ({ t: Number(k[0]), o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]), c: parseFloat(k[4]), v: parseFloat(k[5]) }))
          .reverse();
        if (!off && c.length) setSeed({ key: tf.key, coin, c });
      } catch (e) {}
    };
    load();
    const id = setInterval(load, 20000);
    return () => {
      off = true;
      clearInterval(id);
    };
  }, [coin, tfKey]);
  const now = Date.now();
  const ms = tf.sec * 1000;
  const cur = pricesRef.current[coin];
  let candles = seed.key === tf.key && seed.coin === coin ? seed.c.map((x) => ({ ...x })) : [];
  if (cur && candles.length) {
    const last = candles[candles.length - 1];
    if (now - last.t < ms) {
      last.c = cur.last;
      last.h = Math.max(last.h, cur.last);
      last.l = Math.min(last.l, cur.last);
    } else {
      candles.push({
        t: Math.floor(now / ms) * ms,
        o: last.c,
        h: Math.max(last.c, cur.last),
        l: Math.min(last.c, cur.last),
        c: cur.last,
        v: 0,
      });
    }
  }
  const closes = candles.map((x) => x.c);
  const ma7 = sma(closes, 7);
  const ma14 = sma(closes, 14);
  const ma28 = sma(closes, 28);
  const start = Math.max(0, candles.length - 60);
  const view = candles.slice(start);
  const v7 = ma7.slice(start);
  const v14 = ma14.slice(start);
  const v28 = ma28.slice(start);
  const tabs = (
    <div className="mb-2 flex gap-2">
      {CHART_TFS.map((t) => (
        <button
          key={t.key}
          onClick={() => setTfKey(t.key)}
          className={`rounded-lg px-4 py-1.5 text-xs font-semibold ${
            tfKey === t.key ? "bg-emerald-400/20 text-emerald-300" : "bg-white/5 text-slate-400"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
  if (view.length < 2) {
    return (
      <div>
        {tabs}
        <div className="flex h-[240px] items-center justify-center rounded-2xl border border-white/10 bg-[#0b111c] text-sm text-slate-500">
          Live chart লোড হচ্ছে...
        </div>
      </div>
    );
  }
  const W = 360;
  const padR = 56;
  const pw = W - padR;
  const padT = 14;
  const priceBottom = 206;
  const volTop = 226;
  const volH = 48;
  const H = volTop + volH + 4;
  let lo = Math.min(...view.map((x) => x.l));
  let hi = Math.max(...view.map((x) => x.h));
  if (hi === lo) {
    hi = lo * 1.0005;
    lo = lo * 0.9995;
  }
  const pad = (hi - lo) * 0.06;
  lo -= pad;
  hi += pad;
  const slot = pw / (view.length + 3);
  const bw = Math.max(1.5, slot * 0.68);
  const x = (i) => (i + 0.5) * slot;
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (priceBottom - padT);
  const grid = [0.1, 0.37, 0.63, 0.9].map((f) => lo + (hi - lo) * f);
  const maPath = (arr) => {
    let d = "";
    arr.forEach((v, i) => {
      if (v == null) return;
      d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    });
    return d;
  };
  const maVal = (arr) => {
    const v = arr[arr.length - 1];
    return v == null ? "--" : fmtPrice(v);
  };
  let hiIdx = 0;
  let loIdx = 0;
  view.forEach((cd, i) => {
    if (cd.h > view[hiIdx].h) hiIdx = i;
    if (cd.l < view[loIdx].l) loIdx = i;
  });
  const vmax = Math.max(...view.map((cd) => cd.v), 1e-9);
  const lastC = view[view.length - 1];
  const lastColor = lastC.c >= lastC.o ? UP_C : DN_C;
  const fmtT = (t) => {
    const d = new Date(t);
    const hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    return tf.key === "1h" ? `${d.getDate()}/${d.getMonth() + 1} ${hm}` : hm;
  };
  const tIdx = [0.15, 0.5, 0.85].map((f) => Math.floor((view.length - 1) * f));
  const hiX = x(hiIdx);
  const loX = x(loIdx);
  return (
    <div>
      {tabs}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b111c]">
        <div className="flex gap-3 px-3 pt-2 text-[10px] font-semibold">
          <span style={{ color: "#f0b90b" }}>MA7: {maVal(v7)}</span>
          <span style={{ color: "#5b9bd5" }}>MA14: {maVal(v14)}</span>
          <span style={{ color: "#c57ad6" }}>MA28: {maVal(v28)}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full">
          {grid.map((g, i) => (
            <g key={i}>
              <line x1="0" x2={pw} y1={y(g)} y2={y(g)} stroke="#ffffff" strokeOpacity="0.06" />
              <text x={pw + 4} y={y(g) + 3} fontSize="8.5" fill="#64748b">
                {fmtPrice(g)}
              </text>
            </g>
          ))}
          {view.map((cd, i) => {
            const up = cd.c >= cd.o;
            const col = up ? UP_C : DN_C;
            const top = y(Math.max(cd.o, cd.c));
            const bh = Math.max(1, Math.abs(y(cd.o) - y(cd.c)));
            return (
              <g key={cd.t}>
                <line x1={x(i)} x2={x(i)} y1={y(cd.h)} y2={y(cd.l)} stroke={col} strokeWidth="1" />
                <rect x={x(i) - bw / 2} y={top} width={bw} height={bh} fill={col} />
              </g>
            );
          })}
          <path d={maPath(v7)} fill="none" stroke="#f0b90b" strokeWidth="1" />
          <path d={maPath(v14)} fill="none" stroke="#5b9bd5" strokeWidth="1" />
          <path d={maPath(v28)} fill="none" stroke="#c57ad6" strokeWidth="1" />
          <line x1={hiX} x2={hiX + (hiX > pw * 0.6 ? -12 : 12)} y1={y(view[hiIdx].h)} y2={y(view[hiIdx].h)} stroke="#cbd5e1" strokeWidth="0.8" />
          <text
            x={hiX + (hiX > pw * 0.6 ? -14 : 14)}
            y={y(view[hiIdx].h) + 3}
            fontSize="8"
            fill="#cbd5e1"
            textAnchor={hiX > pw * 0.6 ? "end" : "start"}
          >
            {fmtPrice(view[hiIdx].h)}
          </text>
          <line x1={loX} x2={loX + (loX > pw * 0.6 ? -12 : 12)} y1={y(view[loIdx].l)} y2={y(view[loIdx].l)} stroke="#cbd5e1" strokeWidth="0.8" />
          <text
            x={loX + (loX > pw * 0.6 ? -14 : 14)}
            y={y(view[loIdx].l) + 3}
            fontSize="8"
            fill="#cbd5e1"
            textAnchor={loX > pw * 0.6 ? "end" : "start"}
          >
            {fmtPrice(view[loIdx].l)}
          </text>
          {marks
            .filter((m) => m.price > lo && m.price < hi)
            .map((m, i) => (
              <g key={i}>
                <line x1="0" x2={pw} y1={y(m.price)} y2={y(m.price)} stroke={m.color} strokeWidth="1" strokeDasharray="4 3" />
                <text x="4" y={y(m.price) - 3} fontSize="8.5" fill={m.color}>
                  {m.label}
                </text>
              </g>
            ))}
          <line x1="0" x2={pw} y1={y(lastC.c)} y2={y(lastC.c)} stroke={lastColor} strokeWidth="0.8" strokeDasharray="3 3" />
          <rect x={pw} y={y(lastC.c) - 8} width={padR} height="16" rx="3" fill={lastColor} />
          <text x={pw + 4} y={y(lastC.c) + 3.5} fontSize="8.5" fontWeight="700" fill="#ffffff">
            {fmtPrice(lastC.c)}
          </text>
          {tIdx.map((idx, k) => (
            <text key={k} x={x(idx)} y={priceBottom + 13} fontSize="8" fill="#64748b" textAnchor="middle">
              {fmtT(view[idx].t)}
            </text>
          ))}
          {view.map((cd, i) => {
            const h = Math.max(1, (cd.v / vmax) * (volH - 2));
            return (
              <rect
                key={"v" + cd.t}
                x={x(i) - bw / 2}
                y={volTop + volH - h}
                width={bw}
                height={h}
                fill={cd.c >= cd.o ? UP_C : DN_C}
                opacity="0.65"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function CoinHeader({ coin, price }) {
  const chg = price ? price.chg : 0;
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar coin={coin} size={30} />
        <div>
          <div className="text-sm font-bold leading-tight">
            {coin}
            <span className="text-slate-500">/USDT</span>
          </div>
          <div className={`text-[11px] font-semibold ${chg >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            24h {chg >= 0 ? "+" : ""}
            {chg.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-lg font-bold leading-tight">{price ? fmtPrice(price.last) : "--"}</div>
        <div className="text-[11px] text-slate-500">≈ {price ? money(price.last * USDT_BDT) : "--"}</div>
      </div>
    </div>
  );
}

/* ---------- COIN LIST ---------- */
function CoinList({ prices, onPick }) {
  return (
    <div className="divide-y divide-white/5">
      <div className="flex px-4 py-2 text-xs text-slate-500">
        <span className="flex-1">Pair</span>
        <span className="w-28 text-right">Last price</span>
        <span className="w-20 text-right">24h</span>
      </div>
      {COINS.map((c) => {
        const p = prices[c];
        const chg = p ? p.chg : 0;
        return (
          <button key={c} onClick={() => onPick(c)} className="flex w-full items-center px-4 py-3 text-left active:bg-white/5">
            <span className="flex flex-1 items-center gap-3">
              <Avatar coin={c} />
              <span className="font-semibold">
                {c}
                <span className="text-slate-500">/USDT</span>
              </span>
            </span>
            <span className="w-28 text-right font-mono text-sm">{p ? fmtPrice(p.last) : "--"}</span>
            <span className="w-20 text-right">
              <span
                className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${
                  chg >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
                }`}
              >
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(2)}%
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- 1) PREDICTION ---------- */
function BetRow({ b, price }) {
  const now = useNow(250);
  const left = Math.max(0, Math.ceil((b.expiresAt - now) / 1000));
  const winning = price != null && (b.side === "up" ? price > b.entry : price < b.entry);
  const tl = (PRED_TIMES.find((t) => t.s === b.secs) || {}).label;
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <div>
        <div className={`text-sm font-bold ${b.side === "up" ? "text-emerald-400" : "text-rose-400"}`}>
          {b.side === "up" ? "▲ Up" : "▼ Down"} · {tl}
        </div>
        <div className="text-xs text-slate-400">
          Entry {fmtPrice(b.entry)} · Bet {money(b.amount)}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-lg font-bold">{fmtLeft(left)}</div>
        <div className={`text-xs font-semibold ${winning ? "text-emerald-400" : "text-rose-400"}`}>
          {winning ? "Winning" : "Losing"}
        </div>
      </div>
    </div>
  );
}

function PredictionSheet({ side, coin, price, balance, onClose, onConfirm }) {
  const [secs, setSecs] = useState(null);
  const [amount, setAmount] = useState(null);
  const options = useMemo(() => {
    const seen = new Set();
    return PCTS.map((p) => ({ p, v: Math.floor((balance * p) / 100) })).filter((o) => {
      if (o.v < 1 || seen.has(o.v)) return false;
      seen.add(o.v);
      return true;
    });
  }, [balance]);
  const tl = secs ? PRED_TIMES.find((t) => t.s === secs).label : "";
  const isUp = side === "up";

  return (
    <Sheet onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <div className={`text-lg font-bold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
          {isUp ? "▲ Up" : "▼ Down"} · {coin}/USDT
        </div>
        <div className="font-mono text-sm text-slate-300">{fmtPrice(price)}</div>
      </div>

      {!secs ? (
        <>
          <div className="mb-2 text-sm text-slate-400">সময় select করুন</div>
          <Chips
            cols={3}
            items={PRED_TIMES.map((t) => ({ key: t.s, label: t.label }))}
            value={secs}
            onPick={(k) => setSecs(k)}
          />
        </>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
            <span>Prediction amount ({tl})</span>
            <button className="text-emerald-400" onClick={() => { setSecs(null); setAmount(null); }}>
              সময় বদলান
            </button>
          </div>
          {options.length === 0 ? (
            <div className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">
              ব্যালেন্স কম। Deposit থেকে ডেমো ফান্ড যোগ করুন।
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {options.map((o) => (
                <button
                  key={o.p}
                  onClick={() => setAmount(o.v)}
                  className={`rounded-xl border px-2 py-2.5 text-center ${
                    amount === o.v
                      ? "border-emerald-400 bg-emerald-400/15"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="text-sm font-bold">৳{o.v.toLocaleString("en-US")}</div>
                </button>
              ))}
            </div>
          )}
          <button
            disabled={!amount}
            onClick={() => onConfirm(secs, amount)}
            className={`mt-4 w-full rounded-xl py-3.5 text-base font-bold text-white disabled:opacity-40 ${
              isUp ? "bg-emerald-500" : "bg-rose-500"
            }`}
          >
            Confirm {isUp ? "Up" : "Down"}
            {amount ? ` · ৳${amount.toLocaleString("en-US")}` : ""}
          </button>
          <div className="mt-2 text-center text-xs text-slate-500">
            জিতলে bet-এর দ্বিগুণ, হারলে পুরো bet loss।
          </div>
        </>
      )}
    </Sheet>
  );
}

function PredictionPage({ coin, prices, pricesRef, histRef, w, openBet }) {
  const [side, setSide] = useState(null);
  const price = prices[coin];
  const myBets = w.bets.filter((b) => b.coin === coin);
  const marks = myBets.map((b) => ({
    price: b.entry,
    color: b.side === "up" ? "#34d399" : "#fb7185",
    label: "Entry",
  }));
  return (
    <div className="space-y-4 p-4">
      <CoinHeader coin={coin} price={price} />
      <LiveChart coin={coin} histRef={histRef} pricesRef={pricesRef} marks={marks} />
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setSide("up")}
          className="rounded-2xl bg-emerald-500 py-5 text-center text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
        >
          <div className="text-xl font-extrabold">▲ Up</div>
          <div className="text-xs opacity-90">Win 2×</div>
        </button>
        <button
          onClick={() => setSide("down")}
          className="rounded-2xl bg-rose-500 py-5 text-center text-white shadow-lg shadow-rose-500/20 active:scale-[0.98]"
        >
          <div className="text-xl font-extrabold">▼ Down</div>
          <div className="text-xs opacity-90">Win 2×</div>
        </button>
      </div>
      <div className="text-xs text-slate-500">
        Bet ধরার মুহূর্তের live price হলো Entry price। সময় শেষে price Entry-র উপরে থাকলে Up, নিচে থাকলে Down জিতবে।
        সমান হলে টাকা ফেরত।
      </div>
      {myBets.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-300">Active predictions</div>
          {myBets.map((b) => (
            <BetRow key={b.id} b={b} price={price ? price.last : null} />
          ))}
        </div>
      )}
      {side && (
        <PredictionSheet
          side={side}
          coin={coin}
          price={price ? price.last : 0}
          balance={w.balance}
          onClose={() => setSide(null)}
          onConfirm={(secs, amount) => {
            if (openBet(coin, side, secs, amount)) setSide(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- 2) SPOT ---------- */
function SpotSheet({ mode, coin, price, w, onClose, onConfirm }) {
  const [val, setVal] = useState("");
  const [pct, setPct] = useState(null);
  const isBuy = mode === "buy";
  const h = w.holdings[coin];
  const rate = price ? price * USDT_BDT : 0;
  const amt = parseFloat(val) || 0;
  const estQty = rate ? (amt * (1 - SPOT_FEE)) / rate : 0;
  const sellVal = h && pct ? ((h.qty * pct) / 100) * rate : 0;
  return (
    <Sheet onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <div className={`text-base font-bold ${isBuy ? "text-emerald-400" : "text-rose-400"}`}>
          {isBuy ? "Buy" : "Sell"} {coin}/USDT
        </div>
        <div className="font-mono text-xs text-slate-300">{fmtPrice(price)}</div>
      </div>
      {isBuy ? (
        <>
          <div className="mb-1 flex justify-between text-[11px] text-slate-400">
            <span>Available</span>
            <span>{money(w.balance)}</span>
          </div>
          <input
            inputMode="decimal"
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder={`Amount ৳ (min ৳${SPOT_MIN})`}
            className="w-full rounded-lg border border-white/10 bg-[#0b111c] px-3 py-2.5 text-sm outline-none focus:border-emerald-400"
          />
          <div className="mb-3 mt-2 grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => setVal(String(Math.floor((w.balance * p) / 100)))}
                className="rounded-md border border-white/10 bg-white/5 py-1.5 text-xs text-slate-200"
              >
                ৳{Math.floor((w.balance * p) / 100).toLocaleString("en-US")}
              </button>
            ))}
          </div>
          <div className="mb-3 space-y-0.5 text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>You get ≈</span>
              <span>
                {estQty ? estQty.toPrecision(5) : "0"} {coin}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Fee</span>
              <span>{SPOT_FEE * 100}%</span>
            </div>
          </div>
          <button
            onClick={() => onConfirm(amt)}
            className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white"
          >
            Confirm Buy
          </button>
        </>
      ) : (
        <>
          <div className="mb-2 flex justify-between text-[11px] text-slate-400">
            <span>Holding</span>
            <span>
              {h ? h.qty.toPrecision(5) : "0"} {coin}
            </span>
          </div>
          <div className="mb-3 grid grid-cols-4 gap-1.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => setPct(p)}
                className={`rounded-md border py-2 text-xs font-semibold ${
                  pct === p
                    ? "border-rose-400 bg-rose-400/15 text-rose-300"
                    : "border-white/10 bg-white/5 text-slate-200"
                }`}
              >
                ৳{Math.floor(((h?.qty || 0) * p) / 100 * rate * (1 - SPOT_FEE)).toLocaleString("en-US")}
              </button>
            ))}
          </div>
          <div className="mb-3 space-y-0.5 text-[11px] text-slate-400">
            <div className="flex justify-between">
              <span>You get ≈</span>
              <span>{money(sellVal * (1 - SPOT_FEE))}</span>
            </div>
            <div className="text-slate-500">
              সর্বনিম্ন ট্রেড ৳{SPOT_MIN} (100% sell করলে এই শর্ত খাটে না)
            </div>
          </div>
          <button
            disabled={!h || !pct}
            onClick={() => onConfirm(pct)}
            className="w-full rounded-xl bg-rose-500 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            Confirm Sell
          </button>
        </>
      )}
    </Sheet>
  );
}
function SpotPage({ coin, prices, pricesRef, histRef, w, buySpot, sellSpot }) {
  const [mode, setMode] = useState(null);
  const price = prices[coin];
  const h = w.holdings[coin];
  const value = h && price ? h.qty * price.last * USDT_BDT : 0;
  const pnl = h ? value - h.cost : 0;
  return (
    <div className="space-y-2.5 p-3">
      <CoinHeader coin={coin} price={price} />
      <LiveChart coin={coin} histRef={histRef} pricesRef={pricesRef} />
      {h && (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
          <span className="text-slate-400">
            Holding {h.qty.toPrecision(5)} {coin}
          </span>
          <span className="font-semibold">
            {money(value)}{" "}
            <span className={pnlColor(pnl)}>({sgn(pnl)})</span>
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setMode("buy")}
          className="rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
        >
          Buy
        </button>
        <button
          onClick={() => setMode("sell")}
          className="rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
        >
          Sell
        </button>
      </div>
      {mode && (
        <SpotSheet
          mode={mode}
          coin={coin}
          price={price ? price.last : 0}
          w={w}
          onClose={() => setMode(null)}
          onConfirm={(v) => {
            const ok = mode === "buy" ? buySpot(coin, v) : sellSpot(coin, v);
            if (ok) setMode(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- 3) FUTURE ---------- */
function PositionRow({ ps, mark, onClose }) {
  const m = mark == null ? ps.entry : mark;
  const pnl = posPnl(ps, m);
  const roe = (pnl / ps.margin) * 100;
  const liq = liqPrice(ps.side, ps.entry, ps.lev);
  const isLong = ps.side === "long";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold">{ps.coin}/USDT</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
              isLong ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}
          >
            {isLong ? "Long" : "Short"} {ps.lev}x
          </span>
        </div>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold">
          Close
        </button>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <div className="text-xs text-slate-400">Unrealized P&L</div>
          <div className={`text-lg font-bold ${pnlColor(pnl)}`}>{sgn(pnl)}</div>
        </div>
        <div className={`text-lg font-bold ${pnlColor(pnl)}`}>
          {roe >= 0 ? "+" : ""}
          {roe.toFixed(2)}%
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Entry</div>
          <div className="font-mono">{fmtPrice(ps.entry)}</div>
        </div>
        <div>
          <div className="text-slate-500">Mark</div>
          <div className="font-mono">{fmtPrice(m)}</div>
        </div>
        <div>
          <div className="text-slate-500">Liq.</div>
          <div className="font-mono text-amber-400">{fmtPrice(liq)}</div>
        </div>
        <div>
          <div className="text-slate-500">Margin</div>
          <div>{money(ps.margin)}</div>
        </div>
        <div>
          <div className="text-slate-500">TP</div>
          <div className="font-mono">{ps.tp ? fmtPrice(ps.tp) : "--"}</div>
        </div>
        <div>
          <div className="text-slate-500">SL</div>
          <div className="font-mono">{ps.sl ? fmtPrice(ps.sl) : "--"}</div>
        </div>
      </div>
    </div>
  );
}

function FutureSheet({ side, coin, price, w, onClose, onConfirm }) {
  const [lev, setLev] = useState(10);
  const [margin, setMargin] = useState("");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const isLong = side === "long";
  const p = price || 0;
  const mg = parseFloat(margin) || 0;
  const notional = mg * lev;
  const fee = notional * FUT_FEE;
  const qty = p ? notional / USDT_BDT / p : 0;
  const maxMargin = Math.max(0, Math.floor(w.balance / (1 + lev * FUT_FEE)));
  const inp =
    "w-full rounded-lg border border-white/10 bg-[#0b111c] px-3 py-2 text-sm outline-none focus:border-emerald-400";
  return (
    <Sheet onClose={onClose}>
      <div className="mb-2 flex items-center justify-between">
        <div className={`text-base font-bold ${isLong ? "text-emerald-400" : "text-rose-400"}`}>
          {isLong ? "Buy / Long" : "Sell / Short"} · {coin}/USDT
        </div>
        <div className="font-mono text-xs text-slate-300">{fmtPrice(p)}</div>
      </div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-slate-300">Leverage</span>
        <span className="rounded-md bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-300">{lev}x</span>
      </div>
      <input
        type="range"
        min="1"
        max="100"
        value={lev}
        onChange={(e) => setLev(parseInt(e.target.value, 10))}
        className="w-full accent-emerald-400"
      />
      <div className="mb-3 mt-1 grid grid-cols-6 gap-1.5">
        {[2, 5, 10, 20, 50, 100].map((l) => (
          <button
            key={l}
            onClick={() => setLev(l)}
            className={`rounded-md py-1.5 text-[11px] font-semibold ${
              lev === l ? "bg-emerald-400/20 text-emerald-300" : "bg-white/5 text-slate-300"
            }`}
          >
            {l}x
          </button>
        ))}
      </div>
      <div className="mb-1 flex justify-between text-[11px] text-slate-400">
        <span>Available</span>
        <span>{money(w.balance)}</span>
      </div>
      <input
        inputMode="decimal"
        value={margin}
        onChange={(e) => setMargin(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={`Margin ৳ (min ৳${MIN_MARGIN})`}
        className={inp}
      />
      <div className="mb-3 mt-2 grid grid-cols-4 gap-1.5">
        {[25, 50, 75, 100].map((pc) => (
          <button
            key={pc}
            onClick={() => setMargin(String(pc === 100 ? maxMargin : Math.floor((w.balance * pc) / 100)))}
            className="rounded-md border border-white/10 bg-white/5 py-1.5 text-xs text-slate-200"
          >
            ৳{(pc === 100 ? maxMargin : Math.floor((w.balance * pc) / 100)).toLocaleString("en-US")}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <input
          inputMode="decimal"
          value={tp}
          onChange={(e) => setTp(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Take Profit (optional)"
          className={inp}
        />
        <input
          inputMode="decimal"
          value={sl}
          onChange={(e) => setSl(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Stop Loss (optional)"
          className={inp}
        />
      </div>
      <div className="mb-3 space-y-0.5 text-[11px] text-slate-400">
        <div className="flex justify-between">
          <span>Position size</span>
          <span>
            {money(notional)} ({qty ? qty.toPrecision(4) : "0"} {coin})
          </span>
        </div>
        <div className="flex justify-between">
          <span>Est. liq.</span>
          <span className="font-mono text-amber-400">{p ? fmtPrice(liqPrice(side, p, lev)) : "--"}</span>
        </div>
        <div className="flex justify-between">
          <span>Fee</span>
          <span>{money(fee)}</span>
        </div>
      </div>
      <button
        onClick={() => onConfirm(mg, lev, tp, sl)}
        className={`w-full rounded-xl py-3 text-sm font-bold text-white ${isLong ? "bg-emerald-500" : "bg-rose-500"}`}
      >
        Confirm {isLong ? "Long" : "Short"}
      </button>
    </Sheet>
  );
}
function MiniPos({ ps, mark, onClose }) {
  const m = mark == null ? ps.entry : mark;
  const pnl = posPnl(ps, m);
  const roe = (pnl / ps.margin) * 100;
  const liq = liqPrice(ps.side, ps.entry, ps.lev);
  const isLong = ps.side === "long";
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              isLong ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
            }`}
          >
            {isLong ? "Long" : "Short"} {ps.lev}x
          </span>
          <span className={`font-bold ${pnlColor(pnl)}`}>
            {sgn(pnl)} ({roe >= 0 ? "+" : ""}
            {roe.toFixed(1)}%)
          </span>
        </div>
        <button onClick={onClose} className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
          Close
        </button>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>Entry {fmtPrice(ps.entry)}</span>
        <span>
          Liq <span className="text-amber-400">{fmtPrice(liq)}</span>
        </span>
        <span>Margin {money(ps.margin)}</span>
      </div>
    </div>
  );
}
function FuturePage({ coin, prices, pricesRef, histRef, w, openPos, closePos }) {
  const [side, setSide] = useState(null);
  const price = prices[coin];
  const mine = w.positions.filter((p) => p.coin === coin);
  const marks = [];
  mine.forEach((p) => {
    marks.push({ price: p.entry, color: "#e2e8f0", label: "Entry" });
    marks.push({ price: liqPrice(p.side, p.entry, p.lev), color: "#f59e0b", label: "Liq" });
    if (p.tp) marks.push({ price: p.tp, color: "#34d399", label: "TP" });
    if (p.sl) marks.push({ price: p.sl, color: "#fb7185", label: "SL" });
  });
  return (
    <div className="space-y-2.5 p-3">
      <CoinHeader coin={coin} price={price} />
      <LiveChart coin={coin} histRef={histRef} pricesRef={pricesRef} marks={marks} />
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => setSide("long")}
          className="rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
        >
          Buy / Long
        </button>
        <button
          onClick={() => setSide("short")}
          className="rounded-xl bg-rose-500 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
        >
          Sell / Short
        </button>
      </div>
      {mine.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-slate-300">Open positions</div>
          {mine.map((p) => (
            <MiniPos key={p.id} ps={p} mark={price ? price.last : null} onClose={() => closePos(p.id)} />
          ))}
        </div>
      )}
      {side && (
        <FutureSheet
          side={side}
          coin={coin}
          price={price ? price.last : 0}
          w={w}
          onClose={() => setSide(null)}
          onConfirm={(mg, lev, tp, sl) => {
            if (openPos(coin, side, mg, lev, tp, sl)) setSide(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- ASSET ---------- */
function AssetPage({ w, prices, goSpot, closePos }) {
  const spotRows = Object.entries(w.holdings).map(([c, h]) => {
    const p = prices[c] ? prices[c].last : 0;
    const value = h.qty * p * USDT_BDT;
    return { c, h, value, pnl: value - h.cost, pct: h.cost ? ((value - h.cost) / h.cost) * 100 : 0 };
  });
  const spotValue = spotRows.reduce((s, r) => s + r.value, 0);
  const spotPnl = spotRows.reduce((s, r) => s + r.pnl, 0);
  const futPnl = w.positions.reduce((s, p) => s + posPnl(p, prices[p.coin] ? prices[p.coin].last : p.entry), 0);
  const futMargin = w.positions.reduce((s, p) => s + p.margin, 0);
  const locked = w.bets.reduce((s, b) => s + b.amount, 0);
  const equity = w.balance + spotValue + futMargin + futPnl + locked;
  const totalPnl = spotPnl + futPnl;

  return (
    <div className="space-y-5 p-4">
      <div className="rounded-2xl border border-emerald-900/60 bg-gradient-to-br from-[#0b2a22] to-[#0a0f1a] p-4">
        <div className="text-xs text-slate-400">Total equity</div>
        <div className="text-3xl font-extrabold">{money(equity)}</div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-slate-400">Available</div>
            <div className="font-semibold">{money(w.balance)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Open P&L</div>
            <div className={`font-semibold ${pnlColor(totalPnl)}`}>{sgn(totalPnl)}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-slate-300">Spot holdings</div>
        {spotRows.length === 0 ? (
          <div className="rounded-xl bg-white/5 p-4 text-center text-sm text-slate-500">
            কোনো coin নেই। Trading → Spot থেকে কিনুন।
          </div>
        ) : (
          <div className="space-y-2">
            {spotRows.map((r) => (
              <button
                key={r.c}
                onClick={() => goSpot(r.c)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <Avatar coin={r.c} />
                  <div>
                    <div className="font-semibold">{r.c}</div>
                    <div className="text-xs text-slate-400">{r.h.qty.toPrecision(6)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{money(r.value)}</div>
                  <div className={`text-xs font-semibold ${pnlColor(r.pnl)}`}>
                    {sgn(r.pnl)} ({r.pct >= 0 ? "+" : ""}
                    {r.pct.toFixed(2)}%)
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-slate-300">Futures positions</div>
        {w.positions.length === 0 ? (
          <div className="rounded-xl bg-white/5 p-4 text-center text-sm text-slate-500">কোনো open position নেই।</div>
        ) : (
          <div className="space-y-2">
            {w.positions.map((p) => (
              <PositionRow key={p.id} ps={p} mark={prices[p.coin] ? prices[p.coin].last : null} onClose={() => closePos(p.id)} />
            ))}
          </div>
        )}
      </div>

      {w.bets.length > 0 && (
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-300">Active predictions</div>
          <div className="space-y-2">
            {w.bets.map((b) => (
              <div key={b.id}>
                <div className="mb-1 text-xs text-slate-500">{b.coin}/USDT</div>
                <BetRow b={b} price={prices[b.coin] ? prices[b.coin].last : null} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-sm font-semibold text-slate-300">History</div>
        {w.history.length === 0 ? (
          <div className="rounded-xl bg-white/5 p-4 text-center text-sm text-slate-500">এখনো কোনো ট্রেড হয়নি।</div>
        ) : (
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
            {w.history.slice(0, 30).map((h) => (
              <div key={h.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <div className="text-sm font-semibold">{h.coin ? `${h.coin} · ` : ""}{h.text}</div>
                  <div className="text-xs text-slate-500">{new Date(h.time).toLocaleString()}</div>
                </div>
                <div className={`text-sm font-bold ${pnlColor(h.pnl)}`}>{h.pnl ? sgn(h.pnl) : "--"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- DEPOSIT ---------- */
function DepositPage({ w, main, addFunds, withdrawFunds }) {
  const [val, setVal] = useState("");
  const amt = parseInt(val, 10) || 0;
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-xs text-slate-400">Main balance</div>
        <div className="text-3xl font-extrabold">{money(main)}</div>
        <div className="mt-2 text-xs text-slate-400">
          Trading wallet: <span className="font-semibold text-slate-200">{money(w.balance)}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[100, 500, 1000, 5000].map((a) => (
          <button
            key={a}
            onClick={() => setVal(String(a))}
            className="rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-semibold"
          >
            ৳{a.toLocaleString("en-US")}
          </button>
        ))}
      </div>
      <input
        inputMode="numeric"
        value={val}
        onChange={(e) => setVal(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="Amount"
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-emerald-400"
      />
      <div className="text-xs text-slate-500">
        Add = Main balance থেকে Trading wallet-এ যাবে। Withdraw = Trading wallet থেকে Main balance-এ ফিরবে।
      </div>
      <button
        onClick={() => addFunds(amt) && setVal("")}
        className="w-full rounded-xl bg-emerald-500 py-3.5 text-base font-bold text-white"
      >
        Add funds
      </button>
      <button
        onClick={() => withdrawFunds(amt) && setVal("")}
        className="w-full rounded-xl bg-rose-500 py-3.5 text-base font-bold text-white"
      >
        Withdraw balance
      </button>
    </div>
  );
}

/* ---------- HOME PAGE CARD (হোমপেজের Trading আইকন) ---------- */
export function TradingCard({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative aspect-square w-full overflow-hidden rounded-2xl border border-emerald-900/60 bg-gradient-to-br from-[#0b2a22] via-[#0a1a1a] to-[#0a0f1a] p-3 text-left"
    >
      <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-bold text-black">LIVE</span>
      <TrendingUp className="mx-auto mt-5 h-12 w-12 text-emerald-400" />
      <div className="absolute inset-x-3 bottom-3 text-center text-base font-semibold text-white">Trading</div>
    </button>
  );
}

/* ---------- MAIN APP ---------- */
export default function TradingApp({ onClose, mainBalance, onMainBalanceChange }) {
  const { prices, pricesRef, histRef, live } = useMarket();
  const [w, setW] = useState(loadWallet);
  const wRef = useRef(w);
  wRef.current = w;
  const [tab, setTab] = useState("home");
  const [mode, setMode] = useState("prediction");
  const [coin, setCoin] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const lastHist = useRef(w.history[0] ? w.history[0].id : null);
  const controlled = typeof mainBalance === "number" && typeof onMainBalanceChange === "function";
  const main = controlled ? mainBalance : typeof w.main === "number" ? w.main : START_MAIN;
  const mainRef = useRef(main);
  mainRef.current = main;

  useEffect(() => {
    const unsub = onValue(ref(db, 'game_settings/trading'), (snap) => {
      if (snap.exists() && typeof snap.val().rtp === 'number') {
        tradingRtp = snap.val().rtp;
      }
    });
    return () => unsub();
  }, []);

  const say = (msg, kind = "info") => {
    setToast({ msg, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // save
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(w));
    } catch (e) {}
  }, [w]);

  // engine: prediction settle + futures liquidation / TP / SL
  useEffect(() => {
    const id = setInterval(() => {
      const cw = wRef.current;
      const now = Date.now();
      const betRes = [];
      cw.bets.forEach((b) => {
        if (b.expiresAt <= now) {
          const p = priceAt(histRef, pricesRef, b.coin, b.expiresAt);
          if (p == null) betRes.push({ id: b.id, void: true });
          else betRes.push({ id: b.id, price: p });
        }
      });
      const posRes = [];
      cw.positions.forEach((ps) => {
        const cur = pricesRef.current[ps.coin];
        if (!cur) return;
        const mark = cur.last;
        const liq = liqPrice(ps.side, ps.entry, ps.lev);
        if (ps.side === "long") {
          if (mark <= liq) posRes.push({ id: ps.id, reason: "Liquidated", price: liq });
          else if (ps.sl && mark <= ps.sl) posRes.push({ id: ps.id, reason: "Stop Loss", price: mark });
          else if (ps.tp && mark >= ps.tp) posRes.push({ id: ps.id, reason: "Take Profit", price: mark });
        } else {
          if (mark >= liq) posRes.push({ id: ps.id, reason: "Liquidated", price: liq });
          else if (ps.sl && mark >= ps.sl) posRes.push({ id: ps.id, reason: "Stop Loss", price: mark });
          else if (ps.tp && mark <= ps.tp) posRes.push({ id: ps.id, reason: "Take Profit", price: mark });
        }
      });
      if (betRes.length || posRes.length) setW((prev) => settleAll(prev, betRes, posRes));
    }, 250);
    return () => clearInterval(id);
  }, []);

  // result toast
  useEffect(() => {
    const h = w.history[0];
    if (!h || h.id === lastHist.current) return;
    lastHist.current = h.id;
    if (h.auto) say(`${h.coin} · ${h.text} ${h.pnl ? sgn(h.pnl) : ""}`, h.pnl > 0 ? "win" : h.pnl < 0 ? "loss" : "info");
  }, [w.history]);

  /* ----- actions ----- */
  const openBet = (c, side, secs, amount) => {
    const p = pricesRef.current[c];
    if (!p) return say("Price লোড হয়নি, একটু অপেক্ষা করুন", "loss"), false;
    if (amount < 1 || amount > wRef.current.balance) return say("ব্যালেন্স যথেষ্ট নয়", "loss"), false;
    const now = Date.now();
    setW((prev) => ({
      ...prev,
      balance: prev.balance - amount,
      bets: [
        ...prev.bets,
        { id: uid(), coin: c, side, secs, amount, entry: p.last, openedAt: now, expiresAt: now + secs * 1000 },
      ],
    }));
    say(`${side === "up" ? "▲ Up" : "▼ Down"} bet placed @ ${fmtPrice(p.last)}`);
    return true;
  };

  const buySpot = (c, bdt) => {
    const p = pricesRef.current[c];
    if (!p) return say("Price লোড হয়নি", "loss"), false;
    if (bdt < SPOT_MIN) return say(`Spot-এ সর্বনিম্ন ট্রেড ৳${SPOT_MIN}`, "loss"), false;
    if (bdt > wRef.current.balance) return say("ব্যালেন্স যথেষ্ট নয়", "loss"), false;
    const qty = (bdt * (1 - SPOT_FEE)) / USDT_BDT / p.last;
    setW((prev) => {
      const old = prev.holdings[c] || { qty: 0, cost: 0 };
      return {
        ...prev,
        balance: prev.balance - bdt,
        holdings: { ...prev.holdings, [c]: { qty: old.qty + qty, cost: old.cost + bdt } },
        history: [{ id: uid(), type: "spot", coin: c, text: `Bought ${qty.toPrecision(5)}`, pnl: 0, time: Date.now() }, ...prev.history].slice(0, 100),
      };
    });
    say(`${c} কেনা হয়েছে`, "win");
    return true;
  };

  const sellSpot = (c, pct) => {
    const p = pricesRef.current[c];
    const h = wRef.current.holdings[c];
    if (!p || !h) return say("Holding নেই", "loss"), false;
    const qty = pct === 100 ? h.qty : (h.qty * pct) / 100;
    const gross = qty * p.last * USDT_BDT;
    if (pct !== 100 && gross < SPOT_MIN) return say(`Spot-এ সর্বনিম্ন ট্রেড ৳${SPOT_MIN}`, "loss"), false;
    const net = gross * (1 - SPOT_FEE);
    const costPart = h.cost * (qty / h.qty);
    const realized = net - costPart;
    setW((prev) => {
      const old = prev.holdings[c];
      if (!old) return prev;
      const hold = { ...prev.holdings };
      const left = old.qty - qty;
      if (left <= old.qty * 1e-9) delete hold[c];
      else hold[c] = { qty: left, cost: old.cost - costPart };
      return {
        ...prev,
        balance: prev.balance + net,
        holdings: hold,
        history: [{ id: uid(), type: "spot", coin: c, text: `Sold ${qty.toPrecision(5)}`, pnl: realized, time: Date.now() }, ...prev.history].slice(0, 100),
      };
    });
    say(`${c} বিক্রি হয়েছে ${sgn(realized)}`, realized >= 0 ? "win" : "loss");
    return true;
  };

  const openPos = (c, side, margin, lev, tp, sl) => {
    const p = pricesRef.current[c];
    if (!p) return say("Price লোড হয়নি", "loss"), false;
    if (margin < MIN_MARGIN) return say(`সর্বনিম্ন margin ৳${MIN_MARGIN}`, "loss"), false;
    const fee = margin * lev * FUT_FEE;
    if (margin + fee > wRef.current.balance) return say("ব্যালেন্স যথেষ্ট নয়", "loss"), false;
    const tpN = parseFloat(tp) || 0;
    const slN = parseFloat(sl) || 0;
    const liq = liqPrice(side, p.last, lev);
    if (side === "long") {
      if (tpN && tpN <= p.last) return say("Take Profit এখনকার price-এর উপরে দিন", "loss"), false;
      if (slN && (slN >= p.last || slN <= liq)) return say("Stop Loss এখনকার price ও Liq-এর মাঝে দিন", "loss"), false;
    } else {
      if (tpN && tpN >= p.last) return say("Take Profit এখনকার price-এর নিচে দিন", "loss"), false;
      if (slN && (slN <= p.last || slN >= liq)) return say("Stop Loss এখনকার price ও Liq-এর মাঝে দিন", "loss"), false;
    }
    const size = (margin * lev) / USDT_BDT / p.last;
    setW((prev) => ({
      ...prev,
      balance: prev.balance - margin - fee,
      positions: [
        ...prev.positions,
        { id: uid(), coin: c, side, lev, margin, entry: p.last, size, tp: tpN || null, sl: slN || null, openedAt: Date.now() },
      ],
    }));
    say(`${side === "long" ? "Long" : "Short"} ${lev}x opened @ ${fmtPrice(p.last)}`, "win");
    return true;
  };

  const closePos = (id) => {
    const ps = wRef.current.positions.find((p) => p.id === id);
    if (!ps) return;
    const cur = pricesRef.current[ps.coin];
    const price = cur ? cur.last : ps.entry;
    setW((prev) => settleAll(prev, [], [{ id, reason: "Closed", price }]));
    const pnl = posPnl(ps, price);
    say(`Position closed ${sgn(pnl)}`, pnl >= 0 ? "win" : "loss");
  };

  const addFunds = (amt) => {
    if (!(amt >= 1)) {
      say("Amount লিখুন", "loss");
      return false;
    }
    if (amt > mainRef.current) {
      say("Main balance-এ এত টাকা নেই", "loss");
      return false;
    }
    const nextMain = mainRef.current - amt;
    mainRef.current = nextMain;
    if (controlled) onMainBalanceChange(nextMain);
    setW((prev) => ({
      ...prev,
      balance: prev.balance + amt,
      main: controlled ? prev.main : nextMain,
      history: [{ id: uid(), type: "deposit", coin: "", text: "Transfer from main", pnl: amt, time: Date.now() }, ...prev.history].slice(0, 100),
    }));
    say(`${money(amt)} Trading wallet-এ গেছে`, "win");
    return true;
  };
  const withdrawFunds = (amt) => {
    if (!(amt >= 1)) {
      say("Amount লিখুন", "loss");
      return false;
    }
    if (amt > wRef.current.balance) {
      say("Trading wallet-এ এত টাকা নেই", "loss");
      return false;
    }
    wRef.current = { ...wRef.current, balance: wRef.current.balance - amt };
    const nextMain = mainRef.current + amt;
    mainRef.current = nextMain;
    if (controlled) onMainBalanceChange(nextMain);
    setW((prev) => ({
      ...prev,
      balance: prev.balance - amt,
      main: controlled ? prev.main : nextMain,
      history: [{ id: uid(), type: "withdraw", coin: "", text: "Withdraw to main", pnl: -amt, time: Date.now() }, ...prev.history].slice(0, 100),
    }));
    say(`${money(amt)} Main balance-এ ফিরেছে`, "win");
    return true;
  };

  const resetAll = () => {
    setW(freshWallet());
    lastHist.current = null;
    say("Account reset হয়েছে");
  };

  const goSpot = (c) => {
    setTab("home");
    setMode("spot");
    setCoin(c);
  };

  const back = () => {
    if (tab === "home" && coin) setCoin(null);
    else if (onClose) onClose();
  };

  const MODES = [
    { key: "prediction", label: "Prediction" },
    { key: "spot", label: "Spot" },
    { key: "future", label: "Future" },
  ];
  const NAV = [
    { key: "home", label: "Home", Icon: Home },
    { key: "deposit", label: "Deposit", Icon: Wallet },
    { key: "asset", label: "Asset", Icon: PieChart },
  ];
  const title = tab === "home" ? (coin ? `${coin}/USDT` : "Trading") : tab === "deposit" ? "Deposit" : "Asset";

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col bg-[#070b14] text-white">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-3">
        <div className="flex items-center gap-2">
          {(onClose || (tab === "home" && coin)) && (
            <button onClick={back} className="rounded-full p-1.5 active:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <span className="text-lg font-bold">{title}</span>
          <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-400" : "bg-slate-600"}`} title={live ? "Live" : "Connecting"} />
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold">{money(w.balance)}</div>
      </div>

      {/* content */}
      <div className="relative flex-1 overflow-y-auto">
        {tab === "home" && (
          <>
            <div className="sticky top-0 z-10 bg-[#070b14] px-4 pt-3">
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/5 p-1">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`rounded-lg py-2 text-sm font-bold ${
                      mode === m.key ? "bg-emerald-500 text-white" : "text-slate-400"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {!coin && <CoinList prices={prices} onPick={setCoin} />}
            {coin && mode === "prediction" && (
              <PredictionPage coin={coin} prices={prices} pricesRef={pricesRef} histRef={histRef} w={w} openBet={openBet} />
            )}
            {coin && mode === "spot" && (
              <SpotPage coin={coin} prices={prices} pricesRef={pricesRef} histRef={histRef} w={w} buySpot={buySpot} sellSpot={sellSpot} />
            )}
            {coin && mode === "future" && (
              <FuturePage coin={coin} prices={prices} pricesRef={pricesRef} histRef={histRef} w={w} openPos={openPos} closePos={closePos} />
            )}
          </>
        )}
        {tab === "deposit" && <DepositPage w={w} main={main} addFunds={addFunds} withdrawFunds={withdrawFunds} />}
        {tab === "asset" && <AssetPage w={w} prices={prices} goSpot={goSpot} closePos={closePos} />}
      </div>

      {/* toast */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-50 flex justify-center px-4">
          <div
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold shadow-xl ${
              toast.kind === "win"
                ? "bg-emerald-500 text-white"
                : toast.kind === "loss"
                ? "bg-rose-500 text-white"
                : "bg-slate-700 text-white"
            }`}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* bottom nav */}
      <div className="grid grid-cols-3 border-t border-white/5 bg-[#0a0f1a] pb-2 pt-1">
        {NAV.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              if (key === "home") setCoin(null);
            }}
            className="flex flex-col items-center gap-0.5 py-2"
          >
            <span className={`rounded-xl px-4 py-1 ${tab === key ? "bg-emerald-400/15" : ""}`}>
              <Icon className={`h-5 w-5 ${tab === key ? "text-emerald-400" : "text-slate-500"}`} />
            </span>
            <span className={`text-xs ${tab === key ? "font-semibold text-emerald-400" : "text-slate-500"}`}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
