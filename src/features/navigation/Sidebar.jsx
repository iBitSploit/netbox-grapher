import { ChevronDown, ChevronRight, MapPin, Network, Search } from 'lucide-react'
import { useState } from 'react'
import { colors, statusColor } from '../../app/theme'

export default function Sidebar({ sites, racksBySite, activeSiteId, activeRackId, onSelectSite, onSelectRack, totalDevices, search, setSearch }) {
  const [expanded, setExpanded] = useState(() => new Set(sites.slice(0, 1).map(site => site.id)))
  const toggle = id => setExpanded(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next })
  const query = search.toLowerCase()
  const visibleSites = sites.filter(site => !query || site.name.toLowerCase().includes(query) || (racksBySite[site.id] || []).some(rack => rack.name.toLowerCase().includes(query)))
  return <aside style={{ width: 250, flexShrink: 0, background: colors.panel, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: 14 }}><div style={{ position: 'relative' }}><Search size={13} color={colors.textDim} style={{ position: 'absolute', left: 9, top: 9 }} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter sites, racks..." style={{ ...inputStyle, paddingLeft: 28 }} /></div></div>
    <div style={{ overflowY: 'auto', padding: '0 8px 12px' }}>
      <button type="button" onClick={() => onSelectSite(null)} style={rowStyle(activeSiteId === null)}><Network size={13} /> All infrastructure <span style={{ marginLeft: 'auto', color: colors.textDim }}>{totalDevices}</span></button>
      {visibleSites.map(site => { const racks = racksBySite[site.id] || []; const open = expanded.has(site.id); const active = activeSiteId === site.id; return <div key={site.id}>
        <button type="button" onClick={() => { toggle(site.id); onSelectSite(site.id) }} style={rowStyle(active && activeRackId === null)}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}<MapPin size={12} color={active ? colors.accent : statusColor(site.status)} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.name}</span></button>
        {open && racks.map(rack => <button type="button" key={rack.id} onClick={() => { onSelectSite(site.id); onSelectRack(rack.id) }} style={{ ...rowStyle(activeRackId === rack.id), paddingLeft: 30, fontSize: 11.5 }}>{rack.name}</button>)}
      </div> })}
    </div>
  </aside>
}

const inputStyle = { width: '100%', boxSizing: 'border-box', background: colors.panelAlt, border: `1px solid ${colors.borderLight}`, borderRadius: 6, padding: '7px 10px', color: colors.textPrimary, outline: 'none', fontSize: 12.5 }
const rowStyle = active => ({ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', border: 0, borderRadius: 6, background: active ? colors.panelAlt : 'transparent', color: active ? colors.textPrimary : colors.textSecondary, cursor: 'pointer', textAlign: 'left' })
