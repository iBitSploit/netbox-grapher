import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Server, Router, HardDrive, Wifi, WifiOff, RefreshCw, Settings, X, ChevronRight, ChevronDown, MapPin, Cable, Network, AlertTriangle, CheckCircle2, Circle, Loader2, Zap, Waypoints, ZoomIn, ZoomOut, Maximize2, Rows3, Globe2, Database, Filter, ArrowRightLeft } from 'lucide-react';

// ---------- Design tokens ----------
const C = {
  bg: '#0A0E14',
  panel: '#10151D',
  panelAlt: '#141B25',
  border: '#212B38',
  borderLight: '#2A3644',
  textPrimary: '#E4E8ED',
  textSecondary: '#8B96A8',
  textDim: '#5A6576',
  accent: '#4FD1C5',
  accentDim: '#2C5C58',
  warn: '#F0A868',
  danger: '#E15554',
  offline: '#5A6576',
  planned: '#6E8FD1',
  circuit: '#9B7EDE',
};

const STATUS_COLOR = {
  active: C.accent, offline: C.danger, planned: C.planned, staged: C.warn,
  failed: C.danger, decommissioning: C.textDim, connected: C.accent, disconnected: C.danger,
  provisioning: C.planned, deprovisioning: C.warn,
};

function statusColor(status) {
  if (!status) return C.textDim;
  const v = (typeof status === 'object' ? status.value : status || '').toLowerCase();
  return STATUS_COLOR[v] || C.textDim;
}
function statusLabel(status) {
  if (!status) return 'Unknown';
  return typeof status === 'object' ? status.label : status;
}

// ---------- Topology color palettes ----------
const SITE_PALETTE = [
  '#4FD1C5', '#F0A868', '#E15554', '#6E8FD1', '#9B7EDE',
'#5FD98C', '#F0C868', '#68B5F0', '#E17FC1', '#A8E17F',
'#7FD9D9', '#F08868', '#8FB0E1', '#C89BE1', '#68D9A5',
];
const ROLE_PALETTE = [
  '#E15554', '#F0A868', '#4FD1C5', '#6E8FD1', '#9B7EDE',
'#5FD98C', '#F0C868', '#68B5F0', '#E17FC1', '#A8E17F',
'#7FD9D9', '#F08868', '#8FB0E1', '#C89BE1', '#68D9A5',
];

function colorForSite(siteId) {
  if (siteId == null) return C.textDim;
  const n = Number(siteId);
  if (!Number.isFinite(n)) return C.textDim;
  return SITE_PALETTE[Math.abs(n) % SITE_PALETTE.length];
}
function colorForRole(roleName) {
  if (!roleName) return C.textDim;
  let h = 0;
  for (let i = 0; i < roleName.length; i++) h = (h * 31 + roleName.charCodeAt(i)) | 0;
  return ROLE_PALETTE[Math.abs(h) % ROLE_PALETTE.length];
}

// ---------- Small UI atoms ----------
function Mono({ children, style, ...rest }) {
  return <span style={{ fontFamily: "'JetBrains Mono', 'IBM Plex Mono', monospace", ...style }} {...rest}>{children}</span>;
}
function StatusDot({ status, size = 7 }) {
  const col = statusColor(status);
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${col}88`, flexShrink: 0 }} />;
}
function Badge({ children, color = C.textSecondary, bg }) {
  return (
    <span style={{
      fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color,
      background: bg || `${color}18`, border: `1px solid ${color}33`,
      borderRadius: 4, padding: '2px 6px', letterSpacing: 0.2, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}
function Spinner({ size = 16 }) {
  return <Loader2 size={size} style={{ animation: 'spin 0.8s linear infinite', color: C.accent }} />;
}

// ---------- NetBox API client ----------
function useNetBox(baseUrl, token) {
  const cache = useRef(new Map());
  const request = useCallback(async (path, { useCache = true } = {}) => {
    if (!baseUrl || !token) throw new Error('Not configured');
    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    if (useCache && cache.current.has(url)) return cache.current.get(url);
    const res = await fetch(url, { headers: { 'Authorization': `Token ${token}`, 'Accept': 'application/json' } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`);
    }
    const data = await res.json();
    cache.current.set(url, data);
    return data;
  }, [baseUrl, token]);
  const fetchAllPages = useCallback(async (path, limit = 200) => {
    let results = [];
    let url = `${path}${path.includes('?') ? '&' : '?'}limit=${limit}`;
    let guard = 0;
    while (url && guard < 50) {
      const data = await request(url, { useCache: false });
      results = results.concat(data.results || []);
      if (data.next) url = data.next.replace(baseUrl.replace(/\/$/, ''), ''); else url = null;
      guard++;
    }
    return results;
  }, [request, baseUrl]);
  const clearCache = useCallback(() => cache.current.clear(), []);
  return { request, fetchAllPages, clearCache };
}

// ---------- Connection setup ----------
function ConnectionSetup({ initial, onConnect, error, connecting }) {
  const [url, setUrl] = useState(initial?.url || '');
  const [token, setToken] = useState(initial?.token || '');
  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
    <div style={{ width: '100%', maxWidth: 440 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Network size={19} color={C.accent} />
    </div>
    <div>
    <div style={{ fontSize: 16, fontWeight: 600, color: C.textPrimary, letterSpacing: -0.2 }}>Infrastructure Map</div>
    <div style={{ fontSize: 12.5, color: C.textDim }}>Live from NetBox</div>
    </div>
    </div>
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
    <label style={{ display: 'block', fontSize: 12.5, color: C.textSecondary, marginBottom: 6 }}>NetBox URL</label>
    <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://netbox.yourdomain.com"
    style={{ width: '100%', boxSizing: 'border-box', background: C.panelAlt, border: `1px solid ${C.borderLight}`, borderRadius: 7, padding: '10px 12px', color: C.textPrimary, fontSize: 13.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 16, outline: 'none' }} />
    <label style={{ display: 'block', fontSize: 12.5, color: C.textSecondary, marginBottom: 6 }}>API Token</label>
    <input value={token} onChange={e => setToken(e.target.value)} placeholder="0123456789abcdef0123456789abcdef01234567" type="password"
    style={{ width: '100%', boxSizing: 'border-box', background: C.panelAlt, border: `1px solid ${C.borderLight}`, borderRadius: 7, padding: '10px 12px', color: C.textPrimary, fontSize: 13.5, fontFamily: "'JetBrains Mono', monospace", marginBottom: 8, outline: 'none' }} />
    <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 20, lineHeight: 1.5 }}>Needs read permission on DCIM, IPAM and Circuits.</div>
    {error && (
      <div style={{ background: `${C.danger}15`, border: `1px solid ${C.danger}44`, borderRadius: 7, padding: '10px 12px', marginBottom: 16, fontSize: 12.5, color: C.danger, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} /><span>{error}</span>
      </div>
    )}
    <button onClick={() => onConnect(url.trim(), token.trim())} disabled={!url.trim() || !token.trim() || connecting}
    style={{ width: '100%', background: (!url.trim() || !token.trim()) ? C.borderLight : C.accent, color: (!url.trim() || !token.trim()) ? C.textDim : '#04231F', border: 'none', borderRadius: 7, padding: '11px 0', fontSize: 13.5, fontWeight: 600, cursor: (!url.trim() || !token.trim()) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
    {connecting ? <><Spinner size={15} /> Connecting…</> : 'Connect'}
    </button>
    </div>
    </div>
    </div>
  );
}

// ---------- Small device icon (rack rows / detail panel) ----------
function DeviceIcon({ role, size = 13, color }) {
  const r = (role || '').toLowerCase();
  if (r.includes('router')) return <Router size={size} color={color} />;
  if (r.includes('switch') || r.includes('network')) return <Network size={size} color={color} />;
  if (r.includes('storage') || r.includes('disk')) return <HardDrive size={size} color={color} />;
  return <Server size={size} color={color} />;
}

// ---------- EVE-NG / PNetLab style role icon ----------
function TopoRoleIconPath({ role, color, fill }) {
  const r = (role || '').toLowerCase();
  const stroke = color;
  const sw = 2.2;
  const fillColor = fill || 'transparent';

  if (r.includes('router') || r.includes('gateway') || r.includes('edge')) {
    return (
      <g>
      <circle cx="32" cy="32" r="24" fill={fillColor} stroke={stroke} strokeWidth={sw} />
      <path d="M32 14 L32 24 M27 19 L32 14 L37 19" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 50 L32 40 M27 45 L32 50 L37 45" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 32 L24 32 M19 27 L14 32 L19 37" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 32 L40 32 M45 27 L50 32 L45 37" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="3" fill={stroke} />
      </g>
    );
  }
  if (r.includes('switch') || r.includes('network')) {
    return (
      <g>
      <rect x="6" y="18" width="52" height="28" rx="4" fill={fillColor} stroke={stroke} strokeWidth={sw} />
      <path d="M22 24 L22 40 M17 29 L22 24 L27 29" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M42 24 L42 40 M37 35 L42 40 L47 35" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="2.2" fill={stroke} />
      </g>
    );
  }
  if (r.includes('firewall') || r.includes('fire') || r.includes('security')) {
    return (
      <g>
      <rect x="8" y="14" width="48" height="36" rx="3" fill={fillColor} stroke={stroke} strokeWidth={sw} />
      <line x1="8" y1="26" x2="56" y2="26" stroke={stroke} strokeWidth={sw * 0.7} />
      <line x1="8" y1="38" x2="56" y2="38" stroke={stroke} strokeWidth={sw * 0.7} />
      <line x1="24" y1="14" x2="24" y2="26" stroke={stroke} strokeWidth={sw * 0.7} />
      <line x1="40" y1="14" x2="40" y2="26" stroke={stroke} strokeWidth={sw * 0.7} />
      <line x1="16" y1="26" x2="16" y2="38" stroke={stroke} strokeWidth={sw * 0.7} />
      <line x1="32" y1="26" x2="32" y2="38" stroke={stroke} strokeWidth={sw * 0.7} />
      <line x1="48" y1="26" x2="48" y2="38" stroke={stroke} strokeWidth={sw * 0.7} />
      <line x1="24" y1="38" x2="24" y2="50" stroke={stroke} strokeWidth={sw * 0.7} />
      <line x1="40" y1="38" x2="40" y2="50" stroke={stroke} strokeWidth={sw * 0.7} />
      </g>
    );
  }
  if (r.includes('storage') || r.includes('disk') || r.includes('san') || r.includes('nas')) {
    return (
      <g>
      <ellipse cx="32" cy="16" rx="20" ry="6" fill={fillColor} stroke={stroke} strokeWidth={sw} />
      <path d="M12 16 L12 48 M52 16 L52 48" fill="none" stroke={stroke} strokeWidth={sw} />
      <ellipse cx="32" cy="48" rx="20" ry="6" fill={fillColor} stroke={stroke} strokeWidth={sw} />
      <ellipse cx="32" cy="30" rx="20" ry="6" fill="none" stroke={stroke} strokeWidth={sw * 0.6} opacity="0.55" />
      </g>
    );
  }
  if (r.includes('wireless') || r.includes('wifi') || r.includes('ap') || r.includes('wlan')) {
    return (
      <g>
      <circle cx="32" cy="46" r="4.5" fill={stroke} />
      <path d="M20 38 A 18 18 0 0 1 44 38" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <path d="M14 32 A 26 26 0 0 1 50 32" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <path d="M8 26 A 34 34 0 0 1 56 26" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      </g>
    );
  }
  if (r.includes('cloud') || r.includes('wan') || r.includes('internet') || r.includes('isp')) {
    return (
      <g>
      <path d="M18 44 A 10 10 0 0 1 18 24 A 12 12 0 0 1 42 22 A 10 10 0 0 1 46 44 Z" fill={fillColor} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      </g>
    );
  }
  if (r.includes('load') && r.includes('balanc')) {
    return (
      <g>
      <rect x="10" y="16" width="44" height="32" rx="4" fill={fillColor} stroke={stroke} strokeWidth={sw} />
      <path d="M32 22 L32 42 M24 30 L32 22 L40 30" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }
  if (r.includes('pc') || r.includes('host') || r.includes('workstation') || r.includes('endpoint') || r.includes('user')) {
    return (
      <g>
      <rect x="8" y="14" width="48" height="30" rx="3" fill={fillColor} stroke={stroke} strokeWidth={sw} />
      <line x1="22" y1="52" x2="42" y2="52" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      <line x1="32" y1="44" x2="32" y2="52" stroke={stroke} strokeWidth={sw} />
      </g>
    );
  }
  return (
    <g>
    <rect x="14" y="10" width="36" height="44" rx="3" fill={fillColor} stroke={stroke} strokeWidth={sw} />
    <line x1="14" y1="22" x2="50" y2="22" stroke={stroke} strokeWidth={sw * 0.8} />
    <line x1="14" y1="34" x2="50" y2="34" stroke={stroke} strokeWidth={sw * 0.8} />
    <line x1="14" y1="46" x2="50" y2="46" stroke={stroke} strokeWidth={sw * 0.8} />
    <circle cx="20" cy="16" r="1.6" fill={stroke} />
    <circle cx="20" cy="28" r="1.6" fill={stroke} />
    <circle cx="20" cy="40" r="1.6" fill={stroke} />
    </g>
  );
}

// ---------- Hierarchy tiering ----------
const TIER_NAMES = ['Circuits / Uplinks', 'Edge / Firewall', 'Routers', 'Switches', 'Devices'];
const TIER_COLORS = ['#9B7EDE', '#E15554', '#F0A868', '#4FD1C5', '#8B96A8'];

function getTier(role) {
  const r = (role || '').toLowerCase();
  if (r === '__circuit__') return 0;
  if (/firewall|\bfire\b|security|\bwan\b|internet|\bisp\b|\bcloud\b|\bedge\b|\bperimeter\b|\bdmz\b/.test(r)) return 1;
  if (/router|gateway/.test(r)) return 2;
  if (/switch|network|load.*balanc|\blb\b/.test(r)) return 3;
  return 4;
}

// ---------- Hierarchical (Sugiyama-lite) layout ----------
function computeHierarchicalLayout(nodes, edges) {
  if (nodes.length === 0) return { positions: [], tierMeta: [], graphMinX: 0, graphMaxX: 0 };

  const tierMax = TIER_NAMES.length - 1;
  const tiers = Array.from({ length: tierMax + 1 }, () => []);
  nodes.forEach(n => tiers[getTier(n.role)].push(n));

  tiers.forEach(t => t.sort((a, b) => a.label.localeCompare(b.label)));

  const nodeTier = new Map();
  nodes.forEach(n => nodeTier.set(n.id, getTier(n.role)));
  const upNbrs = new Map();
  const downNbrs = new Map();
  nodes.forEach(n => { upNbrs.set(n.id, []); downNbrs.set(n.id, []); });
  edges.forEach(e => {
    const ta = nodeTier.get(e.source);
    const tb = nodeTier.get(e.target);
    if (ta == null || tb == null || ta === tb) return;
    if (ta < tb) {
      upNbrs.get(e.target).push(e.source);
      downNbrs.get(e.source).push(e.target);
    } else {
      upNbrs.get(e.source).push(e.target);
      downNbrs.get(e.target).push(e.source);
    }
  });

  const orderIndex = new Map();
  const refreshOrder = () => tiers.forEach(t => t.forEach((n, i) => orderIndex.set(n.id, i)));

  const sortByBary = (tier, neighborMap) => {
    refreshOrder();
    const bary = new Map();
    tier.forEach(n => {
      const refs = (neighborMap.get(n.id) || []).map(id => orderIndex.get(id)).filter(v => v != null);
      bary.set(n.id, refs.length ? refs.reduce((a, b) => a + b, 0) / refs.length : Infinity);
    });
    tier.sort((a, b) => {
      const ba = bary.get(a.id), bb = bary.get(b.id);
      if (ba === Infinity && bb === Infinity) return a.label.localeCompare(b.label);
      if (ba === Infinity) return 1;
      if (bb === Infinity) return -1;
      return ba - bb;
    });
  };

  for (let pass = 0; pass < 4; pass++) {
    for (let ti = 1; ti <= tierMax; ti++) sortByBary(tiers[ti], upNbrs);
    for (let ti = tierMax - 1; ti >= 0; ti--) sortByBary(tiers[ti], downNbrs);
  }

  const intraDeg = new Map();
  nodes.forEach(n => intraDeg.set(n.id, 0));
  edges.forEach(e => {
    const ta = nodeTier.get(e.source);
    const tb = nodeTier.get(e.target);
    if (ta != null && ta === tb) {
      intraDeg.set(e.source, (intraDeg.get(e.source) || 0) + 1);
      intraDeg.set(e.target, (intraDeg.get(e.target) || 0) + 1);
    }
  });

  const active = tiers.map((t, i) => ({ items: t, index: i })).filter(x => x.items.length > 0);

  const H_SPACING = 135;
  const ROW_SPACING = 130;
  const LANE_GAP = 45;
  const Y_START = 110;
  const SIDE_PAD = 120;

  let maxCount = 1;
  active.forEach(({ items }) => {
    const elevated = items.filter(n => intraDeg.get(n.id) >= 2);
    const normal = items.filter(n => intraDeg.get(n.id) < 2);
    if (elevated.length === 0 || normal.length === 0) {
      maxCount = Math.max(maxCount, items.length);
    } else {
      maxCount = Math.max(maxCount, elevated.length, normal.length);
    }
  });

  const graphW = (maxCount - 1) * H_SPACING;
  const positions = [];
  const tierMeta = [];

  let currentY = Y_START;

  active.forEach(({ items, index }) => {
    const elevated = items.filter(n => intraDeg.get(n.id) >= 2);
    const normal = items.filter(n => intraDeg.get(n.id) < 2);

    const subRows = (elevated.length === 0 || normal.length === 0)
    ? [items]
    : [elevated, normal];

    const topY = currentY;
    const bottomY = currentY + (subRows.length - 1) * ROW_SPACING;

    subRows.forEach((rowItems, subIdx) => {
      const count = rowItems.length;
      const rowW = (count - 1) * H_SPACING;
      const startX = -rowW / 2;
      const y = currentY + subIdx * ROW_SPACING;
      rowItems.forEach((n, i) => {
        positions.push({ id: n.id, x: startX + i * H_SPACING, y, tier: index });
      });
    });

    const centerY = (topY + bottomY) / 2;
    tierMeta.push({
      index,
      label: TIER_NAMES[index],
      color: TIER_COLORS[index],
      y: centerY,
      topY,
      bottomY,
      rowCount: subRows.length,
      count: items.length,
    });

    currentY = bottomY + ROW_SPACING + LANE_GAP;
  });

  const graphMinX = -graphW / 2 - SIDE_PAD;
  const graphMaxX = graphW / 2 + SIDE_PAD;

  return { positions, tierMeta, graphMinX, graphMaxX };
}

// Shorten an edge so it stops at the icon boundary
function trimEdge(a, b, margin) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  return {
    x1: a.x + ux * margin, y1: a.y + uy * margin,
    x2: b.x - ux * margin, y2: b.y - uy * margin,
  };
}

// ---------- Termination helpers ----------
// NetBox content-type strings are "app.model" (e.g. "dcim.interface",
// "circuits.circuittermination"). We normalise to the model name only, and
// recognise a couple of alternative serializations NetBox has used over time.
function rawModelFromType(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') {
    const parts = raw.split('.');
    return String(parts[parts.length - 1] || '').toLowerCase();
  }
  if (typeof raw === 'object') {
    const candidates = [raw.model, raw.model_name, raw.label, raw.name, raw.url];
    for (const c of candidates) {
      if (typeof c === 'string' && c) {
        const parts = c.split(/[/.]/);
        const last = String(parts[parts.length - 1] || '').toLowerCase();
        if (last) return last;
      }
    }
  }
  return '';
}

function terminationKind(term) {
  if (!term) return null;
  let model = rawModelFromType(term.object_type);
  if (!model && term.object?.device) model = 'interface';
  if (!model) return null;
  if (model === 'interface') return 'interface';
  if (model === 'frontport') return 'frontport';
  if (model === 'rearport') return 'rearport';
  if (model === 'circuittermination') return 'circuittermination';
  return 'other';
}

// ---------- Topology Map ----------
function TopologyMap({ devices, cables, interfaces, frontPorts, rearPorts, circuits, circuitTerminations, selectedId, onSelectDevice, onSelectCircuit }) {
  const ICON = 44;
  const PLATE_PAD = 5;
  const EDGE_MARGIN = ICON / 2 + PLATE_PAD + 6;

  const svgRef = useRef(null);
  const [hoverId, setHoverId] = useState(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [panning, setPanning] = useState(null);
  const [showIsolated, setShowIsolated] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showTierLanes, setShowTierLanes] = useState(true);
  const [showCircuits, setShowCircuits] = useState(true);

  const [siteFilter, setSiteFilter] = useState(null);
  const [colorMode, setColorMode] = useState('status');

  const sitesInData = useMemo(() => {
    const m = new Map();
    (devices || []).forEach(d => {
      if (d.site?.id != null) m.set(d.site.id, d.site);
    });
      return Array.from(m.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [devices]);

  const filteredDevices = useMemo(() => {
    if (siteFilter == null) return devices;
    return (devices || []).filter(d => d.site?.id === siteFilter);
  }, [devices, siteFilter]);

  const nodeColor = useCallback((d) => {
    if (colorMode === 'site') return colorForSite(d.site?.id);
    if (colorMode === 'role') return colorForRole(d.device_role?.name || d.role?.name);
    return statusColor(d.status);
  }, [colorMode]);

  const { nodes, edges, unresolvedCables, matchedCircuits, orphanCircuits } = useMemo(() => {
    const ifaceToDevice = new Map();
    const ifaceById = new Map();
    (interfaces || []).forEach(i => {
      const did = i.device?.id ?? (typeof i.device === 'number' ? i.device : null);
      if (did != null) ifaceToDevice.set(i.id, did);
      ifaceById.set(i.id, i);
    });

    const frontPortsById = new Map();
    (frontPorts || []).forEach(fp => frontPortsById.set(fp.id, fp));

    const rearPortsById = new Map();
    (rearPorts || []).forEach(rp => rearPortsById.set(rp.id, rp));

    const rearToFrontIds = new Map();
    (frontPorts || []).forEach(fp => {
      const rpid = fp.rear_port?.id ?? (typeof fp.rear_port === 'number' ? fp.rear_port : null);
      if (rpid == null) return;
      if (!rearToFrontIds.has(rpid)) rearToFrontIds.set(rpid, []);
      rearToFrontIds.get(rpid).push(fp.id);
    });

    const cableById = new Map();
    (cables || []).forEach(c => { cableById.set(c.id, c); });

    const termKey = (term) => {
      if (!term) return null;
      const kind = terminationKind(term);
      if (!kind) return null;
      if (term.object_id == null) return null;
      return `${kind}:${term.object_id}`;
    };

    const cableByTermKey = new Map();
    (cables || []).forEach(c => {
      const aTerm = c.a_terminations?.[0];
      const bTerm = c.b_terminations?.[0];
      const aKey = termKey(aTerm);
      const bKey = termKey(bTerm);
      if (aKey) cableByTermKey.set(aKey, { cable: c, aKey, bKey, aTerm, bTerm });
      if (bKey) cableByTermKey.set(bKey, { cable: c, aKey, bKey, aTerm, bTerm });
    });

    const resolveEndpoint = (key, visited) => {
      if (!key || visited.has(key)) return null;
      visited.add(key);

      if (key.startsWith('interface:')) {
        const id = Number(key.slice(10));
        const did = ifaceToDevice.get(id);
        if (did == null) return null;
        return { deviceId: did };
      }

      if (key.startsWith('frontport:')) {
        const id = Number(key.slice(10));
        const fp = frontPortsById.get(id);
        if (!fp) return null;
        const rpid = fp.rear_port?.id ?? (typeof fp.rear_port === 'number' ? fp.rear_port : null);
        if (rpid == null) return null;
        const nextKey = `rearport:${rpid}`;
        const entry = cableByTermKey.get(nextKey);
        if (!entry) return null;
        const otherKey = entry.aKey === nextKey ? entry.bKey : entry.aKey;
        return resolveEndpoint(otherKey, visited);
      }

      if (key.startsWith('rearport:')) {
        const id = Number(key.slice(6));
        const rp = rearPortsById.get(id);
        if (!rp) return null;
        const frontIds = rearToFrontIds.get(id);
        if (!frontIds || frontIds.length === 0) return null;
        const nextKey = `frontport:${frontIds[0]}`;
        const entry = cableByTermKey.get(nextKey);
        if (!entry) return null;
        const otherKey = entry.aKey === nextKey ? entry.bKey : entry.aKey;
        return resolveEndpoint(otherKey, visited);
      }

      return null;
    };

    const cableEdges = [];
    const seenPairs = new Set();
    let unresolved = 0;

    (cables || []).forEach(c => {
      const aTerm = c.a_terminations?.[0];
      const bTerm = c.b_terminations?.[0];
      const aKey = termKey(aTerm);
      const bKey = termKey(bTerm);
      if (!aKey || !bKey) { unresolved++; return; }

      const aKind = terminationKind(aTerm);
      const bKind = terminationKind(bTerm);
      if (aKind === 'circuittermination' || bKind === 'circuittermination') return;

      const aEp = resolveEndpoint(aKey, new Set([bKey]));
      const bEp = resolveEndpoint(bKey, new Set([aKey]));
      if (!aEp || !bEp) { unresolved++; return; }
      if (aEp.deviceId === bEp.deviceId) return;

      const lo = Math.min(aEp.deviceId, bEp.deviceId);
      const hi = Math.max(aEp.deviceId, bEp.deviceId);
      const pairKey = `${lo}-${hi}`;
      if (seenPairs.has(pairKey)) return;
      seenPairs.add(pairKey);

      const aIface = aKey.startsWith('interface:')
      ? (ifaceById.get(Number(aKey.slice(10)))?.name || '')
      : '';
      const bIface = bKey.startsWith('interface:')
      ? (ifaceById.get(Number(bKey.slice(10)))?.name || '')
      : '';

    cableEdges.push({
      id: c.id, source: aEp.deviceId, target: bEp.deviceId, cable: c,
      aIface, bIface,
    });
    });

    // ---- Circuit edges ----
    // The link from a circuit to our infrastructure lives on a cable whose one
    // end is a circuit termination. We iterate BOTH directions (each circuit
    // termination, and each cable that touches one) so we catch all NetBox
    // serializations, then union the results.
    const circuitsById = new Map((circuits || []).map(c => [c.id, c]));
    const ctById = new Map((circuitTerminations || []).map(t => [t.id, t]));
    const circuitNodesById = new Map();
    const circuitEdges = [];
    const matchedCircuitIds = new Set();
    const seenCircuitEdges = new Set();
    // circuitId -> Set of deviceIds
    const circuitToDevices = new Map();

    const addPair = (cid, devId) => {
      if (cid == null || devId == null) return;
      if (!circuitToDevices.has(cid)) circuitToDevices.set(cid, new Set());
      circuitToDevices.get(cid).add(devId);
    };

    // Given a cable object (which we know touches a circuit termination on at
    // least one side), resolve the OTHER side to a device id.
    const deviceIdFromCableOtherThanCircuit = (cableObj) => {
      if (!cableObj) return null;
      const sides = [
        ...(cableObj.a_terminations || []),
                                                                                      ...(cableObj.b_terminations || []),
      ];
      for (const side of sides) {
        const kind = terminationKind(side);
        if (!kind || kind === 'circuittermination') continue;
        const ep = resolveEndpoint(`${kind}:${side.object_id}`, new Set());
        if (ep) return ep.deviceId;
      }
      return null;
    };

    // Return the circuit termination id embedded on a cable side, if any.
    const circuitTerminationIdFromCable = (cableObj) => {
      if (!cableObj) return null;
      const sides = [
        ...(cableObj.a_terminations || []),
                                                                                      ...(cableObj.b_terminations || []),
      ];
      for (const side of sides) {
        if (terminationKind(side) === 'circuittermination' && side.object_id != null) {
          return side.object_id;
        }
      }
      return null;
    };

    if (showCircuits) {
      // Approach A — per circuit termination
      (circuitTerminations || []).forEach(t => {
        let devId = null;

        // A.1 cable on the termination object (id or expanded object)
        if (t.cable != null) {
          const cableObj = (typeof t.cable === 'object') ? t.cable : cableById.get(t.cable);
          if (cableObj) devId = deviceIdFromCableOtherThanCircuit(cableObj);
        }

        // A.2 fallback: find the cable that references this termination id
        if (devId == null) {
          const entry = cableByTermKey.get(`circuittermination:${t.id}`);
          if (entry && entry.cable) devId = deviceIdFromCableOtherThanCircuit(entry.cable);
        }

        // A.3 fallback: nested device on the termination object
        if (devId == null && t.termination?.device?.id != null) devId = t.termination.device.id;
        if (devId == null && typeof t.termination?.device === 'number') devId = t.termination.device;

        // A.4 fallback: direct interface termination
        if (devId == null && t.termination_id != null) {
          const model = rawModelFromType(t.termination_type);
          if (model === 'interface' || model === 'frontport' || model === 'rearport') {
            const ep = resolveEndpoint(`${model}:${t.termination_id}`, new Set());
            if (ep) devId = ep.deviceId;
          }
        }

        // A.5 fallback: parse the termination URL
        if (devId == null && typeof t.termination?.url === 'string') {
          const m = t.termination.url.match(/\/api\/dcim\/(interfaces|front-ports|rear-ports)\/(\d+)\/?/);
          if (m) {
            const map = { 'interfaces': 'interface', 'front-ports': 'frontport', 'rear-ports': 'rearport' };
            const ep = resolveEndpoint(`${map[m[1]]}:${m[2]}`, new Set());
            if (ep) devId = ep.deviceId;
          }
        }

        if (devId == null) return;

        const cid = (t.circuit && typeof t.circuit === 'object') ? t.circuit.id : t.circuit;
        if (cid == null) return;
        matchedCircuitIds.add(cid);
        addPair(cid, devId);
      });

      // Approach B — per cable that touches a circuit termination.
      // This catches the case where the terminations endpoint omits `cable`
      // or where the cable's terminations list is the only place the link
      // exists.
      (cables || []).forEach(c => {
        const ctId = circuitTerminationIdFromCable(c);
        if (ctId == null) return;
        const ct = ctById.get(ctId);
        if (!ct) return;
        const cid = (ct.circuit && typeof ct.circuit === 'object') ? ct.circuit.id : ct.circuit;
        if (cid == null) return;
        const devId = deviceIdFromCableOtherThanCircuit(c);
        if (devId == null) return;
        matchedCircuitIds.add(cid);
        addPair(cid, devId);
      });
    }

    // Materialize nodes + edges from the accumulated pairs
    circuitToDevices.forEach((devIds, cid) => {
      const circuitObj = circuitsById.get(cid);
      if (!circuitObj) return;

      const nodeId = `circuit:${cid}`;
      if (!circuitNodesById.has(nodeId)) {
        const cstat = statusColor(circuitObj.status);
        circuitNodesById.set(nodeId, {
          id: nodeId, isCircuit: true, circuit: circuitObj,
          label: circuitObj.cid || `Circuit #${cid}`,
          role: '__circuit__',
          color: cstat === C.textDim ? C.circuit : cstat,
          device: null,
        });
      }

      devIds.forEach(devId => {
        const edgeKey = `${cid}:${devId}`;
        if (seenCircuitEdges.has(edgeKey)) return;
        seenCircuitEdges.add(edgeKey);
        circuitEdges.push({
          id: `circuit-edge:${cid}:${devId}`,
          source: devId, target: nodeId, isCircuit: true,
          circuit: circuitObj,
          aIface: '', bIface: '',
        });
      });
    });

    if (circuits && circuits.length > 0) {
      // eslint-disable-next-line no-console
      console.info(`[circuits] graph: ${matchedCircuitIds.size}/${circuits.length} circuits anchored to a device; ${circuitEdges.length} edges`);
    }

    const edgeList = showCircuits ? [...cableEdges, ...circuitEdges] : cableEdges;

    const connectedIds = new Set();
    edgeList.forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });

    const nodeList = (filteredDevices || [])
    .filter(d => showIsolated || connectedIds.has(d.id))
    .map(d => ({
      id: d.id, device: d,
      label: d.name || `#${d.id}`,
      color: nodeColor(d),
               role: d.device_role?.name || d.role?.name || '',
    }));

    if (showCircuits) {
      for (const cn of circuitNodesById.values()) nodeList.push(cn);
    }

    const nodeIds = new Set(nodeList.map(n => n.id));
    const finalEdges = edgeList.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    const stillConnected = new Set();
    finalEdges.forEach(e => { stillConnected.add(e.source); stillConnected.add(e.target); });
    const finalNodes = nodeList.filter(n => !n.isCircuit || stillConnected.has(n.id));

    const orphanCount = Math.max(0, (circuits || []).length - matchedCircuitIds.size);

    return {
      nodes: finalNodes,
      edges: finalEdges,
      unresolvedCables: unresolved,
      matchedCircuits: matchedCircuitIds.size,
      orphanCircuits: orphanCount,
    };
  }, [filteredDevices, cables, interfaces, frontPorts, rearPorts, showIsolated, nodeColor, showCircuits, circuits, circuitTerminations]);

  const layout = useMemo(() => computeHierarchicalLayout(nodes, edges), [nodes, edges]);
  const { positions, tierMeta, graphMinX, graphMaxX } = layout;
  const posMap = useMemo(() => new Map(positions.map(p => [p.id, p])), [positions]);

  const neighborMap = useMemo(() => {
    const m = new Map();
    nodes.forEach(n => m.set(n.id, new Set()));
    edges.forEach(e => {
      m.get(e.source)?.add(e.target);
      m.get(e.target)?.add(e.source);
    });
    return m;
  }, [nodes, edges]);

  const legendEntries = useMemo(() => {
    if (colorMode === 'status') {
      const counts = { active: 0, offline: 0, planned: 0, other: 0 };
      nodes.forEach(n => {
        if (n.isCircuit) return;
        const v = (typeof n.device.status === 'object' ? n.device.status?.value : n.device.status || '').toLowerCase();
        if (v === 'active') counts.active++;
        else if (v === 'offline') counts.offline++;
        else if (v === 'planned') counts.planned++;
        else counts.other++;
      });
        const out = [];
        if (counts.active) out.push({ color: STATUS_COLOR.active, label: `active · ${counts.active}` });
        if (counts.offline) out.push({ color: STATUS_COLOR.offline, label: `offline · ${counts.offline}` });
        if (counts.planned) out.push({ color: STATUS_COLOR.planned, label: `planned · ${counts.planned}` });
        if (counts.other) out.push({ color: C.textDim, label: `other · ${counts.other}` });
        const circuitsShown = nodes.filter(n => n.isCircuit).length;
        if (circuitsShown) out.push({ color: C.circuit, label: `circuits · ${circuitsShown}` });
        return out;
    }
    if (colorMode === 'site') {
      const m = new Map();
      nodes.forEach(n => {
        if (n.isCircuit) return;
        const id = n.device.site?.id;
        const name = n.device.site?.name || 'No site';
        if (!m.has(id)) m.set(id, { name, color: colorForSite(id), count: 0 });
        m.get(id).count++;
      });
      return Array.from(m.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(x => ({ color: x.color, label: `${x.name} · ${x.count}` }));
    }
    const m = new Map();
    nodes.forEach(n => {
      if (n.isCircuit) return;
      const key = n.role || 'Unknown role';
      if (!m.has(key)) m.set(key, { color: colorForRole(n.role), count: 0 });
      m.get(key).count++;
    });
    return Array.from(m.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([name, v]) => ({ color: v.color, label: `${name} · ${v.count}` }));
  }, [colorMode, nodes]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scale = Math.exp(-e.deltaY * 0.0015);
      setView(v => {
        const nk = Math.max(0.15, Math.min(4, v.k * scale));
        const ratio = nk / v.k;
        return { k: nk, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    if (positions.length === 0) { setView({ x: 0, y: 0, k: 1 }); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    positions.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
      minX -= 90; maxX += 90;
      minY -= 90; maxY += 110;
      const bw = (maxX - minX);
      const bh = (maxY - minY);
      const rect = el.getBoundingClientRect();
      const k = Math.min(rect.width / bw, rect.height / bh, 1.4);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setView({ k, x: rect.width / 2 - cx * k, y: rect.height / 2 - cy * k });
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-node]')) return;
    setPanning({ startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y });
  };
  const onMouseMove = (e) => {
    if (!panning) return;
    setView(v => ({ ...v, x: panning.vx + (e.clientX - panning.startX), y: panning.vy + (e.clientY - panning.startY) }));
  };
  const onMouseUp = () => setPanning(null);

  const fitToContent = () => {
    const el = svgRef.current;
    if (!el || positions.length === 0) { setView({ x: 0, y: 0, k: 1 }); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    positions.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
      minX -= 90; maxX += 90; minY -= 90; maxY += 110;
      const bw = (maxX - minX);
      const bh = (maxY - minY);
      const rect = el.getBoundingClientRect();
      const k = Math.min(rect.width / bw, rect.height / bh, 1.4);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      setView({ k, x: rect.width / 2 - cx * k, y: rect.height / 2 - cy * k });
  };

  const zoomBy = (factor) => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2, my = rect.height / 2;
    setView(v => {
      const nk = Math.max(0.15, Math.min(4, v.k * factor));
      const ratio = nk / v.k;
      return { k: nk, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio };
    });
  };

  const hasData = nodes.length > 0;
  const activeHoverEdges = hoverId != null;

  const laneX1 = graphMinX;
  const laneX2 = graphMaxX;
  const laneW = laneX2 - laneX1;

  const selectStyle = {
    background: C.panelAlt,
    border: `1px solid ${C.borderLight}`,
    borderRadius: 6,
    padding: '4px 6px',
    color: C.textPrimary,
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
    cursor: 'pointer',
    maxWidth: 160,
  };

  const totalCircuitsLoaded = (circuits || []).length;

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '100%', background: C.bg }}>
    <svg
    ref={svgRef}
    width="100%"
    height="100%"
    onMouseDown={onMouseDown}
    onMouseMove={onMouseMove}
    onMouseUp={onMouseUp}
    onMouseLeave={onMouseUp}
    style={{ display: 'block', cursor: panning ? 'grabbing' : 'grab', userSelect: 'none' }}
    >
    <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.border} strokeWidth="0.5" opacity="0.35" />
    </pattern>
    <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.45" />
    </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />

    <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
    {showTierLanes && tierMeta.map((tm, i) => {
      const laneTop = tm.topY - 78;
      const laneBottom = tm.bottomY + 78;
      const laneHeight = laneBottom - laneTop;
      return (
        <g key={`lane-${i}`}>
        <rect
        x={laneX1} y={laneTop}
        width={laneW} height={laneHeight}
        rx={14}
        fill={`${tm.color}08`}
        stroke={`${tm.color}22`}
        strokeWidth={1}
        strokeDasharray="6 6"
        />
        <text
        x={laneX1 + 16} y={laneTop + 20}
        fill={tm.color}
        fontSize={11}
        fontWeight={700}
        fontFamily="'JetBrains Mono', monospace"
        letterSpacing={1.2}
        opacity={0.85}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
        {tm.label.toUpperCase()} · {tm.count}
        </text>
        </g>
      );
    })}

    {edges.map(e => {
      const a = posMap.get(e.source);
      const b = posMap.get(e.target);
      if (!a || !b) return null;
      const t = trimEdge(a, b, EDGE_MARGIN);
      const isHoverRelated = hoverId === e.source || hoverId === e.target;
      const isSelectedRelated = selectedId === e.source || selectedId === e.target;
      const highlighted = isHoverRelated || isSelectedRelated;
      const dim = activeHoverEdges && !isHoverRelated;
      const labelX = (t.x1 + t.x2) / 2;
      const labelY = (t.y1 + t.y2) / 2;
      const strokeColor = e.isCircuit
      ? (highlighted ? C.circuit : `${C.circuit}AA`)
      : (highlighted ? C.accent : C.borderLight);
      return (
        <g key={e.id}>
        <line
        x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
        stroke={strokeColor}
        strokeWidth={highlighted ? 2 : 1.2}
        opacity={dim ? 0.12 : highlighted ? 1 : (e.isCircuit ? 0.7 : 0.55)}
        strokeLinecap="round"
        strokeDasharray={e.isCircuit ? '5 4' : undefined}
        />
        {isHoverRelated && showLabels && (e.aIface || e.bIface) && (
          <g>
          <rect
          x={labelX - Math.max(((e.aIface.length + e.bIface.length + 3) * 3.2), 40)}
          y={labelY - 9}
          width={Math.max(((e.aIface.length + e.bIface.length + 3) * 6.4), 80)}
          height={18}
          rx={4}
          fill={C.bg}
          stroke={C.border}
          />
          <text
          x={labelX} y={labelY + 4}
          textAnchor="middle"
          fill={C.textSecondary}
          fontSize={10}
          fontFamily="'JetBrains Mono', monospace"
          style={{ pointerEvents: 'none' }}
          >
          {e.aIface} ↔ {e.bIface || '—'}
          </text>
          </g>
        )}
        </g>
      );
    })}

    {nodes.map(n => {
      const p = posMap.get(n.id);
      if (!p) return null;
      const isSelected = selectedId === n.id;
      const isHovered = hoverId === n.id;
      const isNeighbor = hoverId != null && neighborMap.get(hoverId)?.has(n.id);
      const dim = hoverId != null && !isHovered && !isNeighbor;
      const plateW = ICON + PLATE_PAD * 2;

      return (
        <g
        key={n.id}
        data-node
        transform={`translate(${p.x}, ${p.y})`}
        onClick={(ev) => {
          ev.stopPropagation();
          if (n.isCircuit) onSelectCircuit?.(n.circuit);
          else onSelectDevice(n.device);
        }}
        onMouseEnter={() => setHoverId(n.id)}
        onMouseLeave={() => setHoverId(null)}
        style={{ cursor: 'pointer' }}
        opacity={dim ? 0.2 : 1}
        >
        {isSelected && (
          <rect
          x={-plateW / 2 - 8} y={-plateW / 2 - 8}
          width={plateW + 16} height={plateW + 16}
          rx={12} fill="none"
          stroke={C.accent} strokeWidth={1.6}
          strokeDasharray="5 4" opacity={0.85}
          />
        )}

        <rect
        x={-plateW / 2} y={-plateW / 2}
        width={plateW} height={plateW}
        rx={10}
        fill={C.panel}
        stroke={n.color}
        strokeWidth={isHovered || isSelected ? 2.4 : 1.4}
        strokeDasharray={n.isCircuit ? '5 4' : undefined}
        filter="url(#nodeShadow)"
        />

        {n.isCircuit ? (
          <g transform={`translate(${-ICON / 2 + 2}, ${-ICON / 2 + 2})`}>
          <Cable size={ICON - 4} color={n.color} strokeWidth={1.8} />
          </g>
        ) : (
          <svg
          x={-ICON / 2} y={-ICON / 2}
          width={ICON} height={ICON}
          viewBox="0 0 64 64"
          overflow="visible"
          >
          <TopoRoleIconPath role={n.role} color={n.color} fill={C.panelAlt} />
          </svg>
        )}

        <text
        y={plateW / 2 + 14}
        textAnchor="middle"
        fill={isSelected || isHovered ? C.textPrimary : C.textSecondary}
        fontSize={11}
        fontWeight={isSelected ? 600 : 500}
        fontFamily="'JetBrains Mono', monospace"
        style={{ pointerEvents: 'none', userSelect: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.7)' }}
        >
        {n.label}
        </text>
        </g>
      );
    })}
    </g>
    </svg>

    <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
    <MapButton onClick={() => zoomBy(1.25)} title="Zoom in"><ZoomIn size={15} /></MapButton>
    <MapButton onClick={() => zoomBy(0.8)} title="Zoom out"><ZoomOut size={15} /></MapButton>
    <MapButton onClick={fitToContent} title="Fit to content"><Maximize2 size={15} /></MapButton>
    </div>

    <div style={{
      position: 'absolute', bottom: 14, left: 14,
      background: `${C.panel}E6`, backdropFilter: 'blur(6px)',
          border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8, minWidth: 320,
    }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
    <Mono style={{ fontSize: 11, color: C.textDim }}>SITE FILTER</Mono>
    <select
    value={siteFilter == null ? '' : String(siteFilter)}
    onChange={e => setSiteFilter(e.target.value === '' ? null : Number(e.target.value))}
    style={selectStyle}
    title="Show only devices from the selected site"
    >
    <option value="">All sites ({devices.length})</option>
    {sitesInData.map(s => (
      <option key={s.id} value={s.id}>{s.name}</option>
    ))}
    </select>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
    <Mono style={{ fontSize: 11, color: C.textDim }}>COLOR BY</Mono>
    <select
    value={colorMode}
    onChange={e => setColorMode(e.target.value)}
    style={selectStyle}
    title="Recolor nodes by status, site, or device role"
    >
    <option value="status">Status</option>
    <option value="site">Site</option>
    <option value="role">Device role</option>
    </select>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
    <Mono style={{ fontSize: 11, color: C.textDim }}>VIEW</Mono>
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
    <label
    title={
      totalCircuitsLoaded === 0
      ? 'No circuits loaded — your API token may lack Circuits permission'
  : `${matchedCircuits} of ${totalCircuitsLoaded} circuits anchored to visible devices${orphanCircuits ? ` — ${orphanCircuits} have no cable/interface we can reach a device through` : ''}`
    }
    style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: totalCircuitsLoaded === 0 ? C.textDim : C.textSecondary, cursor: 'pointer' }}>
    <input type="checkbox" checked={showCircuits} onChange={e => setShowCircuits(e.target.checked)} style={{ accentColor: C.circuit, cursor: 'pointer' }} />
    Circuits ({matchedCircuits}/{totalCircuitsLoaded})
    </label>
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSecondary, cursor: 'pointer' }}>
    <input type="checkbox" checked={showTierLanes} onChange={e => setShowTierLanes(e.target.checked)} style={{ accentColor: C.accent, cursor: 'pointer' }} />
    Lanes
    </label>
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSecondary, cursor: 'pointer' }}>
    <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} style={{ accentColor: C.accent, cursor: 'pointer' }} />
    Ifaces
    </label>
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textSecondary, cursor: 'pointer' }}>
    <input type="checkbox" checked={showIsolated} onChange={e => setShowIsolated(e.target.checked)} style={{ accentColor: C.accent, cursor: 'pointer' }} />
    Isolated
    </label>
    </div>
    </div>

    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
    <LegendItem color={C.accent} label={`${nodes.filter(n => !n.isCircuit).length} devices`} />
    <LegendItem color={C.borderLight} label={`${edges.filter(e => !e.isCircuit).length} links`} dashed />
    {unresolvedCables > 0 && (
      <LegendItem color={C.warn} label={`${unresolvedCables} unresolved`} />
    )}
    {showCircuits && edges.some(e => e.isCircuit) && (
      <LegendItem color={C.circuit} label={`${nodes.filter(n => n.isCircuit).length} circuits`} dashed />
    )}
    </div>
    {legendEntries.length > 0 && (
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 2, borderTop: `1px solid ${C.border}` }}>
      {legendEntries.map((x, i) => (
        <LegendItem key={i} color={x.color} label={x.label} />
      ))}
      </div>
    )}
    </div>

    {!hasData && (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ textAlign: 'center', color: C.textDim, fontSize: 13 }}>
      <Waypoints size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
      <div>No devices to display.</div>
      <div style={{ fontSize: 11.5, marginTop: 4 }}>Adjust the site filter or toggle "Isolated" to include unlinked devices.</div>
      </div>
      </div>
    )}
    </div>
  );
}

function MapButton({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title}
    style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${C.panel}E6`, backdropFilter: 'blur(6px)', border: `1px solid ${C.border}`, borderRadius: 6, color: C.textSecondary, cursor: 'pointer' }}
    onMouseEnter={e => { e.currentTarget.style.color = C.accent; e.currentTarget.style.borderColor = C.accentDim; }}
    onMouseLeave={e => { e.currentTarget.style.color = C.textSecondary; e.currentTarget.style.borderColor = C.border; }}>
    {children}
    </button>
  );
}
function LegendItem({ color, label, dashed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <div style={{ width: 14, height: 2, background: dashed ? 'transparent' : color, borderTop: dashed ? `2px dashed ${color}` : 'none' }} />
    <span style={{ fontSize: 11, color: C.textSecondary, fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
    </div>
  );
}

// ---------- IPAM / NOC graph ----------
function ipAddressWithoutPrefix(value) {
  if (!value) return '';
  return String(value).split('/')[0];
}

function ipStatusValue(status) {
  return String(typeof status === 'object' ? status?.value : (status || '')).toLowerCase();
}

function ipFamily(value) {
  return ipAddressWithoutPrefix(value).includes(':') ? 6 : 4;
}

function parseIpNumber(value) {
  const raw = ipAddressWithoutPrefix(value);
  const family = ipFamily(raw);
  try {
    if (family === 4) {
      const parts = raw.split('.');
      if (parts.length !== 4 || parts.some(x => !/^\d+$/.test(x) || Number(x) > 255)) return null;
      return { family, value: parts.reduce((n, x) => (n << 8n) + BigInt(Number(x)), 0n) };
    }
    const expanded = raw.includes('::')
    ? (() => {
      const [left, right] = raw.split('::');
      const l = left ? left.split(':').filter(Boolean) : [];
      const r = right ? right.split(':').filter(Boolean) : [];
      return [...l, ...Array(Math.max(0, 8 - l.length - r.length)).fill('0'), ...r];
    })()
    : raw.split(':');
    if (expanded.length !== 8) return null;
    const value128 = expanded.reduce((n, part) => (n << 16n) + BigInt(parseInt(part || '0', 16)), 0n);
    return { family, value: value128 };
  } catch (e) {
    return null;
  }
}

function prefixContainsAddress(prefix, address) {
  if (!prefix || !address) return false;
  const [base, lenRaw] = String(prefix).split('/');
  const len = Number(lenRaw);
  const a = parseIpNumber(address);
  const b = parseIpNumber(base);
  if (!a || !b || a.family !== b.family || !Number.isInteger(len)) return false;
  const bits = a.family === 4 ? 32 : 128;
  if (len < 0 || len > bits) return false;
  const shift = BigInt(bits - len);
  return (a.value >> shift) === (b.value >> shift);
}

function ipDisplay(ip) {
  return ip?.address || ip?.display || '—';
}

function resolveAssignedDeviceId(ip, interfaceById) {
  const assigned = ip?.assigned_object;
  if (!assigned) return null;
  const directDevice = assigned.device?.id ?? (typeof assigned.device === 'number' ? assigned.device : null);
  if (directDevice != null) return directDevice;
  const ifaceId = assigned.id;
  if (ifaceId != null && interfaceById.has(ifaceId)) {
    const iface = interfaceById.get(ifaceId);
    return iface.device?.id ?? (typeof iface.device === 'number' ? iface.device : null);
  }
  return null;
}

function deriveDeviceIpMap(devices, ipAddresses, interfaces) {
  const interfaceById = new Map((interfaces || []).map(i => [i.id, i]));
  const byDevice = new Map();
  const ipById = new Map((ipAddresses || []).map(ip => [ip.id, ip]));

  (devices || []).forEach(d => {
    const arr = [];
    if (d.primary_ip?.id != null) {
      const full = ipById.get(d.primary_ip.id);
      arr.push(full || d.primary_ip);
    } else if (d.primary_ip?.address) {
      const candidate = (ipAddresses || []).find(ip => ip.address === d.primary_ip.address);
      arr.push(candidate || d.primary_ip);
    }
    byDevice.set(d.id, arr.filter(Boolean));
  });

  (ipAddresses || []).forEach(ip => {
    const did = resolveAssignedDeviceId(ip, interfaceById);
    if (did == null) return;
    if (!byDevice.has(did)) byDevice.set(did, []);
    const arr = byDevice.get(did);
    if (!arr.some(x => x.id != null && x.id === ip.id)) arr.push(ip);
  });

    return { byDevice, ipById };
}

function formatRangeCount(start, end) {
  const a = parseIpNumber(start);
  const b = parseIpNumber(end);
  if (!a || !b || a.family !== b.family || b.value < a.value) return '—';
  const count = b.value - a.value + 1n;
  if (count > 1000000000n) return `${(Number(count / 1000000n) / 1000).toFixed(1)}B`;
  if (count > 1000000n) return `${(Number(count / 1000000n)).toFixed(1)}M`;
  if (count > 1000n) return `${(Number(count / 1000n)).toFixed(1)}K`;
  return count.toString();
}

function IPGraph({
  devices, interfaces, cables, ipAddresses, prefixes, ipRanges, sites,
  onSelectDevice,
}) {
  const svgRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [panning, setPanning] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [selectedPrefix, setSelectedPrefix] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showReserved, setShowReserved] = useState(true);
  const [showRanges, setShowRanges] = useState(true);
  const [showNat, setShowNat] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const { byDevice, ipById } = useMemo(
    () => deriveDeviceIpMap(devices, ipAddresses, interfaces),
                                       [devices, ipAddresses, interfaces]
  );

  const subnetList = useMemo(() => {
    return (prefixes || []).slice().sort((a, b) =>
    String(a.prefix || '').localeCompare(String(b.prefix || ''), undefined, { numeric: true })
    );
  }, [prefixes]);

  const reservedIps = useMemo(() => (ipAddresses || []).filter(ip => ipStatusValue(ip.status) === 'reserved'), [ipAddresses]);
  const natPairs = useMemo(() => {
    const pairs = [];
    const seen = new Set();
    (ipAddresses || []).forEach(ip => {
      const insideId = ip?.nat_inside?.id;
      if (insideId == null) return;
      const key = `${insideId}:${ip.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ inside: ipById.get(insideId), outside: ip });
    });
    return pairs.filter(p => p.inside || p.outside);
  }, [ipAddresses, ipById]);

  const { nodes, edges, natEdges, visiblePrefixes, visibleRanges } = useMemo(() => {
    const deviceById = new Map((devices || []).map(d => [d.id, d]));
    const matchingPrefix = selectedPrefix ? (prefixes || []).find(p => String(p.id) === selectedPrefix) : null;
    const prefixMatches = (ip) => !matchingPrefix || prefixContainsAddress(matchingPrefix.prefix, ip?.address);
    const siteMatches = d => !siteFilter || String(d.site?.id || '') === siteFilter;

    const physical = [];
    const seen = new Set();
    (cables || []).forEach(c => {
      const sides = [
        ...(c.a_terminations || []).map(t => t.object),
                           ...(c.b_terminations || []).map(t => t.object),
      ].filter(Boolean);
      const ids = [];
      sides.forEach(obj => {
        const did = obj.device?.id;
        if (did != null && !ids.includes(did)) ids.push(did);
      });
        if (ids.length < 2) return;
        const pair = [Math.min(ids[0], ids[1]), Math.max(ids[0], ids[1])];
      const key = pair.join(':');
      if (seen.has(key)) return;
      seen.add(key);
      physical.push({ id: `ip-link:${key}`, source: pair[0], target: pair[1], cable: c });
    });

    const finalNodes = [];
    const visibleDeviceIds = new Set();
    (devices || []).forEach(d => {
      const ips = byDevice.get(d.id) || [];
      const primary = d.primary_ip?.address || ips[0]?.address || '';
      const status = ipStatusValue(d.status);
      const statusOk = statusFilter === 'all' || status === statusFilter;
      const prefixOk = prefixMatches(primary ? { address: primary } : null);
      const include = siteMatches(d) && statusOk && (selectedPrefix ? prefixOk : true);
      if (!include) return;
      visibleDeviceIds.add(d.id);
      finalNodes.push({
        id: d.id,
        device: d,
        primaryIp: primary,
        allIps: ips,
        reservedCount: ips.filter(ip => ipStatusValue(ip.status) === 'reserved').length,
                      natCount: ips.filter(ip => ip.nat_inside?.id != null || (ip.nat_outside || []).length > 0).length,
                      label: d.name || `#${d.id}`,
                      role: d.device_role?.name || d.role?.name || '',
                      color: statusColor(d.status),
      });
    });

    const finalEdges = physical.filter(e => visibleDeviceIds.has(e.source) && visibleDeviceIds.has(e.target));

    const rangeVisible = (ipRanges || []).filter(r => {
      if (!selectedPrefix) return true;
      return prefixContainsAddress(matchingPrefix?.prefix, r.start_address) ||
      prefixContainsAddress(matchingPrefix?.prefix, r.end_address);
    });
    const prefixVisible = (prefixes || []).filter(p => !selectedPrefix || p.id === Number(selectedPrefix));

    const nEdges = [];
    if (showNat) {
      natPairs.forEach(({ inside, outside }) => {
        const insideDid = inside ? resolveAssignedDeviceId(inside, new Map((interfaces || []).map(i => [i.id, i]))) : null;
        const outsideDid = outside ? resolveAssignedDeviceId(outside, new Map((interfaces || []).map(i => [i.id, i]))) : null;
        const source = insideDid != null ? insideDid : outsideDid;
        const target = insideDid != null && outsideDid != null ? outsideDid : null;
        if (source != null && target != null && visibleDeviceIds.has(source) && visibleDeviceIds.has(target)) {
          nEdges.push({ id: `nat:${inside.id}:${outside.id}`, source, target, inside, outside, isNat: true });
        }
      });
    }

    return {
      nodes: finalNodes,
      edges: finalEdges,
      natEdges: nEdges,
      visiblePrefixes: prefixVisible,
      visibleRanges: rangeVisible,
    };
  }, [devices, cables, prefixes, ipRanges, byDevice, selectedPrefix, siteFilter, statusFilter, showNat, natPairs, interfaces]);

  const posMap = useMemo(() => {
    const map = new Map();
    const ordered = nodes.slice().sort((a, b) => {
      const sa = a.device.site?.name || '';
      const sb = b.device.site?.name || '';
      return sa.localeCompare(sb) || String(a.primaryIp).localeCompare(String(b.primaryIp), undefined, { numeric: true });
    });
    const cols = Math.max(1, Math.ceil(Math.sqrt(ordered.length || 1)));
    ordered.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      map.set(n.id, { x: (col - (cols - 1) / 2) * 220, y: row * 150 });
    });
    const rows = Math.ceil(ordered.length / cols);
    const offsetY = ((rows - 1) * 150) / 2;
    map.forEach(p => { p.y -= offsetY; });
    return map;
  }, [nodes]);

  const neighborMap = useMemo(() => {
    const m = new Map(nodes.map(n => [n.id, new Set()]));
    [...edges, ...natEdges].forEach(e => {
      m.get(e.source)?.add(e.target);
      m.get(e.target)?.add(e.source);
    });
    return m;
  }, [nodes, edges, natEdges]);

  const fitToContent = useCallback(() => {
    const el = svgRef.current;
    if (!el || posMap.size === 0) {
      setView({ x: 0, y: 0, k: 1 });
      return;
    }
    const ps = Array.from(posMap.values());
    const minX = Math.min(...ps.map(p => p.x)) - 150;
    const maxX = Math.max(...ps.map(p => p.x)) + 150;
    const minY = Math.min(...ps.map(p => p.y)) - 110;
    const maxY = Math.max(...ps.map(p => p.y)) + 130;
    const rect = el.getBoundingClientRect();
    const k = Math.max(0.15, Math.min(1.5, Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY))));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({ x: rect.width / 2 - cx * k, y: rect.height / 2 - cy * k, k });
  }, [posMap]);

  useEffect(() => { fitToContent(); }, [fitToContent]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = e => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const nk = Math.max(0.15, Math.min(4, view.k * Math.exp(-e.deltaY * 0.0015)));
      const ratio = nk / view.k;
      setView(v => ({ k: nk, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio }));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [view.k]);

  const onMouseDown = e => {
    if (e.button !== 0 || e.target.closest('[data-node]')) return;
    setPanning({ x: e.clientX, y: e.clientY, vx: view.x, vy: view.y });
  };
  const onMouseMove = e => {
    if (!panning) return;
    setView(v => ({ ...v, x: panning.vx + e.clientX - panning.x, y: panning.vy + e.clientY - panning.y }));
  };

  const zoomBy = factor => {
    const el = svgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = rect.width / 2, my = rect.height / 2;
    setView(v => {
      const nk = Math.max(0.15, Math.min(4, v.k * factor));
      const ratio = nk / v.k;
      return { k: nk, x: mx - (mx - v.x) * ratio, y: my - (my - v.y) * ratio };
    });
  };

  const nodePositions = nodeId => posMap.get(nodeId);
  const deviceCount = nodes.length;
  const primaryCount = nodes.filter(n => !!n.primaryIp).length;
  const natCount = natPairs.length;
  const reservedCount = reservedIps.length;
  const rangeCount = visibleRanges.length;

  const nodeWidth = 190;
  const nodeHeight = 76;

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '100%', background: C.bg }}>
    <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 3, display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'none' }}>
    <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: `${C.panel}F2`, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 10px', backdropFilter: 'blur(8px)' }}>
    <Globe2 size={15} color={C.accent} />
    <div>
    <div style={{ fontSize: 12.5, fontWeight: 600 }}>IPAM / NOC Graph</div>
    <div style={{ fontSize: 10.5, color: C.textDim }}>
    {deviceCount} devices · {primaryCount} primary IPs · {edges.length} links
    {showNat ? ` · ${natCount} NAT relations` : ''}
    </div>
    </div>
    </div>
    <div style={{ marginLeft: 'auto', pointerEvents: 'auto', display: 'flex', gap: 5 }}>
    <MapButton onClick={() => zoomBy(1.25)} title="Zoom in"><ZoomIn size={15} /></MapButton>
    <MapButton onClick={() => zoomBy(0.8)} title="Zoom out"><ZoomOut size={15} /></MapButton>
    <MapButton onClick={fitToContent} title="Fit graph"><Maximize2 size={15} /></MapButton>
    </div>
    </div>

    <svg ref={svgRef} width="100%" height="100%"
    onMouseDown={onMouseDown}
    onMouseMove={onMouseMove}
    onMouseUp={() => setPanning(null)}
    onMouseLeave={() => setPanning(null)}
    style={{ display: 'block', cursor: panning ? 'grabbing' : 'grab', userSelect: 'none' }}>
    <defs>
    <pattern id="ip-grid" width="40" height="40" patternUnits="userSpaceOnUse">
    <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.border} strokeWidth="0.5" opacity="0.35" />
    </pattern>
    <filter id="ip-node-shadow" x="-50%" y="-50%" width="200%" height="200%">
    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.5" />
    </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#ip-grid)" />
    <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
    {edges.map(e => {
      const a = nodePositions(e.source), b = nodePositions(e.target);
      if (!a || !b) return null;
      const related = hoverId === e.source || hoverId === e.target;
      return (
        <g key={e.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={related ? C.accent : C.borderLight}
        strokeWidth={related ? 2.5 : 1.4}
        opacity={hoverId && !related ? 0.15 : 0.62}
        strokeLinecap="round" />
        {showLabels && related && (
          <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6}
          textAnchor="middle" fill={C.textDim} fontSize="9.5" fontFamily="'JetBrains Mono', monospace">
          LINK
          </text>
        )}
        </g>
      );
    })}
    {natEdges.map(e => {
      const a = nodePositions(e.source), b = nodePositions(e.target);
      if (!a || !b) return null;
      const related = hoverId === e.source || hoverId === e.target;
      return (
        <g key={e.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={C.warn} strokeWidth={related ? 2.6 : 1.5}
        strokeDasharray="6 5" opacity={hoverId && !related ? 0.08 : 0.72} />
        {showLabels && (
          <g style={{ pointerEvents: 'none' }}>
          <rect x={(a.x + b.x) / 2 - 28} y={(a.y + b.y) / 2 - 20} width="56" height="16" rx="4" fill={C.bg} stroke={`${C.warn}55`} />
          <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 8} textAnchor="middle" fill={C.warn} fontSize="9" fontFamily="'JetBrains Mono', monospace">NAT</text>
          </g>
        )}
        </g>
      );
    })}

    {nodes.map(n => {
      const p = nodePositions(n.id);
      if (!p) return null;
      const selected = selectedPrefix && n.primaryIp && prefixContainsAddress(visiblePrefixes[0]?.prefix, n.primaryIp);
      const hovered = hoverId === n.id;
      const dim = hoverId && !hovered && !neighborMap.get(hoverId)?.has(n.id);
      const reserved = n.reservedCount > 0;
      return (
        <g key={n.id} data-node transform={`translate(${p.x},${p.y})`}
        onClick={e => { e.stopPropagation(); onSelectDevice?.(n.device); }}
        onMouseEnter={() => setHoverId(n.id)}
        onMouseLeave={() => setHoverId(null)}
        style={{ cursor: 'pointer' }} opacity={dim ? 0.18 : 1}>
        <rect x={-nodeWidth / 2} y={-nodeHeight / 2} width={nodeWidth} height={nodeHeight}
        rx="10" fill={C.panel} stroke={hovered ? C.accent : n.color} strokeWidth={hovered ? 2.4 : 1.4}
        filter="url(#ip-node-shadow)" />
        <line x1={-nodeWidth / 2} y1={-nodeHeight / 2} x2={-nodeWidth / 2} y2={nodeHeight / 2} stroke={n.color} strokeWidth="4" />
        <foreignObject x={-nodeWidth / 2 + 13} y={-nodeHeight / 2 + 9} width={nodeWidth - 24} height={nodeHeight - 16}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{ fontFamily: "'Inter', sans-serif", color: C.textPrimary }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <DeviceIcon role={n.role} size={13} color={n.color} />
        <div style={{ fontSize: 11.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.label}</div>
        {reserved && showReserved && <span style={{ width: 6, height: 6, borderRadius: 6, background: C.warn, boxShadow: `0 0 5px ${C.warn}88` }} />}
        </div>
        <div style={{ marginTop: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: n.primaryIp ? C.accent : C.textDim }}>
        {n.primaryIp || 'NO PRIMARY IP'}
        </div>
        <div style={{ marginTop: 4, display: 'flex', gap: 5, alignItems: 'center', fontSize: 9.5, color: C.textDim }}>
        <span>{n.allIps.length} IP{n.allIps.length === 1 ? '' : 's'}</span>
        {reserved && showReserved && <span>· {n.reservedCount} reserved</span>}
        {showNat && n.natCount > 0 && <span>· {n.natCount} NAT</span>}
        </div>
        </div>
        </foreignObject>
        </g>
      );
    })}
    </g>
    </svg>

    <div style={{ position: 'absolute', left: 12, bottom: 12, width: 340, maxHeight: 'calc(100% - 92px)', overflowY: 'auto', background: `${C.panel}F2`, backdropFilter: 'blur(8px)', border: `1px solid ${C.border}`, borderRadius: 9, padding: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
    <Filter size={13} color={C.accent} />
    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>NOC FILTERS</span>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
    <select value={selectedPrefix} onChange={e => setSelectedPrefix(e.target.value)} style={{ ...ipFilterSelect, gridColumn: '1 / -1' }} title="Filter devices by primary IP subnet">
    <option value="">All subnets ({subnetList.length})</option>
    {subnetList.map(p => (
      <option key={p.id} value={p.id}>{p.prefix}{p.description ? ` · ${p.description}` : ''}</option>
    ))}
    </select>
    <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)} style={ipFilterSelect}>
    <option value="">All sites</option>
    {(sites || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={ipFilterSelect}>
    <option value="all">Any device status</option>
    <option value="active">Active</option>
    <option value="offline">Offline</option>
    <option value="planned">Planned</option>
    <option value="staged">Staged</option>
    </select>
    </div>

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
    <label style={ipToggleLabel}><input type="checkbox" checked={showReserved} onChange={e => setShowReserved(e.target.checked)} /> Reserved</label>
    <label style={ipToggleLabel}><input type="checkbox" checked={showRanges} onChange={e => setShowRanges(e.target.checked)} /> IP ranges</label>
    <label style={ipToggleLabel}><input type="checkbox" checked={showNat} onChange={e => setShowNat(e.target.checked)} /> NAT links</label>
    <label style={ipToggleLabel}><input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} /> Labels</label>
    </div>

    <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
    <MiniMetric label="Primary IPs" value={primaryCount} color={C.accent} />
    <MiniMetric label="Reserved" value={showReserved ? reservedCount : 0} color={C.warn} />
    <MiniMetric label="NAT" value={showNat ? natCount : 0} color={C.warn} />
    <MiniMetric label="Ranges" value={showRanges ? rangeCount : 0} color={C.circuit} />
    </div>

    {selectedPrefix && visiblePrefixes[0] && (
      <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <SectionLabel>SELECTED SUBNET</SectionLabel>
      <Mono style={{ display: 'block', fontSize: 12.5, color: C.accent }}>{visiblePrefixes[0].prefix}</Mono>
      <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 4 }}>
      {visiblePrefixes[0].status?.label || visiblePrefixes[0].status || 'Unknown'} · {visiblePrefixes[0].role?.name || 'No role'}
      {visiblePrefixes[0].vrf?.name ? ` · VRF ${visiblePrefixes[0].vrf.name}` : ''}
      </div>
      </div>
    )}

    {showReserved && reservedIps.length > 0 && (
      <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <SectionLabel>RESERVED IP ADDRESSES ({reservedCount})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {reservedIps.slice(0, 14).map(ip => (
        <div key={ip.id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 5, padding: '6px 7px' }}>
        <Circle size={7} color={C.warn} fill={C.warn} />
        <Mono style={{ fontSize: 10.5, color: C.warn, flex: 1 }}>{ipDisplay(ip)}</Mono>
        {ip.dns_name && <span style={{ fontSize: 9.5, color: C.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 115 }}>{ip.dns_name}</span>}
        </div>
      ))}
      </div>
      {reservedCount > 14 && <div style={{ fontSize: 9.5, color: C.textDim, marginTop: 5 }}>+ {reservedCount - 14} more</div>}
      </div>
    )}

    {showRanges && visibleRanges.length > 0 && (
      <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <SectionLabel>IP RANGES ({visibleRanges.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {visibleRanges.slice(0, 10).map(r => (
        <div key={r.id} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 5, padding: '7px 8px' }}>
        <Mono style={{ display: 'block', fontSize: 10.5, color: C.circuit }}>{r.start_address} → {r.end_address}</Mono>
        <div style={{ display: 'flex', gap: 7, marginTop: 3, fontSize: 9.5, color: C.textDim }}>
        <span>{formatRangeCount(r.start_address, r.end_address)} addresses</span>
        {r.description && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</span>}
        </div>
        </div>
      ))}
      </div>
      </div>
    )}

    {showNat && natPairs.length > 0 && (
      <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <SectionLabel>NAT RELATIONSHIPS ({natPairs.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {natPairs.slice(0, 12).map(({ inside, outside }) => (
        <div key={`${inside?.id}:${outside?.id}`} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 5, padding: '7px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Mono style={{ fontSize: 10.5, color: C.accent, flex: 1 }}>{ipDisplay(inside)}</Mono>
        <ArrowRightLeft size={11} color={C.warn} />
        <Mono style={{ fontSize: 10.5, color: C.warn, flex: 1, textAlign: 'right' }}>{ipDisplay(outside)}</Mono>
        </div>
        </div>
      ))}
      </div>
      </div>
    )}

    <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
    <LegendItem color={C.accent} label="Primary IP" />
    <LegendItem color={C.warn} label="NAT / reserved" dashed />
    <LegendItem color={C.borderLight} label="Physical link" />
    </div>
    </div>

    {nodes.length === 0 && (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ textAlign: 'center', color: C.textDim, fontSize: 13 }}>
      <Database size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
      <div>No devices match the current IP filter.</div>
      <div style={{ fontSize: 11.5, marginTop: 4 }}>Check the subnet, site, or status filter.</div>
      </div>
      </div>
    )}
    </div>
  );
}

const ipFilterSelect = {
  width: '100%',
  background: C.panelAlt,
  border: `1px solid ${C.borderLight}`,
  borderRadius: 6,
  padding: '6px 7px',
  color: C.textPrimary,
  fontSize: 10.5,
  fontFamily: "'JetBrains Mono', monospace",
  outline: 'none',
};

const ipToggleLabel = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 10.5,
  color: C.textSecondary,
  cursor: 'pointer',
};

function MiniMetric({ label, value, color }) {
  return (
    <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 5, padding: '6px 8px' }}>
    <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    <div style={{ fontSize: 9.5, color: C.textDim }}>{label}</div>
    </div>
  );
}

// ---------- Rack elevation ----------
function RackElevation({ rack, devices, onSelectDevice, selectedId }) {
  const height = rack.u_height || 42;
  const unitH = 20;
  const totalH = height * unitH;

  const occupied = useMemo(() => {
    const map = {};
    devices.forEach(d => {
      if (d.position == null) return;
      const devH = d.device_type?.u_height ?? 1;
      for (let i = 0; i < devH; i++) map[d.position + i] = { device: d, isTop: i === 0, span: devH };
    });
    return map;
  }, [devices]);

  const rows = [];
  for (let u = height; u >= 1; u--) {
    const occ = occupied[u];
    if (occ && occ.isTop) {
      const col = statusColor(occ.device.status);
      const selected = selectedId === occ.device.id;
      rows.push(
        <div key={u} onClick={() => onSelectDevice(occ.device)}
        style={{ position: 'absolute', top: (height - u - occ.span + 1) * unitH, left: 0, right: 0, height: occ.span * unitH - 2, margin: '1px 0', background: selected ? `${col}22` : C.panelAlt, border: `1px solid ${selected ? col : C.borderLight}`, borderLeft: `3px solid ${col}`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 7, padding: '0 8px', cursor: 'pointer', overflow: 'hidden' }}>
        <DeviceIcon role={occ.device.device_role?.name || occ.device.role?.name} size={12} color={col} />
        <span style={{ fontSize: 11.5, color: C.textPrimary, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{occ.device.name || `#${occ.device.id}`}</span>
        <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{occ.span}U</span>
        </div>
      );
    } else if (!occ) {
      rows.push(
        <div key={u} style={{ position: 'absolute', top: (height - u) * unitH, left: 0, right: 0, height: unitH - 2, margin: '1px 0', borderTop: `1px dashed ${C.border}`, display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 8.5, color: C.textDim, marginLeft: 4, fontFamily: "'JetBrains Mono', monospace" }}>{u}</span>
        </div>
      );
    }
  }

  return (
    <div style={{ marginBottom: 28 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary }}>{rack.name}</span>
    <Badge color={C.textSecondary}>{devices.length} device{devices.length !== 1 ? 's' : ''}</Badge>
    </div>
    <span style={{ fontSize: 11, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{height}U</span>
    </div>
    <div style={{ position: 'relative', height: totalH, background: '#0C1119', border: `1px solid ${C.border}`, borderRadius: 6, padding: 3 }}>
    <div style={{ position: 'relative', height: '100%' }}>{rows}</div>
    </div>
    </div>
  );
}

// ---------- Device detail panel ----------
function DeviceDetail({ device, interfaces, ips, cables, onClose, loading }) {
  if (!device) return null;
  const col = statusColor(device.status);
  return (
    <div style={{ width: 380, flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.border}`, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: C.panel, zIndex: 2 }}>
    <div style={{ minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
    <DeviceIcon role={device.device_role?.name || device.role?.name} size={14} color={col} />
    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>{device.name || `Device #${device.id}`}</span>
    </div>
    <div style={{ fontSize: 12, color: C.textSecondary }}>{device.device_type?.display || device.device_type?.model} · {device.device_role?.name || device.role?.name}</div>
    </div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: 4, flexShrink: 0 }}><X size={17} /></button>
    </div>
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <Badge color={col}><StatusDot status={device.status} size={6} /> &nbsp;{statusLabel(device.status)}</Badge>
    {device.site?.name && <Badge color={C.textSecondary}><MapPin size={10} style={{ verticalAlign: -1.5 }} /> {device.site.name}</Badge>}
    {device.rack?.name && <Badge color={C.textSecondary}>Rack {device.rack.name}{device.position != null ? ` · U${device.position}` : ''}</Badge>}
    </div>
    {device.primary_ip?.address && (<div><SectionLabel>Primary IP</SectionLabel><Mono style={{ fontSize: 13, color: C.accent }}>{device.primary_ip.address}</Mono></div>)}
    {device.serial && (<div><SectionLabel>Serial</SectionLabel><Mono style={{ fontSize: 12.5, color: C.textPrimary }}>{device.serial}</Mono></div>)}
    {device.manufacturer?.name && (<div><SectionLabel>Manufacturer</SectionLabel><span style={{ fontSize: 12.5, color: C.textPrimary }}>{device.manufacturer?.name || device.device_type?.manufacturer?.name}</span></div>)}
    <div>
    <SectionLabel>Interfaces {interfaces && `(${interfaces.length})`}</SectionLabel>
    {loading ? <div style={{ padding: '8px 0' }}><Spinner size={14} /></div> : (
      !interfaces || interfaces.length === 0 ? <EmptyNote text="No interfaces found" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {interfaces.map(iface => {
          const ifaceIps = (ips || []).filter(ip => ip.assigned_object_id === iface.id);
          const connected = !!iface.cable;
          return (
            <div key={iface.id} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {connected ? <Wifi size={11} color={C.accent} /> : <WifiOff size={11} color={C.textDim} />}
            <Mono style={{ fontSize: 12, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{iface.name}</Mono>
            </div>
            {iface.type?.label && <span style={{ fontSize: 10, color: C.textDim, flexShrink: 0 }}>{iface.type.label}</span>}
            </div>
            {iface.mac_address && <Mono style={{ fontSize: 10.5, color: C.textDim, display: 'block', marginTop: 3 }}>{iface.mac_address}</Mono>}
            {ifaceIps.map(ip => (<Mono key={ip.id} style={{ fontSize: 11, color: C.accent, display: 'block', marginTop: 3 }}>{ip.address}</Mono>))}
            </div>
          );
        })}
        </div>
      )
    )}
    </div>
    {cables && cables.length > 0 && (
      <div>
      <SectionLabel>Cables ({cables.length})</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {cables.map(c => (
        <div key={c.id} style={{ fontSize: 11, color: C.textSecondary, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Cable size={11} color={C.textDim} style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {c.a_terminations?.[0]?.object?.device?.name || c.a_terminations?.[0]?.object?.name} ({c.a_terminations?.[0]?.object?.name})
        {' → '}
        {c.b_terminations?.[0]?.object?.device?.name || c.b_terminations?.[0]?.object?.name} ({c.b_terminations?.[0]?.object?.name})
        </span>
        </div>
      ))}
      </div>
      </div>
    )}
    {device.comments && (<div><SectionLabel>Notes</SectionLabel><div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>{device.comments}</div></div>)}
    </div>
    </div>
  );
}

// ---------- Circuit detail panel ----------
function CircuitDetail({ circuit, terminations, devices, interfaces, onClose }) {
  if (!circuit) return null;
  const col = C.circuit;
  const provider = circuit.provider?.name || '—';
  const type = circuit.type?.name || '—';
  const status = circuit.status?.label || circuit.status?.value || circuit.status || '—';

  const devById = useMemo(() => new Map((devices || []).map(d => [d.id, d])), [devices]);
  const ifaceById = useMemo(() => new Map((interfaces || []).map(i => [i.id, i])), [interfaces]);

  const resolveTermination = (t) => {
    let devName = null;
    let ifaceName = t.termination?.name || t.termination?.object?.name || null;

    if (t.cable && typeof t.cable === 'object') {
      const sides = [t.cable.a_terminations?.[0], t.cable.b_terminations?.[0]].filter(Boolean);
      for (const side of sides) {
        if (side.object_type && String(side.object_type).toLowerCase().includes('circuittermination')) continue;
        if (side.object?.device?.name) { devName = side.object.device.name; }
        if (side.object?.name) ifaceName = side.object.name;
      }
    }

    if (!devName && t.termination?.device?.name) devName = t.termination.device.name;

    if (!devName && t.termination_id != null) {
      const iface = ifaceById.get(t.termination_id);
      if (iface) {
        ifaceName = iface.name;
        const did = iface.device?.id ?? (typeof iface.device === 'number' ? iface.device : null);
        if (did != null) devName = devById.get(did)?.name || `Device #${did}`;
      }
    }

    if (!devName && t.site?.name) devName = t.site.name;
    return { devName: devName || '—', ifaceName: ifaceName || '—' };
  };

  return (
    <div style={{ width: 380, flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.border}`, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'sticky', top: 0, background: C.panel, zIndex: 2 }}>
    <div style={{ minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
    <Cable size={14} color={col} />
    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>{circuit.cid || `Circuit #${circuit.id}`}</span>
    </div>
    <div style={{ fontSize: 12, color: C.textSecondary }}>{provider} · {type}</div>
    </div>
    <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', padding: 4, flexShrink: 0 }}><X size={17} /></button>
    </div>
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <Badge color={col}>{status}</Badge>
    {circuit.commit_rate != null && <Badge color={C.textSecondary}>{circuit.commit_rate} kbps</Badge>}
    </div>

    {circuit.description && (
      <div>
      <SectionLabel>Description</SectionLabel>
      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>{circuit.description}</div>
      </div>
    )}

    <div>
    <SectionLabel>Terminations {terminations && `(${terminations.length})`}</SectionLabel>
    {!terminations || terminations.length === 0 ? <EmptyNote text="No terminations found" /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {terminations.map(t => {
        const { devName, ifaceName } = resolveTermination(t);
        return (
          <div key={t.id} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <Mono style={{ fontSize: 11, color: col, fontWeight: 600 }}>SIDE {t.term_side || '—'}</Mono>
          {t.port_speed != null && <span style={{ fontSize: 10, color: C.textDim }}>{t.port_speed} kbps</span>}
          </div>
          <div style={{ fontSize: 12, color: C.textPrimary, fontFamily: "'JetBrains Mono', monospace" }}>{devName}</div>
          <div style={{ fontSize: 11, color: C.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{ifaceName}</div>
          {t.description && <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 4 }}>{t.description}</div>}
          </div>
        );
      })}
      </div>
    )}
    </div>
    </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6, fontWeight: 500 }}>{children}</div>;
}
function EmptyNote({ text }) {
  return <div style={{ fontSize: 11.5, color: C.textDim, fontStyle: 'italic' }}>{text}</div>;
}

// ---------- Sidebar ----------
function Sidebar({ sites, racksBySite, activeSiteId, activeRackId, onSelectSite, onSelectRack, counts, search, setSearch }) {
  const [expanded, setExpanded] = useState(() => new Set(sites.slice(0, 1).map(s => s.id)));
  const toggle = (id) => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const filtered = search
  ? sites.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (racksBySite[s.id] || []).some(r => r.name.toLowerCase().includes(search.toLowerCase())))
  : sites;
  return (
    <div style={{ width: 250, flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.border}`, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '14px 14px 10px' }}>
    <div style={{ position: 'relative' }}>
    <Search size={13} color={C.textDim} style={{ position: 'absolute', left: 9, top: 9 }} />
    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter sites, racks…"
    style={{ width: '100%', boxSizing: 'border-box', background: C.panelAlt, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: '7px 10px 7px 28px', color: C.textPrimary, fontSize: 12.5, outline: 'none' }} />
    </div>
    </div>
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
    <div onClick={() => onSelectSite(null)}
    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', marginBottom: 4, background: activeSiteId === null ? C.panelAlt : 'transparent', color: activeSiteId === null ? C.textPrimary : C.textSecondary, fontSize: 12.5, fontWeight: 500 }}>
    <Network size={13} /> All infrastructure
    <span style={{ marginLeft: 'auto', fontSize: 10.5, color: C.textDim }}>{counts.totalDevices}</span>
    </div>
    {filtered.map(site => {
      const racks = racksBySite[site.id] || [];
      const isExp = expanded.has(site.id);
      const isActiveSite = activeSiteId === site.id;
      return (
        <div key={site.id} style={{ marginBottom: 2 }}>
        <div onClick={() => { toggle(site.id); onSelectSite(site.id); }}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 8px', borderRadius: 6, cursor: 'pointer', background: isActiveSite && activeRackId === null ? C.panelAlt : 'transparent' }}>
        {isExp ? <ChevronDown size={12} color={C.textDim} /> : <ChevronRight size={12} color={C.textDim} />}
        <MapPin size={12} color={isActiveSite ? C.accent : C.textDim} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: isActiveSite ? C.textPrimary : C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{site.name}</span>
        <StatusDot status={site.status} size={6} />
        </div>
        {isExp && racks.map(rack => (
          <div key={rack.id} onClick={() => { onSelectSite(site.id); onSelectRack(rack.id); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 30px', borderRadius: 6, cursor: 'pointer', background: activeRackId === rack.id ? C.accentDim : 'transparent' }}>
          <span style={{ fontSize: 11.5, color: activeRackId === rack.id ? C.accent : C.textDim, fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rack.name}</span>
          </div>
        ))}
        {isExp && racks.length === 0 && (<div style={{ padding: '4px 8px 4px 30px', fontSize: 11, color: C.textDim, fontStyle: 'italic' }}>No racks</div>)}
        </div>
      );
    })}
    </div>
    </div>
  );
}

// ---------- Stat pill ----------
function StatPill({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', flex: 1, minWidth: 120 }}>
    <div style={{ width: 28, height: 28, borderRadius: 6, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
    <div>
    <div style={{ fontSize: 17, fontWeight: 700, color: C.textPrimary, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 10.5, color: C.textDim }}>{label}</div>
    </div>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [config, setConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [connError, setConnError] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const [sites, setSites] = useState([]);
  const [racks, setRacks] = useState([]);
  const [devices, setDevices] = useState([]);
  const [cables, setCables] = useState([]);
  const [interfacesAll, setInterfacesAll] = useState([]);
  const [ipAddresses, setIpAddresses] = useState([]);
  const [prefixes, setPrefixes] = useState([]);
  const [ipRanges, setIpRanges] = useState([]);
  const [frontPorts, setFrontPorts] = useState([]);
  const [rearPorts, setRearPorts] = useState([]);
  const [circuits, setCircuits] = useState([]);
  const [circuitTerminations, setCircuitTerminations] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  const [activeSiteId, setActiveSiteId] = useState(null);
  const [activeRackId, setActiveRackId] = useState(null);
  const [search, setSearch] = useState('');
  const [deviceSearch, setDeviceSearch] = useState('');
  const [viewMode, setViewMode] = useState('racks');

  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedIfaces, setSelectedIfaces] = useState(null);
  const [selectedIps, setSelectedIps] = useState(null);
  const [selectedCables, setSelectedCables] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedCircuit, setSelectedCircuit] = useState(null);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const nb = useNetBox(config?.url, config?.token);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get('netbox-config');
        if (result?.value) setConfig(JSON.parse(result.value));
      } catch (e) {}
      finally { setConfigLoaded(true); }
    })();
  }, []);

  const handleConnect = async (url, token) => {
    setConnecting(true); setConnError(null);
    try {
      const testUrl = `${url.replace(/\/$/, '')}/api/dcim/sites/?limit=1`;
      const res = await fetch(testUrl, { headers: { 'Authorization': `Token ${token}`, 'Accept': 'application/json' } });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) throw new Error('Authentication failed — check your API token and its permissions.');
        throw new Error(`Connection failed (${res.status} ${res.statusText})`);
      }
      await res.json();
      const cfg = { url: url.replace(/\/$/, ''), token };
      setConfig(cfg);
      try { await window.storage.set('netbox-config', JSON.stringify(cfg)); } catch (e) {}
    } catch (e) {
      if (e.message === 'Failed to fetch') setConnError('Could not reach that URL from the browser. Check the address, that NetBox is running, and that CORS is enabled for this origin.');
      else setConnError(e.message);
    } finally { setConnecting(false); }
  };

  const loadAll = useCallback(async () => {
    if (!config) return;
    setLoadingData(true); setLoadError(null);
    nb.clearCache();
    try {
      const [sitesData, racksData, devicesData, cablesData, ifacesData] = await Promise.all([
        nb.fetchAllPages('/api/dcim/sites/'),
                                                                                            nb.fetchAllPages('/api/dcim/racks/'),
                                                                                            nb.fetchAllPages('/api/dcim/devices/'),
                                                                                            nb.fetchAllPages('/api/dcim/cables/'),
                                                                                            nb.fetchAllPages('/api/dcim/interfaces/'),
      ]);
      setSites(sitesData);
      setRacks(racksData);
      setDevices(devicesData);
      setCables(cablesData);
      setInterfacesAll(ifacesData);

      try {
        const [ipData, prefixData, rangeData] = await Promise.all([
          nb.fetchAllPages('/api/ipam/ip-addresses/'),
                                                                  nb.fetchAllPages('/api/ipam/prefixes/'),
                                                                  nb.fetchAllPages('/api/ipam/ip-ranges/'),
        ]);
        setIpAddresses(ipData);
        setPrefixes(prefixData);
        setIpRanges(rangeData);
      } catch (e) {
        // IPAM is additive: a token without IPAM permission must not break the original UI.
        // eslint-disable-next-line no-console
        console.warn('[ipam] load failed:', e.message || e);
        setIpAddresses([]);
        setPrefixes([]);
        setIpRanges([]);
      }

      try {
        const [fpData, rpData] = await Promise.all([
          nb.fetchAllPages('/api/dcim/front-ports/'),
                                                   nb.fetchAllPages('/api/dcim/rear-ports/'),
        ]);
        setFrontPorts(fpData);
        setRearPorts(rpData);
      } catch (e) {
        setFrontPorts([]);
        setRearPorts([]);
      }

      try {
        const [circuitsData, terminationsData] = await Promise.all([
          nb.fetchAllPages('/api/circuits/circuits/'),
                                                                   nb.fetchAllPages('/api/circuits/circuit-terminations/'),
        ]);
        setCircuits(circuitsData);
        setCircuitTerminations(terminationsData);
        // eslint-disable-next-line no-console
        console.info(`[circuits] loaded ${circuitsData.length} circuits, ${terminationsData.length} terminations`);
        // Sample the first termination shape so we can see what fields are present
        if (terminationsData.length > 0) {
          // eslint-disable-next-line no-console
          console.info('[circuits] sample termination shape:', {
            id: terminationsData[0].id,
            termination_type: terminationsData[0].termination_type,
            termination_id: terminationsData[0].termination_id,
            cable: terminationsData[0].cable,
            has_nested_termination: !!terminationsData[0].termination,
            nested_termination_keys: terminationsData[0].termination ? Object.keys(terminationsData[0].termination) : null,
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[circuits] load failed:', e.message || e);
        setCircuits([]);
        setCircuitTerminations([]);
      }

      setLastSync(new Date());
    } catch (e) {
      setLoadError(e.message || 'Failed to load infrastructure data');
    } finally { setLoadingData(false); }
  }, [config, nb]);

  useEffect(() => { if (config) loadAll(); }, [config]);

  useEffect(() => {
    if (!autoRefresh || !config) return;
    const id = setInterval(loadAll, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, config, loadAll]);

  const racksBySite = useMemo(() => {
    const map = {};
    racks.forEach(r => { const sid = r.site?.id; if (!map[sid]) map[sid] = []; map[sid].push(r); });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [racks]);

  const devicesByRack = useMemo(() => {
    const map = {};
    devices.forEach(d => { const rid = d.rack?.id; if (rid == null) return; if (!map[rid]) map[rid] = []; map[rid].push(d); });
    return map;
  }, [devices]);

  const visibleRacks = useMemo(() => {
    let r = racks;
    if (activeRackId != null) r = r.filter(x => x.id === activeRackId);
    else if (activeSiteId != null) r = r.filter(x => x.site?.id === activeSiteId);
    return r.sort((a, b) => a.name.localeCompare(b.name));
  }, [racks, activeSiteId, activeRackId]);

  const unracked = useMemo(() => {
    let d = devices.filter(x => x.rack == null);
    if (activeSiteId != null) d = d.filter(x => x.site?.id === activeSiteId);
    if (deviceSearch) d = d.filter(x => (x.name || '').toLowerCase().includes(deviceSearch.toLowerCase()));
    return d;
  }, [devices, activeSiteId, deviceSearch]);

  const filteredVisibleRacks = useMemo(() => {
    if (!deviceSearch) return visibleRacks;
    return visibleRacks.filter(rack => {
      const devs = devicesByRack[rack.id] || [];
      return devs.some(d => (d.name || '').toLowerCase().includes(deviceSearch.toLowerCase())) ||
      rack.name.toLowerCase().includes(deviceSearch.toLowerCase());
    });
  }, [visibleRacks, devicesByRack, deviceSearch]);

  const counts = useMemo(() => {
    const active = devices.filter(d => (d.status?.value || d.status) === 'active').length;
    const offline = devices.filter(d => (d.status?.value || d.status) === 'offline').length;
    return { totalDevices: devices.length, totalRacks: racks.length, totalSites: sites.length, active, offline };
  }, [devices, racks, sites]);

  const selectedCircuitTerminations = useMemo(() => {
    if (!selectedCircuit) return [];
    return (circuitTerminations || []).filter(t => {
      const cid = (t.circuit && typeof t.circuit === 'object') ? t.circuit.id : t.circuit;
      return cid === selectedCircuit.id;
    });
  }, [selectedCircuit, circuitTerminations]);

  const handleSelectDevice = async (device) => {
    setSelectedDevice(device);
    setSelectedCircuit(null);
    setDetailLoading(true);
    setSelectedIfaces(null); setSelectedIps(null); setSelectedCables(null);
    try {
      const ifaces = await nb.fetchAllPages(`/api/dcim/interfaces/?device_id=${device.id}`);
      const ips = await nb.fetchAllPages(`/api/ipam/ip-addresses/?device_id=${device.id}`);
      let cables = [];
      try { cables = await nb.fetchAllPages(`/api/dcim/cables/?device_id=${device.id}`); } catch (e) {}
      setSelectedIfaces(ifaces); setSelectedIps(ips); setSelectedCables(cables);
    } catch (e) {
      setSelectedIfaces([]); setSelectedIps([]);
    } finally { setDetailLoading(false); }
  };

  const handleSelectCircuit = (circuit) => {
    setSelectedCircuit(circuit);
    setSelectedDevice(null);
  };

  if (!configLoaded) {
    return <div style={{ height: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner size={22} /></div>;
  }
  if (!config) {
    return (<><GlobalStyle /><ConnectionSetup onConnect={handleConnect} error={connError} connecting={connecting} /></>);
  }

  const combinedSelectedId = selectedDevice?.id ?? (selectedCircuit ? `circuit:${selectedCircuit.id}` : null);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.bg, display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden', color: C.textPrimary,
    }}>
    <GlobalStyle />

    <div style={{ height: 52, flexShrink: 0, borderBottom: `1px solid ${C.border}`, background: C.panel, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ width: 26, height: 26, borderRadius: 6, background: C.accentDim, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Network size={14} color={C.accent} />
    </div>
    <span style={{ fontSize: 13.5, fontWeight: 600 }}>Infrastructure Map</span>
    </div>

    <div style={{ display: 'flex', background: C.panelAlt, border: `1px solid ${C.borderLight}`, borderRadius: 7, padding: 2 }}>
    <ViewTab active={viewMode === 'racks'} onClick={() => setViewMode('racks')} icon={<Rows3 size={13} />} label="Racks" />
    <ViewTab active={viewMode === 'topology'} onClick={() => setViewMode('topology')} icon={<Waypoints size={13} />} label="Topology" />
    <ViewTab active={viewMode === 'ipgraph'} onClick={() => setViewMode('ipgraph')} icon={<Globe2 size={13} />} label="IP Graph" />
    </div>

    <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
    <Search size={13} color={C.textDim} style={{ position: 'absolute', left: 10, top: 9 }} />
    <input value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} placeholder="Search devices…"
    style={{ width: '100%', boxSizing: 'border-box', background: C.panelAlt, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: '7px 10px 7px 30px', color: C.textPrimary, fontSize: 12.5, outline: 'none' }} />
    </div>

    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
    {lastSync && <span style={{ fontSize: 11, color: C.textDim }}>Synced {lastSync.toLocaleTimeString()}</span>}
    <button onClick={() => setAutoRefresh(a => !a)} title="Auto-refresh every 30s"
    style={{ display: 'flex', alignItems: 'center', gap: 5, background: autoRefresh ? C.accentDim : 'transparent', border: `1px solid ${autoRefresh ? C.accent : C.borderLight}`, borderRadius: 6, padding: '6px 9px', color: autoRefresh ? C.accent : C.textSecondary, fontSize: 11.5, cursor: 'pointer' }}>
    <Zap size={12} /> Live
    </button>
    <button onClick={loadAll} disabled={loadingData}
    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: '6px 10px', color: C.textSecondary, fontSize: 11.5, cursor: 'pointer' }}>
    {loadingData ? <Spinner size={12} /> : <RefreshCw size={12} />} Refresh
    </button>
    <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', padding: 4 }}>
    <Settings size={16} />
    </button>
    </div>
    </div>

    <div style={{ display: 'flex', gap: 10, padding: '12px 16px', flexShrink: 0 }}>
    <StatPill icon={<MapPin size={13} color={C.accent} />} label="Sites" value={counts.totalSites} color={C.accent} />
    <StatPill icon={<Server size={13} color={C.warn} />} label="Racks" value={counts.totalRacks} color={C.warn} />
    <StatPill icon={<Circle size={13} color={C.accent} />} label="Total devices" value={counts.totalDevices} color={C.accent} />
    <StatPill icon={<CheckCircle2 size={13} color={C.accent} />} label="Active" value={counts.active} color={C.accent} />
    <StatPill icon={<AlertTriangle size={13} color={C.danger} />} label="Offline" value={counts.offline} color={C.danger} />
    <StatPill icon={<Cable size={13} color={C.circuit} />} label="Circuits" value={circuits.length} color={C.circuit} />
    </div>

    {loadError && (
      <div style={{ margin: '0 16px 12px', background: `${C.danger}15`, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: C.danger, display: 'flex', alignItems: 'center', gap: 8 }}>
      <AlertTriangle size={14} /> {loadError}
      </div>
    )}

    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
    <Sidebar
    sites={sites.sort((a, b) => a.name.localeCompare(b.name))}
    racksBySite={racksBySite}
    activeSiteId={activeSiteId}
    activeRackId={activeRackId}
    onSelectSite={(id) => { setActiveSiteId(id); setActiveRackId(null); }}
    onSelectRack={(id) => setActiveRackId(id)}
    counts={counts}
    search={search}
    setSearch={setSearch}
    />

    {viewMode === 'topology' ? (
      <TopologyMap
      devices={devices}
      cables={cables}
      interfaces={interfacesAll}
      frontPorts={frontPorts}
      rearPorts={rearPorts}
      circuits={circuits}
      circuitTerminations={circuitTerminations}
      selectedId={combinedSelectedId}
      onSelectDevice={handleSelectDevice}
      onSelectCircuit={handleSelectCircuit}
      />
    ) : viewMode === 'ipgraph' ? (
      <IPGraph
      devices={devices}
      interfaces={interfacesAll}
      cables={cables}
      ipAddresses={ipAddresses}
      prefixes={prefixes}
      ipRanges={ipRanges}
      sites={sites}
      onSelectDevice={handleSelectDevice}
      />
    ) : (
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', minWidth: 0 }}>
      {loadingData && devices.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textSecondary, fontSize: 13, marginTop: 40, justifyContent: 'center' }}>
        <Spinner size={18} /> Loading infrastructure…
        </div>
      ) : filteredVisibleRacks.length === 0 && unracked.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60, color: C.textDim, fontSize: 13 }}>
        No racks or devices match the current view.
        </div>
      ) : (
        <>
        {filteredVisibleRacks.map(rack => (
          <RackElevation key={rack.id} rack={rack} devices={devicesByRack[rack.id] || []} onSelectDevice={handleSelectDevice} selectedId={selectedDevice?.id} />
        ))}
        {unracked.length > 0 && (
          <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary, marginBottom: 10 }}>
          Unracked devices <Badge color={C.textSecondary}>{unracked.length}</Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {unracked.map(d => {
            const col = statusColor(d.status);
            const selected = selectedDevice?.id === d.id;
            return (
              <div key={d.id} onClick={() => handleSelectDevice(d)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: selected ? `${col}18` : C.panel, border: `1px solid ${selected ? col : C.border}`, borderLeft: `3px solid ${col}`, borderRadius: 6, cursor: 'pointer' }}>
              <DeviceIcon role={d.device_role?.name || d.role?.name} size={13} color={col} />
              <Mono style={{ fontSize: 12.5, color: C.textPrimary }}>{d.name || `#${d.id}`}</Mono>
              <span style={{ fontSize: 11, color: C.textDim }}>{d.device_type?.display}</span>
              {d.site?.name && <span style={{ fontSize: 11, color: C.textDim, marginLeft: 'auto' }}>{d.site.name}</span>}
              </div>
            );
          })}
          </div>
          </div>
        )}
        </>
      )}
      </div>
    )}

    {selectedDevice && (
      <DeviceDetail
      device={selectedDevice}
      interfaces={selectedIfaces}
      ips={selectedIps}
      cables={selectedCables}
      loading={detailLoading}
      onClose={() => setSelectedDevice(null)}
      />
    )}

    {selectedCircuit && (
      <CircuitDetail
      circuit={selectedCircuit}
      terminations={selectedCircuitTerminations}
      devices={devices}
      interfaces={interfacesAll}
      onClose={() => setSelectedCircuit(null)}
      />
    )}
    </div>

    {showSettings && (
      <SettingsModal
      config={config}
      onClose={() => setShowSettings(false)}
      onDisconnect={async () => {
        try { await window.storage.delete('netbox-config'); } catch (e) {}
        setConfig(null);
        setSites([]); setRacks([]); setDevices([]); setCables([]); setInterfacesAll([]);
        setFrontPorts([]); setRearPorts([]);
        setCircuits([]); setCircuitTerminations([]);
        setIpAddresses([]); setPrefixes([]); setIpRanges([]);
        setShowSettings(false);
      }}
      />
    )}
    </div>
  );
}

function ViewTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: active ? C.accentDim : 'transparent',
      border: 'none', borderRadius: 5, padding: '5px 10px',
      color: active ? C.accent : C.textSecondary,
      fontSize: 12, cursor: 'pointer', fontWeight: active ? 600 : 500,
      transition: 'background 0.15s, color 0.15s',
    }}>
    {icon} {label}
    </button>
  );
}

function SettingsModal({ config, onClose, onDisconnect }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ width: 380, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 22 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
    <span style={{ fontSize: 14.5, fontWeight: 600 }}>Connection</span>
    <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer' }}><X size={17} /></button>
    </div>
    <div style={{ marginBottom: 6 }}>
    <SectionLabel>NetBox URL</SectionLabel>
    <Mono style={{ fontSize: 12.5, color: C.textPrimary }}>{config.url}</Mono>
    </div>
    <div style={{ marginBottom: 20 }}>
    <SectionLabel>API Token</SectionLabel>
    <Mono style={{ fontSize: 12.5, color: C.textSecondary }}>{'•'.repeat(20)}</Mono>
    </div>
    <button onClick={onDisconnect}
    style={{ width: '100%', background: 'transparent', border: `1px solid ${C.danger}55`, color: C.danger, borderRadius: 7, padding: '10px 0', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
    Disconnect &amp; forget credentials
    </button>
    </div>
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #0A0E14;
      }
      #root, body > div:first-child {
      width: 100%;
      height: 100%;
      min-width: 100%;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      }
      #root > *, body > div:first-child > * {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      min-height: 0;
      }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      ::-webkit-scrollbar { width: 9px; height: 9px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #2A3644; border-radius: 5px; }
      ::-webkit-scrollbar-thumb:hover { background: #3A4657; }
      input::placeholder { color: #5A6576; }
      select option { background: #141B25; color: #E4E8ED; }
      `}</style>
  );
}
