import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import AnimeCard from '../components/AnimeCard.jsx'
import { useFavorites } from '../hooks/useFavorites.js'
import { getStatus } from '../utils/api.js'

export default function Home() {
  const { favorites, removeFavorite } = useFavorites()
  const [status, setStatus] = useState(null)

  useEffect(() => {
    getStatus().then(setStatus).catch(() => setStatus({ status: 'offline' }))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-accent/5 blur-[80px] pointer-events-none" />

        <div className="mb-8 text-center relative">
          <h1 className="font-display tracking-widest leading-none" style={{ fontSize: 'clamp(4rem, 12vw, 8rem)' }}>
            <span className="text-accent">ANI</span><span className="text-text">SEARCH</span>
          </h1>
          <p className="mt-3 text-text-dim font-body text-sm">Cerca e guarda anime da AnimeWorld</p>
        </div>

        <div className="w-full max-w-xl relative">
          <SearchBar large autoFocus />
        </div>

        {/* Stato backend */}
        <p className="mt-4 text-xs font-body text-muted h-4">
          {status?.status === 'online' && (
            <><span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 mb-px" />{status.cached_anime.toLocaleString()} anime indicizzati</>
          )}
          {status?.status === 'offline' && (
            <><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 mb-px" />Backend offline — avvia il server Python</>
          )}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link to="/catalog" className="px-6 py-3 bg-accent hover:bg-accent-h text-white rounded-xl text-sm font-semibold font-body transition-all shadow-lg shadow-accent/20 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            Esplora il Catalogo
          </Link>
          <Link to="/favorites" className="px-6 py-3 bg-surface hover:border-accent/40 border border-border text-text rounded-xl text-sm font-semibold font-body transition-all flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-accent"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/></svg>
            I Miei Preferiti
          </Link>
        </div>

        <div className="mt-8 flex gap-4 text-[10px] text-muted font-body">
          <span><kbd className="bg-border px-1 py-0.5 rounded">↑↓</kbd> naviga</span>
          <span><kbd className="bg-border px-1 py-0.5 rounded">Enter</kbd> seleziona</span>
          <span><kbd className="bg-border px-1 py-0.5 rounded">Esc</kbd> chiudi</span>
        </div>
      </section>

      {/* Preferiti */}
      {favorites.length > 0 && (
        <section className="max-w-6xl mx-auto w-full px-4 pb-16">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl tracking-wide text-text flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#e63946"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/></svg>
              PREFERITI
            </h2>
            <Link to="/favorites" className="text-xs text-muted hover:text-accent font-body transition-colors">Vedi tutti →</Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {favorites.slice(0, 8).map(anime => (
              <AnimeCard key={anime.id} anime={anime} onRemove={removeFavorite} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
