import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { getEpisodeVideo, getAnimeDetail, saveWatchProgress } from '../utils/api.js'

export default function WatchPage() {
  const { animeId, episodeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  
  // Episode list and Anime details
  const [episodes, setEpisodes] = useState(location.state?.episodes || [])
  const [animeTitle, setAnimeTitle] = useState(location.state?.animeTitle || '')
  
  // Stream data
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch episodes if missing (e.g. on direct page access or refresh)
  useEffect(() => {
    if (episodes.length === 0 || !animeTitle) {
      getAnimeDetail(animeId)
        .then(data => {
          setEpisodes(data.episodes || [])
          setAnimeTitle(data.title || '')
        })
        .catch(err => console.error('Error fetching episodes context:', err))
    }
  }, [animeId, episodes.length, animeTitle])

  // Fetch video stream URL on episodeId change
  useEffect(() => {
    setLoading(true)
    setError(null)
    setVideoUrl('')

    getEpisodeVideo(episodeId)
      .then(data => {
        if (data.video_url) {
          setVideoUrl(data.video_url)
          saveWatchProgress(animeId, episodeId).catch(err => console.error('Error saving watch progress:', err))
        } else {
          setError("Impossibile caricare il flusso video di questo episodio.")
        }
      })
      .catch(() => {
        setError("Errore durante il recupero del flusso video. L'episodio potrebbe non essere disponibile.")
      })
      .finally(() => setLoading(false))
  }, [episodeId])

  // Navigation handlers
  const currentIdx = episodes.findIndex(ep => ep.id === episodeId)
  const prevEp = currentIdx > 0 ? episodes[currentIdx - 1] : null
  const nextEp = currentIdx >= 0 && currentIdx < episodes.length - 1 ? episodes[currentIdx + 1] : null

  const handleNavigateEp = (ep) => {
    if (ep) {
      navigate(`/watch/${animeId}/${ep.id}`, { state: { episodes, animeTitle } })
    }
  }

  const currentEpNumber = episodes[currentIdx]?.number || ''

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-text-dim mb-6 font-body">
        <Link to="/" className="hover:text-accent transition-colors">Home</Link>
        <span>/</span>
        <Link to="/catalog" className="hover:text-accent transition-colors">Catalogo</Link>
        <span>/</span>
        <Link to={`/anime/${animeId}`} className="hover:text-accent transition-colors truncate max-w-[200px]">
          {animeTitle || 'Anime'}
        </Link>
        <span>/</span>
        <span className="text-accent font-semibold">Episodio {currentEpNumber}</span>
      </div>

      {/* Main Video Section */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Player & Info */}
        <div className="lg:col-span-3 space-y-4">
          <div className="video-player-container border border-border shadow-2xl relative bg-black">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-surface/90">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-accent mb-4">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <p className="text-sm text-text font-body">Acquisizione flusso video in corso...</p>
                <p className="text-xs text-muted font-body mt-1">Stiamo recuperando l'URL aggiornato da AnimeWorld</p>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-surface/95">
                <p className="text-4xl mb-3">⚠️</p>
                <p className="text-sm font-semibold text-text font-body max-w-md">{error}</p>
                <a 
                  href={`https://www.animeworld.ac/play/${animeId}/${episodeId}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-6 px-5 py-2.5 bg-accent hover:bg-accent-h text-white rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Apri su AnimeWorld
                </a>
              </div>
            ) : (
              <video 
                src={videoUrl} 
                controls 
                autoPlay 
                playsInline
                className="w-full h-full"
              />
            )}
          </div>

          {/* Episode Title & Navigation Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/40 p-5 rounded-2xl border border-border/50 backdrop-blur-sm">
            <div>
              <h2 className="text-xl font-bold font-body text-text">{animeTitle}</h2>
              <p className="text-sm text-text-dim font-body mt-1">Episodio {currentEpNumber}</p>
            </div>

            {/* Quick Next/Prev controls */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                disabled={!prevEp}
                onClick={() => handleNavigateEp(prevEp)}
                className="px-4 py-2 bg-border hover:bg-border/80 disabled:opacity-30 disabled:hover:bg-border rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border border-white/5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                Precedente
              </button>
              
              <button
                disabled={!nextEp}
                onClick={() => handleNavigateEp(nextEp)}
                className="px-4 py-2 bg-accent hover:bg-accent-h text-white disabled:opacity-30 disabled:hover:bg-accent rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 shadow-lg shadow-accent/10">
                Successivo
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Episode Quick Navigation */}
        <div className="bg-surface/30 p-5 rounded-2xl border border-border/50 backdrop-blur-sm flex flex-col max-h-[600px]">
          <h3 className="font-display text-lg tracking-wide text-text mb-4">EPISODI</h3>
          
          <div className="grid grid-cols-4 gap-2 overflow-y-auto flex-1 pr-1">
            {episodes.map((ep, i) => {
              const isActive = ep.id === episodeId
              return (
                <button
                  key={ep.id || i}
                  onClick={() => handleNavigateEp(ep)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all border font-body
                    ${isActive 
                      ? 'bg-accent border-accent text-white shadow-lg shadow-accent/20 scale-105' 
                      : 'bg-card border-border text-text-dim hover:border-accent hover:text-text'
                    }`}
                >
                  {ep.number}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
