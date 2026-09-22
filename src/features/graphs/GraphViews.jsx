import { useMemo, useRef, useState } from 'react'
import { Cable, Globe2, Maximize2, Network, ZoomIn, ZoomOut } from 'lucide-react'
import { colors, roleName, statusColor, statusValue } from '../../app/theme'
import { Mono, SectionLabel } from '../../app/ui'

const buttonStyle = { width: 32, height: 32, display: 'grid', placeItems: 'center', background: `${colors.panel}E8`, border: `1px solid ${colors.border}`, borderRadius: 6, color: colors.textSecondary, cursor: 'pointer' }
const selectStyle = { background: colors.panelAlt, border: `1px solid ${colors.borderLight}`, borderRadius: 6, color: colors.textPrimary, padding: '5px 7px', fontSize: 11, maxWidth: 150 }
const tiers = ['Circuits / Uplinks', 'Edge / Firewall', 'Routers', 'Switches', 'Devices']
const tierColors = [colors.circuit, colors.danger, colors.warn, colors.accent, colors.textSecondary]

function modelName(value) {
  if (!value) return ''
  const raw = typeof value === 'string' ? value : value.model || value.model_name || value.label || value.name || value.url || ''
  return String(raw).split(/[/.]/).pop().toLowerCase()
}

function terminationKind(term) {
  const model = modelName(term?.object_type) || (term?.object?.device ? 'interface' : '')
  return ['interface', 'frontport', 'rearport', 'circuittermination'].includes(model) ? model : model ? 'other' : null
}

function tierFor(role) {
  const value = String(role || '').toLowerCase()
  if (value === '__circuit__') return 0
  if (/firewall|security|wan|internet|isp|cloud|edge|perimeter|dmz/.test(value)) return 1
  if (/router|gateway/.test(value)) return 2
  if (/switch|network|load.*balanc|\blb\b/.test(value)) return 3
  return 4
}

function TopoRoleIconPath({ role, color, fill = 'transparent' }) {
  const value = String(role || '').toLowerCase()
  const strokeWidth = 2.2
  if (/router|gateway|edge/.test(value)) return <g><circle cx="32" cy="32" r="24" fill={fill} stroke={color} strokeWidth={strokeWidth} /><path d="M32 14v12m-6-6 6-6 6 6M32 50V38m-6 6 6 6 6-6M14 32h12m-6-6-6 6 6 6M50 32H38m6-6 6 6-6 6" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /><circle cx="32" cy="32" r="3" fill={color} /></g>
  if (/switch|network/.test(value)) return <g><rect x="6" y="18" width="52" height="28" rx="4" fill={fill} stroke={color} strokeWidth={strokeWidth} /><path d="M22 24v16m-5-11 5-5 5 5m15-5v16m-5-5 5 5 5-5" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /><circle cx="32" cy="32" r="2.2" fill={color} /></g>
  if (/firewall|security/.test(value)) return <g><rect x="8" y="14" width="48" height="36" rx="3" fill={fill} stroke={color} strokeWidth={strokeWidth} /><path d="M8 26h48M8 38h48M24 14v12m16-12v12M16 26v12m16-12v12m16-12v12M24 38v12m16-12v12" stroke={color} strokeWidth="1.5" /></g>
  if (/storage|disk|san|nas/.test(value)) return <g><ellipse cx="32" cy="16" rx="20" ry="6" fill={fill} stroke={color} strokeWidth={strokeWidth} /><path d="M12 16v32m40-32v32" stroke={color} strokeWidth={strokeWidth} /><ellipse cx="32" cy="48" rx="20" ry="6" fill={fill} stroke={color} strokeWidth={strokeWidth} /><ellipse cx="32" cy="30" rx="20" ry="6" fill="none" stroke={color} opacity=".55" /></g>
  if (/wireless|wifi|\bap\b|wlan/.test(value)) return <g><circle cx="32" cy="46" r="4.5" fill={color} /><path d="M20 38a18 18 0 0 1 24 0M14 32a26 26 0 0 1 36 0M8 26a34 34 0 0 1 48 0" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" /></g>
  if (/cloud|wan|internet|isp/.test(value)) return <path d="M18 44a10 10 0 0 1 0-20 12 12 0 0 1 24-2 10 10 0 0 1 4 22Z" fill={fill} stroke={color} strokeWidth={strokeWidth} />
  return <g><rect x="14" y="10" width="36" height="44" rx="3" fill={fill} stroke={color} strokeWidth={strokeWidth} /><path d="M14 22h36M14 34h36M14 46h36" stroke={color} strokeWidth="1.7" /><circle cx="20" cy="16" r="1.6" fill={color} /><circle cx="20" cy="28" r="1.6" fill={color} /><circle cx="20" cy="40" r="1.6" fill={color} /></g>
}

function resolveTopology(devices, cables, interfaces, frontPorts, rearPorts, circuits, circuitTerminations, showCircuits) {
  const ifaceToDevice = new Map((interfaces || []).map(item => [item.id, item.device?.id ?? item.device]))
  const ifaceById = new Map((interfaces || []).map(item => [item.id, item]))
  const frontById = new Map((frontPorts || []).map(item => [item.id, item]))
  const frontByRear = new Map()
  ;(frontPorts || []).forEach(port => { const rearId = port.rear_port?.id ?? port.rear_port; if (rearId != null) frontByRear.set(rearId, [...(frontByRear.get(rearId) || []), port.id]) })
  const cableByTerm = new Map()
  const keyFor = term => { const kind = terminationKind(term); return kind && term?.object_id != null ? `${kind}:${term.object_id}` : null }
  ;(cables || []).forEach(cable => { const sides = [cable.a_terminations?.[0], cable.b_terminations?.[0]]; const keys = sides.map(keyFor); keys.forEach(key => key && cableByTerm.set(key, { cable, keys })) })

  const resolve = (key, visited = new Set()) => {
    if (!key || visited.has(key)) return null
    const nextVisited = new Set(visited).add(key)
    if (key.startsWith('interface:')) return ifaceToDevice.get(Number(key.slice(10))) ? { deviceId: ifaceToDevice.get(Number(key.slice(10))) } : null
    const [kind, rawId] = key.split(':')
    const id = Number(rawId)
    if (kind === 'frontport') {
      const rearId = frontById.get(id)?.rear_port?.id ?? frontById.get(id)?.rear_port
      const linked = rearId != null ? cableByTerm.get(`rearport:${rearId}`) : null
      return linked ? resolve(linked.keys.find(item => item !== `rearport:${rearId}`), nextVisited) : null
    }
    if (kind === 'rearport') {
      const frontId = frontByRear.get(id)?.[0]
      const linked = frontId != null ? cableByTerm.get(`frontport:${frontId}`) : null
      return linked ? resolve(linked.keys.find(item => item !== `frontport:${frontId}`), nextVisited) : null
    }
    return null
  }

  const edges = []
  const seenPairs = new Set()
  let unresolved = 0
  ;(cables || []).forEach(cable => {
    const a = cable.a_terminations?.[0]
    const b = cable.b_terminations?.[0]
    if (terminationKind(a) === 'circuittermination' || terminationKind(b) === 'circuittermination') return
    const aKey = keyFor(a); const bKey = keyFor(b)
    const source = resolve(aKey, new Set([bKey])); const target = resolve(bKey, new Set([aKey]))
    if (!source || !target) { unresolved += 1; return }
    if (source.deviceId === target.deviceId) return
    const pair = [source.deviceId, target.deviceId].sort((x, y) => x - y).join(':')
    if (seenPairs.has(pair)) return
    seenPairs.add(pair)
    edges.push({ id: `cable:${cable.id}`, source: source.deviceId, target: target.deviceId, aIface: aKey?.startsWith('interface:') ? ifaceById.get(Number(aKey.slice(10)))?.name : '', bIface: bKey?.startsWith('interface:') ? ifaceById.get(Number(bKey.slice(10)))?.name : '' })
  })

  const nodes = devices.map(device => ({ id: device.id, device, label: device.name || `#${device.id}`, role: roleName(device), color: statusColor(device.status) }))
  if (showCircuits) {
    const circuitById = new Map((circuits || []).map(circuit => [circuit.id, circuit]))
    const circuitDevices = new Map()
    ;(circuitTerminations || []).forEach(term => {
      const circuitId = term.circuit?.id ?? term.circuit
      let deviceId = term.termination?.device?.id ?? term.termination?.device
      if (deviceId == null && term.cable && typeof term.cable === 'object') {
        const sides = [...(term.cable.a_terminations || []), ...(term.cable.b_terminations || [])]
        const endpoint = sides.find(side => terminationKind(side) !== 'circuittermination')
        const endpointKey = keyFor(endpoint)
        deviceId = resolve(endpointKey)?.deviceId
      }
      if (deviceId == null) {
        const cableEntry = cableByTerm.get(`circuittermination:${term.id}`)
        if (cableEntry) {
          const endpoint = cableEntry.keys.find(key => key !== `circuittermination:${term.id}`)
          deviceId = resolve(endpoint)?.deviceId
        }
      }
      if (deviceId == null && term.termination_id != null) {
        const kind = modelName(term.termination_type)
        if (['interface', 'frontport', 'rearport'].includes(kind)) deviceId = resolve(`${kind}:${term.termination_id}`)?.deviceId
      }
      if (circuitId != null && deviceId != null) circuitDevices.set(circuitId, [...(circuitDevices.get(circuitId) || []), deviceId])
    })
    circuitDevices.forEach((deviceIds, circuitId) => {
      const circuit = circuitById.get(circuitId)
      if (!circuit) return
      const nodeId = `circuit:${circuitId}`
      nodes.push({ id: nodeId, isCircuit: true, circuit, label: circuit.cid || `Circuit #${circuitId}`, role: '__circuit__', color: colors.circuit })
      ;[...new Set(deviceIds)].forEach(deviceId => edges.push({ id: `circuit-edge:${circuitId}:${deviceId}`, source: deviceId, target: nodeId, isCircuit: true }))
    })
  }
  return { nodes, edges, unresolved }
}

function layoutTopology(nodes) {
  const groups = tiers.map(() => [])
  nodes.forEach(node => groups[tierFor(node.role)].push(node))
  groups.forEach(group => group.sort((a, b) => a.label.localeCompare(b.label)))
  const positions = new Map()
  let y = 100
  groups.forEach((group, tier) => { if (!group.length) return; const width = Math.max(0, (group.length - 1) * 145); group.forEach((node, index) => positions.set(node.id, { x: 500 - width / 2 + index * 145, y, tier })); y += 135 })
  return positions
}

export function TopologyMap({ devices = [], cables = [], interfaces = [], frontPorts = [], rearPorts = [], circuits = [], circuitTerminations = [], selectedId, onSelectDevice, onSelectCircuit }) {
  const svgRef = useRef(null)
  const [site, setSite] = useState('')
  const [showIsolated, setShowIsolated] = useState(false)
  const [showLabels, setShowLabels] = useState(true)
  const [showLanes, setShowLanes] = useState(true)
  const [showCircuits, setShowCircuits] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(null)
  const [hovered, setHovered] = useState(null)
  const graph = useMemo(() => resolveTopology(devices, cables, interfaces, frontPorts, rearPorts, circuits, circuitTerminations, showCircuits), [devices, cables, interfaces, frontPorts, rearPorts, circuits, circuitTerminations, showCircuits])
  const visibleNodes = useMemo(() => { const connected = new Set(graph.edges.flatMap(edge => [edge.source, edge.target])); return graph.nodes.filter(node => (node.isCircuit || !site || String(node.device.site?.id) === site) && (showIsolated || node.isCircuit || connected.has(node.id))) }, [graph, site, showIsolated])
  const visibleIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes])
  const visibleEdges = useMemo(() => graph.edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target)), [graph.edges, visibleIds])
  const positions = useMemo(() => layoutTopology(visibleNodes), [visibleNodes])
  const sites = useMemo(() => [...new Map(devices.filter(device => device.site).map(device => [device.site.id, device.site])).values()], [devices])
  const onMouseDown = event => { if (event.button === 0) setPanning({ x: event.clientX, y: event.clientY, pan }) }
  const onMouseMove = event => { if (panning) setPan({ x: panning.pan.x + event.clientX - panning.x, y: panning.pan.y + event.clientY - panning.y }) }
  return <GraphCanvas title="Topology" icon={<Network size={15} color={colors.accent} />} setZoom={setZoom} svgRef={svgRef} controls={<><select value={site} onChange={event => setSite(event.target.value)} style={selectStyle}><option value="">All sites ({devices.length})</option>{sites.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><label><input type="checkbox" checked={showCircuits} onChange={event => setShowCircuits(event.target.checked)} /> Circuits</label><label><input type="checkbox" checked={showLanes} onChange={event => setShowLanes(event.target.checked)} /> Lanes</label><label><input type="checkbox" checked={showLabels} onChange={event => setShowLabels(event.target.checked)} /> Ifaces</label><label><input type="checkbox" checked={showIsolated} onChange={event => setShowIsolated(event.target.checked)} /> Isolated</label></>}>
    <svg viewBox="0 0 1000 760" width="100%" height="100%" role="img" aria-label="Network topology" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={() => setPanning(null)} onMouseLeave={() => setPanning(null)} style={{ cursor: panning ? 'grabbing' : 'grab' }}><g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>{showLanes && tiers.map((label, tier) => { const tierNodes = visibleNodes.filter(node => tierFor(node.role) === tier); if (!tierNodes.length) return null; const ys = [...positions.values()].filter(position => position.tier === tier).map(position => position.y); return <g key={label}><rect x="40" y={Math.min(...ys) - 55} width="920" height="110" rx="12" fill={`${tierColors[tier]}08`} stroke={`${tierColors[tier]}33`} strokeDasharray="6 6" /><text x="55" y={Math.min(...ys) - 35} fill={tierColors[tier]} fontSize="11" fontWeight="700">{label.toUpperCase()} · {tierNodes.length}</text></g> })}{visibleEdges.map(edge => { const a = positions.get(edge.source); const b = positions.get(edge.target); if (!a || !b) return null; const related = hovered === edge.source || hovered === edge.target; return <g key={edge.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={edge.isCircuit ? colors.circuit : related ? colors.accent : colors.borderLight} strokeWidth={related ? 2.5 : 1.5} strokeDasharray={edge.isCircuit ? '6 5' : undefined} opacity={hovered && !related ? 0.16 : 0.8} />{showLabels && related && (edge.aIface || edge.bIface) && <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7} textAnchor="middle" fill={colors.textSecondary} fontSize="10">{edge.aIface || '—'} ↔ {edge.bIface || '—'}</text>}</g> })}{visibleNodes.map(node => { const point = positions.get(node.id); if (!point) return null; const active = selectedId === node.id; const related = hovered === node.id; return <g key={node.id} transform={`translate(${point.x},${point.y})`} onClick={event => { event.stopPropagation(); node.isCircuit ? onSelectCircuit?.(node.circuit) : onSelectDevice(node.device) }} onMouseEnter={() => setHovered(node.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}><rect x="-34" y="-34" width="68" height="68" rx="12" fill={colors.panel} stroke={active || related ? colors.accent : node.color} strokeWidth={active || related ? 2.5 : 1.5} strokeDasharray={node.isCircuit ? '5 4' : undefined} />{node.isCircuit ? <Cable x="-18" y="-18" size={36} color={node.color} /> : <svg x="-22" y="-22" width="44" height="44" viewBox="0 0 64 64"><TopoRoleIconPath role={node.role} color={node.color} fill={colors.panelAlt} /></svg>}<text textAnchor="middle" y="84" fill={active || related ? colors.textPrimary : colors.textSecondary} fontSize="11">{node.label}</text></g> })}</g></svg><Legend unresolved={graph.unresolved} circuits={visibleNodes.filter(node => node.isCircuit).length} />
  </GraphCanvas>
}

function ipWithoutPrefix(value) { return String(value || '').split('/')[0] }
function parseIp(value) { const raw = ipWithoutPrefix(value); const family = raw.includes(':') ? 6 : 4; try { if (family === 4) { const parts = raw.split('.'); if (parts.length !== 4 || parts.some(part => !/^\d+$/.test(part) || Number(part) > 255)) return null; return { family, value: parts.reduce((sum, part) => (sum << 8n) + BigInt(part), 0n) } } const [left = '', right = ''] = raw.split('::'); const leftParts = left ? left.split(':') : []; const rightParts = right ? right.split(':') : []; const parts = raw.includes('::') ? [...leftParts, ...Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill('0'), ...rightParts] : raw.split(':'); if (parts.length !== 8) return null; return { family, value: parts.reduce((sum, part) => (sum << 16n) + BigInt(parseInt(part || '0', 16)), 0n) } } catch { return null } }
function contains(prefix, address) { const [base, length] = String(prefix || '').split('/'); const a = parseIp(address); const b = parseIp(base); const bits = a?.family === 4 ? 32 : 128; const size = Number(length); return !!a && !!b && a.family === b.family && Number.isInteger(size) && size >= 0 && size <= bits && (a.value >> BigInt(bits - size)) === (b.value >> BigInt(bits - size)) }
function ipText(ip) { return ip?.address || ip?.display || '—' }
function assignedDevice(ip, interfaces) { return ip?.assigned_object?.device?.id ?? interfaces.get(ip?.assigned_object?.id) ?? null }

export function IpGraph({ devices = [], interfaces = [], cables = [], ipAddresses = [], prefixes = [], ipRanges = [], sites = [], onSelectDevice }) {
  const [site, setSite] = useState(''); const [status, setStatus] = useState('all'); const [prefix, setPrefix] = useState(''); const [showReserved, setShowReserved] = useState(true); const [showRanges, setShowRanges] = useState(true); const [showNat, setShowNat] = useState(true); const [zoom, setZoom] = useState(1); const [pan, setPan] = useState({ x: 0, y: 0 }); const [panning, setPanning] = useState(null); const [hovered, setHovered] = useState(null)
  const ifaceDevices = useMemo(() => new Map(interfaces.map(item => [item.id, item.device?.id ?? item.device])), [interfaces])
  const ipById = useMemo(() => new Map(ipAddresses.map(ip => [ip.id, ip])), [ipAddresses])
  const ipsByDevice = useMemo(() => { const result = new Map(devices.map(device => [device.id, []])); devices.forEach(device => { if (device.primary_ip) result.get(device.id)?.push(ipById.get(device.primary_ip.id) || device.primary_ip) }); ipAddresses.forEach(ip => { const deviceId = assignedDevice(ip, ifaceDevices); if (deviceId != null && result.has(deviceId) && !result.get(deviceId).some(item => item.id === ip.id)) result.get(deviceId).push(ip) }); return result }, [devices, ipAddresses, ipById, ifaceDevices])
  const visible = useMemo(() => devices.filter(device => (!site || String(device.site?.id) === site) && (status === 'all' || statusValue(device.status) === status) && (!prefix || (ipsByDevice.get(device.id) || []).some(ip => contains(prefix, ip.address)))), [devices, site, status, prefix, ipsByDevice])
  const physicalEdges = useMemo(() => { const seen = new Set(); return cables.flatMap(cable => { const ids = [...new Set([...cable.a_terminations || [], ...cable.b_terminations || []].map(term => term.object?.device?.id).filter(Boolean))]; if (ids.length < 2) return []; const key = ids.slice(0, 2).sort((a, b) => a - b).join(':'); if (seen.has(key)) return []; seen.add(key); return [{ id: `physical:${cable.id}`, source: ids[0], target: ids[1] }] }) }, [cables])
  const natEdges = useMemo(() => showNat ? ipAddresses.flatMap(ip => { const inside = ipById.get(ip.nat_inside?.id); const source = assignedDevice(inside, ifaceDevices); const target = assignedDevice(ip, ifaceDevices); return source != null && target != null ? [{ id: `nat:${ip.id}`, source, target }] : [] }) : [], [showNat, ipAddresses, ipById, ifaceDevices])
  const positions = useMemo(() => { const columns = Math.max(1, Math.ceil(Math.sqrt(visible.length))); return new Map(visible.map((device, index) => [device.id, { x: 120 + index % columns * 210, y: 110 + Math.floor(index / columns) * 135 }])) }, [visible])
  const reserved = ipAddresses.filter(ip => statusValue(ip.status) === 'reserved')
  const startPan = event => { if (event.button === 0) setPanning({ x: event.clientX, y: event.clientY, pan }) }
  const movePan = event => { if (panning) setPan({ x: panning.pan.x + event.clientX - panning.x, y: panning.pan.y + event.clientY - panning.y }) }
  return <GraphCanvas title="IPAM / NOC Graph" icon={<Globe2 size={15} color={colors.accent} />} setZoom={setZoom} controls={<><select value={site} onChange={event => setSite(event.target.value)} style={selectStyle}><option value="">All sites</option>{sites.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)} style={selectStyle}><option value="all">Any status</option><option value="active">Active</option><option value="offline">Offline</option><option value="planned">Planned</option><option value="staged">Staged</option></select><select value={prefix} onChange={event => setPrefix(event.target.value)} style={selectStyle}><option value="">All subnets ({prefixes.length})</option>{prefixes.map(item => <option key={item.id} value={item.prefix}>{item.prefix}</option>)}</select><label><input type="checkbox" checked={showNat} onChange={event => setShowNat(event.target.checked)} /> NAT</label><label><input type="checkbox" checked={showReserved} onChange={event => setShowReserved(event.target.checked)} /> Reserved</label><label><input type="checkbox" checked={showRanges} onChange={event => setShowRanges(event.target.checked)} /> Ranges</label></>}>
    <svg viewBox="0 0 1000 760" width="100%" height="100%" role="img" aria-label="IPAM network graph" onMouseDown={startPan} onMouseMove={movePan} onMouseUp={() => setPanning(null)} onMouseLeave={() => setPanning(null)} style={{ cursor: panning ? 'grabbing' : 'grab' }}><g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>{[...physicalEdges, ...natEdges].map(edge => { const a = positions.get(edge.source); const b = positions.get(edge.target); if (!a || !b) return null; const related = hovered === edge.source || hovered === edge.target; return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={edge.id.startsWith('nat:') ? colors.warn : colors.borderLight} strokeDasharray={edge.id.startsWith('nat:') ? '6 5' : undefined} strokeWidth={related ? 2.5 : 1.4} opacity={hovered && !related ? 0.15 : 0.72} /> })}{visible.map(device => { const point = positions.get(device.id); const ips = ipsByDevice.get(device.id) || []; const reservedCount = ips.filter(ip => statusValue(ip.status) === 'reserved').length; return <g key={device.id} transform={`translate(${point.x},${point.y})`} onClick={event => { event.stopPropagation(); onSelectDevice(device) }} onMouseEnter={() => setHovered(device.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: 'pointer' }}><rect x="-90" y="-40" width="180" height="80" rx="10" fill={colors.panel} stroke={statusColor(device.status)} strokeWidth={hovered === device.id ? 2.5 : 1.4} /><text textAnchor="middle" y="-12" fill={colors.textPrimary} fontSize="12">{device.name || `#${device.id}`}</text><text textAnchor="middle" y="10" fill={device.primary_ip ? colors.accent : colors.textDim} fontSize="11">{device.primary_ip?.address || ips[0]?.address || 'NO PRIMARY IP'}</text><text textAnchor="middle" y="28" fill={colors.textDim} fontSize="9">{ips.length} IPs{reservedCount ? ` · ${reservedCount} reserved` : ''}</text></g> })}</g></svg><div style={panelStyle}><SectionLabel>IPAM DETAILS</SectionLabel><div style={metricRow}><span>Devices</span><b>{visible.length}</b></div><div style={metricRow}><span>Reserved IPs</span><b>{showReserved ? reserved.length : 0}</b></div><div style={metricRow}><span>Ranges</span><b>{showRanges ? ipRanges.length : 0}</b></div>{showReserved && reserved.slice(0, 8).map(ip => <div key={ip.id} style={listItem}><Mono style={{ color: colors.warn }}>{ipText(ip)}</Mono></div>)}{showRanges && ipRanges.slice(0, 5).map(range => <div key={range.id} style={listItem}><Mono style={{ color: colors.circuit }}>{range.start_address} → {range.end_address}</Mono></div>)}</div>
  </GraphCanvas>
}

function GraphCanvas({ title, icon, controls, setZoom, svgRef, children }) { return <main style={{ position: 'relative', flex: 1, minWidth: 0, background: colors.bg }}><div style={toolbarStyle}><div style={toolbarGroup}>{icon}<strong>{title}</strong>{controls}</div><div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}><button type="button" style={buttonStyle} onClick={() => setZoom(current => Math.min(2, current * 1.2))} title="Zoom in"><ZoomIn size={15} /></button><button type="button" style={buttonStyle} onClick={() => setZoom(current => Math.max(0.5, current * 0.8))} title="Zoom out"><ZoomOut size={15} /></button><button type="button" style={buttonStyle} onClick={() => setZoom(1)} title="Reset zoom"><Maximize2 size={15} /></button></div></div><div ref={svgRef} style={{ width: '100%', height: '100%' }}>{children}</div></main> }
function Legend({ unresolved, circuits }) { return <div style={legendStyle}><Mono>{unresolved} unresolved cables</Mono>{circuits > 0 && <Mono style={{ color: colors.circuit }}>{circuits} circuits</Mono>}</div> }
const toolbarStyle = { position: 'absolute', zIndex: 2, top: 12, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'none' }
const toolbarGroup = { pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', background: `${colors.panel}F2`, border: `1px solid ${colors.border}`, borderRadius: 8, padding: '8px 10px' }
const legendStyle = { position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 12, padding: '8px 10px', background: `${colors.panel}E8`, border: `1px solid ${colors.border}`, borderRadius: 7, fontSize: 10, color: colors.textDim }
const panelStyle = { position: 'absolute', bottom: 12, left: 12, width: 280, maxHeight: '45%', overflowY: 'auto', padding: 12, background: `${colors.panel}F2`, border: `1px solid ${colors.border}`, borderRadius: 8 }
const metricRow = { display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: colors.textSecondary, fontSize: 11 }
const listItem = { marginTop: 4, padding: '5px 7px', background: colors.panelAlt, border: `1px solid ${colors.border}`, borderRadius: 5, fontSize: 10 }
