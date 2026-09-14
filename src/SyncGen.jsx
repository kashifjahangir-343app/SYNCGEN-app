import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Activity, Zap, Sun, Server, Cloud, Battery, AlertTriangle, Bell,
  LayoutDashboard, Factory, Settings, Plus, Search, ChevronRight, ChevronDown,
  Wifi, WifiOff, Gauge, TrendingUp, FileText, Radio,
  Power, Thermometer, Wind, Droplets, Sunrise, X, Check,
  Download, Grid3x3, Map, BellRing, CircleDot,
  Sparkles, Send, MessageSquare, TrendingDown, Search as SearchIcon, Loader
} from "lucide-react";

/* ============================================================
   SyncGen — Centralized EMS / SCADA Portal
   Multi-plant, MQTT-device-driven telemetry.
   Sources: WAPDA (Grid), Gas Genset, Solar PV, Battery (BESS)
   ============================================================ */

// ▼▼▼ DEPLOYMENT SETTING — leave empty for the demo. ▼▼▼
// When you build the real backend, paste its address between the quotes,
// e.g. "https://your-domain.com/api/ai". That backend holds your Anthropic
// API key securely. While this is empty, the AI bot runs in friendly demo mode.
const AI_BACKEND_URL = "";
// ▲▲▲ -------------------------------------------------- ▲▲▲

const THEME = {
  bg: "#0A0E14",
  panel: "#111722",
  panel2: "#161E2D",
  line: "#1F2A3C",
  text: "#E6EDF5",
  dim: "#7C8BA1",
  faint: "#4A5870",
  signal: "#3DF5A0",   // live telemetry green
  grid: "#4D9DFF",     // WAPDA
  gas: "#FF9F43",      // genset
  solar: "#FFD23F",    // solar
  batt: "#A78BFA",     // battery
  alarm: "#FF5C5C",
  warn: "#FFB020",
};

const SRC = {
  grid: { name: "WAPDA Grid", color: THEME.grid, icon: Zap },
  gas: { name: "Gas Genset", color: THEME.gas, icon: Server },
  solar: { name: "Solar PV", color: THEME.solar, icon: Sun },
  batt: { name: "Battery", color: THEME.batt, icon: Battery },
};

// ---------- Synthetic but realistic plant fleet ----------
const DEPT_NAMES = [
  "Sunrays Textile Unit 1", "Sunrays Textile Unit 2",
  "Indus Dyeing Unit 1", "Indus Dyeing Unit 2",
  "Recycle Plant", "TFO Department",
];

function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function buildPlant(id) {
  const r = seededRand(id * 7919 + 13);
  const regions = ["Faisalabad", "Karachi", "Lahore", "Multan", "Sialkot", "Gujranwala"];
  const names = [
    "Sunrays Textile Complex", "Indus Weaving Mills", "Crescent Spinning",
    "Nishat Processing", "Kohinoor Mills", "Gul Ahmed Unit", "Sapphire Fibres",
    "Masood Textile", "Chenab Mills", "Interloop Hosiery",
  ];
  const name = `${names[id % names.length]} ${String.fromCharCode(65 + (id % 6))}${id}`;
  const online = r() > 0.06;
  const gridKw = Math.round(800 + r() * 2600);
  const gasKw = Math.round(400 + r() * 1800);
  const solarKw = Math.round(200 + r() * 1400);
  const battKw = Math.round(r() > 0.4 ? 100 + r() * 600 : 0);
  const total = gridKw + gasKw + solarKw + battKw;
  const alarms = Math.floor(r() * 5);
  return {
    id, name, region: regions[id % regions.length], online,
    sources: { grid: gridKw, gas: gasKw, solar: solarKw, batt: battKw },
    total, alarms,
    pf: (0.88 + r() * 0.11).toFixed(2),
    pr: Math.round(78 + r() * 18),       // solar performance ratio %
    cuf: Math.round(16 + r() * 9),       // capacity utilization %
    co2: (total * 0.0007).toFixed(1),
    cost: Math.round(total * (14 + r() * 6)),
    lastSeen: online ? `${Math.floor(r() * 30)}s ago` : `${1 + Math.floor(r() * 9)}h ago`,
    devices: 8 + Math.floor(r() * 30),
    depts: DEPT_NAMES.map((d, i) => ({
      name: d, kw: Math.round((total / 6) * (0.6 + r() * 0.9)),
      lf: Math.round(55 + r() * 35),
    })),
    weather: {
      ghi: Math.round(300 + r() * 650), amb: Math.round(24 + r() * 14),
      mod: Math.round(30 + r() * 22), wind: (1 + r() * 7).toFixed(1),
      hum: Math.round(35 + r() * 45), windDir: Math.round(r() * 360),
    },
  };
}

const FLEET = Array.from({ length: 200 }, (_, i) => buildPlant(i + 1));

// ---------- Time-series generators ----------
function genDaySeries(plant, key) {
  const r = seededRand(plant.id * 31 + key.length);
  return Array.from({ length: 24 }, (_, h) => {
    const solarShape = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    const base = {
      grid: plant.sources.grid * (0.55 + 0.4 * (1 - solarShape) + r() * 0.1),
      gas: plant.sources.gas * (0.5 + 0.4 * Math.abs(Math.sin(h / 4)) + r() * 0.1),
      solar: plant.sources.solar * solarShape * (0.85 + r() * 0.2),
      batt: plant.sources.batt * (solarShape > 0.4 ? -0.4 : 0.5) * (0.5 + r()),
      load: plant.total * (0.6 + 0.35 * Math.abs(Math.sin((h - 3) / 5)) + r() * 0.08),
    };
    return {
      h: `${String(h).padStart(2, "0")}:00`,
      grid: Math.max(0, Math.round(base.grid)),
      gas: Math.max(0, Math.round(base.gas)),
      solar: Math.max(0, Math.round(base.solar)),
      batt: Math.round(base.batt),
      load: Math.round(base.load),
    };
  });
}

function genMonthSeries(plant) {
  const r = seededRand(plant.id * 53);
  return Array.from({ length: 30 }, (_, d) => ({
    d: d + 1,
    grid: Math.round(plant.sources.grid * 20 * (0.8 + r() * 0.4)),
    gas: Math.round(plant.sources.gas * 18 * (0.7 + r() * 0.5)),
    solar: Math.round(plant.sources.solar * 7 * (0.6 + r() * 0.6)),
  }));
}

// ---------- Small UI atoms ----------
const fmt = (n) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`;
const fmtFull = (n) => Math.round(n).toLocaleString();

function StatusDot({ online, pulse }) {
  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <span style={{
        width: 8, height: 8, borderRadius: 99,
        background: online ? THEME.signal : THEME.faint,
        boxShadow: online ? `0 0 8px ${THEME.signal}` : "none",
      }} />
      {online && pulse && (
        <span className="sg-ping" style={{
          position: "absolute", inset: 0, borderRadius: 99,
          background: THEME.signal,
        }} />
      )}
    </span>
  );
}

function Panel({ children, style, pad = 16, ...p }) {
  return (
    <div {...p} style={{
      background: THEME.panel, border: `1px solid ${THEME.line}`,
      borderRadius: 12, padding: pad, ...style,
    }}>{children}</div>
  );
}

function Sparkline({ data, color, height = 36 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`sp-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#sp-${color})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function spark(seed) {
  const r = seededRand(seed);
  return Array.from({ length: 20 }, () => ({ v: 40 + r() * 60 }));
}

const chartTooltipStyle = {
  background: THEME.panel2, border: `1px solid ${THEME.line}`,
  borderRadius: 8, fontSize: 12, color: THEME.text,
};

// ---------- Signature: Energy Flow (Sankey-style) ----------
function EnergyFlow({ plant }) {
  const s = plant.sources;
  const gen = s.grid + s.gas + s.solar + Math.max(0, s.batt);
  const loads = plant.depts;
  const loadTotal = loads.reduce((a, b) => a + b.kw, 0) || 1;
  const sources = [
    { k: "grid", v: s.grid }, { k: "gas", v: s.gas },
    { k: "solar", v: s.solar }, { k: "batt", v: Math.max(0, s.batt) },
  ].filter((x) => x.v > 0);

  const H = 320, W = 720, padY = 16;
  const srcX = 40, midX = W / 2, loadX = W - 40;
  let sy = padY, ly = padY;
  const srcNodes = sources.map((src) => {
    const h = (src.v / gen) * (H - padY * 2);
    const node = { ...src, y: sy, h, cy: sy + h / 2 };
    sy += h + 6; return node;
  });
  const loadNodes = loads.map((ld) => {
    const h = (ld.kw / loadTotal) * (H - padY * 2);
    const node = { ...ld, y: ly, h, cy: ly + h / 2 };
    ly += h + 6; return node;
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 560 }}>
        <defs>
          {sources.map((src) => (
            <linearGradient key={src.k} id={`flow-${src.k}`} x1="0" x2="1">
              <stop offset="0%" stopColor={SRC[src.k].color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={SRC[src.k].color} stopOpacity={0.08} />
            </linearGradient>
          ))}
        </defs>
        {/* flows */}
        {srcNodes.map((sn) =>
          loadNodes.map((ln, li) => {
            const frac = ln.kw / loadTotal;
            const sw = Math.max(1.5, sn.h * frac);
            const y1 = sn.cy, y2 = ln.cy;
            const c1 = midX - 60, c2 = midX + 60;
            return (
              <path key={`${sn.k}-${li}`}
                d={`M ${srcX + 14} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${loadX - 14} ${y2}`}
                stroke={`url(#flow-${sn.k})`} strokeWidth={sw} fill="none"
                opacity={0.7} className="sg-flow" />
            );
          })
        )}
        {/* source nodes */}
        {srcNodes.map((sn) => (
          <g key={sn.k}>
            <rect x={srcX} y={sn.y} width={14} height={sn.h} rx={3}
              fill={SRC[sn.k].color} />
            <text x={srcX + 22} y={sn.cy - 2} fill={THEME.text} fontSize={11}
              fontWeight={600}>{SRC[sn.k].name}</text>
            <text x={srcX + 22} y={sn.cy + 11} fill={THEME.dim} fontSize={10}
              fontFamily="ui-monospace, monospace">{fmtFull(sn.v)} kW</text>
          </g>
        ))}
        {/* load nodes */}
        {loadNodes.map((ln, i) => (
          <g key={i}>
            <rect x={loadX} y={ln.y} width={14} height={ln.h} rx={3}
              fill={THEME.faint} />
            <text x={loadX - 8} y={ln.cy - 2} fill={THEME.text} fontSize={11}
              textAnchor="end" fontWeight={600}>{ln.name}</text>
            <text x={loadX - 8} y={ln.cy + 11} fill={THEME.dim} fontSize={10}
              textAnchor="end" fontFamily="ui-monospace, monospace">{fmtFull(ln.kw)} kW</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ---------- Live telemetry simulation (stands in for MQTT subscription) ----------
function useLiveTick(ms = 2000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return tick;
}

function KpiCard({ label, value, unit, sub, color, icon: Icon, sparkSeed }) {
  return (
    <Panel pad={14} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: THEME.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
        <Icon size={15} color={color} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: THEME.text, fontFamily: "ui-monospace, monospace", lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 12, color: THEME.dim }}>{unit}</span>
      </div>
      {sparkSeed !== undefined && <Sparkline data={spark(sparkSeed)} color={color} />}
      {sub && <span style={{ fontSize: 11, color: THEME.faint }}>{sub}</span>}
    </Panel>
  );
}

// ---------- App Shell ----------
const NAV = [
  { id: "kpi", label: "Overview", icon: Gauge },
  { id: "fleet", label: "All Plants", icon: LayoutDashboard },
  { id: "plant", label: "Plant Operations", icon: Activity },
  { id: "sources", label: "Energy Sources", icon: Zap },
  { id: "solar", label: "Solar Analytics", icon: Sun },
  { id: "weather", label: "Weather Stations", icon: Cloud },
  { id: "depts", label: "Energy Accounting", icon: Factory },
  { id: "trends", label: "Historical Trends", icon: TrendingUp },
  { id: "alarms", label: "Alarms & Events", icon: BellRing },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "admin", label: "Admin · Plants & Tags", icon: Settings },
];

export default function SyncGen() {
  const [view, setView] = useState("kpi");
  const [activePlant, setActivePlant] = useState(FLEET[0]);
  const [fleet, setFleet] = useState(FLEET);
  const [navOpen, setNavOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const tick = useLiveTick(2500);

  const openPlant = (p) => { setActivePlant(p); setView("plant"); setNavOpen(false); };

  const totals = useMemo(() => {
    const online = fleet.filter((p) => p.online).length;
    const gen = fleet.reduce((a, p) => a + p.total, 0);
    const alarms = fleet.reduce((a, p) => a + p.alarms, 0);
    const solar = fleet.reduce((a, p) => a + p.sources.solar, 0);
    const co2 = fleet.reduce((a, p) => a + parseFloat(p.co2), 0);
    return { online, gen, alarms, solar, co2, count: fleet.length };
  }, [fleet]);

  return (
    <div style={{
      display: "flex", minHeight: "100vh", background: THEME.bg,
      color: THEME.text, fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${THEME.line}; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        @keyframes sgping { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(2.6); opacity: 0 } }
        .sg-ping { animation: sgping 1.8s ease-out infinite; }
        @keyframes flowdash { to { stroke-dashoffset: -24; } }
        .sg-flow { stroke-dasharray: 1 0; }
        .sg-nav-item:hover { background: ${THEME.panel2} !important; }
        .sg-row:hover { background: ${THEME.panel2} !important; }
        .sg-btn:hover { filter: brightness(1.12); }
        .sg-ai-fab:hover { transform: translateY(-2px); transition: transform .15s; }
        @keyframes sgblink { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
        .sg-typing { animation: sgblink 1.2s ease-in-out infinite; }
        .sg-md p { margin: 0 0 8px; } .sg-md ul { margin: 4px 0 8px; padding-left: 18px; } .sg-md li { margin: 2px 0; } .sg-md strong { color: ${THEME.text}; } .sg-md code { background: ${THEME.bg}; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
        @media (prefers-reduced-motion: reduce) { .sg-ping { animation: none; } }
        @media (max-width: 900px) { .sg-sidebar { position: fixed; z-index: 50; height: 100%; transform: translateX(-100%); transition: transform .2s; } .sg-sidebar.open { transform: translateX(0); } .sg-hamburger { display: flex !important; } }
      `}</style>

      {/* Sidebar */}
      <aside className={`sg-sidebar ${navOpen ? "open" : ""}`} style={{
        width: 230, background: THEME.panel, borderRight: `1px solid ${THEME.line}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${THEME.line}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${THEME.signal}, ${THEME.grid})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Radio size={18} color="#06120C" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>SyncGen</div>
            <div style={{ fontSize: 9.5, color: THEME.dim, letterSpacing: 1, textTransform: "uppercase" }}>EMS · SCADA</div>
          </div>
        </div>
        <nav style={{ padding: 8, flex: 1, overflowY: "auto" }}>
          {NAV.map((n) => {
            const on = view === n.id;
            return (
              <button key={n.id} className="sg-nav-item" onClick={() => { setView(n.id); setNavOpen(false); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", marginBottom: 2, borderRadius: 8, border: "none",
                  background: on ? THEME.panel2 : "transparent", cursor: "pointer",
                  color: on ? THEME.text : THEME.dim, fontSize: 13, textAlign: "left",
                  borderLeft: on ? `2px solid ${THEME.signal}` : "2px solid transparent",
                  fontWeight: on ? 600 : 400,
                }}>
                <n.icon size={16} color={on ? THEME.signal : THEME.dim} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: 12, borderTop: `1px solid ${THEME.line}`, fontSize: 11, color: THEME.faint }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Wifi size={12} color={THEME.signal} /> MQTT broker · live
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Server size={12} /> MQTT field devices
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar view={view} totals={totals} activePlant={activePlant}
          onHamburger={() => setNavOpen((o) => !o)} tick={tick} />
        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {view === "kpi" && <KpiDashboard fleet={fleet} totals={totals} tick={tick} openPlant={openPlant} />}
          {view === "fleet" && <FleetView fleet={fleet} openPlant={openPlant} totals={totals} tick={tick} />}
          {view === "plant" && <PlantView plant={activePlant} tick={tick} />}
          {view === "sources" && <SourcesView plant={activePlant} fleet={fleet} setPlant={setActivePlant} />}
          {view === "solar" && <SolarView plant={activePlant} fleet={fleet} setPlant={setActivePlant} />}
          {view === "weather" && <WeatherView plant={activePlant} fleet={fleet} setPlant={setActivePlant} tick={tick} />}
          {view === "depts" && <DeptsView plant={activePlant} fleet={fleet} setPlant={setActivePlant} />}
          {view === "trends" && <TrendsView plant={activePlant} fleet={fleet} setPlant={setActivePlant} />}
          {view === "alarms" && <AlarmsView fleet={fleet} openPlant={openPlant} />}
          {view === "reports" && <ReportsView />}
          {view === "admin" && <AdminView fleet={fleet} setFleet={setFleet} />}
        </div>
      </main>

      {/* SyncGen AI — floating launcher + slide-in panel */}
      {!aiOpen && (
        <button className="sg-btn sg-ai-fab" onClick={() => setAiOpen(true)} style={{
          position: "fixed", right: 22, bottom: 22, zIndex: 60,
          display: "flex", alignItems: "center", gap: 9, padding: "12px 18px",
          borderRadius: 99, border: "none", cursor: "pointer",
          background: `linear-gradient(135deg, ${THEME.signal}, ${THEME.grid})`,
          color: "#06120C", fontWeight: 700, fontSize: 13.5,
          boxShadow: `0 8px 30px ${THEME.signal}40`,
        }}>
          <Sparkles size={17} /> Ask SyncGen AI
        </button>
      )}
      <SyncGenAI open={aiOpen} onClose={() => setAiOpen(false)} plant={activePlant} fleet={fleet} totals={totals} setPlant={setActivePlant} />
    </div>
  );
}

// ---------- Top Bar ----------
function TopBar({ view, totals, activePlant, onHamburger, tick }) {
  const title = NAV.find((n) => n.id === view)?.label || "SyncGen";
  const showPlant = ["plant", "sources", "solar", "weather", "depts", "trends"].includes(view);
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 14, padding: "12px 18px",
      borderBottom: `1px solid ${THEME.line}`, background: THEME.panel,
      position: "sticky", top: 0, zIndex: 20,
    }}>
      <button className="sg-hamburger" onClick={onHamburger} style={{
        display: "none", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, borderRadius: 8, border: `1px solid ${THEME.line}`,
        background: THEME.panel2, color: THEME.text, cursor: "pointer",
      }}><Grid3x3 size={16} /></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>
        {showPlant && (
          <div style={{ fontSize: 11.5, color: THEME.dim, display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot online={activePlant.online} /> {activePlant.name} · {activePlant.region}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: THEME.signal }}>
          <CircleDot size={13} className="sg-flow" /> {totals.online}/{totals.count} online
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: totals.alarms ? THEME.alarm : THEME.dim }}>
          <Bell size={14} /> {totals.alarms}
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: 99, background: THEME.panel2,
          border: `1px solid ${THEME.line}`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 12, fontWeight: 700, color: THEME.signal,
        }}>AD</div>
      </div>
    </header>
  );
}

// ---------- Fleet Overview ----------
function FleetView({ fleet, openPlant, totals, tick }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const live = (v) => Math.round(v * (0.97 + ((tick % 7) / 100)));

  const filtered = fleet.filter((p) => {
    const m = p.name.toLowerCase().includes(q.toLowerCase()) || p.region.toLowerCase().includes(q.toLowerCase());
    if (filter === "online") return m && p.online;
    if (filter === "offline") return m && !p.online;
    if (filter === "alarms") return m && p.alarms > 0;
    return m;
  });

  const mixData = [
    { name: "WAPDA", value: fleet.reduce((a, p) => a + p.sources.grid, 0), color: THEME.grid },
    { name: "Gas", value: fleet.reduce((a, p) => a + p.sources.gas, 0), color: THEME.gas },
    { name: "Solar", value: fleet.reduce((a, p) => a + p.sources.solar, 0), color: THEME.solar },
    { name: "Battery", value: fleet.reduce((a, p) => a + p.sources.batt, 0), color: THEME.batt },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        <KpiCard label="Total Generation" value={fmt(live(totals.gen))} unit="kW" color={THEME.signal} icon={Activity} sub="all plants · live" sparkSeed={1} />
        <KpiCard label="Plants Online" value={`${totals.online}`} unit={`/ ${totals.count}`} color={THEME.grid} icon={Power} sub={`${Math.round(totals.online / totals.count * 100)}% availability`} sparkSeed={2} />
        <KpiCard label="Solar Output" value={fmt(live(totals.solar))} unit="kW" color={THEME.solar} icon={Sun} sub="distributed PV" sparkSeed={3} />
        <KpiCard label="Active Alarms" value={`${totals.alarms}`} unit="" color={totals.alarms ? THEME.alarm : THEME.dim} icon={AlertTriangle} sub="all plants" sparkSeed={4} />
        <KpiCard label="CO₂ Avoided" value={totals.co2.toFixed(0)} unit="t/day" color={THEME.signal} icon={TrendingUp} sub="vs grid baseline" sparkSeed={5} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }} className="sg-grid2">
        {/* Fleet table */}
        <Panel pad={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: 14, display: "flex", gap: 10, alignItems: "center", borderBottom: `1px solid ${THEME.line}`, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
              <Search size={14} color={THEME.dim} style={{ position: "absolute", left: 10, top: 9 }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plants…"
                style={{ width: "100%", padding: "7px 10px 7px 30px", background: THEME.bg, border: `1px solid ${THEME.line}`, borderRadius: 8, color: THEME.text, fontSize: 12.5, outline: "none" }} />
            </div>
            {["all", "online", "offline", "alarms"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="sg-btn" style={{
                padding: "6px 11px", borderRadius: 7, fontSize: 11.5, cursor: "pointer",
                border: `1px solid ${filter === f ? THEME.signal : THEME.line}`,
                background: filter === f ? "rgba(61,245,160,0.1)" : THEME.bg,
                color: filter === f ? THEME.signal : THEME.dim, textTransform: "capitalize",
              }}>{f}</button>
            ))}
          </div>
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead style={{ position: "sticky", top: 0, background: THEME.panel, zIndex: 1 }}>
                <tr style={{ color: THEME.dim, fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  <th style={th}>Plant</th><th style={th}>Region</th>
                  <th style={{ ...th, textAlign: "right" }}>Load</th>
                  <th style={{ ...th, textAlign: "center" }}>PF</th>
                  <th style={{ ...th, textAlign: "center" }}>Alarms</th>
                  <th style={{ ...th, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 60).map((p) => (
                  <tr key={p.id} className="sg-row" onClick={() => openPlant(p)} style={{ cursor: "pointer", borderTop: `1px solid ${THEME.line}` }}>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <StatusDot online={p.online} pulse />
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ ...td, color: THEME.dim }}>{p.region}</td>
                    <td style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{fmt(live(p.total))} kW</td>
                    <td style={{ ...td, textAlign: "center", color: parseFloat(p.pf) < 0.92 ? THEME.warn : THEME.dim }}>{p.pf}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {p.alarms > 0 ? <span style={{ color: THEME.alarm, fontWeight: 600 }}>{p.alarms}</span> : <span style={{ color: THEME.faint }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}><ChevronRight size={15} color={THEME.faint} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 60 && <div style={{ padding: 10, textAlign: "center", fontSize: 11, color: THEME.faint }}>Showing 60 of {filtered.length} matching plants</div>}
          </div>
        </Panel>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel>
            <div style={sectionTitle}>Plants Energy Mix</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={mixData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                  {mixData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => `${fmt(v)} kW`} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {mixData.map((m) => (
                <span key={m.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: THEME.dim }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} /> {m.name}
                </span>
              ))}
            </div>
          </Panel>
          <Panel>
            <div style={sectionTitle}>Regions</div>
            {Object.entries(fleet.reduce((a, p) => { a[p.region] = (a[p.region] || 0) + 1; return a; }, {})).map(([reg, n]) => (
              <div key={reg} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: `1px solid ${THEME.line}`, fontSize: 12.5 }}>
                <span style={{ color: THEME.dim }}>{reg}</span>
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{n} plants</span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 14px", fontWeight: 600 };
const td = { padding: "9px 14px" };
const sectionTitle = { fontSize: 12, fontWeight: 600, color: THEME.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12 };

// ---------- Plant Operations ----------
function PlantView({ plant, tick }) {
  const live = (v) => Math.round(v * (0.96 + ((tick % 9) / 100)));
  const day = useMemo(() => genDaySeries(plant, "ops"), [plant.id]);
  const s = plant.sources;
  const srcCards = [
    { k: "grid", v: s.grid }, { k: "gas", v: s.gas },
    { k: "solar", v: s.solar }, { k: "batt", v: s.batt },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Source status row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {srcCards.map(({ k, v }) => {
          const meta = SRC[k]; const Icon = meta.icon;
          const active = v !== 0;
          return (
            <Panel key={k} pad={14}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `${meta.color}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={16} color={meta.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{meta.name}</div>
                    <div style={{ fontSize: 10.5, color: active ? THEME.signal : THEME.faint }}>{active ? (v < 0 ? "Charging" : "Online") : "Standby"}</div>
                  </div>
                </div>
                <StatusDot online={active} pulse />
              </div>
              <div style={{ marginTop: 12, fontSize: 24, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>
                {k === "batt" && v < 0 ? "−" : ""}{fmt(Math.abs(live(v)))} <span style={{ fontSize: 12, color: THEME.dim, fontWeight: 400 }}>kW</span>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Sankey + summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }} className="sg-grid2">
        <Panel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={sectionTitle}>Live Energy Flow · Sankey</div>
            <span style={{ fontSize: 10.5, color: THEME.signal, display: "flex", alignItems: "center", gap: 5 }}><CircleDot size={11} /> streaming</span>
          </div>
          <EnergyFlow plant={plant} />
        </Panel>
        <Panel>
          <div style={sectionTitle}>Plant Vitals</div>
          {[
            ["Total Load", `${fmtFull(live(plant.total))} kW`, THEME.signal],
            ["Power Factor", plant.pf, parseFloat(plant.pf) < 0.92 ? THEME.warn : THEME.text],
            ["Connected Devices", `${plant.devices}`, THEME.text],
            ["Daily Energy Cost", `Rs ${fmtFull(plant.cost)}`, THEME.text],
            ["CO₂ Avoided", `${plant.co2} t/day`, THEME.signal],
            ["Last Telemetry", plant.lastSeen, THEME.dim],
          ].map(([k, v, c]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `1px solid ${THEME.line}`, fontSize: 13 }}>
              <span style={{ color: THEME.dim }}>{k}</span>
              <span style={{ fontWeight: 600, color: c, fontFamily: "ui-monospace, monospace" }}>{v}</span>
            </div>
          ))}
        </Panel>
      </div>

      {/* 24h source stack */}
      <Panel>
        <div style={sectionTitle}>Source Contribution · 24 h</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={day}>
            <defs>
              {["grid", "gas", "solar"].map((k) => (
                <linearGradient key={k} id={`ar-${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SRC[k].color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={SRC[k].color} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
            <XAxis dataKey="h" stroke={THEME.faint} fontSize={10} interval={3} tickLine={false} />
            <YAxis stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Area type="monotone" dataKey="grid" stackId="1" stroke={THEME.grid} fill="url(#ar-grid)" name="WAPDA" />
            <Area type="monotone" dataKey="gas" stackId="1" stroke={THEME.gas} fill="url(#ar-gas)" name="Gas" />
            <Area type="monotone" dataKey="solar" stackId="1" stroke={THEME.solar} fill="url(#ar-solar)" name="Solar" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

// ---------- Plant selector (reusable) ----------
function PlantPicker({ fleet, plant, setPlant }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const list = fleet.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  return (
    <div style={{ position: "relative" }}>
      <button className="sg-btn" onClick={() => setOpen((o) => !o)} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        background: THEME.panel2, border: `1px solid ${THEME.line}`, borderRadius: 8,
        color: THEME.text, fontSize: 12.5, cursor: "pointer",
      }}>
        <StatusDot online={plant.online} /> {plant.name}
        <ChevronDown size={14} color={THEME.dim} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: 42, left: 0, zIndex: 30, width: 300, background: THEME.panel2, border: `1px solid ${THEME.line}`, borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,.5)", overflow: "hidden" }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plants…"
            style={{ width: "100%", padding: "10px 12px", background: THEME.bg, border: "none", borderBottom: `1px solid ${THEME.line}`, color: THEME.text, fontSize: 12.5, outline: "none" }} />
          <div style={{ maxHeight: 300, overflowY: "auto" }}>
            {list.map((p) => (
              <div key={p.id} className="sg-row" onClick={() => { setPlant(p); setOpen(false); setQ(""); }}
                style={{ padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <StatusDot online={p.online} /> {p.name}
                <span style={{ marginLeft: "auto", fontSize: 11, color: THEME.faint }}>{p.region}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ViewHeader({ fleet, plant, setPlant, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
      <PlantPicker fleet={fleet} plant={plant} setPlant={setPlant} />
      {right}
    </div>
  );
}

// ---------- Energy Sources (deep telemetry) ----------
function SourcesView({ plant, fleet, setPlant }) {
  const [tab, setTab] = useState("grid");
  const tabs = [
    { k: "grid", label: "WAPDA Grid", icon: Zap },
    { k: "gas", label: "Gas Genset", icon: Server },
    { k: "solar", label: "Solar PV", icon: Sun },
    { k: "batt", label: "Battery", icon: Battery },
  ];
  return (
    <div>
      <ViewHeader fleet={fleet} plant={plant} setPlant={setPlant} />
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className="sg-btn" style={{
            display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8,
            border: `1px solid ${tab === t.k ? SRC[t.k].color : THEME.line}`,
            background: tab === t.k ? `${SRC[t.k].color}14` : THEME.panel,
            color: tab === t.k ? SRC[t.k].color : THEME.dim, cursor: "pointer", fontSize: 12.5,
          }}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      {tab === "grid" && <GridDetail plant={plant} />}
      {tab === "gas" && <GasDetail plant={plant} />}
      {tab === "solar" && <SolarDetail plant={plant} />}
      {tab === "batt" && <BattDetail plant={plant} />}
    </div>
  );
}

function MetricGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
      {items.map(([label, val, unit, color]) => (
        <Panel key={label} pad={12}>
          <div style={{ fontSize: 10.5, color: THEME.dim, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
          <div style={{ marginTop: 6, fontSize: 19, fontWeight: 700, fontFamily: "ui-monospace, monospace", color: color || THEME.text }}>
            {val}<span style={{ fontSize: 11, color: THEME.dim, fontWeight: 400, marginLeft: 3 }}>{unit}</span>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function GridDetail({ plant }) {
  const r = seededRand(plant.id * 11);
  const day = genDaySeries(plant, "grid");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <MetricGrid items={[
        ["Phase V (R/Y/B)", "398/401/399", "V"],
        ["Phase I (R/Y/B)", `${Math.round(plant.sources.grid * 1.4)}`, "A"],
        ["Frequency", "49.98", "Hz"],
        ["Power Factor", plant.pf, "", parseFloat(plant.pf) < 0.92 ? THEME.warn : THEME.signal],
        ["Active Power", fmt(plant.sources.grid), "kW"],
        ["Reactive Power", fmt(plant.sources.grid * 0.3), "kVAR"],
        ["Apparent Power", fmt(plant.sources.grid * 1.05), "kVA"],
        ["Max Demand", fmt(plant.sources.grid * 1.2), "kW"],
      ]} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="sg-grid2">
        <Panel>
          <div style={sectionTitle}>Grid Import · 24 h</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={day}>
              <defs><linearGradient id="g-imp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.grid} stopOpacity={0.5} /><stop offset="100%" stopColor={THEME.grid} stopOpacity={0.04} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
              <XAxis dataKey="h" stroke={THEME.faint} fontSize={10} interval={3} tickLine={false} />
              <YAxis stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="grid" stroke={THEME.grid} fill="url(#g-imp)" name="kW" />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div style={sectionTitle}>Power Quality · Mandatory</div>
          {[
            ["THD-Voltage", `${(2 + r() * 3).toFixed(1)}%`, "within IEEE 519"],
            ["THD-Current", `${(4 + r() * 5).toFixed(1)}%`, "monitored"],
            ["Voltage Unbalance", `${(0.5 + r() * 1.5).toFixed(2)}%`, "ok"],
            ["Sags (today)", `${Math.floor(r() * 4)}`, "logged w/ timestamp"],
            ["Swells (today)", `${Math.floor(r() * 2)}`, "logged"],
            ["Interruptions", `${Math.floor(r() * 2)}`, "outage log"],
          ].map(([k, v, note]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: `1px solid ${THEME.line}`, fontSize: 12.5 }}>
              <span style={{ color: THEME.dim }}>{k}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 600 }}>{v}</span>
                <span style={{ fontSize: 10.5, color: THEME.faint }}>{note}</span>
              </span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel>
        <div style={sectionTitle}>Outage Log</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ color: THEME.dim, fontSize: 10.5, textTransform: "uppercase" }}>
            <th style={th}>Event Start</th><th style={th}>Duration</th><th style={th}>Cause</th><th style={th}>Availability Impact</th>
          </tr></thead>
          <tbody>
            {Array.from({ length: 4 }, (_, i) => {
              const dur = Math.floor(r() * 90) + 5;
              return (
                <tr key={i} style={{ borderTop: `1px solid ${THEME.line}` }}>
                  <td style={td}>2026-06-{String(10 + i).padStart(2, "0")} {String(2 + i * 4).padStart(2, "0")}:14</td>
                  <td style={{ ...td, fontFamily: "ui-monospace, monospace" }}>{dur} min</td>
                  <td style={{ ...td, color: THEME.dim }}>{["Grid trip", "Scheduled", "Voltage dip", "Feeder fault"][i]}</td>
                  <td style={{ ...td, color: THEME.warn }}>−{(dur / 14.4).toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function GasDetail({ plant }) {
  const r = seededRand(plant.id * 17);
  const day = genDaySeries(plant, "gas");
  const loadPct = Math.round((plant.sources.gas / (plant.sources.gas * 1.3)) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <MetricGrid items={[
        ["Active Power", fmt(plant.sources.gas), "kW"],
        ["Load %", `${loadPct}`, "%", loadPct > 90 ? THEME.warn : THEME.signal],
        ["Frequency", "50.01", "Hz"],
        ["Engine Speed", `${1480 + Math.floor(r() * 30)}`, "RPM"],
        ["Gas Rate", `${(plant.sources.gas * 0.26).toFixed(0)}`, "Nm³/hr"],
        ["Fuel Efficiency", `${(0.24 + r() * 0.04).toFixed(3)}`, "Nm³/kWh"],
        ["Lube Oil Pressure", `${(3.8 + r() * 0.6).toFixed(1)}`, "bar"],
        ["Coolant Temp", `${Math.round(78 + r() * 8)}`, "°C"],
        ["Exhaust Temp", `${Math.round(420 + r() * 80)}`, "°C"],
        ["Running Hours", `${Math.round(4000 + r() * 9000)}`, "h"],
        ["Availability", `${Math.round(92 + r() * 7)}`, "%"],
        ["Cap. Utilization", `${plant.cuf + 20}`, "%"],
      ]} />
      <Panel>
        <div style={sectionTitle}>Generator Output · 24 h</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={day}>
            <defs><linearGradient id="g-gas" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.gas} stopOpacity={0.5} /><stop offset="100%" stopColor={THEME.gas} stopOpacity={0.04} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
            <XAxis dataKey="h" stroke={THEME.faint} fontSize={10} interval={3} tickLine={false} />
            <YAxis stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Area type="monotone" dataKey="gas" stroke={THEME.gas} fill="url(#g-gas)" name="kW" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

function SolarDetail({ plant }) {
  const r = seededRand(plant.id * 19);
  const day = genDaySeries(plant, "solar");
  const inv = Array.from({ length: 4 }, (_, i) => ({
    name: `INV-${i + 1}`, ac: Math.round(plant.sources.solar / 4 * (0.8 + r() * 0.4)),
    eff: (96 + r() * 2.5).toFixed(1), status: r() > 0.1 ? "Running" : "Fault",
  }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <MetricGrid items={[
        ["AC Output", fmt(plant.sources.solar), "kW"],
        ["DC Input", fmt(plant.sources.solar * 1.04), "kW"],
        ["Daily Energy", fmt(plant.sources.solar * 5.5), "kWh"],
        ["Performance Ratio", `${plant.pr}`, "%", plant.pr < 80 ? THEME.warn : THEME.signal],
        ["Specific Yield", `${(3.8 + r()).toFixed(2)}`, "kWh/kWp"],
        ["CUF", `${plant.cuf}`, "%"],
      ]} />
      <Panel>
        <div style={sectionTitle}>Solar Generation · 24 h</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={day}>
            <defs><linearGradient id="g-sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.solar} stopOpacity={0.5} /><stop offset="100%" stopColor={THEME.solar} stopOpacity={0.04} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
            <XAxis dataKey="h" stroke={THEME.faint} fontSize={10} interval={3} tickLine={false} />
            <YAxis stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Area type="monotone" dataKey="solar" stroke={THEME.solar} fill="url(#g-sol)" name="kW" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
      <Panel pad={0}>
        <div style={{ padding: 14 }}><span style={sectionTitle}>Inverter-Level Monitoring</span></div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ color: THEME.dim, fontSize: 10.5, textTransform: "uppercase" }}>
            <th style={th}>Inverter</th><th style={{ ...th, textAlign: "right" }}>AC kW</th><th style={{ ...th, textAlign: "right" }}>Efficiency</th><th style={{ ...th, textAlign: "center" }}>Status</th>
          </tr></thead>
          <tbody>
            {inv.map((iv) => (
              <tr key={iv.name} style={{ borderTop: `1px solid ${THEME.line}` }}>
                <td style={td}>{iv.name}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{iv.ac}</td>
                <td style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{iv.eff}%</td>
                <td style={{ ...td, textAlign: "center" }}>
                  <span style={{ color: iv.status === "Running" ? THEME.signal : THEME.alarm, fontSize: 11.5 }}>● {iv.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function BattDetail({ plant }) {
  const r = seededRand(plant.id * 23);
  const hasBatt = plant.sources.batt !== 0;
  if (!hasBatt) return <Panel><div style={{ color: THEME.dim, fontSize: 13, textAlign: "center", padding: 30 }}>No battery system configured at this plant. Add a BESS device in Admin → Plants & Tags.</div></Panel>;
  const soc = Math.round(40 + r() * 55);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <MetricGrid items={[
        ["State of Charge", `${soc}`, "%", soc < 25 ? THEME.warn : THEME.batt],
        ["Power", `${plant.sources.batt < 0 ? "−" : ""}${fmt(Math.abs(plant.sources.batt))}`, "kW"],
        ["Mode", plant.sources.batt < 0 ? "Charging" : "Discharging", ""],
        ["Pack Voltage", `${Math.round(680 + r() * 60)}`, "V"],
        ["Cycles", `${Math.round(200 + r() * 800)}`, ""],
        ["Cell Temp", `${Math.round(26 + r() * 8)}`, "°C"],
      ]} />
      <Panel>
        <div style={sectionTitle}>State of Charge · 24 h</div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={Array.from({ length: 24 }, (_, h) => ({ h: `${h}:00`, soc: Math.round(40 + 30 * Math.sin((h - 6) / 4) + r() * 8) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
            <XAxis dataKey="h" stroke={THEME.faint} fontSize={10} interval={3} tickLine={false} />
            <YAxis stroke={THEME.faint} fontSize={10} domain={[0, 100]} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Line type="monotone" dataKey="soc" stroke={THEME.batt} strokeWidth={2} dot={false} name="SoC %" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

// ---------- Solar Analytics (mandatory KPIs + clipping) ----------
function SolarView({ plant, fleet, setPlant }) {
  const r = seededRand(plant.id * 29);
  const month = genMonthSeries(plant);
  const prData = Array.from({ length: 12 }, (_, i) => ({ m: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i], pr: Math.round(76 + 14 * Math.sin(i / 2) + r() * 6) }));
  const lossData = [
    { name: "Irradiance", v: Math.round(4 + r() * 4), color: THEME.solar },
    { name: "Temperature", v: Math.round(5 + r() * 5), color: THEME.gas },
    { name: "System / DC", v: Math.round(2 + r() * 3), color: THEME.batt },
    { name: "Clipping", v: Math.round(1 + r() * 4), color: THEME.alarm },
  ];
  return (
    <div>
      <ViewHeader fleet={fleet} plant={plant} setPlant={setPlant} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        <KpiCard label="Performance Ratio" value={plant.pr} unit="%" color={plant.pr < 80 ? THEME.warn : THEME.signal} icon={Gauge} sub="per plant" />
        <KpiCard label="Specific Yield" value={(3.8 + r()).toFixed(2)} unit="kWh/kWp" color={THEME.solar} icon={Sun} sub="today" />
        <KpiCard label="CUF" value={plant.cuf} unit="%" color={THEME.grid} icon={Activity} sub="capacity factor" />
        <KpiCard label="Expected vs Actual" value={`${Math.round(92 + r() * 7)}`} unit="%" color={THEME.signal} icon={TrendingUp} sub="generation ratio" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }} className="sg-grid2">
        <Panel>
          <div style={sectionTitle}>Monthly Generation</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={month}>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
              <XAxis dataKey="d" stroke={THEME.faint} fontSize={10} interval={4} tickLine={false} />
              <YAxis stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Bar dataKey="solar" fill={THEME.solar} radius={[3,3,0,0]} name="kWh" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel>
          <div style={sectionTitle}>Loss Analysis</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={lossData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} horizontal={false} />
              <XAxis type="number" stroke={THEME.faint} fontSize={10} unit="%" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" stroke={THEME.faint} fontSize={11} width={80} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => `${v}%`} />
              <Bar dataKey="v" radius={[0,3,3,0]} name="loss">
                {lossData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={sectionTitle}>Inverter Clipping Analysis</div>
          <span style={{ fontSize: 11, color: THEME.dim }}>Auto-detected · logged with timestamp</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ color: THEME.dim, fontSize: 10.5, textTransform: "uppercase" }}>
            <th style={th}>Date</th><th style={th}>Inverter</th><th style={{ ...th, textAlign: "right" }}>Duration</th><th style={{ ...th, textAlign: "right" }}>Energy Loss</th><th style={{ ...th, textAlign: "right" }}>% of Gen</th>
          </tr></thead>
          <tbody>
            {Array.from({ length: 5 }, (_, i) => {
              const dur = Math.round(20 + r() * 120);
              const loss = Math.round(dur * (2 + r() * 4));
              return (
                <tr key={i} style={{ borderTop: `1px solid ${THEME.line}` }}>
                  <td style={td}>2026-06-{String(11 + i).padStart(2, "0")}</td>
                  <td style={td}>INV-{1 + (i % 4)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{dur} min</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace", color: THEME.alarm }}>{loss} kWh</td>
                  <td style={{ ...td, textAlign: "right" }}>{(loss / (plant.sources.solar * 5.5) * 100).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ---------- Weather Stations ----------
function WeatherView({ plant, fleet, setPlant, tick }) {
  const w = plant.weather;
  const stations = [
    { id: "WS-A", ...w },
    { id: "WS-B", ghi: Math.round(w.ghi * 0.97), amb: w.amb + 1, mod: w.mod - 2, wind: (parseFloat(w.wind) + 0.6).toFixed(1), hum: w.hum - 4, windDir: (w.windDir + 30) % 360 },
  ];
  const ghiDay = Array.from({ length: 24 }, (_, h) => ({ h: `${h}:00`, ghi: Math.max(0, Math.round(900 * Math.sin(((h - 6) / 12) * Math.PI))) }));
  return (
    <div>
      <ViewHeader fleet={fleet} plant={plant} setPlant={setPlant} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="sg-grid2">
        {stations.map((st) => (
          <Panel key={st.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Cloud size={16} color={THEME.signal} />
                <span style={{ fontWeight: 600 }}>Weather Station {st.id}</span>
              </div>
              <StatusDot online pulse />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                [Sunrise, "GHI", `${st.ghi}`, "W/m²", THEME.solar],
                [Thermometer, "Ambient", `${st.amb}`, "°C", THEME.gas],
                [Thermometer, "Module", `${st.mod}`, "°C", THEME.alarm],
                [Wind, "Wind", st.wind, "m/s", THEME.grid],
                [Map, "Direction", `${st.windDir}`, "°", THEME.dim],
                [Droplets, "Humidity", `${st.hum}`, "%", THEME.batt],
              ].map(([Ic, k, v, u, c]) => (
                <div key={k} style={{ background: THEME.bg, borderRadius: 8, padding: 10 }}>
                  <Ic size={14} color={c} />
                  <div style={{ fontSize: 10, color: THEME.dim, marginTop: 6 }}>{k}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}>{v}<span style={{ fontSize: 10, color: THEME.dim, fontWeight: 400 }}> {u}</span></div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
      <Panel>
        <div style={sectionTitle}>GHI vs Solar Output Correlation · Today</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={ghiDay}>
            <defs><linearGradient id="g-ghi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.solar} stopOpacity={0.5} /><stop offset="100%" stopColor={THEME.solar} stopOpacity={0.04} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
            <XAxis dataKey="h" stroke={THEME.faint} fontSize={10} interval={3} tickLine={false} />
            <YAxis stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} unit=" W/m²" />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Area type="monotone" dataKey="ghi" stroke={THEME.solar} fill="url(#g-ghi)" name="GHI W/m²" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}

// ---------- Department Energy Accounting ----------
function DeptsView({ plant, fleet, setPlant }) {
  const total = plant.depts.reduce((a, d) => a + d.kw, 0);
  return (
    <div>
      <ViewHeader fleet={fleet} plant={plant} setPlant={setPlant} />
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }} className="sg-grid2">
        <Panel pad={0}>
          <div style={{ padding: 14 }}><span style={sectionTitle}>Department-wise Consumption</span></div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ color: THEME.dim, fontSize: 10.5, textTransform: "uppercase" }}>
              <th style={th}>Department</th><th style={{ ...th, textAlign: "right" }}>Load</th><th style={{ ...th, textAlign: "right" }}>Daily</th><th style={{ ...th, textAlign: "center" }}>Load Factor</th>
            </tr></thead>
            <tbody>
              {plant.depts.map((d) => (
                <tr key={d.name} style={{ borderTop: `1px solid ${THEME.line}` }}>
                  <td style={td}>{d.name}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{fmt(d.kw)} kW</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{fmt(d.kw * 18)} kWh</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 50, height: 5, background: THEME.line, borderRadius: 9, overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${d.lf}%`, background: d.lf > 75 ? THEME.signal : THEME.warn }} />
                      </span>
                      {d.lf}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel>
          <div style={sectionTitle}>Consumption Share</div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={plant.depts} dataKey="kw" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2} stroke="none">
                {plant.depts.map((e, i) => <Cell key={i} fill={[THEME.signal, THEME.grid, THEME.solar, THEME.gas, THEME.batt, THEME.alarm][i]} />)}
              </Pie>
              <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => `${fmt(v)} kW`} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11.5, color: THEME.dim, textAlign: "center" }}>Total {fmt(total)} kW across 6 departments</div>
        </Panel>
      </div>
    </div>
  );
}

// ---------- Alarms & Events ----------
const ALARM_TYPES = [
  ["High load alarm", "warn", Gauge],
  ["Low power factor", "warn", Activity],
  ["Grid failure", "alarm", Zap],
  ["Generator trip", "alarm", Server],
  ["Inverter fault", "alarm", Sun],
  ["Power quality violation", "warn", Radio],
  ["Communication loss", "alarm", WifiOff],
];
function buildAlarms(fleet) {
  const out = [];
  fleet.forEach((p) => {
    const r = seededRand(p.id * 41);
    for (let i = 0; i < p.alarms; i++) {
      const [name, sev, icon] = ALARM_TYPES[Math.floor(r() * ALARM_TYPES.length)];
      out.push({
        id: `${p.id}-${i}`, plant: p, name, sev, icon,
        time: `${String(Math.floor(r() * 24)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}`,
        ack: r() > 0.6,
      });
    }
  });
  return out.sort((a, b) => (a.sev === "alarm" ? -1 : 1));
}
function AlarmsView({ fleet, openPlant }) {
  const [alarms, setAlarms] = useState(() => buildAlarms(fleet));
  const [sev, setSev] = useState("all");
  const filtered = alarms.filter((a) => sev === "all" || a.sev === sev);
  const ack = (id) => setAlarms((al) => al.map((a) => a.id === id ? { ...a, ack: true } : a));
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[["all", "All"], ["alarm", "Critical"], ["warn", "Warnings"]].map(([k, l]) => (
          <button key={k} onClick={() => setSev(k)} className="sg-btn" style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12.5, cursor: "pointer",
            border: `1px solid ${sev === k ? THEME.signal : THEME.line}`,
            background: sev === k ? "rgba(61,245,160,0.1)" : THEME.panel,
            color: sev === k ? THEME.signal : THEME.dim,
          }}>{l}</button>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: THEME.dim, alignSelf: "center" }}>
          {filtered.filter((a) => !a.ack).length} unacknowledged
        </div>
      </div>
      <Panel pad={0}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead><tr style={{ color: THEME.dim, fontSize: 10.5, textTransform: "uppercase" }}>
            <th style={th}>Severity</th><th style={th}>Alarm</th><th style={th}>Plant</th><th style={th}>Time</th><th style={{ ...th, textAlign: "right" }}>Action</th>
          </tr></thead>
          <tbody>
            {filtered.slice(0, 40).map((a) => (
              <tr key={a.id} className="sg-row" style={{ borderTop: `1px solid ${THEME.line}`, opacity: a.ack ? 0.5 : 1 }}>
                <td style={td}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: a.sev === "alarm" ? THEME.alarm : THEME.warn, fontWeight: 600, fontSize: 11.5 }}>
                    <a.icon size={13} /> {a.sev === "alarm" ? "CRITICAL" : "WARNING"}
                  </span>
                </td>
                <td style={td}>{a.name}</td>
                <td style={{ ...td, color: THEME.dim, cursor: "pointer" }} onClick={() => openPlant(a.plant)}>{a.plant.name}</td>
                <td style={{ ...td, fontFamily: "ui-monospace, monospace", color: THEME.dim }}>{a.time}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {a.ack ? <span style={{ color: THEME.signal, fontSize: 11 }}><Check size={13} /> Acked</span>
                    : <button className="sg-btn" onClick={() => ack(a.id)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${THEME.line}`, background: THEME.panel2, color: THEME.text, fontSize: 11, cursor: "pointer" }}>Acknowledge</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ---------- Reports ----------
function ReportsView() {
  const reports = [
    ["Daily Energy Report", "Generation, consumption & source mix", "Daily 06:00"],
    ["Weekly Performance Report", "KPI rollup across all plants", "Mon 08:00"],
    ["Monthly Energy & Cost Report", "Cost, savings vs baseline", "1st of month"],
    ["Generator Performance Report", "Running hrs, fuel efficiency, availability", "Daily"],
    ["Solar Generation Report", "PR, yield, clipping, losses", "Daily"],
    ["Power Quality Report", "THD, sags/swells, unbalance", "Weekly"],
    ["Department Consumption Report", "Per-department kWh & load factor", "Daily"],
    ["Executive Summary", "Plant KPIs & targets", "Monthly"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
      {reports.map(([name, desc, sched]) => (
        <Panel key={name} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <FileText size={18} color={THEME.signal} />
            <span style={{ fontSize: 10.5, color: THEME.dim, background: THEME.bg, padding: "3px 8px", borderRadius: 6 }}>{sched}</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>{name}</div>
            <div style={{ fontSize: 11.5, color: THEME.dim, marginTop: 3 }}>{desc}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button className="sg-btn" style={{ flex: 1, padding: "7px", borderRadius: 7, border: "none", background: THEME.signal, color: "#06120C", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Download size={13} /> PDF</button>
            <button className="sg-btn" style={{ flex: 1, padding: "7px", borderRadius: 7, border: `1px solid ${THEME.line}`, background: THEME.panel2, color: THEME.text, fontSize: 11.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Download size={13} /> Excel</button>
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ---------- Admin: Plants & Tags (MQTT device provisioning) ----------
const TAG_TEMPLATES = {
  grid: ["voltage_r", "voltage_y", "voltage_b", "current_r", "current_y", "current_b", "frequency", "pf", "kw", "kvar", "kva", "kwh_import", "max_demand", "thd_v", "thd_i", "grid_status"],
  gas: ["kw", "kva", "pf", "load_pct", "freq", "running_hours", "gas_rate", "lube_oil_press", "coolant_temp", "exhaust_temp", "rpm", "fault_status"],
  solar: ["ac_power", "dc_power", "daily_kwh", "efficiency", "inv_status", "string_v", "string_i"],
  batt: ["soc", "power_kw", "pack_voltage", "cell_temp", "mode", "cycles"],
  weather: ["ghi", "ambient_temp", "module_temp", "wind_speed", "wind_dir", "humidity"],
};

function AdminView({ fleet, setFleet }) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Plant & Device Provisioning</div>
          <div style={{ fontSize: 12, color: THEME.dim }}>{fleet.length} plants registered · admin role</div>
        </div>
        <button className="sg-btn" onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 8, border: "none", background: THEME.signal, color: "#06120C", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          <Plus size={16} /> Add New Plant
        </button>
      </div>

      <Panel pad={0} style={{ marginBottom: 16 }}>
        <div style={{ padding: 14 }}><span style={sectionTitle}>Registered Plants</span></div>
        <div style={{ maxHeight: 300, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead style={{ position: "sticky", top: 0, background: THEME.panel }}><tr style={{ color: THEME.dim, fontSize: 10.5, textTransform: "uppercase" }}>
              <th style={th}>Plant ID</th><th style={th}>Name</th><th style={th}>Region</th><th style={{ ...th, textAlign: "center" }}>Devices</th><th style={{ ...th, textAlign: "center" }}>MQTT</th>
            </tr></thead>
            <tbody>
              {fleet.slice(0, 30).map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${THEME.line}` }}>
                  <td style={{ ...td, fontFamily: "ui-monospace, monospace", color: THEME.dim }}>PLT-{String(p.id).padStart(3, "0")}</td>
                  <td style={td}>{p.name}</td>
                  <td style={{ ...td, color: THEME.dim }}>{p.region}</td>
                  <td style={{ ...td, textAlign: "center" }}>{p.devices}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ color: p.online ? THEME.signal : THEME.faint, fontSize: 11 }}>{p.online ? "● connected" : "○ offline"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <div style={sectionTitle}>MQTT Broker Configuration</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          {[
            ["Broker URL", "mqtts://broker.syncgen.io:8883"],
            ["Protocol", "MQTT 3.1.1 / 5.0 · TLS"],
            ["Topic Pattern", "syncgen/{plant_id}/{device}/{tag}"],
            ["MQTT Devices", `${fleet.filter(p => p.online).length} publishing`],
            ["QoS Level", "1 (at least once)"],
            ["Payload Format", "JSON · Modbus-mapped"],
          ].map(([k, v]) => (
            <div key={k} style={{ background: THEME.bg, padding: 12, borderRadius: 8 }}>
              <div style={{ fontSize: 10.5, color: THEME.dim, textTransform: "uppercase", letterSpacing: 0.4 }}>{k}</div>
              <div style={{ fontSize: 12.5, fontFamily: "ui-monospace, monospace", marginTop: 5, color: THEME.text }}>{v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {adding && <AddPlantModal fleet={fleet} setFleet={setFleet} close={() => setAdding(false)} />}
    </div>
  );
}

function AddPlantModal({ fleet, setFleet, close }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("Faisalabad");
  const [sources, setSources] = useState({ grid: true, gas: true, solar: true, batt: false, weather: true });
  const [tagPrefix, setTagPrefix] = useState(`PLT-${String(fleet.length + 1).padStart(3, "0")}`);

  const toggleSrc = (k) => setSources((s) => ({ ...s, [k]: !s[k] }));
  const activeTags = Object.entries(sources).filter(([, v]) => v).flatMap(([k]) => (TAG_TEMPLATES[k] || []).map((t) => `${tagPrefix.toLowerCase()}/${k}/${t}`));

  const save = () => {
    const np = buildPlant(fleet.length + 1);
    np.name = name || np.name;
    np.region = region;
    np.online = true;
    setFleet([np, ...fleet]);
    close();
  };

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(4,8,14,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 580, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: THEME.panel, border: `1px solid ${THEME.line}`, borderRadius: 14 }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${THEME.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Add New Plant</div>
            <div style={{ fontSize: 11.5, color: THEME.dim }}>Step {step} of 3 · {["Plant details", "Energy sources", "MQTT tag map"][step - 1]}</div>
          </div>
          <button onClick={close} style={{ background: "none", border: "none", color: THEME.dim, cursor: "pointer" }}><X size={20} /></button>
        </div>

        <div style={{ padding: 20 }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Plant Name">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrays Textile Complex C7" style={inputStyle} />
              </Field>
              <Field label="Region">
                <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
                  {["Faisalabad", "Karachi", "Lahore", "Multan", "Sialkot", "Gujranwala"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Plant ID / Tag Prefix">
                <input value={tagPrefix} onChange={(e) => setTagPrefix(e.target.value)} style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }} />
              </Field>
              <Field label="MQTT Device IP">
                <input placeholder="192.168.1.50" style={{ ...inputStyle, fontFamily: "ui-monospace, monospace" }} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12.5, color: THEME.dim, marginBottom: 4 }}>Select the energy sources & stations present at this plant. Tags are auto-generated for each.</div>
              {[
                ["grid", "WAPDA Grid", Zap], ["gas", "Gas Genset", Server],
                ["solar", "Solar PV", Sun], ["batt", "Battery (BESS)", Battery],
                ["weather", "Weather Station", Cloud],
              ].map(([k, label, Icon]) => (
                <div key={k} onClick={() => toggleSrc(k)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                  border: `1px solid ${sources[k] ? THEME.signal : THEME.line}`,
                  background: sources[k] ? "rgba(61,245,160,0.06)" : THEME.bg,
                }}>
                  <Icon size={18} color={sources[k] ? THEME.signal : THEME.dim} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 11, color: THEME.dim }}>{(TAG_TEMPLATES[k] || []).length} tags</span>
                  <span style={{ width: 20, height: 20, borderRadius: 6, border: `1px solid ${sources[k] ? THEME.signal : THEME.faint}`, display: "flex", alignItems: "center", justifyContent: "center", background: sources[k] ? THEME.signal : "transparent" }}>
                    {sources[k] && <Check size={14} color="#06120C" />}
                  </span>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize: 12.5, color: THEME.dim, marginBottom: 10 }}>
                {activeTags.length} MQTT tags will be subscribed from the MQTT device. These map device registers → SCADA points automatically.
              </div>
              <div style={{ maxHeight: 280, overflowY: "auto", background: THEME.bg, borderRadius: 10, padding: 12, fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>
                {activeTags.map((t) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", color: THEME.dim }}>
                    <Radio size={11} color={THEME.signal} /> syncgen/{t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${THEME.line}`, display: "flex", justifyContent: "space-between" }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : close()} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${THEME.line}`, background: THEME.panel2, color: THEME.text, fontSize: 12.5, cursor: "pointer" }}>
            {step > 1 ? "Back" : "Cancel"}
          </button>
          {step < 3
            ? <button className="sg-btn" onClick={() => setStep(step + 1)} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: THEME.signal, color: "#06120C", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>Continue</button>
            : <button className="sg-btn" onClick={save} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 20px", borderRadius: 8, border: "none", background: THEME.signal, color: "#06120C", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}><Check size={15} /> Provision Plant</button>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 11.5, color: THEME.dim, display: "block", marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}
const inputStyle = { width: "100%", padding: "10px 12px", background: THEME.bg, border: `1px solid ${THEME.line}`, borderRadius: 8, color: THEME.text, fontSize: 13, outline: "none" };

// ---------- Historical Trends (2-year history @ 5-min sampling, adaptive downsample) ----------
// Real historians store at 5-min; the UI downsamples to the window for performance.
const TREND_GROUPS = {
  energy: {
    label: "Energy (kWh)", unit: "kWh",
    params: [
      { k: "kwh_grid", label: "Grid Import kWh", color: THEME.grid, base: 1400 },
      { k: "kwh_gas", label: "Genset kWh", color: THEME.gas, base: 1100 },
      { k: "kwh_solar", label: "Solar kWh", color: THEME.solar, base: 800, solar: true },
      { k: "kwh_total", label: "Total Consumption kWh", color: THEME.signal, base: 3000 },
    ],
  },
  voltage: {
    label: "Voltages (V)", unit: "V",
    params: [
      { k: "v_r", label: "Voltage R", color: "#FF6B6B", base: 400, jitter: 6 },
      { k: "v_y", label: "Voltage Y", color: "#FFD93D", base: 401, jitter: 6 },
      { k: "v_b", label: "Voltage B", color: "#4D9DFF", base: 399, jitter: 6 },
    ],
  },
  current: {
    label: "Currents (A)", unit: "A",
    params: [
      { k: "i_r", label: "Current R", color: "#FF6B6B", base: 1200, jitter: 180 },
      { k: "i_y", label: "Current Y", color: "#FFD93D", base: 1180, jitter: 180 },
      { k: "i_b", label: "Current B", color: "#4D9DFF", base: 1210, jitter: 180 },
    ],
  },
  weather: {
    label: "Weather Station", unit: "",
    params: [
      { k: "ghi", label: "GHI W/m²", color: THEME.solar, base: 500, solar: true, amp: 450 },
      { k: "amb", label: "Ambient °C", color: THEME.gas, base: 30, jitter: 8, season: true },
      { k: "mod", label: "Module °C", color: THEME.alarm, base: 42, jitter: 14, solar: true, amp: 20 },
      { k: "wind", label: "Wind m/s", color: THEME.grid, base: 4, jitter: 3 },
      { k: "hum", label: "Humidity %", color: THEME.batt, base: 55, jitter: 25 },
    ],
  },
  sources: {
    label: "Source Power (kW)", unit: "kW",
    params: [
      { k: "p_grid", label: "Grid kW", color: THEME.grid, base: 1500, jitter: 400 },
      { k: "p_gas", label: "Genset kW", color: THEME.gas, base: 1100, jitter: 350 },
      { k: "p_solar", label: "Solar kW", color: THEME.solar, base: 900, solar: true, amp: 850 },
      { k: "p_batt", label: "Battery kW", color: THEME.batt, base: 0, jitter: 300 },
    ],
  },
  genset: {
    label: "Genset Running Hours", unit: "h",
    params: [
      { k: "run_hours", label: "Cumulative Run Hours", color: THEME.gas, base: 0, cumulative: true },
    ],
  },
  meter: {
    label: "Meter Parameters", unit: "",
    params: [
      { k: "pf", label: "Power Factor", color: THEME.signal, base: 0.94, jitter: 0.05 },
      { k: "freq", label: "Frequency Hz", color: THEME.grid, base: 50, jitter: 0.15 },
      { k: "kvar", label: "Reactive kVAR", color: THEME.batt, base: 450, jitter: 150 },
      { k: "kva", label: "Apparent kVA", color: THEME.warn, base: 3200, jitter: 500 },
      { k: "thd_v", label: "THD-V %", color: THEME.alarm, base: 3, jitter: 1.5 },
    ],
  },
};

const RANGES = [
  { k: "1d", label: "24 h", days: 1, buckets: 96 },     // 15-min
  { k: "7d", label: "7 days", days: 7, buckets: 168 },  // hourly
  { k: "30d", label: "30 days", days: 30, buckets: 120 },
  { k: "90d", label: "90 days", days: 90, buckets: 90 },
  { k: "1y", label: "1 year", days: 365, buckets: 73 },
  { k: "2y", label: "2 years", days: 730, buckets: 104 }, // weekly
];

// Generate a downsampled series for a given param over a range.
// Mimics reading 5-min historian data and aggregating into N buckets.
function genTrend(plant, param, range) {
  const r = seededRand(plant.id * 97 + param.k.length * 13 + range.days);
  const n = range.buckets;
  const out = [];
  let cumulative = Math.round(4000 + r() * 9000); // starting genset hours
  for (let i = 0; i < n; i++) {
    const frac = i / n;                 // 0..1 across the window
    const dayPos = (i / n) * range.days;
    // seasonal sine across the year(s)
    const season = param.season || param.solar ? Math.sin((dayPos / 365) * Math.PI * 2 - Math.PI / 2) : 0;
    // daily solar/temperature shape (only meaningful for short ranges)
    const hourOfDay = range.days <= 7 ? ((dayPos % 1) * 24) : 12;
    const solarShape = param.solar ? Math.max(0, Math.sin(((hourOfDay - 6) / 12) * Math.PI)) : 1;
    let v;
    if (param.cumulative) {
      cumulative += (8 + r() * 14);     // hours accrue
      v = Math.round(cumulative);
    } else if (param.solar) {
      const seasonalScale = 0.8 + 0.25 * (season + 1) / 2;
      v = param.base + (param.amp || param.base) * solarShape * seasonalScale * (0.85 + r() * 0.3);
      if (range.days > 7) v = param.base * (0.5 + 0.5 * (season + 1) / 2) * (0.85 + r() * 0.3) + (param.amp || 0) * 0.4;
    } else {
      const seasonalAdd = param.season ? season * 7 : 0;
      v = param.base + seasonalAdd + (param.jitter ? (r() - 0.5) * 2 * param.jitter : param.base * 0.15 * (r() - 0.5));
    }
    v = Math.max(0, v);
    const dec = param.base < 2 ? 3 : (param.base < 60 ? 1 : 0);
    out.push({
      t: labelFor(range, i, n),
      [param.k]: Number(v.toFixed(dec)),
    });
  }
  return out;
}

function labelFor(range, i, n) {
  const now = new Date("2026-06-17T12:00:00");
  const msBack = (range.days * 86400000) * (1 - i / (n - 1));
  const d = new Date(now.getTime() - msBack);
  if (range.days <= 1) return `${String(d.getHours()).padStart(2, "0")}:${String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, "0")}`;
  if (range.days <= 30) return `${d.getDate()}/${d.getMonth() + 1}`;
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function mergeSeries(seriesList) {
  if (!seriesList.length) return [];
  const merged = seriesList[0].map((row) => ({ ...row }));
  for (let s = 1; s < seriesList.length; s++) {
    seriesList[s].forEach((row, i) => { if (merged[i]) Object.assign(merged[i], row); });
  }
  return merged;
}

function TrendsView({ plant, fleet, setPlant }) {
  const [mode, setMode] = useState("single"); // single | compare
  const [group, setGroup] = useState("energy");
  const [range, setRange] = useState(RANGES[2]);
  const g = TREND_GROUPS[group];

  // Compare-mode state
  const [cmpPlants, setCmpPlants] = useState(() => fleet.slice(0, 3).map((p) => p.id));
  const [cmpParam, setCmpParam] = useState(g.params[0].k);
  const COMPARE_COLORS = [THEME.signal, THEME.grid, THEME.solar, THEME.gas, THEME.batt, THEME.alarm, "#FF6B9D", "#5EEAD4"];

  // When group changes, ensure cmpParam is valid for the new group
  useEffect(() => {
    if (!g.params.find((p) => p.k === cmpParam)) setCmpParam(g.params[0].k);
  }, [group]);

  // Single-plant data: all params of the group for this plant
  const singleData = useMemo(() => {
    const series = g.params.map((p) => genTrend(plant, p, range));
    return mergeSeries(series);
  }, [plant.id, group, range.k]);

  // Compare data: one param across several plants
  const compareData = useMemo(() => {
    const paramDef = g.params.find((p) => p.k === cmpParam) || g.params[0];
    const series = cmpPlants.map((pid) => {
      const pl = fleet.find((p) => p.id === pid);
      const s = genTrend(pl, paramDef, range);
      // rename the param key to the plant id so multiple plants merge side by side
      return s.map((row) => ({ t: row.t, [`p${pid}`]: row[paramDef.k] }));
    });
    return mergeSeries(series);
  }, [cmpPlants.join(","), cmpParam, group, range.k]);

  const isCumulative = g.params.some((p) => p.cumulative);
  const isBar = mode === "single" && group === "energy" && range.days >= 30;
  const activeData = mode === "single" ? singleData : compareData;

  const toggleCmpPlant = (id) => {
    setCmpPlants((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : (cur.length < 8 ? [...cur, id] : cur));
  };

  return (
    <div>
      <ViewHeader fleet={fleet} plant={plant} setPlant={setPlant} right={
        <span style={{ fontSize: 11.5, color: THEME.dim, display: "flex", alignItems: "center", gap: 6 }}>
          <Server size={13} color={THEME.signal} /> Historian · 5-min sampling · 2-year retention
        </span>
      } />

      {/* Mode toggle */}
      <div style={{ display: "inline-flex", background: THEME.bg, border: `1px solid ${THEME.line}`, borderRadius: 9, padding: 3, marginBottom: 14 }}>
        {[["single", "Single Plant"], ["compare", "Compare Plants"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)} className="sg-btn" style={{
            padding: "7px 16px", borderRadius: 7, fontSize: 12.5, cursor: "pointer", border: "none",
            background: mode === k ? THEME.signal : "transparent",
            color: mode === k ? "#06120C" : THEME.dim, fontWeight: mode === k ? 600 : 400,
          }}>{l}</button>
        ))}
      </div>

      {/* Parameter group selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(TREND_GROUPS).map(([k, gr]) => (
          <button key={k} onClick={() => setGroup(k)} className="sg-btn" style={{
            padding: "7px 13px", borderRadius: 8, fontSize: 12, cursor: "pointer",
            border: `1px solid ${group === k ? THEME.signal : THEME.line}`,
            background: group === k ? "rgba(61,245,160,0.1)" : THEME.panel,
            color: group === k ? THEME.signal : THEME.dim,
          }}>{gr.label}</button>
        ))}
      </div>

      {/* Compare-mode: parameter + plant pickers */}
      {mode === "compare" && (
        <Panel pad={14} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 11, color: THEME.faint, marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.4 }}>Parameter to compare</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {g.params.map((p) => (
                  <button key={p.k} onClick={() => setCmpParam(p.k)} className="sg-btn" style={{
                    padding: "6px 11px", borderRadius: 7, fontSize: 11.5, cursor: "pointer",
                    border: `1px solid ${cmpParam === p.k ? THEME.signal : THEME.line}`,
                    background: cmpParam === p.k ? "rgba(61,245,160,0.1)" : THEME.bg,
                    color: cmpParam === p.k ? THEME.signal : THEME.dim,
                  }}>{p.label}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 11, color: THEME.faint, marginBottom: 7, textTransform: "uppercase", letterSpacing: 0.4 }}>
                Plants ({cmpPlants.length} of max 8)
              </div>
              <CompareePlantPicker fleet={fleet} selected={cmpPlants} toggle={toggleCmpPlant} colors={COMPARE_COLORS} />
            </div>
          </div>
        </Panel>
      )}

      {/* Range selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: THEME.faint, marginRight: 4 }}>RANGE</span>
        {RANGES.map((rg) => (
          <button key={rg.k} onClick={() => setRange(rg)} className="sg-btn" style={{
            padding: "6px 12px", borderRadius: 7, fontSize: 11.5, cursor: "pointer",
            border: `1px solid ${range.k === rg.k ? THEME.grid : THEME.line}`,
            background: range.k === rg.k ? "rgba(77,157,255,0.12)" : THEME.panel,
            color: range.k === rg.k ? THEME.grid : THEME.dim,
          }}>{rg.label}</button>
        ))}
        <button className="sg-btn" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 7, fontSize: 11.5, border: `1px solid ${THEME.line}`, background: THEME.panel2, color: THEME.text, cursor: "pointer" }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div style={sectionTitle}>
            {mode === "single"
              ? `${g.label} · ${plant.name} · ${range.label}`
              : `${g.params.find((p) => p.k === cmpParam)?.label} · ${cmpPlants.length} plants · ${range.label}`}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {mode === "single"
              ? g.params.map((p) => (
                  <span key={p.k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: THEME.dim }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: p.color }} /> {p.label}
                  </span>
                ))
              : cmpPlants.map((pid, i) => {
                  const pl = fleet.find((p) => p.id === pid);
                  return (
                    <span key={pid} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: THEME.dim }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: COMPARE_COLORS[i % COMPARE_COLORS.length] }} /> {pl?.name}
                    </span>
                  );
                })}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={360}>
          {isBar ? (
            <BarChart data={activeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
              <XAxis dataKey="t" stroke={THEME.faint} fontSize={10} interval={Math.floor(activeData.length / 12)} tickLine={false} />
              <YAxis stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              {g.params.map((p) => <Bar key={p.k} dataKey={p.k} stackId="e" fill={p.color} name={p.label} />)}
            </BarChart>
          ) : (
            <LineChart data={activeData}>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
              <XAxis dataKey="t" stroke={THEME.faint} fontSize={10} interval={Math.floor(activeData.length / 12)} tickLine={false} />
              <YAxis stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} domain={isCumulative && mode === "single" ? ["auto", "auto"] : undefined} />
              <Tooltip contentStyle={chartTooltipStyle} />
              {mode === "single"
                ? g.params.map((p) => (
                    <Line key={p.k} type="monotone" dataKey={p.k} stroke={p.color} strokeWidth={1.6} dot={false} name={p.label} isAnimationActive={false} />
                  ))
                : cmpPlants.map((pid, i) => {
                    const pl = fleet.find((p) => p.id === pid);
                    return (
                      <Line key={pid} type="monotone" dataKey={`p${pid}`} stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]} strokeWidth={1.8} dot={false} name={pl?.name} isAnimationActive={false} />
                    );
                  })}
            </LineChart>
          )}
        </ResponsiveContainer>

        {/* Stats strip */}
        <div style={{ display: "flex", gap: 20, marginTop: 10, paddingTop: 12, borderTop: `1px solid ${THEME.line}`, flexWrap: "wrap" }}>
          {mode === "single"
            ? g.params.map((p) => {
                const vals = activeData.map((d) => d[p.k]).filter((v) => v != null);
                const min = Math.min(...vals), max = Math.max(...vals);
                const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
                const dec = p.base < 2 ? 2 : (p.base < 60 ? 1 : 0);
                return (
                  <div key={p.k} style={{ fontSize: 11 }}>
                    <span style={{ color: p.color, fontWeight: 600 }}>{p.label}</span>
                    <span style={{ color: THEME.dim, marginLeft: 8, fontFamily: "ui-monospace, monospace" }}>
                      {p.cumulative ? `now ${max.toLocaleString()}` : `min ${min.toFixed(dec)} · avg ${avg.toFixed(dec)} · max ${max.toFixed(dec)}`}
                    </span>
                  </div>
                );
              })
            : cmpPlants.map((pid, i) => {
                const pl = fleet.find((p) => p.id === pid);
                const vals = activeData.map((d) => d[`p${pid}`]).filter((v) => v != null);
                const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
                const max = Math.max(...vals);
                const pdef = g.params.find((p) => p.k === cmpParam);
                const dec = pdef.base < 2 ? 2 : (pdef.base < 60 ? 1 : 0);
                return (
                  <div key={pid} style={{ fontSize: 11 }}>
                    <span style={{ color: COMPARE_COLORS[i % COMPARE_COLORS.length], fontWeight: 600 }}>{pl?.name}</span>
                    <span style={{ color: THEME.dim, marginLeft: 8, fontFamily: "ui-monospace, monospace" }}>
                      {pdef.cumulative ? `now ${max.toLocaleString()}` : `avg ${avg.toFixed(dec)} · max ${max.toFixed(dec)}`}
                    </span>
                  </div>
                );
              })}
        </div>
      </Panel>

      <div style={{ fontSize: 11, color: THEME.faint, marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
        <Activity size={12} /> Data stored at 5-minute resolution; chart auto-aggregates to the selected window. Full-resolution export available via CSV.
      </div>
    </div>
  );
}

// Plant picker for compare mode — searchable multi-select chips
function CompareePlantPicker({ fleet, selected, toggle, colors }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = fleet.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {selected.map((pid, i) => {
          const pl = fleet.find((p) => p.id === pid);
          return (
            <span key={pid} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 7,
              background: THEME.bg, border: `1px solid ${THEME.line}`, fontSize: 11.5,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
              {pl?.name}
              <X size={13} color={THEME.dim} style={{ cursor: "pointer" }} onClick={() => toggle(pid)} />
            </span>
          );
        })}
        <button className="sg-btn" onClick={() => setOpen((o) => !o)} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7,
          border: `1px dashed ${THEME.faint}`, background: "transparent", color: THEME.dim, fontSize: 11.5, cursor: "pointer",
        }}><Plus size={13} /> Add plant</button>
      </div>
      {open && (
        <div style={{ background: THEME.bg, border: `1px solid ${THEME.line}`, borderRadius: 9, overflow: "hidden" }}>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search plants to add…"
            style={{ width: "100%", padding: "9px 12px", background: THEME.panel, border: "none", borderBottom: `1px solid ${THEME.line}`, color: THEME.text, fontSize: 12, outline: "none" }} />
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {list.map((p) => {
              const on = selected.includes(p.id);
              return (
                <div key={p.id} className="sg-row" onClick={() => toggle(p.id)} style={{ padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: !on && selected.length >= 8 ? 0.4 : 1 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${on ? THEME.signal : THEME.faint}`, background: on ? THEME.signal : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {on && <Check size={12} color="#06120C" />}
                  </span>
                  <StatusDot online={p.online} /> {p.name}
                  <span style={{ marginLeft: "auto", fontSize: 10.5, color: THEME.faint }}>{p.region}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- KPI Dashboard (FusionSolar-style overview landing) ----------
function KpiDashboard({ fleet, totals, tick, openPlant }) {
  const live = (v) => Math.round(v * (0.97 + ((tick % 7) / 100)));

  // Aggregate headline figures
  const agg = useMemo(() => {
    const curPower = fleet.reduce((a, p) => a + p.total, 0);
    const solarNow = fleet.reduce((a, p) => a + p.sources.solar, 0);
    const todayYield = fleet.reduce((a, p) => a + p.total * 14.2, 0);       // kWh today (approx)
    const monthYield = todayYield * 27;
    const totalYield = fleet.reduce((a, p) => a + p.total, 0) * 8760 * 1.3;  // lifetime kWh
    const revenue = todayYield * 22;                                         // Rs (tariff)
    const co2 = totalYield * 0.0005;                                         // tonnes avoided
    const trees = co2 * 16.5;
    const coal = totalYield * 0.0004;                                        // tonnes standard coal
    const alarmsCrit = fleet.reduce((a, p) => a + (p.alarms >= 3 ? 1 : 0), 0);
    return { curPower, solarNow, todayYield, monthYield, totalYield, revenue, co2, trees, coal, alarmsCrit };
  }, [fleet]);

  // Real-time power vs irradiance curve (today)
  const powerCurve = useMemo(() => Array.from({ length: 24 }, (_, h) => {
    const solarShape = Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
    return {
      h: `${String(h).padStart(2, "0")}:00`,
      power: Math.round(agg.curPower * (0.55 + 0.45 * Math.abs(Math.sin((h - 3) / 5)))),
      solar: Math.round(agg.solarNow * solarShape * 1.05),
      irr: Math.round(950 * solarShape),
    };
  }), [agg.curPower, agg.solarNow]);

  const statusData = [
    { name: "Normal", value: fleet.filter((p) => p.online && p.alarms === 0).length, color: THEME.signal },
    { name: "Warning", value: fleet.filter((p) => p.online && p.alarms > 0 && p.alarms < 3).length, color: THEME.warn },
    { name: "Faulty", value: fleet.filter((p) => p.online && p.alarms >= 3).length, color: THEME.alarm },
    { name: "Offline", value: fleet.filter((p) => !p.online).length, color: THEME.faint },
  ];

  const mix = [
    { name: "WAPDA", value: fleet.reduce((a, p) => a + p.sources.grid, 0), color: THEME.grid },
    { name: "Gas", value: fleet.reduce((a, p) => a + p.sources.gas, 0), color: THEME.gas },
    { name: "Solar", value: fleet.reduce((a, p) => a + p.sources.solar, 0), color: THEME.solar },
    { name: "Battery", value: fleet.reduce((a, p) => a + Math.max(0, p.sources.batt), 0), color: THEME.batt },
  ];
  const mixTotal = mix.reduce((a, m) => a + m.value, 0) || 1;

  const topPerformers = [...fleet].sort((a, b) => b.pr - a.pr).slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Hero headline band */}
      <div style={{
        background: `linear-gradient(135deg, ${THEME.panel} 0%, ${THEME.panel2} 100%)`,
        border: `1px solid ${THEME.line}`, borderRadius: 14, padding: 22,
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 4,
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 240, height: "100%", background: `radial-gradient(circle at 80% 20%, ${THEME.signal}14, transparent 60%)`, pointerEvents: "none" }} />
        <HeroStat label="Current Power" value={fmt(live(agg.curPower))} unit="kW" accent={THEME.signal} big pulse />
        <HeroStat label="Today's Yield" value={fmt(agg.todayYield)} unit="kWh" accent={THEME.solar} />
        <HeroStat label="Monthly Yield" value={`${(agg.monthYield / 1e6).toFixed(1)}`} unit="GWh" accent={THEME.grid} />
        <HeroStat label="Total Yield" value={`${(agg.totalYield / 1e6).toFixed(0)}`} unit="GWh" accent={THEME.batt} />
        <HeroStat label="Today's Revenue" value={`${(agg.revenue / 1e6).toFixed(2)}`} unit="M Rs" accent={THEME.signal} />
      </div>

      {/* Plant status + environmental benefits */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="sg-grid2">
        <Panel>
          <div style={sectionTitle}>Plant Status</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={70} paddingAngle={2} stroke="none">
                    {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "ui-monospace, monospace" }}>{fleet.length}</div>
                <div style={{ fontSize: 10, color: THEME.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>Plants</div>
              </div>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {statusData.map((s) => (
                <div key={s.name} onClick={() => openPlant && null} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                  <span style={{ flex: 1, color: THEME.dim }}>{s.name}</span>
                  <span style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <div style={sectionTitle}>Environmental Benefits</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <EnvStat icon={Cloud} label="CO₂ Avoided" value={fmt(agg.co2)} unit="tonnes" color={THEME.signal} />
            <EnvStat icon={TrendingUp} label="Equivalent Trees" value={fmt(agg.trees)} unit="planted" color={THEME.solar} />
            <EnvStat icon={Factory} label="Coal Saved" value={fmt(agg.coal)} unit="tonnes" color={THEME.grid} />
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${THEME.line}` }}>
            <div style={{ fontSize: 11, color: THEME.dim, marginBottom: 8 }}>Energy mix today</div>
            <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden" }}>
              {mix.map((m) => (
                <div key={m.name} title={`${m.name} ${Math.round(m.value / mixTotal * 100)}%`}
                  style={{ width: `${(m.value / mixTotal) * 100}%`, background: m.color }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
              {mix.map((m) => (
                <span key={m.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: THEME.dim }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                  {m.name} {Math.round(m.value / mixTotal * 100)}%
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Real-time power curve */}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={sectionTitle}>Real-Time Power & Irradiance · Today</div>
          <span style={{ fontSize: 10.5, color: THEME.signal, display: "flex", alignItems: "center", gap: 5 }}><CircleDot size={11} /> live</span>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={powerCurve}>
            <defs>
              <linearGradient id="kpi-power" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.signal} stopOpacity={0.4} /><stop offset="100%" stopColor={THEME.signal} stopOpacity={0.03} /></linearGradient>
              <linearGradient id="kpi-solar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={THEME.solar} stopOpacity={0.4} /><stop offset="100%" stopColor={THEME.solar} stopOpacity={0.03} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.line} vertical={false} />
            <XAxis dataKey="h" stroke={THEME.faint} fontSize={10} interval={3} tickLine={false} />
            <YAxis yAxisId="kw" stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} />
            <YAxis yAxisId="irr" orientation="right" stroke={THEME.faint} fontSize={10} tickLine={false} axisLine={false} unit=" W/m²" />
            <Tooltip contentStyle={chartTooltipStyle} />
            <Area yAxisId="kw" type="monotone" dataKey="power" stroke={THEME.signal} strokeWidth={2} fill="url(#kpi-power)" name="Total Power kW" />
            <Area yAxisId="kw" type="monotone" dataKey="solar" stroke={THEME.solar} strokeWidth={2} fill="url(#kpi-solar)" name="Solar kW" />
            <Line yAxisId="irr" type="monotone" dataKey="irr" stroke={THEME.grid} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Irradiance W/m²" />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      {/* Top performers + quick stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }} className="sg-grid2">
        <Panel pad={0}>
          <div style={{ padding: 14 }}><span style={sectionTitle}>Top Performing Plants · by PR</span></div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ color: THEME.dim, fontSize: 10.5, textTransform: "uppercase" }}>
              <th style={th}>Plant</th><th style={{ ...th, textAlign: "right" }}>Power</th>
              <th style={{ ...th, textAlign: "center" }}>PR</th><th style={{ ...th, textAlign: "center" }}>CUF</th>
            </tr></thead>
            <tbody>
              {topPerformers.map((p) => (
                <tr key={p.id} className="sg-row" onClick={() => openPlant(p)} style={{ cursor: "pointer", borderTop: `1px solid ${THEME.line}` }}>
                  <td style={td}><span style={{ display: "flex", alignItems: "center", gap: 8 }}><StatusDot online={p.online} /> {p.name}</span></td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "ui-monospace, monospace" }}>{fmt(p.total)} kW</td>
                  <td style={{ ...td, textAlign: "center", color: THEME.signal, fontWeight: 600 }}>{p.pr}%</td>
                  <td style={{ ...td, textAlign: "center", color: THEME.dim }}>{p.cuf}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <KpiCard label="Plants Online" value={`${totals.online}`} unit={`/ ${totals.count}`} color={THEME.grid} icon={Power} sub={`${Math.round(totals.online / totals.count * 100)}% availability`} sparkSeed={11} />
          <KpiCard label="Solar Generating" value={fmt(live(agg.solarNow))} unit="kW" color={THEME.solar} icon={Sun} sub="across all plants" sparkSeed={12} />
          <KpiCard label="Active Alarms" value={`${totals.alarms}`} unit="" color={totals.alarms ? THEME.alarm : THEME.dim} icon={AlertTriangle} sub={`${agg.alarmsCrit} plants critical`} sparkSeed={13} />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ label, value, unit, accent, big, pulse }) {
  return (
    <div style={{ position: "relative", padding: "4px 18px 4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        {pulse && <StatusDot online pulse />}
        <span style={{ fontSize: 11, color: THEME.dim, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: big ? 38 : 30, fontWeight: 800, color: accent, fontFamily: "ui-monospace, monospace", lineHeight: 1, letterSpacing: -1 }}>{value}</span>
        <span style={{ fontSize: 13, color: THEME.dim }}>{unit}</span>
      </div>
    </div>
  );
}

function EnvStat({ icon: Icon, label, value, unit, color }) {
  return (
    <div style={{ background: THEME.bg, borderRadius: 10, padding: 12 }}>
      <Icon size={16} color={color} />
      <div style={{ fontSize: 21, fontWeight: 700, fontFamily: "ui-monospace, monospace", marginTop: 8, color: THEME.text }}>{value}</div>
      <div style={{ fontSize: 10, color: THEME.dim, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: THEME.faint }}>{unit}</div>
    </div>
  );
}

// ===========================================================
// SyncGen AI — embedded analyst (calls Anthropic API with live
// plant context for losses, ROI, anomalies & root-cause analysis)
// ===========================================================

// Build a compact, factual snapshot of the plant for grounding the model.
function buildPlantContext(plant, fleet, totals) {
  const s = plant.sources;
  const gen = s.grid + s.gas + s.solar + Math.max(0, s.batt);
  const r = seededRand(plant.id * 11);
  // Derived loss & financial figures (same logic the dashboards use)
  const solarExpected = Math.round(s.solar / (plant.pr / 100));
  const solarLossKw = Math.max(0, solarExpected - s.solar);
  const gensetEff = (0.24 + (seededRand(plant.id * 17)() ) * 0.04).toFixed(3);
  const fleetAvgPR = Math.round(fleet.reduce((a, p) => a + p.pr, 0) / fleet.length);
  const fleetAvgPF = (fleet.reduce((a, p) => a + parseFloat(p.pf), 0) / fleet.length).toFixed(2);
  const fleetAvgCUF = Math.round(fleet.reduce((a, p) => a + p.cuf, 0) / fleet.length);

  return `
PLANT SNAPSHOT — ${plant.name} (${plant.region})
Status: ${plant.online ? "ONLINE" : "OFFLINE"} | Last telemetry: ${plant.lastSeen} | Connected devices: ${plant.devices}

LIVE POWER (kW):
- WAPDA Grid import: ${s.grid}
- Gas Genset output: ${s.gas}
- Solar PV output: ${s.solar}
- Battery: ${s.batt} (${s.batt < 0 ? "charging" : s.batt > 0 ? "discharging" : "idle"})
- Total plant load: ${plant.total}

POWER QUALITY & METERING:
- Power Factor: ${plant.pf} (fleet avg ${fleetAvgPF})
- Frequency: ~50 Hz | THD-V: ${(2 + r() * 3).toFixed(1)}% | THD-I: ${(4 + r() * 5).toFixed(1)}%

SOLAR PERFORMANCE:
- Performance Ratio (PR): ${plant.pr}% (fleet avg ${fleetAvgPR}%)
- Capacity Utilization Factor (CUF): ${plant.cuf}% (fleet avg ${fleetAvgCUF}%)
- Expected solar at nominal PR: ~${solarExpected} kW; estimated underperformance: ~${solarLossKw} kW
- Loss breakdown (typical): irradiance, temperature, soiling, inverter clipping, DC/system losses

GENSET:
- Gas fuel efficiency: ${gensetEff} Nm³/kWh
- Estimated gas consumption: ~${Math.round(s.gas * 0.26)} Nm³/hr

WEATHER STATION:
- GHI: ${plant.weather.ghi} W/m² | Ambient: ${plant.weather.amb}°C | Module temp: ${plant.weather.mod}°C
- Wind: ${plant.weather.wind} m/s | Humidity: ${plant.weather.hum}%

ENERGY ACCOUNTING (departments):
${plant.depts.map((d) => `- ${d.name}: ${d.kw} kW, load factor ${d.lf}%`).join("\n")}

COST & ENVIRONMENT:
- Estimated daily energy cost: Rs ${fmtFull(plant.cost)}
- CO2 avoided: ${plant.co2} t/day
- Active alarms at this plant: ${plant.alarms}

FLEET CONTEXT: ${totals.count} plants total, ${totals.online} online, ${totals.alarms} total active alarms.

ASSUMED TARIFFS/FACTORS (editable in Settings): grid tariff ~Rs 22/kWh, gas generation cost varies with gas price, CO2 factor 0.5 t/MWh, solar capex ~Rs 60/W.
`.trim();
}

const AI_SYSTEM = `You are SyncGen AI, an embedded energy analyst inside the SyncGen EMS/SCADA platform for industrial textile plants in Pakistan. You help plant managers and engineers analyze their data.

Your specialties:
1. LOSS ANALYSIS — identify where energy/money is being lost (solar underperformance, low power factor penalties, genset inefficiency, transformer/distribution losses, inverter clipping) and quantify it.
2. ROI & SAVINGS — estimate payback and savings for actions like adding solar/battery, PF correction, shifting load from grid to solar/genset, reducing genset run-hours.
3. ANOMALY DETECTION — flag values that look off versus fleet averages or physical expectations, and say why.
4. ROOT-CAUSE ANALYSIS — correlate parameters (e.g. low PR vs high module temperature, high THD vs specific load, low PF vs reactive department load) to explain likely causes.

Rules:
- Ground every answer in the PLANT SNAPSHOT data you are given. Cite the actual numbers.
- Be concrete and quantitative. Show the simple arithmetic behind any estimate so the user can trust it.
- When you estimate money/ROI, state your assumptions (tariff, etc.) clearly since these are configurable.
- Keep answers tight and scannable: a short headline finding, then specifics, then a recommended action.
- You are an analyst, not a controller — you advise, you do not actuate equipment. If asked to change a setpoint, explain what you'd recommend and that an engineer must apply it.
- If data needed for a precise answer isn't in the snapshot, say what additional tag/measurement would be required.
- Use plain language a plant manager understands; define jargon briefly when first used.`;

const AI_SUGGESTIONS = [
  { icon: TrendingDown, label: "Analyze my losses", color: THEME.alarm,
    q: "Analyze the main energy and cost losses at this plant right now. Quantify each loss in kW and approximate Rs/day, and rank them from biggest to smallest." },
  { icon: TrendingUp, label: "ROI for more solar", color: THEME.solar,
    q: "If I expand solar PV at this plant to offset grid and genset usage, estimate the daily savings and a rough payback period. Show your assumptions and arithmetic." },
  { icon: AlertTriangle, label: "Find anomalies", color: THEME.warn,
    q: "Scan this plant's current parameters for anomalies compared to fleet averages and physical expectations. List anything that looks abnormal and explain why." },
  { icon: SearchIcon, label: "Root-cause my low PR", color: THEME.grid,
    q: "My solar Performance Ratio looks low. Compare the relevant parameters (module temperature, irradiance, clipping, PF) and tell me the most likely root causes." },
];

// Minimal markdown -> HTML (bold, bullets, code, paragraphs) — safe subset.
function renderMd(text) {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = text.split("\n");
  let html = "", inUl = false;
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
  for (const line of lines) {
    const t = line.trim();
    if (/^[-*•]\s+/.test(t)) {
      if (!inUl) { html += "<ul>"; inUl = true; }
      html += `<li>${inline(t.replace(/^[-*•]\s+/, ""))}</li>`;
    } else {
      if (inUl) { html += "</ul>"; inUl = false; }
      if (t) html += `<p>${inline(t)}</p>`;
    }
  }
  if (inUl) html += "</ul>";
  return html;
}

function SyncGenAI({ open, onClose, plant, fleet, totals, setPlant }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setError(null);
    const userMsg = { role: "user", content };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    const context = buildPlantContext(plant, fleet, totals);
    const apiMessages = history.map((m) => ({ role: m.role, content: m.content }));
    // Prepend current context to the latest user turn so the model always sees live data.
    apiMessages[apiMessages.length - 1] = {
      role: "user",
      content: `Here is the current live data for the plant I'm viewing:\n\n${context}\n\n---\n\nMy question: ${content}`,
    };

    // Backend URL is read from a global config set in index.html.
    // - Empty in the demo => friendly demo-mode message.
    // - Set to your backend URL in production => real AI analysis.
    const BACKEND = (typeof window !== "undefined" && window.SYNCGEN_AI_BACKEND) ? window.SYNCGEN_AI_BACKEND : null;
    const PREVIEW_ENDPOINT = "https://api.anthropic.com/v1/messages";

    // Detect whether we're inside the Claude preview (where the key is auto-provided).
    const IN_PREVIEW = typeof window !== "undefined" && /claude\.ai|anthropic/.test(window.location?.hostname || "");

    try {
      let reply;
      if (BACKEND) {
        // Real deployment: your backend adds the API key server-side.
        const res = await fetch(BACKEND, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ system: AI_SYSTEM, messages: apiMessages, model: "claude-sonnet-4-6", max_tokens: 1000 }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        reply = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
      } else if (IN_PREVIEW) {
        // Preview environment: the key is provided automatically here.
        const res = await fetch(PREVIEW_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: AI_SYSTEM, messages: apiMessages }),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        reply = (data.content || []).map((b) => (b.type === "text" ? b.text : "")).filter(Boolean).join("\n");
      } else {
        // Published demo with no backend configured yet.
        throw new Error("demo");
      }
      setMessages((m) => [...m, { role: "assistant", content: reply || "I couldn't generate a response. Please try rephrasing." }]);
    } catch (e) {
      if (!BACKEND) {
        // Friendly demo-mode message instead of a scary error.
        setMessages((m) => [...m, { role: "assistant", content: "**Demo mode** — the AI analyst is fully built, but it needs to connect to your secure backend to run on a published site.\n\nOnce SyncGen is deployed with your Anthropic API key on the server, I'll analyze this plant's live data for losses, ROI, anomalies, and root causes. Everything else in the app is fully interactive right now." }]);
      } else {
        setError("Couldn't reach the analysis service. Check the connection and try again.");
        setMessages((m) => m.slice(0, -1));
        setInput(content);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,8,14,0.4)", zIndex: 70 }} />
      <aside style={{
        position: "fixed", top: 0, right: 0, height: "100%", width: 440, maxWidth: "100%",
        background: THEME.panel, borderLeft: `1px solid ${THEME.line}`, zIndex: 80,
        display: "flex", flexDirection: "column", boxShadow: "-12px 0 40px rgba(0,0,0,.5)",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${THEME.line}`, display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${THEME.signal}, ${THEME.grid})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={17} color="#06120C" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>SyncGen AI</div>
            <div style={{ fontSize: 11, color: THEME.dim, display: "flex", alignItems: "center", gap: 5 }}>
              <StatusDot online={plant.online} /> analyzing {plant.name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: THEME.dim, cursor: "pointer", padding: 4 }}><X size={20} /></button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {messages.length === 0 && (
            <div>
              <div style={{ fontSize: 13, color: THEME.text, marginBottom: 6, fontWeight: 600 }}>
                Hi — I'm your plant analyst.
              </div>
              <div style={{ fontSize: 12.5, color: THEME.dim, lineHeight: 1.6, marginBottom: 16 }}>
                I can read this plant's live data to analyze losses, estimate ROI, flag anomalies, and trace root causes by comparing parameters. Pick a starting point or ask anything.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {AI_SUGGESTIONS.map((s) => (
                  <button key={s.label} className="sg-btn" onClick={() => send(s.q)} style={{
                    display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 10,
                    border: `1px solid ${THEME.line}`, background: THEME.bg, color: THEME.text,
                    cursor: "pointer", textAlign: "left", fontSize: 12.5,
                  }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${s.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <s.icon size={15} color={s.color} />
                    </div>
                    <span style={{ fontWeight: 500 }}>{s.label}</span>
                    <ChevronRight size={15} color={THEME.faint} style={{ marginLeft: "auto" }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 14, display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              {m.role === "assistant" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, fontSize: 11, color: THEME.signal }}>
                  <Sparkles size={12} /> SyncGen AI
                </div>
              )}
              <div className={m.role === "assistant" ? "sg-md" : ""} style={{
                maxWidth: "92%", padding: "10px 13px", borderRadius: 12, fontSize: 12.5, lineHeight: 1.55,
                background: m.role === "user" ? THEME.grid : THEME.bg,
                color: m.role === "user" ? "#04101F" : THEME.text,
                border: m.role === "user" ? "none" : `1px solid ${THEME.line}`,
                fontWeight: m.role === "user" ? 500 : 400,
              }}
                {...(m.role === "assistant" ? { dangerouslySetInnerHTML: { __html: renderMd(m.content) } } : {})}>
                {m.role === "user" ? m.content : null}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: THEME.dim, fontSize: 12.5 }}>
              <Sparkles size={13} color={THEME.signal} className="sg-typing" />
              <span className="sg-typing">Analyzing {plant.name}'s data…</span>
            </div>
          )}
          {error && (
            <div style={{ padding: "10px 13px", borderRadius: 10, background: `${THEME.alarm}14`, border: `1px solid ${THEME.alarm}40`, color: THEME.alarm, fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{ padding: 14, borderTop: `1px solid ${THEME.line}` }}>
          {messages.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {AI_SUGGESTIONS.map((s) => (
                <button key={s.label} className="sg-btn" onClick={() => send(s.q)} disabled={loading} style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 7,
                  border: `1px solid ${THEME.line}`, background: THEME.bg, color: THEME.dim,
                  cursor: loading ? "default" : "pointer", fontSize: 11,
                }}>
                  <s.icon size={12} color={s.color} /> {s.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about losses, ROI, anomalies…"
              rows={1}
              style={{
                flex: 1, resize: "none", maxHeight: 120, padding: "10px 12px", borderRadius: 10,
                background: THEME.bg, border: `1px solid ${THEME.line}`, color: THEME.text,
                fontSize: 12.5, outline: "none", fontFamily: "inherit", lineHeight: 1.4,
              }}
            />
            <button className="sg-btn" onClick={() => send()} disabled={loading || !input.trim()} style={{
              width: 38, height: 38, borderRadius: 10, border: "none", flexShrink: 0,
              background: input.trim() && !loading ? THEME.signal : THEME.line,
              color: "#06120C", display: "flex", alignItems: "center", justifyContent: "center",
              cursor: input.trim() && !loading ? "pointer" : "default",
            }}>
              {loading ? <Loader size={16} className="sg-typing" /> : <Send size={16} />}
            </button>
          </div>
          <div style={{ fontSize: 10, color: THEME.faint, marginTop: 8, textAlign: "center" }}>
            SyncGen AI analyzes live plant data · advisory only, does not control equipment
          </div>
        </div>
      </aside>
    </>
  );
}
