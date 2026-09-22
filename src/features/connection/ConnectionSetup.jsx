import { AlertTriangle, Network } from 'lucide-react'
import { useState } from 'react'
import { colors } from '../../app/theme'
import { env } from '../../config/env'
import { Spinner } from '../../app/ui'

export default function ConnectionSetup({ initial, onConnect, error, connecting }) {
  const [form, setForm] = useState({ url: initial?.url || env.netboxUrl, token: initial?.token || env.netboxToken })
  const canSubmit = form.url.trim() && form.token.trim() && !connecting
  return <div style={{ position: 'fixed', inset: 0, background: colors.bg, display: 'grid', placeItems: 'center', padding: 20 }}>
    <form onSubmit={event => { event.preventDefault(); if (canSubmit) onConnect(form.url.trim(), form.token.trim()) }} style={{ width: '100%', maxWidth: 440, background: colors.panel, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 24 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24 }}><Network color={colors.accent} /><div><strong>{env.appName}</strong><div style={{ color: colors.textDim, fontSize: 12 }}>Connect to a NetBox instance</div></div></div>
      <label style={labelStyle}>NetBox URL<input required value={form.url} onChange={event => setForm({ ...form, url: event.target.value })} placeholder="https://netbox.example.com" style={inputStyle} /></label>
      <label style={labelStyle}>API Token<input required type="password" value={form.token} onChange={event => setForm({ ...form, token: event.target.value })} placeholder="Token" style={inputStyle} /></label>
      {error && <div style={{ color: colors.danger, fontSize: 12, marginBottom: 14, display: 'flex', gap: 6 }}><AlertTriangle size={14} />{error}</div>}
      <button disabled={!canSubmit} style={{ width: '100%', border: 0, borderRadius: 7, padding: 11, background: canSubmit ? colors.accent : colors.borderLight, color: canSubmit ? '#04231F' : colors.textDim, cursor: canSubmit ? 'pointer' : 'default' }}>{connecting ? <Spinner size={15} /> : 'Connect'}</button>
    </form>
  </div>
}

const labelStyle = { display: 'block', color: colors.textSecondary, fontSize: 12, marginBottom: 14 }
const inputStyle = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', boxSizing: 'border-box', background: colors.panelAlt, border: `1px solid ${colors.borderLight}`, borderRadius: 7, color: colors.textPrimary, outline: 'none' }
