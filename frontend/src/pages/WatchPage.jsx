import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import api, { getEpisodeVideo, getAnimeDetail, saveWatchProgress, deleteWatchProgress, searchAnime, createParty, getPartyInfo } from '../utils/api'
import { useDownloads } from '../hooks/useDownloads.js'
import { useChromecast } from '../hooks/useChromecast.js'
import { useDLNA } from '../hooks/useDLNA.js'
import AnimeCard from '../components/AnimeCard.jsx'
import VideoPlayer from '../components/VideoPlayer.jsx'
import WatchPartyPanel from '../components/WatchPartyPanel.jsx'
import CastDeviceModal from '../components/CastDeviceModal.jsx'

export default function WatchPage() {
  const { animeId, episodeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  // Episode list, Anime details and cover
  const [episodes, setEpisodes] = useState(location.state?.episodes || [])
  const [animeTitle, setAnimeTitle] = useState(location.state?.animeTitle || '')
  const [animeImage, setAnimeImage] = useState(location.state?.animeImage || '')
  const episodeGridClass = episodes.length <= 6 ? 'grid grid-cols-4 gap-1.5 overflow-y-auto flex-1 pr-1' : 'grid grid-cols-6 gap-1.5 overflow-y-auto flex-1 pr-1';

  // Stream data
  const [videoUrl, setVideoUrl] = useState('')
  const [offlineUrl, setOfflineUrl] = useState('')
  const [isOfflinePlay, setIsOfflinePlay] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [related, setRelated] = useState([])
  const [tmdbEpisodeTitle, setTmdbEpisodeTitle] = useState('')
  const [showSkipIntro, setShowSkipIntro] = useState(false)
  const [showSkipOutro, setShowSkipOutro] = useState(false)
  const [autoplayCount, setAutoplayCount] = useState(null)
  const [currentSpeed, setCurrentSpeed] = useState(1.0)
  const [showSpeedBadge, setShowSpeedBadge] = useState(false)
  const autoplayTimerRef = useRef(null)
  const speedTimeoutRef = useRef(null)
  const hasSkippedIntroRef = useRef(false)
  const introTimerRef = useRef(null)
  const [lightsOff, setLightsOff] = useState(false)
  const [ambilightActive, setAmbilightActive] = useState(true)
  const [cinemaMode, setCinemaMode] = useState(() => localStorage.getItem('cinema_mode') === 'true')
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const playerWrapperRef = useRef(null)
  const [isSticky, setIsSticky] = useState(false)

  // Watch Party state
  const [partyRoomId, setPartyRoomId] = useState(null)
  const [partyIsHost, setPartyIsHost] = useState(false)
  const [partyNickname] = useState(() => 'Ospite' + Math.floor(Math.random() * 9000 + 1000))
  const [showPartyPanel, setShowPartyPanel] = useState(false)
  const [showCastModal, setShowCastModal] = useState(false)
  const sessionIdRef = useRef(null)

  // Detect ?party=XXXX in URL (for guests joining via link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const roomId = params.get('party')
    if (roomId) {
      getPartyInfo(roomId)
        .then(info => {
          setPartyRoomId(roomId)
          setPartyIsHost(false)
          setShowPartyPanel(true)
          // Navigate to the correct episode if different
          if (info.episode_id && info.episode_id !== episodeId) {
            navigate(`/watch/${info.anime_id}/${info.episode_id}?party=${roomId}`, { replace: true, state: { episodes, animeTitle, animeImage } })
          }
        })
        .catch(() => {
          console.warn('Party room not found')
        })
    }
  }, [])

  const handleCreateParty = async () => {
    try {
      const data = await createParty(animeId, episodeId, animeTitle, tmdbEpisodeTitle || `Ep. ${currentEpNumber}`)
      setPartyRoomId(data.room_id)
      setPartyIsHost(true)
      setShowPartyPanel(true)
      // Update URL so the host can share it
      const newUrl = `${window.location.pathname}?party=${data.room_id}`
      window.history.replaceState({}, '', newUrl)
    } catch (e) {
      console.error('Error creating party:', e)
    }
  }

  // Sticky mini-player on scroll (YouTube-style)
  useEffect(() => {
    const handleScroll = () => {
      if (!playerWrapperRef.current || cinemaMode) {
        setIsSticky(false)
        return
      }
      const rect = playerWrapperRef.current.getBoundingClientRect()
      setIsSticky(rect.bottom < 80)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [cinemaMode])

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

  // Chromecast hook
  const { isCastAvailable, isCasting: isCastingChromecast, castState: chromecastState, requestSession, loadMedia } = useChromecast()

  // DLNA / UPnP hook
  const dlna = useDLNA()

  // Sincronizza media sul Chromecast se è in corso un cast
  useEffect(() => {
    if (isCastingChromecast && videoUrl) {
      // Ferma il player locale
      if (videoRef.current) {
        videoRef.current.pause()
      }

      const currentIdx = episodes.findIndex(e => String(e.id) === String(episodeId))
      const fullTitle = `${animeTitle} - Ep ${episodes[currentIdx]?.number || ''}`
      loadMedia(videoUrl, fullTitle, tmdbEpisodeTitle || 'AniSearch', animeImage)
    }
  }, [isCastingChromecast, videoUrl, episodeId])

  // Sincronizza media su DLNA
  useEffect(() => {
    if (dlna.isCasting && dlna.selectedDevice && videoUrl) {
      if (videoRef.current) {
        videoRef.current.pause()
      }
      const currentIdx = episodes.findIndex(e => String(e.id) === String(episodeId))
      const fullTitle = `${animeTitle} - Ep ${episodes[currentIdx]?.number || ''}`
      dlna.castToDevice(dlna.selectedDevice, videoUrl, fullTitle, animeImage)
    }
  }, [videoUrl, episodeId]) // Riproduci auto nuovo episodio

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

  // Fetch related anime
  useEffect(() => {
    if (animeTitle) {
      let baseTitle = animeTitle
        .replace(/\s*\(.*?\)/g, '')
        .replace(/\s+(?:the\s+)?movie\b.*/i, '')
        .replace(/\s+(?:st|nd|rd|th)?\s*season\b.*/i, '')
        .replace(/\s+ova\b.*/i, '')
        .replace(/\s+ona\b.*/i, '')
        .replace(/\s+\d+$/, '')
        .trim();

      const searchWords = baseTitle.split(/\s+/).slice(0, 4).join(' ');

      searchAnime(searchWords, 15)
        .then(res => {
          const filtered = res.filter(a => String(a.id) !== String(animeId));
          setRelated(filtered);
        })
        .catch(() => { });
    }
  }, [animeTitle, animeId])

  // Fetch or retrieve offline video URL on episodeId change
  useEffect(() => {
    let active = true
    let localUrl = ''
    const timeoutHandle = setTimeout(() => {
      if (active && loading) {
        setError("Il server impiega troppo tempo a rispondere. Verifica la connessione.")
      }
    }, 8000)  // Timeout dopo 8 secondi

    async function loadVideo() {
      setLoading(true)
      setError(null)
      setVideoUrl('')
      setOfflineUrl('')
      setIsOfflinePlay(false)
      setShowSkipIntro(false)
      setShowSkipOutro(false)

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
          setError("Errore durante il recupero del flusso video. Verifica la connessione o riprova tra poco.")
          setLoading(false)
        }
      } finally {
        clearTimeout(timeoutHandle)
      }
    }

    loadVideo()

    return () => {
      active = false
      clearTimeout(timeoutHandle)
      if (localUrl) {
        URL.revokeObjectURL(localUrl)
      }
    }
  }, [episodeId, getOfflineUrl])

  // Read saved time from localStorage whenever the episode changes.
  // We store it in a ref so VideoPlayer can seek to it once Plyr is ready,
  // avoiding the race condition where videoRef.current is still null.
  const initialTimeRef = useRef(0)
  useEffect(() => {
    const storageKey = `watch_progress_${animeId}_${episodeId}`
    const saved = localStorage.getItem(storageKey)
    const parsed = saved ? parseFloat(saved) : 0
    initialTimeRef.current = !isNaN(parsed) && parsed > 0 ? parsed : 0
  }, [animeId, episodeId])
  
  // Reset intro skip state when episode changes
  useEffect(() => {
    hasSkippedIntroRef.current = false;
    if (introTimerRef.current) clearTimeout(introTimerRef.current);
  }, [episodeId]);

  // Save watch progress periodically via timeupdate.
  // Also controls Skip Intro/Outro visibility.
  // onVideoTimeUpdate is passed to VideoPlayer as a callback.
  const onVideoTimeUpdate = useCallback((time, duration) => {
    const storageKey = `watch_progress_${animeId}_${episodeId}`
    localStorage.setItem(storageKey, time)
    if (duration > 0) {
      localStorage.setItem(`watch_progress_pct_${animeId}_${episodeId}`, Math.floor((time / duration) * 100))
    }

    // Check Skip Intro visibility (first 5 minutes / 300s of the video)
    const shouldShowIntro = time >= 5 && time <= 300 && !hasSkippedIntroRef.current
    
    if (shouldShowIntro && !showSkipIntro) {
      setShowSkipIntro(true)
      if (introTimerRef.current) clearTimeout(introTimerRef.current)
      // Nascondi automaticamente dopo 5 secondi
      introTimerRef.current = setTimeout(() => {
        setShowSkipIntro(false)
        hasSkippedIntroRef.current = true
      }, 5000)
    } else if (!shouldShowIntro && showSkipIntro) {
      setShowSkipIntro(false)
    }

    // Check Skip Outro visibility (last 20s of video, if total duration > 300s)
    if (duration && duration > 300) {
      const shouldShowOutro = (duration - time) <= 20 && (duration - time) >= 2
      setShowSkipOutro(prev => prev !== shouldShowOutro ? shouldShowOutro : prev)
    } else {
      setShowSkipOutro(false)
    }
  }, [animeId, episodeId, showSkipIntro])

  // Ambilight canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !ambilightActive) return

    const ctx = canvas.getContext('2d')
    let animationFrameId

    const draw = () => {
      const video = videoRef.current
      if (!video) {
        // Video non ancora pronto (Plyr lo sta montando), riprova
        animationFrameId = requestAnimationFrame(draw)
        return
      }

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

  // Autoplay countdown effects & cleanup
  useEffect(() => {
    setAutoplayCount(null)
    if (autoplayTimerRef.current) {
      clearTimeout(autoplayTimerRef.current)
      autoplayTimerRef.current = null
    }
  }, [episodeId])

  useEffect(() => {
    if (autoplayCount === null) return
    if (autoplayCount === 0) {
      if (nextEp) {
        handleNavigateEp(nextEp)
      }
      setAutoplayCount(null)
      return
    }

    autoplayTimerRef.current = setTimeout(() => {
      setAutoplayCount(c => c - 1)
    }, 1000)

    return () => clearTimeout(autoplayTimerRef.current)
  }, [autoplayCount, nextEp])

  // Playback speed helper
  const showSpeedOverlay = (speed) => {
    setCurrentSpeed(speed)
    setShowSpeedBadge(true)
    if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current)
    speedTimeoutRef.current = setTimeout(() => {
      setShowSpeedBadge(false)
    }, 2000)
  }

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA'
      )) {
        return
      }

      const video = videoRef.current
      if (!video) return

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault()
          if (video.paused) {
            video.play().catch(() => { })
          } else {
            video.pause()
          }
          break
        case 'arrowright':
          e.preventDefault()
          video.currentTime = Math.min(video.duration || 0, video.currentTime + 10)
          break
        case 'arrowleft':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 10)
          break
        case 'arrowup':
          e.preventDefault()
          video.volume = Math.min(1, video.volume + 0.1)
          break
        case 'arrowdown':
          e.preventDefault()
          video.volume = Math.max(0, video.volume - 0.1)
          break
        case 'f':
          e.preventDefault()
          if (!document.fullscreenElement) {
            const container = document.querySelector('.video-player-container')
            if (container) {
              container.requestFullscreen().catch(() => {
                video.requestFullscreen().catch(() => { })
              })
            } else {
              video.requestFullscreen().catch(() => { })
            }
          } else {
            document.exitFullscreen().catch(() => { })
          }
          break
        case 'm':
          e.preventDefault()
          video.muted = !video.muted
          break
        case 's':
          e.preventDefault()
          const currentSpeedVal = video.playbackRate
          let newSpeed = 1.0
          if (currentSpeedVal === 1.0) newSpeed = 1.25
          else if (currentSpeedVal === 1.25) newSpeed = 1.5
          else if (currentSpeedVal === 1.5) newSpeed = 2.0
          else newSpeed = 1.0
          video.playbackRate = newSpeed
          showSpeedOverlay(newSpeed)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (speedTimeoutRef.current) clearTimeout(speedTimeoutRef.current)
    }
  }, [nextEp, animeId, episodes, animeTitle, animeImage])

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

  // Fetch episode title from TMDB (via backend proxy)
  useEffect(() => {
    let active = true;
    setTmdbEpisodeTitle('');

    async function fetchTmdbTitle() {
      if (!animeTitle || !currentEpNumber) return;
      try {
        // Chiama il proxy backend invece di TMDB direttamente
        const res = await api.get(`/tmdb/episode/${encodeURIComponent(animeTitle)}/${currentEpNumber}`)
        const epData = res.data  // risposta Axios: .data contiene il JSON
        if (active && epData.name) {
          setTmdbEpisodeTitle(epData.name)
        }
      } catch (err) {
        // Errore silenzioso — il titolo TMDB è opzionale
        console.warn('TMDB episode title non disponibile:', err?.response?.data || err.message)
      }
    }

    fetchTmdbTitle();

    return () => { active = false; };
  }, [animeTitle, currentEpNumber]);

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
        <span className="text-accent font-semibold truncate max-w-[200px] sm:max-w-none">
          Episodio {currentEpNumber}{tmdbEpisodeTitle ? ` - ${tmdbEpisodeTitle}` : ''}
        </span>
      </div>

      {/* Main Video Section */}
      <div className={`flex gap-4 transition-all duration-300 ${showPartyPanel ? 'items-start' : ''}`}>
        <div className={`flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-4 gap-6`}>
          {/* Video Player */}
          <div className={`transition-all duration-500 ${cinemaMode ? 'lg:col-span-4' : 'lg:col-span-3'} space-y-4`}>

            {/* Anchor to prevent layout shift and measure scroll accurately */}
            <div ref={playerWrapperRef} className={!cinemaMode ? "w-full" : "w-full flex justify-center"} style={!cinemaMode ? { aspectRatio: '16/9' } : {}}>
              {/* Sticky Container */}
              <div
                className={`transition-all duration-300 rounded-2xl ${lightsOff ? 'z-50 shadow-2xl shadow-accent/10' : 'z-10'
                  } ${isSticky
                    ? 'fixed bottom-4 right-4 z-[9999] w-[340px] shadow-2xl rounded-xl border border-white/20'
                    : 'relative w-full'
                  }`}
                style={isSticky ? { aspectRatio: '16/9' } : {}}
              >

                {/* Ambilight Canvas — only bleed on sides/bottom, NOT top (avoids red line above player) */}
                {ambilightActive && !loading && !error && (
                  <canvas
                    ref={canvasRef}
                    width="16"
                    height="9"
                    className="absolute w-[calc(100%+32px)] h-[calc(100%+16px)] top-0 -left-4 rounded-b-3xl pointer-events-none transition-all duration-500"
                    style={{
                      filter: 'blur(40px) saturate(2.2)',
                      opacity: lightsOff ? 0.95 : 0.65,
                      zIndex: -1,
                    }}
                  />
                )}

                <div
                  className={`video-player-container mx-auto border border-border shadow-2xl overflow-hidden ${!cinemaMode ? 'w-full' : 'max-w-full'}`}
                  style={cinemaMode ? { width: 'calc(85vh * 16 / 9)' } : {}}
                >
                  {loading ? (
                    <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center bg-surface/90">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-accent mb-4">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        <p className="text-sm text-text font-body">Acquisizione flusso video in corso...</p>
                        <p className="text-xs text-muted font-body mt-1">Stiamo recuperando l'URL aggiornato da AnimeWorld</p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-surface/95">
                        <p className="text-4xl mb-3">⚠️</p>
                        <p className="text-sm font-semibold text-text font-body max-w-md">{error}</p>
                        <a
                          href={`https://www.animeworld.ac/play/${animeId}/${episodeId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-6 px-5 py-2.5 bg-accent hover:bg-accent-h text-white rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-2"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                          Aggiorna la Pagina
                        </a>
                      </div>
                    </div>
                  ) : (
                    <VideoPlayer
                      src={isOfflinePlay ? offlineUrl : videoUrl}
                      videoRef={videoRef}
                      onEnded={() => { if (nextEp) setAutoplayCount(5) }}
                      isOfflinePlay={isOfflinePlay}
                      showSkipIntro={showSkipIntro}
                      showSkipOutro={showSkipOutro}
                      showSkipIntroAction={() => { 
                        if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 90)
                        hasSkippedIntroRef.current = true
                        setShowSkipIntro(false)
                      }}
                      showSkipOutroAction={() => { if (nextEp) handleNavigateEp(nextEp); else if (videoRef.current) videoRef.current.currentTime = videoRef.current.duration - 2 }}
                      showSpeedBadge={showSpeedBadge}
                      currentSpeed={currentSpeed}
                      autoplayCount={autoplayCount}
                      onCancelAutoplay={() => setAutoplayCount(null)}
                      onPlayNow={() => { if (nextEp) handleNavigateEp(nextEp); setAutoplayCount(null) }}
                      nextEpLabel={nextEp ? 'Prossimo Episodio' : 'Salta Finale'}
                      onClearProgress={handleClearProgress}
                      cinemaMode={cinemaMode}
                      onToggleCinema={() => setCinemaMode(v => !v)}
                      ambilightActive={ambilightActive}
                      onToggleAmbilight={() => setAmbilightActive(v => !v)}
                      initialTimeRef={initialTimeRef}
                      onTimeUpdate={onVideoTimeUpdate}
                      isGuest={Boolean(partyRoomId && !partyIsHost)}
                    />
                  )}
                  {(isCastingChromecast || dlna.isCasting) && !loading && !error && (
                    <div className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center text-center">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" className="mb-4 animate-pulse">
                        <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"></path>
                        <line x1="2" y1="20" x2="2.01" y2="20" strokeWidth="3"></line>
                      </svg>
                      <h3 className="text-xl font-bold font-display text-white tracking-wide">In Riproduzione su TV</h3>
                      <p className="text-sm text-text-dim mt-2 max-w-md">
                        {dlna.isCasting ? `Riproduzione attiva su ${dlna.selectedDevice?.name || 'Smart TV'}.` : 'Controlla la riproduzione dal tuo dispositivo Google Cast.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Episode Title & Navigation Controls */}
          <div className="transition-all duration-500 lg:col-span-3 space-y-4">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/40 p-5 rounded-2xl border border-border/50 backdrop-blur-sm transition-all duration-500 ${lightsOff ? 'relative z-50 shadow-2xl shadow-amber-500/5' : 'relative z-10'}`}>
              <div>
                <h2 className="text-xl font-bold font-body text-text">{animeTitle}</h2>
                <p className="text-sm text-text-dim font-body mt-1">
                  Episodio {currentEpNumber}{tmdbEpisodeTitle ? ` - ${tmdbEpisodeTitle}` : ''}
                </p>
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

                {isCastAvailable && chromecastState !== 'NO_DEVICES_AVAILABLE' && (
                  <button
                    onClick={requestSession}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border
                    ${isCastingChromecast
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 shadow-lg shadow-blue-500/10 animate-pulse'
                        : 'bg-surface border-border hover:border-blue-400/40 text-text-dim hover:text-text hover:bg-blue-500/5'}`}
                    title="Trasmetti alla TV (Chromecast)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"></path>
                      <line x1="2" y1="20" x2="2.01" y2="20"></line>
                    </svg>
                    {isCastingChromecast ? 'In Trasmissione' : 'Chromecast'}
                  </button>
                )}

                {/* DLNA / Smart TV Button */}
                <button
                  onClick={() => setShowCastModal(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border
                  ${dlna.isCasting
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20 shadow-lg shadow-blue-500/10 animate-pulse'
                      : 'bg-surface border-border hover:border-blue-400/40 text-text-dim hover:text-text hover:bg-blue-500/5'}`}
                  title="Trasmetti a Smart TV, Fire Stick, ecc."
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                    <polyline points="17 2 12 7 7 2"></polyline>
                  </svg>
                  {dlna.isCasting ? 'In Trasmissione' : 'Trasmetti alla TV'}
                </button>

                {/* Watch Party Button */}
                <button
                  onClick={partyRoomId ? () => setShowPartyPanel(v => !v) : handleCreateParty}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold font-body transition-all flex items-center gap-1.5 border
                  ${partyRoomId
                      ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 hover:bg-purple-500/25 shadow-lg shadow-purple-500/10'
                      : 'bg-surface border-border hover:border-purple-400/40 text-text-dim hover:text-text hover:bg-purple-500/5'}`}
                  title={partyRoomId ? 'Mostra/Nascondi Watch Party' : 'Crea una Watch Party con gli amici'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  {partyRoomId ? 'Watch Party 🟢' : 'Watch Party'}
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
                    className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold transition-all border font-body
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

        {/* Watch Party Sidebar Panel */}
        {partyRoomId && (
          <div className={`w-80 flex-shrink-0 h-[calc(100vh-120px)] sticky top-20 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-purple-500/10 ${showPartyPanel ? 'block' : 'hidden'}`}>
            <WatchPartyPanel
              roomId={partyRoomId}
              isHost={partyIsHost}
              sessionId={document.cookie.match(/session_id=([^;]+)/)?.[1] || 'anon-' + Math.random().toString(36).slice(2)}
              nickname={partyNickname}
              videoRef={videoRef}
              onClose={() => setShowPartyPanel(false)}
              onSync={(time, isPlaying) => {
                if (videoRef.current) {
                  const diff = Math.abs(videoRef.current.currentTime - time)
                  if (diff > 2) {
                    videoRef.current.currentTime = time
                  }
                  if (isPlaying && videoRef.current.paused) {
                    videoRef.current.play().catch(() => { 
                      videoRef.current.muted = true
                      videoRef.current.play().catch(() => {})
                    })
                  } else if (!isPlaying && !videoRef.current.paused) {
                    videoRef.current.pause()
                  }
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Anime Correlati */}
      {related.length > 0 && (
        <div className="mt-12 pb-16">
          <h2 className="font-display text-2xl tracking-wide text-text mb-5 flex items-center gap-2">
            CORRELATI
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {related.map(relAnime => (
              <AnimeCard key={relAnime.id} anime={relAnime} />
            ))}
          </div>
        </div>
      )}

      <CastDeviceModal
        isOpen={showCastModal}
        onClose={() => setShowCastModal(false)}
        devices={dlna.devices}
        isScanning={dlna.isScanning}
        scanError={dlna.scanError}
        onScan={dlna.scanDevices}
        onSelectDevice={(device) => {
          const fullTitle = `${animeTitle} - Ep ${episodes.find(e => String(e.id) === String(episodeId))?.number || ''}`;
          dlna.castToDevice(device, videoUrl, fullTitle, animeImage);
        }}
        castState={dlna.castState}
        selectedDevice={dlna.selectedDevice}
        castError={dlna.castError}
        onPause={dlna.pauseDLNA}
        onResume={dlna.resumeDLNA}
        onStop={dlna.stopDLNA}
      />
    </div>
  )
}

