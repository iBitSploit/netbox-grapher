import { Loader2, X } from 'lucide-react'
import { colors } from './theme'

export function Mono({ children, style, ...rest }) {
  return <span style={{ fontFamily: "'JetBrains Mono', monospace", ...style }} {...rest}>{children}</span>
}

export function Spinner({ size = 16 }) {
  return <Loader2 size={size} style={{ animation: 'spin 0.8s linear infinite', color: colors.accent }} />
}

export function Badge({ children, color = colors.textSecondary }) {
  return <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{children}</span>
}

export function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 6, fontWeight: 500 }}>{children}</div>
}

export function EmptyNote({ children }) {
  return <div style={{ fontSize: 11.5, color: colors.textDim, fontStyle: 'italic' }}>{children}</div>
}

export function CloseButton({ onClick }) {
  return <button type="button" onClick={onClick} aria-label="Close" style={{ background: 'none', border: 'none', color: colors.textDim, cursor: 'pointer', padding: 4 }}><X size={17} /></button>
}
