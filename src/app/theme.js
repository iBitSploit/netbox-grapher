import { createElement } from 'react'

export const colors = {
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
  planned: '#6E8FD1',
  circuit: '#9B7EDE',
}

const statusColors = {
  active: colors.accent,
  offline: colors.danger,
  planned: colors.planned,
  staged: colors.warn,
  failed: colors.danger,
  connected: colors.accent,
  disconnected: colors.danger,
  provisioning: colors.planned,
  deprovisioning: colors.warn,
}

export function statusValue(status) {
  return String(typeof status === 'object' ? status?.value : status || '').toLowerCase()
}

export function statusColor(status) {
  return statusColors[statusValue(status)] || colors.textDim
}

export function statusLabel(status) {
  if (!status) return 'Unknown'
  return typeof status === 'object' ? status.label || status.value || 'Unknown' : status
}

export function roleName(device) {
  return device?.device_role?.name || device?.role?.name || ''
}

export function DeviceIcon({ role, size = 13, color = colors.textSecondary }) {
  const icon = String(role || '').toLowerCase()
  const glyph = icon.includes('router') ? '↗' : icon.includes('switch') || icon.includes('network') ? '⇄' : icon.includes('storage') ? '▣' : '▤'
  return createElement('span', { 'aria-hidden': 'true', style: { color, fontSize: size + 2, lineHeight: 1 } }, glyph)
}
