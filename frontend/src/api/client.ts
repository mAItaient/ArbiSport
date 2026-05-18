/**
 * Client HTTP pour l'API backend ArbiSport.
 */

const API_BASE = '/api'

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  if (!res.ok) {
    let errMsg = `Erreur HTTP ${res.status}`
    try {
      const body = await res.json()
      errMsg = body.error || errMsg
    } catch {
      // ignore
    }
    throw new Error(errMsg)
  }

  return res.json() as Promise<T>
}

export const getHealth = () =>
  request<{ status: string; version: string; uptime: number; dbOk: boolean }>('/health')

export const getConfig = () =>
  request<Record<string, unknown>>('/config')

export const updateConfig = (data: Record<string, unknown>) =>
  request<{ ok: boolean; config: Record<string, unknown> }>('/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const getApiKeys = () =>
  request<import('../types').ApiKey[]>('/api-keys')

export const createApiKey = (data: {
  provider: 'theOddsApi' | 'oddsApiIo'
  label: string
  api_key_value: string
  plan_info?: string
  quota_limit?: number
  quota_period?: 'hourly' | 'daily' | 'monthly'
}) =>
  request<import('../types').ApiKey>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateApiKey = (id: number, data: Partial<import('../types').ApiKey>) =>
  request<import('../types').ApiKey>(`/api-keys/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteApiKey = (id: number) =>
  request<{ ok: boolean }>(`/api-keys/${id}`, { method: 'DELETE' })

export const toggleApiKey = (id: number) =>
  request<import('../types').ApiKey>(`/api-keys/${id}/toggle`, { method: 'POST' })

export const runScan = (params: import('../types').ScanParams) =>
  request<import('../types').ScanResult>('/scan', {
    method: 'POST',
    body: JSON.stringify(params),
  })

export const getOpportunities = (params?: {
  limit?: number
  offset?: number
  since?: string
  minRoiPct?: number
}) => {
  const qs = new URLSearchParams()
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  if (params?.since) qs.set('since', params.since)
  if (params?.minRoiPct !== undefined) qs.set('minRoiPct', String(params.minRoiPct))
  const query = qs.toString() ? `?${qs}` : ''
  return request<import('../types').PaginatedOpportunities>(`/opportunities${query}`)
}

export const getHotspots = (params?: { days?: number; groupBy?: 'market' | 'pair'; minOccurrences?: number }) => {
  const qs = new URLSearchParams()
  if (params?.days) qs.set('days', String(params.days))
  if (params?.groupBy) qs.set('groupBy', params.groupBy)
  if (params?.minOccurrences) qs.set('minOccurrences', String(params.minOccurrences))
  const query = qs.toString() ? `?${qs}` : ''
  return request<{ hotspots: import('../types').Hotspot[]; days: number; groupBy: string }>(
    `/analytics/hotspots${query}`
  )
}

export const getAnalyticsStats = (days = 7) =>
  request<{ count: number; avgRoi: number; maxRoi: number; avgGainMin: number }>(
    `/analytics/stats?days=${days}`
  )

export const getTwoWayMarkets = (params?: { provider?: string; sport?: string; twoWayOnly?: boolean }) => {
  const qs = new URLSearchParams()
  if (params?.provider) qs.set('provider', params.provider)
  if (params?.sport) qs.set('sport', params.sport)
  if (params?.twoWayOnly) qs.set('twoWayOnly', 'true')
  const query = qs.toString() ? `?${qs}` : ''
  return request<{ markets: import('../types').TwoWayMarket[] }>(`/markets/two-way${query}`)
}

export const initTwoWayMarkets = (data: { providers: string[]; sports: string[] }) =>
  request<{ ok: boolean; message: string }>('/markets/init-two-way', {
    method: 'POST',
    body: JSON.stringify(data),
  })
