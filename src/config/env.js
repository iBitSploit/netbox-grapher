const raw = import.meta.env

function booleanValue(value, fallback) {
  if (value == null || value === '') return fallback
  return value === 'true' || value === '1'
}

function numberValue(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const env = Object.freeze({
  appName: raw.VITE_APP_NAME || 'Infrastructure Map',
  repositoryUrl: raw.VITE_REPOSITORY_URL || '',
  netboxUrl: raw.VITE_NETBOX_URL || '',
  netboxToken: raw.VITE_NETBOX_TOKEN || '',
  apiPrefix: `/${String(raw.VITE_NETBOX_API_PREFIX || 'api').replace(/^\/+|\/+$/g, '')}`,
  storageKey: raw.VITE_STORAGE_KEY || 'netbox-config',
  defaultView: ['racks', 'topology', 'ipgraph'].includes(raw.VITE_DEFAULT_VIEW) ? raw.VITE_DEFAULT_VIEW : 'racks',
  autoRefresh: booleanValue(raw.VITE_AUTO_REFRESH, false),
  refreshIntervalMs: numberValue(raw.VITE_REFRESH_INTERVAL_MS, 30000),
  enableIpGraph: booleanValue(raw.VITE_ENABLE_IP_GRAPH, true),
  enableCircuits: booleanValue(raw.VITE_ENABLE_CIRCUITS, true),
})

export function apiPath(path) {
  return `${env.apiPrefix}/${String(path).replace(/^\/+/, '')}`
}
