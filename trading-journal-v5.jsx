import { useState, useMemo, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */
const fmt$ = (v, sign = false) => {
  if (v === 0) return "$0.00";
  const s = sign && v > 0 ? "+" : v < 0 ? "-" : "";
  return s + "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtSec = s => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;

function computeStats(execs) {
  let accSize = 0, avgEntry = 0, realized = 0;
  return execs.map(e => {
    if (e.size > 0) {
      avgEntry = accSize === 0 ? e.price : (avgEntry * Math.abs(accSize) + e.price * e.size) / (Math.abs(accSize) + e.size);
      accSize += e.size;
      realized = 0;
    } else {
      const closeQty = Math.abs(e.size);
      realized = (e.price - avgEntry) * closeQty;
      accSize += e.size;
      if (accSize === 0) avgEntry = 0;
    }
    return { ...e, accSize, avgEntry: avgEntry || 0, realized };
  });
}

function genCandles(base, count, from) {
  const candles = [];
  let price = base;
  for (let i = 0; i < count; i++) {
    const o = price;
    const range = price * 0.012;
    const h = o + Math.random() * range;
    const l = o - Math.random() * range;
    const c = l + (Math.random() * (h - l));
    const v = Math.floor(50000 + Math.random() * 200000);
    candles.push({ t: new Date(from.getTime() + i * 5 * 60000), o, h, l, c, v });
    price = c;
  }
  return candles;
}

/* ═══════════════════════════════════════════════════════════════
   SEED DATA
═══════════════════════════════════════════════════════════════ */
const BASE_TIME = new Date("2026-02-24T13:25:00Z");

const TRADES_DATA = [
  {
    id: 1, symbol: "NKLA", market: "Stocks", side: "Long",
    executions: [
      { n: 1, t: new Date(BASE_TIME.getTime() + 3 * 60000), size: +10, price: 3.710 },
      { n: 2, t: new Date(BASE_TIME.getTime() + 5 * 60000), size: +10, price: 3.695 },
      { n: 3, t: new Date(BASE_TIME.getTime() + 8 * 60000), size: +10, price: 3.670 },
      { n: 4, t: new Date(BASE_TIME.getTime() + 11 * 60000), size: +10, price: 3.645 },
      { n: 5, t: new Date(BASE_TIME.getTime() + 14 * 60000), size: +10, price: 3.620 },
      { n: 6, t: new Date(BASE_TIME.getTime() + 17 * 60000), size: +10, price: 3.600 },
      { n: 7, t: new Date(BASE_TIME.getTime() + 22 * 60000), size: -30, price: 3.720 },
      { n: 8, t: new Date(BASE_TIME.getTime() + 25 * 60000), size: -10, price: 3.750 },
      { n: 9, t: new Date(BASE_TIME.getTime() + 68 * 60000), size: +17, price: 3.720 },
      { n: 10, t: new Date(BASE_TIME.getTime() + 69 * 60000), size: -17, price: 3.760 },
    ],
    notes: "NKLA momentum play off the 3.71 level. Scaled in on the drop, exited in two tranches near HOD.",
    tags: ["momentum", "scaling", "intraday"], date: "2026-02-24", pnl: 232.40,
  },
  {
    id: 2, symbol: "AAPL", market: "Stocks", side: "Long",
    executions: [
      { n: 1, t: new Date("2026-02-20T14:00:00Z"), size: +50, price: 182.50 },
      { n: 2, t: new Date("2026-02-20T14:15:00Z"), size: +50, price: 181.80 },
      { n: 3, t: new Date("2026-02-20T15:30:00Z"), size: -100, price: 187.30 },
    ],
    notes: "Breakout above resistance with volume confirmation.",
    tags: ["breakout", "momentum"], date: "2026-02-20", pnl: 480.00,
  },
  {
    id: 3, symbol: "NQ", market: "Futures", side: "Long",
    executions: [
      { n: 1, t: new Date("2026-02-19T14:00:00Z"), size: +1, price: 21450 },
      { n: 2, t: new Date("2026-02-19T15:45:00Z"), size: -1, price: 21580 },
    ],
    notes: "ORB breakout, held through first pullback.",
    tags: ["ORB", "futures"], date: "2026-02-19", pnl: 650.00,
  },
  {
    id: 4, symbol: "TSLA", market: "Stocks", side: "Short",
    executions: [
      { n: 1, t: new Date("2026-02-18T14:30:00Z"), size: -75, price: 175.20 },
      { n: 2, t: new Date("2026-02-18T15:00:00Z"), size: +75, price: 170.60 },
    ],
    notes: "Distribution top, clean risk/reward.",
    tags: ["distribution", "short"], date: "2026-02-18", pnl: 345.00,
  },
  {
    id: 5, symbol: "BTC", market: "Crypto", side: "Long",
    executions: [
      { n: 1, t: new Date("2026-02-17T10:00:00Z"), size: +0.1, price: 61200 },
      { n: 2, t: new Date("2026-02-17T11:30:00Z"), size: -0.1, price: 60800 },
    ],
    notes: "Failed breakout, cut quickly.",
    tags: ["crypto", "failed-breakout"], date: "2026-02-17", pnl: -40.00,
  },
];

const TRANSACTIONS = [
  { id: "TXN-8841", asset: "BTC/USD", type: "Buy", qty: "0.142", price: "$68,420", total: "$9,715.64", date: "Mar 07", status: "Filled" },
  { id: "TXN-8840", asset: "ETH/USD", type: "Sell", qty: "2.5", price: "$3,810", total: "$9,525", date: "Mar 06", status: "Filled" },
  { id: "TXN-8839", asset: "AAPL", type: "Buy", qty: "15", price: "$224.3", total: "$3,364.5", date: "Mar 05", status: "Filled" },
  { id: "TXN-8838", asset: "SOL/USD", type: "Buy", qty: "42", price: "$172.5", total: "$7,245", date: "Mar 04", status: "Filled" },
  { id: "TXN-8837", asset: "NVDA", type: "Sell", qty: "8", price: "$875.2", total: "$7,001.6", date: "Mar 03", status: "Cancelled" },
  { id: "TXN-8836", asset: "BNB/USD", type: "Buy", qty: "12", price: "$589.4", total: "$7,072.8", date: "Mar 02", status: "Filled" },
  { id: "TXN-8835", asset: "MSFT", type: "Buy", qty: "6", price: "$415.8", total: "$2,494.8", date: "Mar 01", status: "Pending" },
];

const MARKET_NEWS = [
  { cat: "MACRO", time: "2h ago", title: "Fed holds rates steady as inflation inches toward 2% target", dir: "up" },
  { cat: "CRYPTO", time: "4h ago", title: "Bitcoin ETF sees record $840M inflows in single trading session", dir: "up" },
  { cat: "MARKETS", time: "6h ago", title: "S&P 500 hits all-time high amid strong earnings season", dir: "up" },
  { cat: "CRYPTO", time: "9h ago", title: "Ethereum staking rewards decline as validator count reaches 1M", dir: "down" },
];

const ALLOCATION = [
  { name: "Bitcoin", pct: 38, color: "#f7931a" },
  { name: "Ethereum", pct: 24, color: "#627eea" },
  { name: "Equities", pct: 22, color: "#00e6a0" },
  { name: "Solana", pct: 11, color: "#9945ff" },
  { name: "Cash", pct: 5, color: "#8b949e" },
];

/* ═══════════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════════ */
const T = {
  bg: "#0a0e14",
  bgSidebar: "#0f1319",
  bgCard: "#111820",
  bgCardInner: "#151d28",
  bgHover: "#1a2332",
  border: "rgba(255,255,255,0.06)",
  borderLight: "rgba(255,255,255,0.08)",
  green: "#00e6a0",
  greenBright: "#00ff8c",
  greenDim: "rgba(0,230,160,0.1)",
  greenBorder: "rgba(0,230,160,0.2)",
  red: "#ff5c5c",
  redDim: "rgba(255,92,92,0.1)",
  redBorder: "rgba(255,92,92,0.2)",
  orange: "#f7931a",
  purple: "#9945ff",
  blue: "#627eea",
  white: "#e8edf4",
  muted: "#5e6a78",
  mutedLight: "#8b949e",
  text: "#c9d1d9",
};

/* ═══════════════════════════════════════════════════════════════
   SVG ICONS
═══════════════════════════════════════════════════════════════ */
const Icons = {
  Dashboard: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>,
  Portfolio: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  Trades: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  Analytics: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  Wallet: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" /></svg>,
  Markets: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
  Alerts: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  Settings: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
  Refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>,
  ArrowUp: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>,
  ArrowDown: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>,
  Dots: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>,
  Calendar: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  Reports: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  Import: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  ExternalLink: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 17 17 7" /><polyline points="7 7 17 7 17 17" /></svg>,
};

/* ═══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
═══════════════════════════════════════════════════════════════ */
const cardStyle = {
  background: T.bgCard,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: "20px 22px",
};

function Card({ title, extra, children, style = {} }) {
  return (
    <div style={{ ...cardStyle, ...style }}>
      {(title || extra) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          {title && <div style={{ fontWeight: 700, fontSize: "0.95rem", color: T.white, letterSpacing: "-0.01em" }}>{title}</div>}
          {extra}
        </div>
      )}
      {children}
    </div>
  );
}

function Tag({ children, color }) {
  return (
    <span style={{ background: color ? `${color}18` : "rgba(255,255,255,0.06)", color: color || T.mutedLight, border: `1px solid ${color ? color + "30" : T.border}`, borderRadius: 6, padding: "3px 9px", fontSize: "0.68rem", fontWeight: 500, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function PillBtn({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? T.green : "rgba(255,255,255,0.04)",
      border: `1px solid ${active ? T.green : T.border}`,
      borderRadius: 8, padding: "6px 14px",
      color: active ? "#000" : T.mutedLight,
      cursor: "pointer", fontSize: "0.75rem", fontWeight: active ? 700 : 500,
      fontFamily: "inherit", transition: "all 0.15s",
    }}>
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Filled: { bg: T.greenDim, border: T.greenBorder, color: T.green },
    Cancelled: { bg: T.redDim, border: T.redBorder, color: T.red },
    Pending: { bg: "rgba(249,185,22,0.1)", border: "rgba(249,185,22,0.2)", color: "#f9b916" },
  };
  const c = colors[status] || colors.Pending;
  return <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color, borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 600 }}>{status}</span>;
}

function TypeBadge({ type }) {
  const isBuy = type === "Buy";
  return <span style={{ background: isBuy ? T.greenDim : T.redDim, border: `1px solid ${isBuy ? T.greenBorder : T.redBorder}`, color: isBuy ? T.green : T.red, borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 700 }}>{type}</span>;
}

/* ═══════════════════════════════════════════════════════════════
   CANDLE CHART (Trades Detail)
═══════════════════════════════════════════════════════════════ */
function CandleChart({ trade }) {
  const [hovCandle, setHovCandle] = useState(null);
  const [hovExec, setHovExec] = useState(null);

  const candles = useMemo(() => {
    const firstExec = trade.executions[0];
    return genCandles(firstExec.price, 40, new Date(firstExec.t.getTime() - 10 * 5 * 60000));
  }, [trade.id]);

  const execStats = useMemo(() => computeStats(trade.executions), [trade.id]);

  const W = 700, H = 220, PL = 50, PR = 20, PT = 14, PB = 32, VH = 36;
  const chartH = H - PT - PB - VH - 6;
  const allH = candles.map(c => c.h), allL = candles.map(c => c.l);
  const priceMax = Math.max(...allH) * 1.002, priceMin = Math.min(...allL) * 0.998;
  const maxV = Math.max(...candles.map(c => c.v));
  const cw = (W - PL - PR) / candles.length;
  const px = i => PL + (i + 0.5) * cw;
  const py = p => PT + (priceMax - p) / (priceMax - priceMin) * chartH;

  const ma20 = candles.map((_, i) => {
    if (i < 19) return null;
    return candles.slice(i - 19, i + 1).reduce((a, c) => a + c.c, 0) / 20;
  });
  const maPath = ma20.map((v, i) => v === null ? "" : `${i === 19 ? "M" : "L"} ${px(i)} ${py(v)}`).join(" ");

  function findCandleIdx(exec) {
    for (let i = 0; i < candles.length; i++) {
      if (exec.t >= candles[i].t && (i === candles.length - 1 || exec.t < candles[i + 1].t)) return i;
    }
    return candles.length - 1;
  }

  return (
    <div style={{ position: "relative", width: "100%", background: T.bgCardInner, borderRadius: 12, padding: "14px 0 8px", boxSizing: "border-box" }}>
      {hovCandle !== null && (
        <div style={{ position: "absolute", top: 10, left: 60, display: "flex", gap: 16, fontSize: "0.72rem", fontFamily: "'JetBrains Mono',monospace", zIndex: 5, pointerEvents: "none" }}>
          {[["O", candles[hovCandle].o], ["H", candles[hovCandle].h], ["L", candles[hovCandle].l], ["C", candles[hovCandle].c]].map(([k, v]) => (
            <span key={k}><span style={{ color: T.muted }}>{k} </span><span style={{ color: T.white }}>{v.toFixed(3)}</span></span>
          ))}
          <span><span style={{ color: T.muted }}>V </span><span style={{ color: T.white }}>{candles[hovCandle].v.toLocaleString()}</span></span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }} onMouseLeave={() => setHovCandle(null)}>
        <defs>
          <filter id="glow2"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(f => {
          const y = PT + f * chartH;
          const price = priceMax - f * (priceMax - priceMin);
          return <g key={f}>
            <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={PL - 4} y={y + 3} textAnchor="end" fontSize="8" fill={T.muted} fontFamily="'JetBrains Mono',monospace">{price.toFixed(2)}</text>
          </g>;
        })}
        {candles.map((c, i) => {
          const barH = (c.v / maxV) * VH;
          return <rect key={i} x={px(i) - cw * 0.35} y={H - PB - barH} width={cw * 0.7} height={barH}
            fill={c.c >= c.o ? "rgba(0,230,160,0.18)" : "rgba(255,92,92,0.18)"} />;
        })}
        {candles.map((c, i) => {
          const bull = c.c >= c.o;
          const bodyY = py(Math.max(c.o, c.c));
          const bodyH = Math.max(1, Math.abs(py(c.o) - py(c.c)));
          return <g key={i} onMouseEnter={() => setHovCandle(i)}>
            <line x1={px(i)} x2={px(i)} y1={py(c.h)} y2={py(c.l)} stroke={bull ? T.green : T.red} strokeWidth="1" />
            <rect x={px(i) - cw * 0.35} y={bodyY} width={cw * 0.7} height={bodyH}
              fill={bull ? T.green : T.red} opacity={hovCandle === i ? 1 : 0.85} />
          </g>;
        })}
        <path d={maPath} fill="none" stroke="#f97316" strokeWidth="1.2" strokeLinejoin="round" opacity="0.8" />
        {hovCandle !== null && (
          <line x1={px(hovCandle)} x2={px(hovCandle)} y1={PT} y2={H - PB - VH - 6}
            stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {execStats.map((e, i) => {
          const ci = findCandleIdx(e);
          const x = px(ci);
          const y = e.size > 0 ? py(e.price) + 16 : py(e.price) - 16;
          const pts = e.size > 0 ? `${x},${y + 8} ${x + 6},${y - 4} ${x - 6},${y - 4}` : `${x},${y - 8} ${x + 6},${y + 4} ${x - 6},${y + 4}`;
          const col = e.size > 0 ? T.green : T.red;
          return (
            <g key={i} style={{ cursor: "pointer" }} onMouseEnter={() => setHovExec(i)} onMouseLeave={() => setHovExec(null)}>
              <polygon points={pts} fill={col} opacity={0.85} filter="url(#glow2)" />
              <text x={x} y={e.size > 0 ? y + 22 : y - 14} textAnchor="middle" fontSize="8" fill={col} fontFamily="'JetBrains Mono',monospace">{e.n}</text>
              {e.realized !== 0 && e.size < 0 && <text x={x} y={e.size > 0 ? y + 32 : y - 24} textAnchor="middle" fontSize="7.5" fill={e.realized > 0 ? T.green : T.red} fontFamily="'JetBrains Mono',monospace">{fmt$(e.realized, true)}</text>}
            </g>
          );
        })}
        {candles.filter((_, i) => i % 8 === 0).map((c) => {
          const origIdx = candles.indexOf(c);
          return <text key={origIdx} x={px(origIdx)} y={H - PB + 12} textAnchor="middle" fontSize="8" fill={T.muted} fontFamily="'JetBrains Mono',monospace">
            {c.t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </text>;
        })}
      </svg>
      {hovExec !== null && (() => {
        const e = execStats[hovExec];
        const first = execStats[0];
        const timeSinceFirst = Math.round((e.t - first.t) / 1000);
        const timeSincePrev = hovExec > 0 ? Math.round((e.t - execStats[hovExec - 1].t) / 1000) : 0;
        return (
          <div style={{ position: "absolute", top: 40, right: 16, background: "rgba(10,14,20,0.97)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 16px", fontSize: "0.72rem", fontFamily: "'JetBrains Mono',monospace", zIndex: 20, minWidth: 210, pointerEvents: "none", backdropFilter: "blur(12px)" }}>
            <div style={{ color: T.muted, marginBottom: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, fontWeight: 600 }}>Execution #{e.n}</div>
            {[
              ["Side", e.size > 0 ? "BUY" : "SELL", e.size > 0 ? T.green : T.red],
              ["Size", Math.abs(e.size), T.white],
              ["Price", fmt$(e.price), T.white],
              ["Acc.Size", e.accSize, T.white],
              ["Avg Entry", fmt$(e.avgEntry), T.white],
              ["Realized", fmt$(e.realized, true), e.realized >= 0 ? T.green : T.red],
              ["Δ 1st", fmtSec(timeSinceFirst), T.muted],
              ["Δ Prev", hovExec > 0 ? fmtSec(timeSincePrev) : "—", T.muted],
            ].map(([k, v, c]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 4 }}>
                <span style={{ color: T.muted }}>{k}</span>
                <span style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXEC TABLE
═══════════════════════════════════════════════════════════════ */
function ExecTable({ trade }) {
  const stats = useMemo(() => computeStats(trade.executions), [trade.id]);
  const first = stats[0];
  const hdrs = ["#", "Time", "Side", "Size", "Price", "Acc.Size", "Avg Entry", "Realized", "Unrealized", "Δ1st", "ΔPrev"];
  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${T.border}`, marginTop: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", fontFamily: "'JetBrains Mono',monospace" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {hdrs.map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: T.muted, fontWeight: 500, fontSize: "0.63rem", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {stats.map((e, i) => {
            const isBuy = e.size > 0;
            const timeSinceFirst = Math.round((e.t - first.t) / 1000);
            const timeSincePrev = i > 0 ? Math.round((e.t - stats[i - 1].t) / 1000) : 0;
            return (
              <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}
                onMouseEnter={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "9px 12px", color: T.muted }}>{e.n}</td>
                <td style={{ padding: "9px 12px", color: T.mutedLight, whiteSpace: "nowrap" }}>{e.t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                <td style={{ padding: "9px 12px" }}><TypeBadge type={isBuy ? "Buy" : "Sell"} /></td>
                <td style={{ padding: "9px 12px", color: T.white }}>{Math.abs(e.size)}</td>
                <td style={{ padding: "9px 12px", color: T.white }}>{fmt$(e.price)}</td>
                <td style={{ padding: "9px 12px", color: T.white }}>{e.accSize}</td>
                <td style={{ padding: "9px 12px", color: T.white }}>{e.avgEntry ? fmt$(e.avgEntry) : "—"}</td>
                <td style={{ padding: "9px 12px", color: e.realized > 0 ? T.green : e.realized < 0 ? T.red : T.muted }}>{e.realized ? fmt$(e.realized, true) : "—"}</td>
                <td style={{ padding: "9px 12px", color: T.muted }}>—</td>
                <td style={{ padding: "9px 12px", color: T.muted }}>{i === 0 ? "—" : fmtSec(timeSinceFirst)}</td>
                <td style={{ padding: "9px 12px", color: T.muted }}>{i === 0 ? "—" : fmtSec(timeSincePrev)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: DASHBOARD
═══════════════════════════════════════════════════════════════ */
function PageDashboard() {
  const [chartPeriod, setChartPeriod] = useState("All");
  const [txFilter, setTxFilter] = useState("All");
  const equityData = [22400, 24100, 21800, 26500, 28900, 27200, 31400, 34870];
  const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const W = 600, H = 160, PT = 16, PB = 30, PL = 10, PR = 10;
  const mn = Math.min(...equityData) * 0.95, mx = Math.max(...equityData) * 1.02;
  const px2 = i => PL + (i / (equityData.length - 1)) * (W - PL - PR);
  const py2 = v => PT + ((mx - v) / (mx - mn)) * (H - PT - PB);
  const linePath = equityData.map((v, i) => `${i === 0 ? "M" : "L"} ${px2(i)} ${py2(v)}`).join(" ");
  const areaPath = linePath + ` L ${px2(equityData.length - 1)} ${H - PB} L ${px2(0)} ${H - PB} Z`;

  const totalPnl = TRADES_DATA.reduce((a, t) => a + t.pnl, 0);

  const filteredTx = txFilter === "All" ? TRANSACTIONS : TRANSACTIONS.filter(t => t.type === txFilter);

  return (
    <div style={{ display: "flex", gap: 20 }}>
      {/* LEFT COLUMN */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
          {/* Total Balance */}
          <div style={{ ...cardStyle, padding: "18px 22px" }}>
            <div style={{ color: T.muted, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Total Balance</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.6rem", color: T.white, letterSpacing: "-0.03em" }}>$34,870</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
              <span style={{ color: T.green, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 3 }}><Icons.ArrowUp /> +55.7%</span>
              <span style={{ color: T.muted, fontSize: "0.68rem" }}>all time</span>
            </div>
          </div>
          {/* Today's P&L */}
          <div style={{ ...cardStyle, padding: "18px 22px" }}>
            <div style={{ color: T.muted, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Today's P&L</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.6rem", color: T.green, letterSpacing: "-0.03em" }}>+$1,240</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
              <span style={{ color: T.green, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 3 }}><Icons.ArrowUp /> +3.7%</span>
              <span style={{ color: T.muted, fontSize: "0.68rem" }}>vs yesterday</span>
            </div>
          </div>
          {/* Open Positions */}
          <div style={{ ...cardStyle, padding: "18px 22px" }}>
            <div style={{ color: T.muted, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>Open Positions</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.6rem", color: T.white, letterSpacing: "-0.03em" }}>7</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
              <span style={{ color: T.red, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 3 }}><Icons.ArrowDown /> -2.1%</span>
              <span style={{ color: T.muted, fontSize: "0.68rem" }}>vs last week</span>
            </div>
          </div>
        </div>

        {/* Account Balance Chart */}
        <Card title="Account Balance"
          extra={
            <div style={{ display: "flex", gap: 4 }}>
              {["1W", "1M", "3M", "1Y", "All"].map(p => (
                <PillBtn key={p} active={chartPeriod === p} onClick={() => setChartPeriod(p)}>{p}</PillBtn>
              ))}
            </div>
          }
          style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.65rem", color: T.white, letterSpacing: "-0.03em" }}>$34,870</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.95rem", color: T.muted }}>.00</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.green} stopOpacity="0.25" />
                <stop offset="100%" stopColor={T.green} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.33, 0.66, 1].map(f => <line key={f} x1={PL} x2={W - PR} y1={PT + f * (H - PT - PB)} y2={PT + f * (H - PT - PB)} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />)}
            <path d={areaPath} fill="url(#eqGrad)" />
            <path d={linePath} fill="none" stroke={T.green} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {equityData.map((v, i) => <circle key={i} cx={px2(i)} cy={py2(v)} r={i === equityData.length - 1 ? 4 : 0} fill={T.green} />)}
            {equityData.map((v, i) => <text key={i} x={px2(i)} y={H - 6} textAnchor="middle" fontSize="10" fill={T.muted} fontFamily="'JetBrains Mono',monospace">{months[i]}</text>)}
          </svg>
        </Card>

        {/* Transactions */}
        <Card title="Transactions"
          extra={
            <div style={{ display: "flex", gap: 4 }}>
              {["All", "Buy", "Sell"].map(f => (
                <PillBtn key={f} active={txFilter === f} onClick={() => setTxFilter(f)}>{f}</PillBtn>
              ))}
            </div>
          }>
          <div style={{ color: T.muted, fontSize: "0.75rem", marginTop: -10, marginBottom: 14 }}>{filteredTx.length} recent orders</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["ID", "Asset", "Type", "Qty", "Price", "Total", "Date", "Status"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", color: T.muted, fontWeight: 500, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTx.map(tx => (
                  <tr key={tx.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)`, cursor: "pointer" }}
                    onMouseEnter={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                    onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                    <td style={{ padding: "12px 14px", color: T.muted, fontFamily: "'JetBrains Mono',monospace", fontSize: "0.73rem" }}>{tx.id}</td>
                    <td style={{ padding: "12px 14px", color: T.white, fontWeight: 600 }}>{tx.asset}</td>
                    <td style={{ padding: "12px 14px" }}><TypeBadge type={tx.type} /></td>
                    <td style={{ padding: "12px 14px", color: T.text, fontFamily: "'JetBrains Mono',monospace" }}>{tx.qty}</td>
                    <td style={{ padding: "12px 14px", color: T.text, fontFamily: "'JetBrains Mono',monospace" }}>{tx.price}</td>
                    <td style={{ padding: "12px 14px", color: T.white, fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" }}>{tx.total}</td>
                    <td style={{ padding: "12px 14px", color: T.muted }}>{tx.date}</td>
                    <td style={{ padding: "12px 14px" }}><StatusBadge status={tx.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* RIGHT SIDEBAR */}
      <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Total Gains / Losses */}
        <div style={{ ...cardStyle, background: T.bgCard, padding: "22px" }}>
          <div style={{ color: T.muted, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 600 }}>Total Gains / Losses</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.7rem", color: T.green, letterSpacing: "-0.03em", marginBottom: 4 }}>+$12,470</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 18 }}>
            <span style={{ color: T.green, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 3 }}><Icons.ArrowUp /> +55.7%</span>
            <span style={{ color: T.muted, fontSize: "0.68rem" }}>since inception</span>
          </div>
          {[
            ["Realized P&L", "+$9,840", T.green],
            ["Unrealized P&L", "+$2,630", T.green],
            ["Total Losses", "-$1,210", T.red],
            ["Net Dividends", "+$310", T.green],
          ].map(([label, val, color]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
              <span style={{ color: T.mutedLight, fontSize: "0.82rem" }}>{label}</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color, fontSize: "0.85rem" }}>{val}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${T.border}` }}>
            <span style={{ color: T.mutedLight, fontSize: "0.82rem" }}>Win Rate</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 80, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: "71%", height: "100%", background: T.green, borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: T.green, fontSize: "0.85rem" }}>71%</span>
            </div>
          </div>
        </div>

        {/* Allocation */}
        <Card title="Allocation" extra={<button style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer" }}><Icons.Dots /></button>}>
          {ALLOCATION.map(a => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: "0.85rem", color: T.text }}>{a.name}</span>
              <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${a.pct}%`, height: "100%", background: a.color, borderRadius: 2 }} />
              </div>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "0.78rem", color: T.mutedLight, width: 32, textAlign: "right" }}>{a.pct}%</span>
            </div>
          ))}
        </Card>

        {/* Market News */}
        <Card title="Market News"
          extra={<span style={{ background: T.redDim, border: `1px solid ${T.redBorder}`, color: T.red, borderRadius: 6, padding: "2px 10px", fontSize: "0.68rem", fontWeight: 700 }}>LIVE</span>}>
          {MARKET_NEWS.map((n, i) => (
            <div key={i} style={{ padding: "12px 0", borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.border}`, borderRadius: 4, padding: "1px 7px", fontSize: "0.62rem", fontWeight: 700, color: T.mutedLight, letterSpacing: "0.05em" }}>{n.cat}</span>
                  <span style={{ fontSize: "0.68rem", color: T.muted }}>{n.time}</span>
                </div>
                <span style={{ color: n.dir === "up" ? T.green : T.red }}>{n.dir === "up" ? <Icons.ExternalLink /> : <Icons.ExternalLink />}</span>
              </div>
              <div style={{ fontSize: "0.82rem", color: T.text, lineHeight: 1.45 }}>{n.title}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: PORTFOLIO
═══════════════════════════════════════════════════════════════ */
function PagePortfolio() {
  const bySymbol = [
    { s: "BTC/USD", qty: "0.142", val: "$9,715", pnl: "+$820", pnlPct: "+9.2%", color: T.green },
    { s: "ETH/USD", qty: "2.5", val: "$9,525", pnl: "+$340", pnlPct: "+3.7%", color: T.green },
    { s: "AAPL", qty: "15", val: "$3,365", pnl: "+$480", pnlPct: "+16.6%", color: T.green },
    { s: "SOL/USD", qty: "42", val: "$7,245", pnl: "+$190", pnlPct: "+2.7%", color: T.green },
    { s: "BNB/USD", qty: "12", val: "$7,073", pnl: "-$120", pnlPct: "-1.7%", color: T.red },
    { s: "MSFT", qty: "6", val: "$2,495", pnl: "+$55", pnlPct: "+2.3%", color: T.green },
  ];
  return (
    <div>
      <Card title="Holdings">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Asset", "Quantity", "Value", "P&L", "% Change"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: T.muted, fontWeight: 500, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bySymbol.map(s => (
                <tr key={s.s} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}
                  onMouseEnter={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "14px 16px", color: T.white, fontWeight: 600 }}>{s.s}</td>
                  <td style={{ padding: "14px 16px", color: T.text, fontFamily: "'JetBrains Mono',monospace" }}>{s.qty}</td>
                  <td style={{ padding: "14px 16px", color: T.white, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{s.val}</td>
                  <td style={{ padding: "14px 16px", color: s.color, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{s.pnl}</td>
                  <td style={{ padding: "14px 16px", color: s.color, fontFamily: "'JetBrains Mono',monospace" }}>{s.pnlPct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: TRADES
═══════════════════════════════════════════════════════════════ */
function PageTrades() {
  const [activeTrade, setActiveTrade] = useState(0);
  const trade = TRADES_DATA[activeTrade];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {TRADES_DATA.map((t, i) => (
          <button key={t.id} onClick={() => setActiveTrade(i)} style={{
            background: i === activeTrade ? T.greenDim : "rgba(255,255,255,0.03)",
            border: `1px solid ${i === activeTrade ? T.greenBorder : T.border}`,
            borderRadius: 10, padding: "10px 18px", cursor: "pointer", color: i === activeTrade ? T.green : T.mutedLight,
            fontSize: "0.82rem", fontWeight: i === activeTrade ? 700 : 400, fontFamily: "inherit", transition: "all 0.15s",
          }}>
            {t.symbol} <span style={{ color: t.pnl > 0 ? T.green : T.red, fontFamily: "'JetBrains Mono',monospace", marginLeft: 6 }}>{fmt$(t.pnl, true)}</span>
          </button>
        ))}
      </div>
      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.02em" }}>{trade.symbol}</h2>
          <Tag color={trade.side === "Long" ? T.green : T.red}>{trade.side}</Tag>
          <Tag>{trade.market}</Tag>
          <span style={{ marginLeft: "auto", color: T.muted, fontSize: "0.82rem" }}>{trade.date}</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.1rem", color: trade.pnl > 0 ? T.green : T.red }}>{fmt$(trade.pnl, true)}</span>
        </div>
        <CandleChart trade={trade} />
        <ExecTable trade={trade} />
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "0.85rem", color: T.mutedLight, lineHeight: 1.65 }}>{trade.notes}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {trade.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: ANALYTICS
═══════════════════════════════════════════════════════════════ */
function PageAnalytics() {
  const stats = [
    { l: "Net P&L", v: "$34,889.72", c: T.green },
    { l: "Win Rate", v: "61.20%", c: T.green },
    { l: "Profit Factor", v: "2.21", c: T.blue },
    { l: "Avg Win", v: "$416.11", c: T.green },
    { l: "Avg Loss", v: "$296.65", c: T.red },
    { l: "Max Drawdown", v: "-$410.00", c: T.red },
    { l: "Total Trades", v: "250", c: T.white },
    { l: "Winners", v: "153", c: T.green },
    { l: "Losers", v: "97", c: T.red },
    { l: "Break Even", v: "0", c: T.muted },
    { l: "Trade Expectancy", v: "$139.56", c: T.green },
    { l: "Largest Win", v: "$1,240.00", c: T.green },
  ];
  const tagPerf = [
    { tag: "momentum", trades: 82, pnl: 8420, wr: 68 },
    { tag: "breakout", trades: 55, pnl: 6100, wr: 71 },
    { tag: "ORB", trades: 38, pnl: 4890, wr: 63 },
    { tag: "scalping", trades: 41, pnl: 3210, wr: 56 },
    { tag: "distribution", trades: 22, pnl: 2780, wr: 73 },
    { tag: "crypto", trades: 12, pnl: -1480, wr: 33 },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {stats.map(({ l, v, c }) => (
          <div key={l} style={{ ...cardStyle, padding: "16px 20px", transition: "border-color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.greenBorder}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            <div style={{ color: T.muted, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>{l}</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.3rem", color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Trade-by-Trade P&L">
          {TRADES_DATA.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ width: 48, color: T.mutedLight, fontSize: "0.8rem", fontWeight: 600 }}>{t.symbol}</span>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3 }}>
                <div style={{ height: "100%", width: `${Math.min(100, Math.abs(t.pnl) / 7)}%`, background: t.pnl > 0 ? T.green : T.red, borderRadius: 3 }} />
              </div>
              <span style={{ width: 70, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: "0.8rem", fontWeight: 600, color: t.pnl > 0 ? T.green : T.red }}>{fmt$(t.pnl, true)}</span>
            </div>
          ))}
        </Card>
        <Card title="Performance by Strategy">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Tag", "Trades", "P&L", "Win%"].map(h => <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: T.muted, fontWeight: 500, fontSize: "0.63rem", textTransform: "uppercase" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {tagPerf.map(r => (
                <tr key={r.tag} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}
                  onMouseEnter={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "9px 10px" }}><Tag>{r.tag}</Tag></td>
                  <td style={{ padding: "9px 10px", color: T.muted, fontFamily: "'JetBrains Mono',monospace" }}>{r.trades}</td>
                  <td style={{ padding: "9px 10px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: r.pnl > 0 ? T.green : T.red }}>{fmt$(r.pnl, true)}</td>
                  <td style={{ padding: "9px 10px", color: r.wr > 60 ? T.green : r.wr > 50 ? T.white : T.red, fontFamily: "'JetBrains Mono',monospace" }}>{r.wr}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: WALLET (Calendar)
═══════════════════════════════════════════════════════════════ */
const DAILY_PNL = {
  "2026-02-17": -40, "2026-02-18": 345, "2026-02-19": 650,
  "2026-02-20": 480, "2026-02-24": 232,
};

function PageWallet() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(1);
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((firstDay + daysInMonth) / 7);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthPnls = Object.entries(DAILY_PNL)
    .filter(([d]) => { const dt = new Date(d); return dt.getFullYear() === year && dt.getMonth() === month; })
    .map(([, v]) => v);
  const monthTotal = monthPnls.reduce((a, b) => a + b, 0);
  const bestDay = Math.max(...monthPnls, 0);
  const worstDay = Math.min(...monthPnls, 0);

  return (
    <div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, letterSpacing: "-0.02em" }}>{monthNames[month]} {year}</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <PillBtn onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}>← Prev</PillBtn>
            <PillBtn onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}>Next →</PillBtn>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 5 }}>
          {dayNames.map(d => <div key={d} style={{ textAlign: "center", color: T.muted, fontSize: "0.72rem", fontWeight: 600, padding: "5px 0" }}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
          {Array.from({ length: weeks * 7 }).map((_, i) => {
            const dayNum = i - firstDay + 1;
            if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const pnl = DAILY_PNL[dateStr];
            const isToday = dateStr === "2026-02-24";
            const bg = pnl > 0 ? T.greenDim : pnl < 0 ? T.redDim : "transparent";
            const border = pnl > 0 ? `1px solid ${T.greenBorder}` : pnl < 0 ? `1px solid ${T.redBorder}` : `1px solid rgba(255,255,255,0.04)`;
            return (
              <div key={i} style={{ background: bg, border, borderRadius: 10, padding: "10px 8px", minHeight: 70, cursor: pnl !== undefined ? "pointer" : "default", transition: "transform 0.15s" }}>
                <div style={{ fontSize: "0.74rem", fontWeight: isToday ? 700 : 400, color: isToday ? T.green : T.muted, marginBottom: 5 }}>{dayNum}</div>
                {pnl !== undefined && <div style={{ fontSize: "0.72rem", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: pnl > 0 ? T.green : T.red }}>{fmt$(pnl, true)}</div>}
                {pnl !== undefined && <div style={{ fontSize: "0.63rem", color: T.muted, marginTop: 3 }}>1 trade</div>}
              </div>
            );
          })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 0, marginTop: 22, background: T.bgCardInner, borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}` }}>
          {[
            ["Trading Days", `${monthPnls.length}`, T.white],
            ["Best Day", fmt$(bestDay, true), T.green],
            ["Worst Day", fmt$(worstDay, true), T.red],
            ["Month P&L", fmt$(monthTotal, true), monthTotal >= 0 ? T.green : T.red],
          ].map(([l, v, c], i) => (
            <div key={l} style={{ padding: "14px 18px", borderRight: i < 3 ? `1px solid ${T.border}` : "none", textAlign: "center" }}>
              <div style={{ color: T.muted, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{l}</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, color: c, fontSize: "1.05rem" }}>{v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: MARKETS
═══════════════════════════════════════════════════════════════ */
function PageMarkets() {
  const markets = [
    { name: "S&P 500", val: "5,842.31", chg: "+1.24%", dir: "up" },
    { name: "Nasdaq", val: "18,432.10", chg: "+1.58%", dir: "up" },
    { name: "Dow Jones", val: "42,876.50", chg: "+0.82%", dir: "up" },
    { name: "BTC/USD", val: "68,420.00", chg: "+3.21%", dir: "up" },
    { name: "ETH/USD", val: "3,810.00", chg: "-0.45%", dir: "down" },
    { name: "SOL/USD", val: "172.50", chg: "+5.67%", dir: "up" },
    { name: "Gold", val: "2,184.30", chg: "+0.34%", dir: "up" },
    { name: "10Y Yield", val: "4.28%", chg: "-0.05%", dir: "down" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
      {markets.map(m => (
        <div key={m.name} style={{ ...cardStyle, padding: "18px 22px", transition: "border-color 0.2s" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = T.greenBorder}
          onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
          <div style={{ color: T.muted, fontSize: "0.75rem", marginBottom: 10, fontWeight: 500 }}>{m.name}</div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.2rem", color: T.white, marginBottom: 6 }}>{m.val}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: m.dir === "up" ? T.green : T.red, fontSize: "0.78rem", display: "flex", alignItems: "center", gap: 3 }}>
              {m.dir === "up" ? <Icons.ArrowUp /> : <Icons.ArrowDown />} {m.chg}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: ALERTS
═══════════════════════════════════════════════════════════════ */
function PageAlerts() {
  const alerts = [
    { symbol: "BTC/USD", condition: "Price above $70,000", status: "Active", created: "Mar 05" },
    { symbol: "AAPL", condition: "Price below $220", status: "Active", created: "Mar 04" },
    { symbol: "ETH/USD", condition: "Price above $4,000", status: "Active", created: "Mar 03" },
    { symbol: "NVDA", condition: "Price above $900", status: "Triggered", created: "Mar 01" },
    { symbol: "SOL/USD", condition: "Price below $150", status: "Expired", created: "Feb 28" },
  ];
  return (
    <Card title="Price Alerts">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {["Symbol", "Condition", "Status", "Created"].map(h => (
              <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: T.muted, fontWeight: 500, fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alerts.map((a, i) => (
            <tr key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}
              onMouseEnter={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.02)"}
              onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}>
              <td style={{ padding: "14px 16px", color: T.white, fontWeight: 600 }}>{a.symbol}</td>
              <td style={{ padding: "14px 16px", color: T.text }}>{a.condition}</td>
              <td style={{ padding: "14px 16px" }}><StatusBadge status={a.status === "Active" ? "Filled" : a.status === "Triggered" ? "Pending" : "Cancelled"} /></td>
              <td style={{ padding: "14px 16px", color: T.muted }}>{a.created}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE: SETTINGS
═══════════════════════════════════════════════════════════════ */
function PageSettings() {
  const [form, setForm] = useState({ name: "Alex Rivera", accountSize: "25000", risk: "2", market: "Stocks", currency: "USD", timezone: "America/New_York" });
  const [toggles, setToggles] = useState({ pnlSidebar: true, soundAlerts: false, emailReports: true, weeklyDigest: true });

  const field = (label, key, type = "text", opts = null) => (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", color: T.muted, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 7, fontWeight: 600 }}>{label}</label>
      {opts
        ? <select value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: "100%", background: T.bgCardInner, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", color: T.white, fontSize: "0.85rem", fontFamily: "inherit", outline: "none" }}>
          {opts.map(o => <option key={o}>{o}</option>)}
        </select>
        : <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: "100%", background: T.bgCardInner, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px", color: T.white, fontSize: "0.85rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
      }
    </div>
  );

  function Toggle({ label, k }) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
        <span style={{ fontSize: "0.88rem", color: T.text }}>{label}</span>
        <div onClick={() => setToggles(t => ({ ...t, [k]: !t[k] }))} style={{ width: 44, height: 24, borderRadius: 12, background: toggles[k] ? T.green : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
          <div style={{ position: "absolute", top: 3, left: toggles[k] ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Card title="Profile">
          {field("Display Name", "name")}
          {field("Account Size ($)", "accountSize", "number")}
          {field("Risk Per Trade (%)", "risk", "number")}
        </Card>
        <Card title="Preferences">
          {field("Default Market", "market", "select", ["Stocks", "Futures", "Crypto", "Forex"])}
          {field("Currency", "currency", "select", ["USD", "EUR", "GBP", "JPY"])}
          {field("Timezone", "timezone", "select", ["America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"])}
        </Card>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Card title="Notifications">
          <Toggle label="P&L in Sidebar" k="pnlSidebar" />
          <Toggle label="Sound Alerts" k="soundAlerts" />
          <Toggle label="Email Reports" k="emailReports" />
          <Toggle label="Weekly Digest" k="weeklyDigest" />
        </Card>
        <button onClick={() => alert("Settings saved!")} style={{ background: `linear-gradient(135deg,${T.green},${T.greenBright})`, border: "none", borderRadius: 12, padding: "14px", color: "#000", fontWeight: 800, cursor: "pointer", fontSize: "0.9rem", fontFamily: "inherit", boxShadow: `0 4px 24px rgba(0,230,160,0.25)`, transition: "transform 0.1s" }}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════ */
const MAIN_TABS = [
  { id: "dashboard", label: "Dashboard", icon: Icons.Dashboard, page: PageDashboard },
  { id: "portfolio", label: "Portfolio", icon: Icons.Portfolio, page: PagePortfolio },
  { id: "trades", label: "Trades", icon: Icons.Trades, page: PageTrades },
  { id: "analytics", label: "Analytics", icon: Icons.Analytics, page: PageAnalytics },
  { id: "wallet", label: "Wallet", icon: Icons.Wallet, page: PageWallet },
];

const OTHER_TABS = [
  { id: "markets", label: "Markets", icon: Icons.Markets, page: PageMarkets },
  { id: "alerts", label: "Alerts", icon: Icons.Alerts, page: PageAlerts },
  { id: "settings", label: "Settings", icon: Icons.Settings, page: PageSettings },
];

const ALL_TABS = [...MAIN_TABS, ...OTHER_TABS];

export default function TradingJournal() {
  const [active, setActive] = useState("dashboard");
  const [searchFocused, setSearchFocused] = useState(false);
  const tab = ALL_TABS.find(t => t.id === active);
  const PageComp = tab.page;
  const totalPnl = 34870;

  const NavBtn = ({ id, label, icon: Icon }) => {
    const isActive = active === id;
    return (
      <button onClick={() => setActive(id)} style={{
        width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 11,
        background: isActive ? T.greenDim : "transparent",
        border: "none",
        borderLeft: `3px solid ${isActive ? T.green : "transparent"}`,
        borderRadius: "0 10px 10px 0",
        padding: "10px 16px", marginBottom: 2, cursor: "pointer",
        color: isActive ? T.green : T.muted,
        fontWeight: isActive ? 600 : 400, fontSize: "0.86rem", fontFamily: "inherit",
        transition: "all 0.15s",
      }}
        onMouseEnter={ev => { if (!isActive) { ev.currentTarget.style.background = "rgba(255,255,255,0.03)"; ev.currentTarget.style.color = T.white; } }}
        onMouseLeave={ev => { if (!isActive) { ev.currentTarget.style.background = "transparent"; ev.currentTarget.style.color = T.muted; } }}>
        <Icon />
        {label}
      </button>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: T.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: T.white }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* ── SIDEBAR ── */}
      <aside style={{ width: 220, flexShrink: 0, background: T.bgSidebar, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", height: "100vh", overflowY: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 0 }}>
            <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${T.green},#00b370)`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>📈</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.02rem", letterSpacing: "-0.03em" }}>Trade<span style={{ color: T.green }}>volut</span></div>
              <div style={{ color: T.muted, fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 500 }}>Portfolio Pro</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "0 14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bgCard, border: `1px solid ${searchFocused ? T.greenBorder : T.border}`, borderRadius: 10, padding: "8px 12px", transition: "border-color 0.2s" }}>
            <span style={{ color: T.muted }}><Icons.Search /></span>
            <input
              placeholder="Search..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{ background: "transparent", border: "none", outline: "none", color: T.white, fontSize: "0.82rem", fontFamily: "inherit", width: "100%" }}
            />
            <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, padding: "1px 6px", fontSize: "0.6rem", color: T.muted, border: `1px solid ${T.border}` }}>/</span>
          </div>
        </div>

        {/* Main nav */}
        <nav style={{ padding: "0 8px", flex: 1 }}>
          <div style={{ color: T.muted, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, padding: "4px 18px 8px" }}>Main</div>
          {MAIN_TABS.map(t => <NavBtn key={t.id} {...t} />)}

          <div style={{ color: T.muted, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 700, padding: "18px 18px 8px" }}>Other</div>
          {OTHER_TABS.map(t => <NavBtn key={t.id} {...t} />)}
        </nav>

        {/* Bottom user card */}
        <div style={{ padding: "0 12px 18px" }}>
          <div style={{ background: T.bgCard, border: `1px solid ${T.greenBorder}`, borderRadius: 14, padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#00e6a0,#0090ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#000", flexShrink: 0 }}>A</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.84rem" }}>Alex Rivera</div>
                <div style={{ color: T.muted, fontSize: "0.66rem" }}>Pro Trader</div>
              </div>
            </div>
            <div style={{ color: T.muted, fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 600 }}>Portfolio Value</div>
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: "1.2rem", color: T.green }}>${totalPnl.toLocaleString()}.00</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
              <span style={{ color: T.green, fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 3 }}><Icons.ArrowUp /> +55.7% all time</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, overflowY: "auto", padding: "24px 30px", boxSizing: "border-box" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ color: T.muted, fontSize: "0.74rem" }}>Tradevolut</span>
              <span style={{ color: T.muted }}>›</span>
              <span style={{ color: T.mutedLight, fontSize: "0.74rem" }}>{tab.label}</span>
            </div>
            <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
              {active === "dashboard" ? <>Good morning, <span style={{ color: T.white }}>Alex</span> 👋</> : tab.label}
            </h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 16px", display: "flex", alignItems: "center", gap: 7, color: T.mutedLight, cursor: "pointer", fontSize: "0.82rem", fontFamily: "inherit", transition: "border-color 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = T.greenBorder}
              onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
              <Icons.Refresh /> Refresh
            </button>
            <button style={{ background: `linear-gradient(135deg,${T.green},#00c96e)`, border: "none", borderRadius: 10, padding: "9px 20px", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: "0.84rem", fontFamily: "inherit", boxShadow: `0 4px 20px rgba(0,230,160,0.22)`, transition: "transform 0.1s" }}>
              + New Trade
            </button>
          </div>
        </div>

        <PageComp />
      </main>
    </div>
  );
}
