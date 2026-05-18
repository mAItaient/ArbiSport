/**
 * Hook de polling automatique — appelle une fonction à intervalle régulier.
 */
import { useEffect, useRef, useCallback } from 'react'

/**
 * Lance un appel à `fetchFn` immédiatement puis toutes les `intervalMs` ms.
 * @param fetchFn  - Fonction async à appeler
 * @param intervalMs - Intervalle en millisecondes (défaut: 30 000 = 30s)
 * @param enabled  - Active/désactive le polling (défaut: true)
 */
export function usePolling(
  fetchFn: () => void | Promise<void>,
  intervalMs = 30_000,
  enabled = true
): { refresh: () => void } {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fnRef = useRef(fetchFn)

  // Met à jour la référence de la fonction sans recréer l'intervalle
  useEffect(() => {
    fnRef.current = fetchFn
  }, [fetchFn])

  useEffect(() => {
    if (!enabled) return

    // Appel immédiat au montage
    fnRef.current()

    timerRef.current = setInterval(() => {
      fnRef.current()
    }, intervalMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [intervalMs, enabled])

  const refresh = useCallback(() => {
    fnRef.current()
  }, [])

  return { refresh }
}

export default usePolling
