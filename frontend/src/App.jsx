import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import AnimeLoader from './components/AnimeLoader.jsx'
import ScrollToTop from './components/ScrollToTop.jsx'
import Home from './pages/Home.jsx'
import AnimePage from './pages/AnimePage.jsx'
import CatalogPage from './pages/CatalogPage.jsx'
import FavoritesPage from './pages/FavoritesPage.jsx'
import WatchlistPage from './pages/WatchlistPage.jsx'
import WatchPage from './pages/WatchPage.jsx'
import DownloadsPage from './pages/DownloadsPage.jsx'
import NewEpisodesPage from './pages/NewEpisodesPage.jsx'
import MangaList from './pages/MangaList.jsx'
import MangaDetail from './pages/MangaDetail.jsx'
import MangaReader from './pages/MangaReader.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'

// Mostra il loader una sola volta per sessione browser
const hasSeenLoader = sessionStorage.getItem('anisearch_loader_seen')

export default function App() {
  const [loading, setLoading] = useState(!hasSeenLoader)

  const handleLoaderComplete = () => {
    sessionStorage.setItem('anisearch_loader_seen', '1')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      {loading && <AnimeLoader onComplete={handleLoaderComplete} />}
      <ScrollToTop />
      <Navbar />
      <main>
        <ErrorBoundary>
          <Routes>
            <Route path="/"              element={<Home />} />
            <Route path="/catalog"       element={<CatalogPage />} />
            <Route path="/anime/:id"     element={<AnimePage />} />
            <Route path="/watch/:animeId/:episodeId" element={<WatchPage />} />
            <Route path="/favorites"     element={<FavoritesPage />} />
            <Route path="/watchlist"     element={<WatchlistPage />} />
            <Route path="/downloads"     element={<DownloadsPage />} />
            <Route path="/nuovi-episodi" element={<NewEpisodesPage />} />
            <Route path="/login"         element={<LoginPage />} />
            <Route path="/register"      element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />
            <Route path="/impostazioni"  element={<SettingsPage />} />
            <Route path="/profilo"       element={<ProfilePage />} />
            
            <Route path="/manga/catalog" element={<MangaList />} />
            <Route path="/manga/:id" element={<MangaDetail />} />
            <Route path="/manga/read/:mangaId/:chapterId" element={<MangaReader />} />

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
