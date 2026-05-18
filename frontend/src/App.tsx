/**
 * Composant racine de l'application ArbiSport.
 * Gère la navigation entre les pages.
 */
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage'
import ScanSettingsPage from './pages/ScanSettingsPage'
import ApiKeysPage from './pages/ApiKeysPage'
import MarketsPage from './pages/MarketsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import DoutesPage from './pages/DoutesPage'
import { useEffect, useState } from 'react'
import { getPendingCount } from './api/client'

const NAV_LINKS = [
  { to: '/', label: '📊 Tableau de bord', end: true },
  { to: '/scan', label: '🔍 Paramètres scan' },
  { to: '/keys', label: '🔑 Clés API' },
  { to: '/markets', label: '📋 Marchés 2-way' },
  { to: '/doutes', label: '🤔 Doutes' },
  { to: '/analytics', label: '📈 Analytics' },
]

export default function App() {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let alive = true
    const fetchCount = () =>
      getPendingCount().then((r) => { if (alive) setPendingCount(r.pending) }).catch(() => {})
    fetchCount()
    const t = setInterval(fetchCount, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Barre de navigation */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <span className="text-xl">♟️</span>
                <span className="font-bold text-gray-900">ArbiSport</span>
                <span className="hidden sm:inline text-xs text-gray-400 ml-1">Détecteur d'arbitrage</span>
              </div>

              {/* Liens */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {NAV_LINKS.map(link => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-green-50 text-green-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    {link.label}
                    {link.to === '/doutes' && pendingCount > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] rounded-full">
                        {pendingCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* Contenu principal */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/scan" element={<ScanSettingsPage />} />
            <Route path="/keys" element={<ApiKeysPage />} />
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/doutes" element={<DoutesPage />} />
          </Routes>
        </main>

        {/* Pied de page */}
        <footer className="border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
          ArbiSport MVP v1.0 — Outil de détection uniquement, aucun pari automatique.
          ⚠️ Vérifiez les CGU des bookmakers.
        </footer>
      </div>
    </BrowserRouter>
  )
}
