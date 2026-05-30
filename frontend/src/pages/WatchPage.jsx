import { useEffect, useState, useRef } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { getEpisodeVideo, getAnimeDetail, saveWatchProgress, deleteWatchProgress } from '../utils/api'
import { useDownloads } from '../hooks/useDownloads.js'

export default function WatchPage() {
  const { animeId, episodeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  // Episode list, Anime details and cover
  const [episodes, setEpisodes] = useState(location.state?.episodes || [])
  const [animeTitle, setAnimeTitle] = useState(location.state?.animeTitle || '')
  const [animeImage, setAnimeImage] = useState(location.state?.animeImage || '')
  const episodeGridClass = episodes.length <= 6 ? 'grid grid-cols-3 gap-1 overflow-y-auto flex-1 pr-1' : 'grid grid-cols-4 gap-2 overflow-y-auto flex-1 pr-1';

  // Stream data
  const [videoUrl, setVideoUrl] = useState('')
  const [offlineUrl, setOfflineUrl] = useState('')
  const [isOfflinePlay, setIsOfflinePlay] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lightsOff, setLightsOff] = useState(false)
  const [ambilightActive, setAmbilightActive] = useState(true)
  const [cinemaMode, setCinemaMode] = useState(() => localStorage.getItem('cinema_mode') === 'true')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('cinema_mode', cinemaMode)
  }, [cinemaMode])

  // YouTube Cinema Mode shortcut ("t" key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.isContentEditable
      )
      if (isInput) return

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        setCinemaMode((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Download hook
  const {
    isDownloaded,
    isDownloading,
    getProgress,
    startDownload,
    cancelDownload,
    removeDownload,
    getOfflineUrl
  } = useDownloads()

  // Fetch episodes if missing
  useEffect(() => {
    if (episodes.length === 0 || !animeTitle) {
      getAnimeDetail(animeId)
        .then(data => {
          setEpisodes(data.episodes || [])
          setAnimeTitle(data.title || '')
          setAnimeImage(data.image || '')
        })
        .catch(err => console.error('Error fetching episodes context:', err))
    }
  }, [animeId, episodes.length, animeTitle])

  // Fetch or retrieve offline video URL on episodeId change
  useEffect(() => {
    let active = true
    let localUrl = ''

    async function loadVideo() {
      setLoading(true)
      setError(null)
      setVideoUrl('')
      setOfflineUrl('')
      setIsOfflinePlay(false)

      try {
        // 1. Check if we have it offline in IndexedDB
        const offlineBlobUrl = await getOfflineUrl(episodeId)
        if (offlineBlobUrl) {
          if (active) {
            localUrl = offlineBlobUrl
            setOfflineUrl(offlineBlobUrl)
            setIsOfflinePlay(true)
            setLoading(false)
            // Save watch progress to backend (ignore errors if offline)
            saveWatchProgress(animeId, episodeId).catch(() => { })
          }
          return
        }

        // 2. Fetch the streaming URL if not offline
        const data = await getEpisodeVideo(episodeId)
        if (active) {
          if (data.video_url) {
            setVideoUrl(data.video_url)
            saveWatchProgress(animeId, episodeId).catch(err => console.error('Error saving watch progress:', err))
          } else {
            setError("Errore durante il recupero del flusso video. L'episodio potrebbe non essere disponibile online.")
          }
          setLoading(false)
        }
      } catch (err) {
        if (active) {
          setError("Errore durante il recupero del flusso video. L'episodio potrebbe non essere disponibile online.")
          setLoading(false)
        }
      }
    }

    loadVideo()

    return () => {
      active = false
      if (localUrl) {
        URL.revokeObjectURL(localUrl)
      }
    }
  }, [episodeId, getOfflineUrl])

  // Restore and save watch progress
  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return

    const storageKey = `watch_progress_${animeId}_${episodeId}`
    let isRestored = false

    const restoreTime = () => {
      if (isRestored) return
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const time = parseFloat(saved)
        if (!isNaN(time) && time > 0) {
          // If duration is known, verify we aren't at the very end
          if (!videoEl.duration || time < videoEl.duration - 5) {
            videoEl.currentTime = time
          }
        }
      }
      isRestored = true
    }

    // Try restoring immediately if metadata is already loaded
    if (videoEl.readyState >= 1) {
      restoreTime()
    }

    const handleLoadedMetadata = () => {
      restoreTime()
    }

    let lastSaveTime = 0
    const handleTimeUpdate = () => {
      const now = Date.now()
      if (now - lastSaveTime > 1500) {
        localStorage.setItem(storageKey, videoEl.currentTime)
        lastSaveTime = now
      }
    }

    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata)
    videoEl.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata)
      videoEl.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [animeId, episodeId, videoUrl, offlineUrl])

  // Ambilight canvas rendering loop
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !ambilightActive) return

    const ctx = canvas.getContext('2d')
    let animationFrameId

    const draw = () => {
      if (video.paused || video.ended) {
        animationFrameId = requestAnimationFrame(draw)
        return
      }
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      } catch (e) {
        // Tainted canvas (CORS fallback) - draw shifting accent-colored radial gradients
        const time = Date.now() / 1500
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const grad = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 1,
          canvas.width / 2, canvas.height / 2, canvas.width
        )
        // Shifting between purple-purple (accent-h) and red-pink (accent)
        const r1 = Math.floor(192 + Math.sin(time) * 63)
        const g1 = Math.floor(56 + Math.cos(time * 0.7) * 20)
        const b1 = Math.floor(180 + Math.sin(time * 1.3) * 75)

        const r2 = Math.floor(252 + Math.cos(time) * 3) // red-accent
        const g2 = Math.floor(56 + Math.sin(time * 0.5) * 10)
        const b2 = Math.floor(75 + Math.cos(time * 0.9) * 20)

        grad.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0.7)`)
        grad.addColorStop(0.5, `rgba(${r2}, ${g2}, ${b2}, 0.4)`)
        grad.addColorStop(1, 'rgba(3, 3, 5, 0)')

        ctx.fillStyle = grad
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [ambilightActive, videoUrl, offlineUrl, loading])


  // Navigation handlers
  const currentIdx = episodes.findIndex(ep => ep.id === episodeId)
  const prevEp = currentIdx > 0 ? episodes[currentIdx - 1] : null
  const nextEp = currentIdx >= 0 && currentIdx < episodes.length - 1 ? episodes[currentIdx + 1] : null

  const handleNavigateEp = (ep) => {
    if (ep) {
      navigate(`/watch/${animeId}/${ep.id}`, { state: { episodes, animeTitle, animeImage } })
    }
  }

  const handleClearProgress = async () => {
    // Remove from localStorage if stored
    localStorage.removeItem(`watch_${animeId}_${episodeId}`)
    // Also remove saved progress timestamp
    localStorage.removeItem(`watch_progress_${animeId}_${episodeId}`)
    // Call backend delete and await completion
    try {
      await deleteWatchProgress(animeId, episodeId)
    } catch (e) {
      console.error('Error deleting watch progress:', e)
    }
    // Navigate back to home to reflect cleared state
    navigate('/')
  }

  const currentEpNumber = episodes[currentIdx]?.number || ''

  const isEpDownloaded = isDownloaded(episodeId)
  const isEpDownloading = isDownloading(episodeId)
  const epProgress = getProgress(episodeId)

  const handleDownloadClick = () => {
    if (isEpDownloaded) {
      if (window.confirm("Vuoi eliminare questo episodio dai download offline?")) {
        removeDownload(episodeId)
        setIsOfflinePlay(false)
        setOfflineUrl('')
        setLoading(true)
        getEpisodeVideo(episodeId)
          .then(data => {
            if (data.video_url) setVideoUrl(data.video_url)
            setLoading(false)
          })
          .catch(() => {
            setError("Errore durante il recupero del flusso video. L'episodio potrebbe non essere disponibile online.")
            setLoading(false)
          })
      }
    } else if (isEpDownloading) {
      cancelDownload(episodeId)
    } else {
      const coverUrl = animeImage || `https://img.animeworld.ac/locandine/${animeId}.jpg`
      startDownload(animeId, animeTitle, coverUrl, episodeId, currentEpNumber)
    }
  }

  return (
    <div className={`mx-auto px-4 py-8 page-enter transition-all duration-500 ${cinemaMode ? 'max-w-full lg:px-8' : 'max-w-7xl'}`}>
      {/* Lights Off Backdrop */}
      {lightsOff && (
        <div
          onClick={() => setLightsOff(false)}
          className="fixed inset-0 bg-black/95 z-40 transition-all duration-500 cursor-pointer backdrop-blur-[2px]"
          aria-hidden="true"
        />
      )}

      {/* Breadcrumb Navigation */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-text-dim mb-6 font-body">
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
        {/* Video Player */}
        <div className={`transition-all duration-500 ${cinemaMode ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-4`}>

          {/* Wrapper container for z-indexing over the Lights Off backdrop and mounting the Ambilight canvas */}
          <div className={`relative transition-all duration-500 rounded-2xl ${lightsOff ? 'z-50 shadow-2xl shadow-accent/10' : 'z-10'}`}>

            {/* Ambilight Canvas */}
            {ambilightActive && !loading && !error && (
              <canvas
                ref={canvasRef}
                width="16"
                height="9"
                className="absolute w-[calc(100%+32px)] h-[calc(100%+32px)] -top-4 -left-4 rounded-3xl pointer-events-none transition-all duration-500"
                style={{
                  filter: 'blur(40px) saturate(2.2)',
                  opacity: lightsOff ? 0.95 : 0.65,
                  zIndex: -1,
                }}
              />
            )}

            <div className="video-player-container border border-border shadow-2xl relative bg-black overflow-hidden">
              {isOfflinePlay && (
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-green-500/20 text-green-400 text-[10px] font-bold font-body">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  OFFLINE PLAYBACK
                </div>
              )}

              {/* Clear progress button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleClearProgress();
                }}
                title="Cancella progresso"
                aria-label="Cancella progresso"
                className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 border border-white/20 text-[#fc384b] hover:bg-red-600 hover:border-red-500 hover:scale-110 transition-all duration-200 shadow-lg backdrop-blur-sm"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#ffffffff" strokeWidth="2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="9" y2="9" />
                  <line x1="9" y1="1" x2="1" y2="9" />
                </svg>
              </button>
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-surface/90">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-accent mb-4">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    Apri su AnimeWorld
                  </a>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={isOfflinePlay ? offlineUrl : videoUrl}
                  controls
                  autoPlay
                  playsInline
                  crossOrigin="anonymous"
                  className="w-full h-full"
                />
              )}
            </div>
          </div>

        </div>

        {/* Episode Title & Navigation Controls */}
        <div className="transition-all duration-500 lg:col-span-3 space-y-4">
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/40 p-5 rounded-2xl border border-border/50 backdrop-blur-sm transition-all duration-500 ${lightsOff ? 'relative z-50 shadow-2xl shadow-amber-500/5' : 'relative z-10'}`}>
            <div>
              <h2 className="text-xl font-bold font-body text-text">{animeTitle}</h2>
              <p className="text-sm text-text-dim font-body mt-1">Episodio {currentEpNumber}</p>
            </div>

            {/* Quick Next/Prev/Download controls */}
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
              {/* Lights Toggle (Spegni/Accendi Luci) */}
              <button
                onClick={() => setLightsOff(!lightsOff)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border cursor-pointer
                  ${lightsOff
                    ? 'relative z-50 bg-amber-400 border-amber-300 text-slate-950 font-bold hover:bg-amber-300 hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.8)]'
                    : 'bg-surface border-border hover:border-accent/40 text-text-dim hover:text-text hover:bg-accent/5'}`}
                title={lightsOff ? "Accendi le Luci" : "Spegni le Luci"}
              >
                {lightsOff ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-pulse">
                      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" fill="currentColor" />
                    </svg>
                    <span>Accendi Luci</span>
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                    <span>Spegni Luci</span>
                  </>
                )}
              </button>

              {/* YouTube Cinema Mode Toggle */}
              <button
                onClick={() => setCinemaMode(!cinemaMode)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border cursor-pointer
                  ${cinemaMode
                    ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25 shadow-lg shadow-accent/15'
                    : 'bg-surface border-border hover:border-accent/40 text-text-dim hover:text-text hover:bg-accent/5'}`}
                title={cinemaMode ? "Disattiva Modalità Cinema (t)" : "Attiva Modalità Cinema (t)"}
                aria-keyshortcuts="t"
                data-priority="9"
                data-title-no-tooltip="Modalità cinema"
                aria-label="Modalità cinema scorciatoia da tastiera t"
                data-tooltip-title="Modalità cinema (t)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.20 3.01L21 3H3L2.79 3.01C2.30 3.06 1.84 3.29 1.51 3.65C1.18 4.02 .99 4.50 1 5V19L1.01 19.20C1.05 19.66 1.26 20.08 1.58 20.41C1.91 20.73 2.33 20.94 2.79 20.99L3 21H21L21.20 20.98C21.66 20.94 22.08 20.73 22.41 20.41C22.73 20.08 22.94 19.66 22.99 19.20L23 19V5C23.00 4.50 22.81 4.02 22.48 3.65C22.15 3.29 21.69 3.06 21.20 3.01ZM3 15V5H21V15H3ZM7.87 6.72L7.79 6.79L4.58 10L7.79 13.20C7.88 13.30 7.99 13.37 8.11 13.43C8.23 13.48 8.37 13.51 8.50 13.51C8.63 13.51 8.76 13.48 8.89 13.43C9.01 13.38 9.12 13.31 9.21 13.21C9.31 13.12 9.38 13.01 9.43 12.89C9.48 12.76 9.51 12.63 9.51 12.50C9.51 12.37 9.48 12.23 9.43 12.11C9.37 11.99 9.30 11.88 9.20 11.79L7.41 10L9.20 8.20L9.27 8.13C9.42 7.93 9.50 7.69 9.48 7.45C9.47 7.20 9.36 6.97 9.19 6.80C9.02 6.63 8.79 6.52 8.54 6.51C8.30 6.49 8.06 6.57 7.87 6.72ZM14.79 6.79C14.60 6.98 14.50 7.23 14.50 7.5C14.50 7.76 14.60 8.01 14.79 8.20L16.58 10L14.79 11.79L14.72 11.86C14.57 12.06 14.49 12.30 14.50 12.54C14.51 12.79 14.62 13.02 14.79 13.20C14.97 13.37 15.20 13.48 15.45 13.49C15.69 13.50 15.93 13.42 16.13 13.27L16.20 13.20L19.41 10L16.20 6.79C16.01 6.60 15.76 6.50 15.5 6.50C15.23 6.50 14.98 6.60 14.79 6.79ZM3 19V17H21V19H3Z" />
                </svg>
                {cinemaMode ? 'Area Standard' : 'Cinema'}
              </button>

              {/* Ambilight Toggle */}
              <button
                onClick={() => setAmbilightActive(!ambilightActive)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border
                  ${ambilightActive
                    ? 'bg-accent/15 border-accent/40 text-accent hover:bg-accent/25 shadow-lg shadow-accent/15'
                    : 'bg-surface border-border hover:border-accent/40 text-text-dim hover:text-text'}`}
                title="Attiva/Disattiva Effetto Ambilight"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                  {ambilightActive && <circle cx="12" cy="10" r="2" fill="currentColor" className="animate-pulse" />}
                </svg>
                Ambilight
              </button>

              {/* Download Button */}
              <button
                onClick={handleDownloadClick}
                className={`px-4 py-2 rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border
                  ${isEpDownloaded
                    ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                    : isEpDownloading
                      ? 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20 animate-pulse'
                      : 'bg-surface border-border hover:border-accent/40 text-text-dim hover:text-text'}`}
              >
                {isEpDownloaded ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    Scaricato
                  </>
                ) : isEpDownloading ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    Scarico ({epProgress}%)
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    Scarica
                  </>
                )}
              </button>

              <button
                disabled={!prevEp}
                onClick={() => handleNavigateEp(prevEp)}
                className="px-4 py-2 bg-border hover:bg-border/80 disabled:opacity-30 disabled:hover:bg-border rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border border-white/5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>
                Precedente
              </button>

              <button
                disabled={!nextEp}
                onClick={() => handleNavigateEp(nextEp)}
                className="px-4 py-2 bg-accent hover:bg-accent-h text-white disabled:opacity-30 disabled:hover:bg-accent rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 shadow-lg shadow-accent/10">
                Successivo
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar - Episode Quick Navigation */}
        <div className={`bg-surface/30 p-5 rounded-2xl border border-border/50 backdrop-blur-sm flex flex-col max-h-[600px] transition-all duration-500 lg:col-span-1 ${cinemaMode ? 'lg:row-span-1' : 'lg:row-span-2'}`}>
          <h3 className="font-display text-lg tracking-wide text-text mb-4">EPISODI</h3>

          <div className={episodeGridClass}>
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

