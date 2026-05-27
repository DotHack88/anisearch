import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Home from './pages/Home.jsx'
import AnimePage from './pages/AnimePage.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import FavoritesPage from './pages/FavoritesPage.jsx'
import WatchPage from './pages/WatchPage.jsx'
import DownloadsPage from './pages/DownloadsPage.jsx'
import NewEpisodesPage from './pages/NewEpisodesPage.jsx'

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Navbar />
      <main>
        <ErrorBoundary>
          <Routes>
            <Route path="/"              element={<Home />} />
            <Route path="/catalog"       element={<CatalogPage />} />
            <Route path="/anime/:id"     element={<AnimePage />} />
            <Route path="/watch/:animeId/:episodeId" element={<WatchPage />} />
            <Route path="/favorites"     element={<FavoritesPage />} />
            <Route path="/downloads"     element={<DownloadsPage />} />
            <Route path="/nuovi-episodi" element={<NewEpisodesPage />} />
            <Route path="*" element={
              <div className="flex flex-col items-center justify-center min-h-[70vh] text-center page-enter">
                <p className="font-display text-8xl text-accent mb-4">404</p>
                <p className="text-text-dim font-body mb-6">Pagina non trovata</p>
                <a href="/" className="text-accent hover:underline font-body text-sm">← Torna alla home</a>
              </div>
            } />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}
