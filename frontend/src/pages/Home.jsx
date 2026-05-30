import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SearchBar from '../components/SearchBar.jsx'
import AnimeCard from '../components/AnimeCard.jsx'
import LatestEpisodes from '../components/LatestEpisodes.jsx'
import { useFavorites } from '../hooks/useFavorites.jsx'
import { getStatus, getRecentWatchProgress, deleteWatchProgress } from '../utils/api'

function AnimatedCounter({ value }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = parseInt(value)
    if (isNaN(end)) return

    // If we already have a count, start counting up from the previous value
    if (count > 0) {
      start = count
    } else {
      // Start counting from a close number on first load to look fast and responsive
      start = Math.max(0, end - 150)
    }

    if (start === end) return

    const duration = 1200 // ms
    const startTime = performance.now()

    const animate = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3)
      
      const current = Math.floor(easeOut * (end - start) + start)
      setCount(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [value])

  return <span>{count.toLocaleString()}</span>
}

export default function Home() {
  const { favorites, removeFavorite } = useFavorites()
  const [status, setStatus] = useState(null)
  const [recentWatch, setRecentWatch] = useState([])

  useEffect(() => {
    const fetchStatus = () => {
      getStatus().then(setStatus).catch(() => setStatus({ status: 'offline' }))
    }
    
    fetchStatus()
    // Poll the status endpoint every 10 seconds to keep the count updated dynamically
    const statusInterval = setInterval(fetchStatus, 10000)

    getRecentWatchProgress()
      .then(setRecentWatch)
      .catch(err => console.error('Error fetching watch progress:', err))

    return () => clearInterval(statusInterval)
  }, [])

  const handleClearProgress = (animeId, episodeId) => {
    localStorage.removeItem(`watch_${animeId}_${episodeId}`)
    localStorage.removeItem(`watch_progress_${animeId}_${episodeId}`)
    deleteWatchProgress(animeId, episodeId).catch((err) => { console.error('Delete failed:', err) })
    setRecentWatch(prev => prev.filter(item => !(item.anime_id === animeId && item.episode_id === episodeId)))
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-20 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-accent/5 blur-[80px] pointer-events-none" />

        <div className="mb-8 text-center relative">
          <h1 className="font-display tracking-widest leading-none" style={{ fontSize: 'clamp(2.5rem, 12vw, 8rem)' }}>
            <span className="text-accent">ANI</span><span className="text-text">SEARCH</span>
          </h1>
          <p className="mt-3 text-text-dim font-body text-sm">Cerca. Trova. Guarda. Tutto in un click.</p>
        </div>

        <div className="w-full max-w-xl relative">
          <SearchBar large autoFocus />
        </div>

        {/* Stato backend */}
        <p className="mt-4 text-xs font-body text-muted h-4">
          {status?.status === 'online' && (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 mb-px" />
              <AnimatedCounter value={status.cached_anime} /> anime
              {status.total_episodes > 0 && (
                <> · <AnimatedCounter value={status.total_episodes} /> episodi</>
              )}
              {' '}indicizzati
            </>
          )}
          {status?.status === 'offline' && (
            <><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5 mb-px" />Backend offline — avvia il server Python</>
          )}
        </p>

        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-sm sm:max-w-none">
          <Link to="/catalog" className="w-full sm:w-auto px-6 py-3 bg-accent hover:bg-accent-h text-white rounded-xl text-sm font-semibold font-body transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
            Esplora il Catalogo
          </Link>
          <Link to="/favorites" className="w-full sm:w-auto px-6 py-3 bg-surface hover:border-accent/40 border border-border text-text rounded-xl text-sm font-semibold font-body transition-all flex items-center justify-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-accent"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
            I Miei Preferiti
          </Link>
        </div>

        <div className="mt-8 hidden sm:flex gap-4 text-[10px] text-muted font-body">
          <span><kbd className="bg-border px-1 py-0.5 rounded">↑↓</kbd> naviga</span>
          <span><kbd className="bg-border px-1 py-0.5 rounded">Enter</kbd> seleziona</span>
          <span><kbd className="bg-border px-1 py-0.5 rounded">Esc</kbd> chiudi</span>
        </div>
      </section>

      {/* Riprendi la Visione */}
      {recentWatch.length > 0 && (
        <section className="max-w-6xl mx-auto w-full px-4 pb-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl tracking-wide text-text flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
              </svg>
              RIPRENDI LA VISIONE
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {recentWatch.map(item => (
              <Link
                key={item.anime_id}
                to={`/watch/${item.anime_id}/${item.episode_id}`}
                className="group relative bg-card/40 border border-border/50 rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:border-accent/40 hover:-translate-y-1 transition-all duration-300 backdrop-blur-sm"
              >
                {/* Clear progress button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleClearProgress(item.anime_id, item.episode_id);
                  }}
                  title="Cancella progresso"
                  className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 border border-white/20 text-white hover:bg-red-600 hover:border-red-500 hover:scale-110 transition-all duration-200 shadow-lg backdrop-blur-sm opacity-0 group-hover:opacity-100"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="1" y1="1" x2="9" y2="9" />
                    <line x1="9" y1="1" x2="1" y2="9" />
                  </svg>
                </button>
                {/* Poster Container */}
                <div className="aspect-[16/9] w-full overflow-hidden bg-surface relative">
                  <img
                    src={item.anime_image || `https://img.animeworld.ac/locandine/${item.anime_id}.jpg`}
                    alt={item.anime_title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Glass Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                    <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                  {/* Badge Episodio */}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/75 text-white rounded-md text-[10px] font-bold font-body backdrop-blur-sm border border-white/10">
                    Episodio {item.episode_number}
                  </span>
                </div>
                {/* Title */}
                <div className="p-3">
                  <h3 className="font-semibold text-xs text-text font-body truncate group-hover:text-accent transition-colors">
                    {item.anime_title}
                  </h3>
                  <p className="text-[10px] text-muted font-body mt-0.5">
                    Ultimo riprodotto
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest Episodes */}
      <section className="max-w-6xl mx-auto w-full px-4 pb-12">
        <LatestEpisodes limit={6} />
      </section>

      {/* Preferiti */}
      {favorites.length > 0 && (
        <section className="max-w-6xl mx-auto w-full px-4 pb-16">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl tracking-wide text-text flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-accent"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" /></svg>
              PREFERITI
            </h2>
            <Link to="/favorites" className="text-xs text-muted hover:text-accent font-body transition-colors">Vedi tutti →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {favorites.slice(0, 8).map(anime => (
              <AnimeCard key={anime.id} anime={anime} onRemove={removeFavorite} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
