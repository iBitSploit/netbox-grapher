import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Cable, CheckCircle2, Circle, Globe2, MapPin, Network, RefreshCw, Rows3, Server, Settings as SettingsIcon, Zap } from 'lucide-react'
import { useNetBox } from './lib/netboxApi'
import { apiPath, env } from './config/env'
import GlobalStyle from './app/GlobalStyle'
import { colors, roleName, statusColor, statusValue } from './app/theme'
import { Badge, Spinner } from './app/ui'
import ConnectionSetup from './features/connection/ConnectionSetup'
import { DeviceDetail, CircuitDetail } from './features/details/DetailPanel'
import { IpGraph, TopologyMap } from './features/graphs/GraphViews'
import Sidebar from './features/navigation/Sidebar'
import RackElevation from './features/racks/RackElevation'

const emptyData = { sites: [], racks: [], devices: [], cables: [], interfaces: [], ipAddresses: [], prefixes: [], ipRanges: [], circuits: [], circuitTerminations: [] }

export default function App() {
  const [config, setConfig] = useState(readStoredConfig)
  const configLoaded = true
  const [connectionError, setConnectionError] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [view, setView] = useState(env.defaultView)
  const [siteId, setSiteId] = useState(null)
  const [rackId, setRackId] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [selectedCircuit, setSelectedCircuit] = useState(null)
  const [details, setDetails] = useState({ interfaces: null, ips: null, cables: null, loading: false })
  const [live, setLive] = useState(env.autoRefresh)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { fetchAllPages, clearCache } = useNetBox(config?.url, config?.token)

  const connect = async (url, token) => {
    setConnecting(true); setConnectionError(null)
    try {
      await requestFromUrl(`${url.replace(/\/$/, '')}${apiPath('/dcim/sites/?limit=1')}`, token)
      const next = { url: url.replace(/\/$/, ''), token }
      localStorage.setItem(env.storageKey, JSON.stringify(next)); setConfig(next)
    } catch (error) { setConnectionError(error.message || 'Unable to connect to NetBox') } finally { setConnecting(false) }
  }

  const loadAll = useCallback(async () => {
    if (!config) return
    setLoading(true); setLoadError(null); clearCache()
    try {
      const [sites, racks, devices, cables, interfaces] = await Promise.all(['/dcim/sites/', '/dcim/racks/', '/dcim/devices/', '/dcim/cables/', '/dcim/interfaces/'].map(path => fetchAllPages(apiPath(path))))
      const optional = async paths => { try { return await Promise.all(paths.map(path => fetchAllPages(path))) } catch { return paths.map(() => []) } }
      const [ipAddresses, prefixes, ipRanges] = await optional(['/ipam/ip-addresses/', '/ipam/prefixes/', '/ipam/ip-ranges/'].map(apiPath))
      const [frontPorts, rearPorts] = await optional(['/dcim/front-ports/', '/dcim/rear-ports/'].map(apiPath))
      const [circuits, circuitTerminations] = env.enableCircuits ? await optional(['/circuits/circuits/', '/circuits/circuit-terminations/'].map(apiPath)) : [[], []]
      setData({ sites, racks, devices, cables, interfaces, ipAddresses, prefixes, ipRanges, frontPorts, rearPorts, circuits, circuitTerminations }); setLastSync(new Date())
    } catch (error) { setLoadError(error.message || 'Failed to load infrastructure data') } finally { setLoading(false) }
  }, [clearCache, config, fetchAllPages])

  // Loading is an intentional synchronization with the selected NetBox instance.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (config) void loadAll() }, [config, loadAll])
  useEffect(() => { if (!live || !config) return undefined; const timer = setInterval(loadAll, env.refreshIntervalMs); return () => clearInterval(timer) }, [config, live, loadAll])

  const selectDevice = async device => {
    setSelectedDevice(device); setSelectedCircuit(null); setDetails({ interfaces: null, ips: null, cables: null, loading: true })
    try {
      const [interfaces, ips, cables] = await Promise.all([fetchAllPages(apiPath(`/dcim/interfaces/?device_id=${device.id}`)), fetchAllPages(apiPath(`/ipam/ip-addresses/?device_id=${device.id}`)), fetchAllPages(apiPath(`/dcim/cables/?device_id=${device.id}`))])
      setDetails({ interfaces, ips, cables, loading: false })
    } catch { setDetails({ interfaces: [], ips: [], cables: [], loading: false }) }
  }

  const racksBySite = useMemo(() => groupBy(data.racks, rack => rack.site?.id), [data.racks])
  const devicesByRack = useMemo(() => groupBy(data.devices, device => device.rack?.id), [data.devices])
  const visibleRacks = useMemo(() => data.racks.filter(rack => (rackId == null || rack.id === rackId) && (siteId == null || rack.site?.id === siteId) && (!search || rack.name.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name)), [data.racks, rackId, search, siteId])
  const unracked = useMemo(() => data.devices.filter(device => !device.rack && (siteId == null || device.site?.id === siteId) && (!search || device.name?.toLowerCase().includes(search.toLowerCase()))), [data.devices, search, siteId])
  const selectedTerminations = useMemo(() => data.circuitTerminations.filter(term => (term.circuit?.id || term.circuit) === selectedCircuit?.id), [data.circuitTerminations, selectedCircuit])
  const counts = useMemo(() => ({ sites: data.sites.length, racks: data.racks.length, devices: data.devices.length, active: data.devices.filter(d => statusValue(d.status) === 'active').length, offline: data.devices.filter(d => statusValue(d.status) === 'offline').length, circuits: data.circuits.length }), [data])

  if (!configLoaded) return <><GlobalStyle /><div style={centerStyle}><Spinner size={22} /></div></>
  if (!config) return <><GlobalStyle /><ConnectionSetup initial={config} onConnect={connect} error={connectionError} connecting={connecting} /></>

  return <><GlobalStyle /><div style={shellStyle}><Header view={view} setView={setView} live={live} setLive={setLive} loading={loading} loadAll={loadAll} lastSync={lastSync} onSettings={() => setSettingsOpen(true)} /><Stats counts={counts} />{loadError && <div style={errorStyle}><AlertTriangle size={14} />{loadError}</div>}<div style={{ display: 'flex', flex: 1, minHeight: 0 }}><Sidebar sites={data.sites} racksBySite={racksBySite} activeSiteId={siteId} activeRackId={rackId} onSelectSite={id => { setSiteId(id); setRackId(null) }} onSelectRack={setRackId} totalDevices={data.devices.length} search={search} setSearch={setSearch} />{view === 'topology' ? <TopologyMap devices={data.devices} cables={data.cables} interfaces={data.interfaces} frontPorts={data.frontPorts} rearPorts={data.rearPorts} circuits={data.circuits} circuitTerminations={data.circuitTerminations} selectedId={selectedDevice?.id ?? (selectedCircuit ? `circuit:${selectedCircuit.id}` : null)} onSelectDevice={selectDevice} onSelectCircuit={circuit => { setSelectedCircuit(circuit); setSelectedDevice(null) }} /> : view === 'ipgraph' && env.enableIpGraph ? <IpGraph devices={data.devices} interfaces={data.interfaces} cables={data.cables} ipAddresses={data.ipAddresses} prefixes={data.prefixes} ipRanges={data.ipRanges} sites={data.sites} onSelectDevice={selectDevice} /> : <RackView racks={visibleRacks} devicesByRack={devicesByRack} unracked={unracked} selectedId={selectedDevice?.id} onSelectDevice={selectDevice} />}{selectedDevice && <DeviceDetail device={selectedDevice} {...details} onClose={() => setSelectedDevice(null)} />}{selectedCircuit && <CircuitDetail circuit={selectedCircuit} terminations={selectedTerminations} onClose={() => setSelectedCircuit(null)} />}</div>{settingsOpen && <Settings onClose={() => setSettingsOpen(false)} onDisconnect={() => { localStorage.removeItem(env.storageKey); setConfig(null); setData(emptyData); setSettingsOpen(false) }} />}</div></>
}

async function requestFromUrl(url, token) { const response = await fetch(url, { headers: { Authorization: `Token ${token}`, Accept: 'application/json' } }); if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Authentication failed' : `${response.status} ${response.statusText}`); return response.json() }
function readStoredConfig() { try { return JSON.parse(localStorage.getItem(env.storageKey) || 'null') || (env.netboxUrl ? { url: env.netboxUrl, token: env.netboxToken } : null) } catch { return env.netboxUrl ? { url: env.netboxUrl, token: env.netboxToken } : null } }
function groupBy(items, key) { return items.reduce((groups, item) => { const value = key(item); if (value != null) (groups[value] ||= []).push(item); return groups }, {}) }
function RackView({ racks, devicesByRack, unracked, selectedId, onSelectDevice }) { return <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{racks.map(rack => <RackElevation key={rack.id} rack={rack} devices={devicesByRack[rack.id] || []} selectedId={selectedId} onSelectDevice={onSelectDevice} />)}{unracked.length > 0 && <><h3>Unracked devices <Badge>{unracked.length}</Badge></h3>{unracked.map(device => <button type="button" key={device.id} onClick={() => onSelectDevice(device)} style={deviceRowStyle(statusColor(device.status))}>{device.name} <span>{roleName(device)}</span></button>)}</>}</main> }
function Header({ view, setView, live, setLive, loading, loadAll, lastSync, onSettings }) { const tabs = [['racks', <Rows3 size={13} />, 'Racks'], ['topology', <Network size={13} />, 'Topology'], ['ipgraph', <Globe2 size={13} />, 'IP Graph']]; return <header style={headerStyle}><strong><Network size={15} color={colors.accent} /> {env.appName}</strong><nav>{tabs.map(([id, icon, label]) => <button type="button" key={id} onClick={() => setView(id)} style={tabStyle(view === id)}>{icon}{label}</button>)}</nav><div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>{lastSync && <span style={{ color: colors.textDim, fontSize: 11 }}>{lastSync.toLocaleTimeString()}</span>}<button type="button" onClick={() => setLive(value => !value)} style={tabStyle(live)}><Zap size={12} />Live</button><button type="button" onClick={loadAll} disabled={loading} style={plainButton}>{loading ? <Spinner size={12} /> : <RefreshCw size={12} />} Refresh</button><button type="button" onClick={onSettings} style={plainButton}><SettingsIcon size={15} /></button></div></header> }
function Stats({ counts }) { const metrics = [['Sites', counts.sites, MapPin, colors.accent], ['Racks', counts.racks, Server, colors.warn], ['Devices', counts.devices, Circle, colors.accent], ['Active', counts.active, CheckCircle2, colors.accent], ['Offline', counts.offline, AlertTriangle, colors.danger], ['Circuits', counts.circuits, Cable, colors.circuit]]; return <div style={{ display: 'flex', gap: 10, padding: '12px 16px' }}>{metrics.map(([label, value, Icon, color]) => <div key={label} style={metricStyle}><Icon size={14} color={color} /><div><strong>{value}</strong><small>{label}</small></div></div>)}</div> }
function Settings({ onClose, onDisconnect }) { return <div style={modalBackdrop} onClick={onClose}><div style={modalStyle} onClick={event => event.stopPropagation()}><h3>Connection settings</h3><button type="button" onClick={onDisconnect} style={{ ...plainButton, color: colors.danger, border: `1px solid ${colors.danger}55`, width: '100%' }}>Disconnect and forget credentials</button></div></div> }
const centerStyle = { height: '100%', display: 'grid', placeItems: 'center', background: colors.bg }
const shellStyle = { height: '100%', display: 'flex', flexDirection: 'column', background: colors.bg, color: colors.textPrimary, fontFamily: "Inter, sans-serif" }
const headerStyle = { height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', borderBottom: `1px solid ${colors.border}`, background: colors.panel }
const tabStyle = active => ({ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 5, padding: '6px 9px', background: active ? colors.accentDim : 'transparent', color: active ? colors.accent : colors.textSecondary, cursor: 'pointer', fontSize: 11.5 })
const plainButton = { display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${colors.borderLight}`, borderRadius: 6, padding: '6px 9px', background: 'transparent', color: colors.textSecondary, cursor: 'pointer' }
const metricStyle = { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 100, padding: '9px 12px', background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 8 }
const errorStyle = { margin: '0 16px 12px', padding: 10, display: 'flex', gap: 8, color: colors.danger, background: `${colors.danger}15`, border: `1px solid ${colors.danger}44`, borderRadius: 8, fontSize: 12 }
const deviceRowStyle = color => ({ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: 5, padding: 10, color: colors.textPrimary, background: colors.panel, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${color}`, borderRadius: 6, cursor: 'pointer', textAlign: 'left' })
const modalBackdrop = { position: 'fixed', inset: 0, zIndex: 10, display: 'grid', placeItems: 'center', background: '#0009' }
const modalStyle = { width: 360, padding: 22, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10 }
