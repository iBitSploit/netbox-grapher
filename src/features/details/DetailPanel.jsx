import { Cable, MapPin, Wifi, WifiOff } from 'lucide-react'
import { colors, DeviceIcon, roleName, statusColor, statusLabel } from '../../app/theme'
import { Badge, CloseButton, EmptyNote, Mono, SectionLabel, Spinner } from '../../app/ui'

export function DeviceDetail({ device, interfaces, ips, cables, loading, onClose }) {
  if (!device) return null
  const color = statusColor(device.status)
  return <Panel title={<><DeviceIcon role={roleName(device)} color={color} /> {device.name || `Device #${device.id}`}</>} subtitle={device.device_type?.display || roleName(device)} onClose={onClose}>
    <div style={chips}><Badge color={color}>{statusLabel(device.status)}</Badge>{device.site?.name && <Badge><MapPin size={10} /> {device.site.name}</Badge>}</div>
    {device.primary_ip?.address && <div><SectionLabel>Primary IP</SectionLabel><Mono style={{ color: colors.accent }}>{device.primary_ip.address}</Mono></div>}
    <SectionLabel>Interfaces {interfaces && `(${interfaces.length})`}</SectionLabel>
    {loading ? <Spinner size={14} /> : !interfaces?.length ? <EmptyNote>No interfaces found</EmptyNote> : interfaces.map(iface => <div key={iface.id} style={itemStyle}><div><span style={{ marginRight: 6 }}>{iface.cable ? <Wifi size={11} color={colors.accent} /> : <WifiOff size={11} color={colors.textDim} />}</span><Mono>{iface.name}</Mono></div>{(ips || []).filter(ip => ip.assigned_object_id === iface.id).map(ip => <Mono key={ip.id} style={{ color: colors.accent, display: 'block', marginTop: 4 }}>{ip.address}</Mono>)}</div>)}
    {cables?.length > 0 && <><SectionLabel>Cables ({cables.length})</SectionLabel>{cables.map(cable => <div key={cable.id} style={itemStyle}><Cable size={11} /> {cable.a_terminations?.[0]?.object?.name || 'A'} → {cable.b_terminations?.[0]?.object?.name || 'B'}</div>)}</>}
  </Panel>
}

export function CircuitDetail({ circuit, terminations, onClose }) {
  if (!circuit) return null
  return <Panel title={<><Cable color={colors.circuit} size={14} /> {circuit.cid || `Circuit #${circuit.id}`}</>} subtitle={circuit.provider?.name || 'Circuit'} onClose={onClose}><Badge color={colors.circuit}>{circuit.status?.label || circuit.status || 'Unknown'}</Badge><SectionLabel>Terminations ({terminations?.length || 0})</SectionLabel>{terminations?.length ? terminations.map(term => <div key={term.id} style={itemStyle}><Mono style={{ color: colors.circuit }}>SIDE {term.term_side || '-'}</Mono><div>{term.termination?.name || term.site?.name || 'Unresolved termination'}</div></div>) : <EmptyNote>No terminations found</EmptyNote>}</Panel>
}

function Panel({ title, subtitle, onClose, children }) { return <aside style={{ width: 380, flexShrink: 0, overflowY: 'auto', background: colors.panel, borderLeft: `1px solid ${colors.border}`, padding: 18 }}><header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}><div style={{ minWidth: 0 }}><div style={{ display: 'flex', gap: 7, alignItems: 'center', fontWeight: 600 }}>{title}</div><div style={{ color: colors.textSecondary, fontSize: 12, marginTop: 5 }}>{subtitle}</div></div><CloseButton onClick={onClose} /></header><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div></aside> }
const chips = { display: 'flex', gap: 8, flexWrap: 'wrap' }
const itemStyle = { background: colors.panelAlt, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '8px 10px', fontSize: 11.5, color: colors.textSecondary }
