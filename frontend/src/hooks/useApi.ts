/**
 * Hook générique pour les appels API avec gestion d'état loading/error/data.
 */
import { useState, useCallback } from 'react'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (...args: unknown[]) => Promise<T | null>
  reset: () => void
}

/**
 * Hook qui encapsule un appel API asynchrone.
 * @param apiFn - Fonction asynchrone à appeler
 */
export function useApi<T>(
  apiFn: (...args: unknown[]) => Promise<T>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async (...args: unknown[]) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const result = await apiFn(...args)
      setState({ data: result, loading: false, error: null })
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      setState(s => ({ ...s, loading: false, error: msg }))
      return null
    }
  }, [apiFn])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, execute, reset }
}

export default useApi
