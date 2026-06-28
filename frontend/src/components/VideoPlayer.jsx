import { useEffect, useRef, useState, useCallback } from 'react'

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function VideoPlayer({
  src,
  videoRef: externalVideoRef,
  onEnded,
  isOfflinePlay,
  showSkipIntro,
  showSkipOutro,
  showSkipIntroAction,
  showSkipOutroAction,
  showSpeedBadge,
  currentSpeed,
  autoplayCount,
  onCancelAutoplay,
  onPlayNow,
  nextEpLabel,
  onClearProgress,
  cinemaMode,
  onToggleCinema,
  ambilightActive,
  onToggleAmbilight,
}) {
  const internalRef = useRef(null)
  const videoRef = externalVideoRef || internalRef
  const containerRef = useRef(null)
  const progressRef = useRef(null)
  const thumbnailCanvasRef = useRef(null)
  const hideControlsTimer = useRef(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('player_volume') ?? '1'))
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [thumbPos, setThumbPos] = useState(null) // { x, time }
  const [thumbSrc, setThumbSrc] = useState(null)
  const [isBuffering, setIsBuffering] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [qualityFilter, setQualityFilter] = useState('auto') // 'auto', 'upscale', 'vivid', 'cinema'
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const thumbDebounceRef = useRef(null)

  // Context Menu & Aspect Ratio & Stats states
  const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false })
  const [isLooping, setIsLooping] = useState(false)
  const [aspectRatio, setAspectRatio] = useState('default') // 'default' (contain), '16-9' (contain-16:9), '4-3', 'stretch'
  const [showStats, setShowStats] = useState(false)
  const [videoResolution, setVideoResolution] = useState({ w: 0, h: 0 })
  const [isSticky, setIsSticky] = useState(false)
  const [introDismissed, setIntroDismissed] = useState(false)
  const [showSkipBackFeedback, setShowSkipBackFeedback] = useState(false)
  const [showSkipForwardFeedback, setShowSkipForwardFeedback] = useState(false)
  const lastClickTimeRef = useRef(0)

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2]

  // Sync volume on mount
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = volume
    v.muted = isMuted
  }, [src])

  // Video event listeners
  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime)
      if (v.buffered.length > 0) {
        setBuffered((v.buffered.end(v.buffered.length - 1) / v.duration) * 100)
      }
    }
    const onLoaded = () => {
      setDuration(v.duration)
      setVideoResolution({ w: v.videoWidth, h: v.videoHeight })
    }
    const onWaiting = () => setIsBuffering(true)
    const onCanPlay = () => setIsBuffering(false)
    const onRateChange = () => setPlaybackRate(v.playbackRate)
    const onPiPEnter = () => setIsPiP(true)
    const onPiPLeave = () => setIsPiP(false)

    v.addEventListener('play', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('timeupdate', onTimeUpdate)
    v.addEventListener('loadedmetadata', onLoaded)
    v.addEventListener('waiting', onWaiting)
    v.addEventListener('canplay', onCanPlay)
    v.addEventListener('ratechange', onRateChange)
    v.addEventListener('enterpictureinpicture', onPiPEnter)
    v.addEventListener('leavepictureinpicture', onPiPLeave)

    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('loadedmetadata', onLoaded)
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('canplay', onCanPlay)
      v.removeEventListener('ratechange', onRateChange)
      v.removeEventListener('enterpictureinpicture', onPiPEnter)
      v.removeEventListener('leavepictureinpicture', onPiPLeave)
    }
  }, [src])

  // Click outside to dismiss context menu & sticky on scroll listener
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.visible) setContextMenu(prev => ({ ...prev, visible: false }))
    }
    
    const handleScroll = () => {
      if (!containerRef.current || isWebFS || isFullscreen) return
      const rect = containerRef.current.getBoundingClientRect()
      // If the top of the video container goes above viewport AND bottom goes above center viewport
      const shouldBeSticky = rect.bottom < 150
      setIsSticky(shouldBeSticky)
    }

    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [contextMenu.visible])

  // Skip Intro auto-dismiss logic (dismisses after 5 seconds of visibility)
  useEffect(() => {
    if (showSkipIntro) {
      setIntroDismissed(false)
      const timer = setTimeout(() => {
        setIntroDismissed(true)
      }, 5000) // auto-hide after 5 seconds
      return () => clearTimeout(timer)
    } else {
      setIntroDismissed(false)
    }
  }, [showSkipIntro])

  // Reset introDismissed if user seeks back to start
  useEffect(() => {
    if (currentTime < 5) {
      setIntroDismissed(false)
    }
  }, [currentTime])

  // Fullscreen change listener
  useEffect(() => {
    const onFSChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFSChange)
    return () => document.removeEventListener('fullscreenchange', onFSChange)
  }, [])

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current)
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying && !showSpeedMenu) setShowControls(false)
    }, 3000)
  }, [isPlaying, showSpeedMenu])

  useEffect(() => {
    resetHideTimer()
    return () => clearTimeout(hideControlsTimer.current)
  }, [isPlaying])

  // Toggle play/pause
  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }

  // Quick skip back/forward handlers
  const skipBackward = useCallback((seconds = 10) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.max(0, v.currentTime - seconds)
    setCurrentTime(v.currentTime)
    setShowSkipBackFeedback(true)
    setTimeout(() => setShowSkipBackFeedback(false), 500)
  }, [videoRef])

  const skipForward = useCallback((seconds = 10) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = Math.min(v.duration || 0, v.currentTime + seconds)
    setCurrentTime(v.currentTime)
    setShowSkipForwardFeedback(true)
    setTimeout(() => setShowSkipForwardFeedback(false), 500)
  }, [videoRef])

  const handleVideoClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const width = rect.width
    const currentTimeStamp = Date.now()

    if (currentTimeStamp - lastClickTimeRef.current < 300) {
      if (clickX < width / 2) {
        skipBackward(10)
      } else {
        skipForward(10)
      }
      lastClickTimeRef.current = 0
    } else {
      lastClickTimeRef.current = currentTimeStamp
      togglePlay()
    }
  }

  const handleSideClick = (e, direction) => {
    e.stopPropagation()
    if (direction === 'back') {
      skipBackward(10)
    } else {
      skipForward(10)
    }
  }

  // Progress bar interaction
  const getTimeFromEvent = (e) => {
    const rect = progressRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  const handleProgressClick = (e) => {
    const t = getTimeFromEvent(e)
    if (videoRef.current) videoRef.current.currentTime = t
    setCurrentTime(t)
  }

  const handleProgressMouseMove = (e) => {
    if (!progressRef.current || !duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const clientX = e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const time = ratio * duration
    const x = clientX - rect.left

    setThumbPos({ x, time })

    // Seek only when dragging (mousedown held)
    if (isDragging) {
      if (videoRef.current) videoRef.current.currentTime = time
      setCurrentTime(time)
      return
    }

    // Debounce thumbnail generation (no actual seek during hover)
    if (thumbDebounceRef.current) clearTimeout(thumbDebounceRef.current)
    thumbDebounceRef.current = setTimeout(() => {
      const v = videoRef.current
      const canvas = thumbnailCanvasRef.current
      if (!v || !canvas) return
      const savedTime = v.currentTime
      const ctx = canvas.getContext('2d')
      const seekHandler = () => {
        try {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
          setThumbSrc(canvas.toDataURL('image/jpeg', 0.6))
        } catch (_) {
          setThumbSrc(null)
        }
        v.currentTime = savedTime
        v.removeEventListener('seeked', seekHandler)
      }
      v.addEventListener('seeked', seekHandler)
      v.currentTime = time
    }, 120)
  }

  const handleProgressLeave = () => {
    setThumbPos(null)
    setThumbSrc(null)
  }

  // Volume
  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value)
    setVolume(val)
    if (videoRef.current) videoRef.current.volume = val
    localStorage.setItem('player_volume', val)
    if (val === 0) setIsMuted(true)
    else setIsMuted(false)
  }

  const toggleMute = () => {
    const v = videoRef.current
    if (!v) return
    const newMuted = !isMuted
    setIsMuted(newMuted)
    v.muted = newMuted
  }

  // Quality filter mappings (CSS filters)
  const getQualityStyles = () => {
    switch (qualityFilter) {
      case 'upscale':
        return { imageRendering: 'crisp-edges', filter: 'contrast(1.06) saturate(1.08) brightness(1.02)' }
      case 'vivid':
        return { filter: 'saturate(1.28) contrast(1.06) brightness(1.02)' }
      case 'cinema':
        return { filter: 'brightness(0.92) contrast(0.95) saturate(0.88)' }
      default:
        return {}
    }
  }

  const getQualityLabel = () => {
    switch (qualityFilter) {
      case 'upscale': return 'Upscale 1080p'
      case 'vivid': return 'Vivid'
      case 'cinema': return 'Cinema'
      default: return 'Auto'
    }
  }

  // Fullscreen
  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // PiP
  const togglePiP = async () => {
    const v = videoRef.current
    if (!v) return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await v.requestPictureInPicture()
      }
    } catch (e) {}
  }

  // Speed
  const setSpeed = (s) => {
    if (videoRef.current) videoRef.current.playbackRate = s
    setPlaybackRate(s)
    setShowSpeedMenu(false)
  }

  // Handle right click context menu
  const handleContextMenu = (e) => {
    e.preventDefault()
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setContextMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true
    })
  }

  // Toggle Video Loop
  const toggleLoop = () => {
    const v = videoRef.current
    if (!v) return
    const nextLoop = !isLooping
    v.loop = nextLoop
    setIsLooping(nextLoop)
  }

  // Screenshot capture function
  const takeScreenshot = () => {
    const v = videoRef.current
    if (!v) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth || 1920
    canvas.height = v.videoHeight || 1080
    const ctx = canvas.getContext('2d')
    try {
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `AniSearch_Screenshot_${Math.floor(currentTime)}s.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      alert("Errore nello screenshot. La sorgente video potrebbe bloccare le catture (CORS).")
    }
  }

  // Helper to map aspect ratio state to styling classes
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '16-9':
        return 'w-full h-full object-contain aspect-video'
      case '4-3':
        return 'w-full h-full object-fill aspect-[4/3]'
      case 'stretch':
        return 'w-full h-full object-fill'
      default:
        return 'w-full h-full object-contain'
    }
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  // Detect if we are in cinema mode or fullscreen
  const isWebFS = cinemaMode

  return (
    <div
      ref={containerRef}
      onContextMenu={handleContextMenu}
      className={`video-player-container relative bg-black overflow-hidden select-none transition-all duration-300 
        ${isWebFS ? 'w-full' : ''} 
        ${isSticky ? 'fixed bottom-4 right-4 z-[9999] w-[340px] shadow-2xl rounded-xl border border-white/20' : 'w-full rounded-2xl'}`}
      style={isSticky ? { aspectRatio: '16/9' } : (isWebFS ? {} : { aspectRatio: '16/9' })}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false)
        setThumbPos(null)
      }}
      onTouchStart={resetHideTimer}
    >
      {/* Hidden canvas for thumbnails */}
      <canvas ref={thumbnailCanvasRef} width="160" height="90" className="hidden" />

      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        className={getAspectRatioClass()}
        style={getQualityStyles()}
        onClick={handleVideoClick}
        onEnded={onEnded}
      />

      {/* Double Tap Skip Feedback Overlays */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1/3 bg-gradient-to-r from-white/10 to-transparent flex flex-col items-center justify-center pointer-events-none z-30 transition-all duration-300 rounded-r-full ${
          showSkipBackFeedback ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="bg-black/60 p-4 rounded-full flex flex-col items-center justify-center shadow-2xl border border-white/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white animate-pulse">
            <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/>
          </svg>
          <span className="text-white text-xs font-bold mt-1">-10s</span>
        </div>
      </div>

      <div
        className={`absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-white/10 to-transparent flex flex-col items-center justify-center pointer-events-none z-30 transition-all duration-300 rounded-l-full ${
          showSkipForwardFeedback ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="bg-black/60 p-4 rounded-full flex flex-col items-center justify-center shadow-2xl border border-white/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white animate-pulse">
            <path d="M13 17l5-5-5-5M6 17l5-5-5-5"/>
          </svg>
          <span className="text-white text-xs font-bold mt-1">+10s</span>
        </div>
      </div>

      {/* Side Quick Skip Buttons */}
      <button
        onClick={(e) => handleSideClick(e, 'back')}
        className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 hover:border-accent text-white flex flex-col items-center justify-center transition-all duration-300 active:scale-95 shadow-2xl backdrop-blur-md cursor-pointer group ${
          showControls || !isPlaying ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
        }`}
        title="Indietro 10s"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:-translate-x-0.5 transition-transform">
          <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/>
        </svg>
        <span className="text-[9px] font-bold mt-0.5 opacity-80">-10s</span>
      </button>

      <button
        onClick={(e) => handleSideClick(e, 'forward')}
        className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 w-12 h-12 rounded-full bg-black/50 hover:bg-black/80 border border-white/10 hover:border-accent text-white flex flex-col items-center justify-center transition-all duration-300 active:scale-95 shadow-2xl backdrop-blur-md cursor-pointer group ${
          showControls || !isPlaying ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
        }`}
        title="Avanti 10s"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-0.5 transition-transform">
          <path d="M13 17l5-5-5-5M6 17l5-5-5-5"/>
        </svg>
        <span className="text-[9px] font-bold mt-0.5 opacity-80">+10s</span>
      </button>

      {/* Nerd Stats Overlay */}
      {showStats && (
        <div className="absolute top-3 left-3 bg-black/85 backdrop-blur-md text-[10px] text-green-400 font-mono p-3 rounded-lg border border-white/10 z-30 pointer-events-auto leading-relaxed shadow-xl max-w-[220px]">
          <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
            <span className="font-bold">STATISTICHE VIDEO</span>
            <button onClick={() => setShowStats(false)} className="text-white/40 hover:text-white font-bold ml-3">✕</button>
          </div>
          <div>Dimens.: {videoResolution.w}x{videoResolution.h}px</div>
          <div>Tempo: {formatTime(currentTime)} / {formatTime(duration)}</div>
          <div>Velocità: {playbackRate}x</div>
          <div>Bufferizzato: {buffered.toFixed(1)}%</div>
          <div>Loop: {isLooping ? 'ATTIVO' : 'SPENTO'}</div>
          <div>Filtro: {getQualityLabel()}</div>
        </div>
      )}

      {/* Custom Context Menu */}
      {contextMenu.visible && (
        <div
          className="absolute bg-gray-900/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl py-1.5 z-[1000] text-xs min-w-[150px] font-sans text-white pointer-events-auto transition-opacity"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { toggleLoop(); setContextMenu(prev => ({ ...prev, visible: false })) }}
            className="flex items-center justify-between w-full px-4 py-2 hover:bg-white/15 text-left transition-colors"
          >
            <span>Loop Video</span>
            <span className={isLooping ? 'text-accent font-bold' : 'text-white/40'}>{isLooping ? 'ON' : 'OFF'}</span>
          </button>
          <div className="border-t border-white/10 my-1" />
          <div className="px-4 py-1 text-[10px] text-white/40 font-semibold uppercase tracking-wider">Rapporto d'aspetto</div>
          {[
            { id: 'default', label: 'Default (Adatta)' },
            { id: '16-9', label: '16:9' },
            { id: '4-3', label: '4:3' },
            { id: 'stretch', label: 'Riempi (Stira)' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => { setAspectRatio(r.id); setContextMenu(prev => ({ ...prev, visible: false })) }}
              className={`block w-full px-4 py-1.5 hover:bg-white/15 text-left transition-colors ${aspectRatio === r.id ? 'text-accent font-bold' : ''}`}
            >
              {r.label}
            </button>
          ))}
          <div className="border-t border-white/10 my-1" />
          <button
            onClick={() => { setShowStats(s => !s); setContextMenu(prev => ({ ...prev, visible: false })) }}
            className="block w-full px-4 py-2 hover:bg-white/15 text-left transition-colors"
          >
            {showStats ? 'Nascondi Statistiche' : 'Statistiche per Nerd'}
          </button>
        </div>
      )}

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="animate-spin opacity-80">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      )}

      {/* Offline badge */}
      {isOfflinePlay && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-green-500/20 text-green-400 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          OFFLINE PLAYBACK
        </div>
      )}

      {/* Clear progress button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClearProgress?.() }}
        title="Cancella progresso"
        className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 border border-white/20 text-white hover:bg-red-600 hover:border-red-500 hover:scale-110 transition-all duration-200 shadow-lg backdrop-blur-sm"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
        </svg>
      </button>

      {/* Skip Intro */}
      {showSkipIntro && !introDismissed && (
        <button
          onClick={showSkipIntroAction}
          className="absolute bottom-20 left-6 z-20 px-4 py-2.5 bg-black/80 hover:bg-accent border border-white/10 hover:border-accent text-white font-semibold text-xs rounded-xl shadow-lg backdrop-blur-md transition-all duration-300 flex items-center gap-2 hover:scale-105"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" /><line x1="19" y1="5" x2="19" y2="19" />
          </svg>
          Salta Sigla
        </button>
      )}

      {/* Skip Outro */}
      {showSkipOutro && (
        <button
          onClick={showSkipOutroAction}
          className="absolute bottom-20 right-6 z-20 px-4 py-2.5 bg-accent hover:bg-accent-h text-white font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(251,56,75,0.4)] border border-accent-h hover:scale-105 transition-all duration-300 flex items-center gap-2"
        >
          <span>{nextEpLabel || 'Salta Finale'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" /><line x1="19" y1="5" x2="19" y2="19" />
          </svg>
        </button>
      )}

      {/* Speed Badge */}
      {showSpeedBadge && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/75 px-4 py-2 rounded-xl text-white font-bold text-sm pointer-events-none z-30 flex items-center gap-2 border border-white/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="13 19 22 12 13 5 13 19" fill="currentColor" /><polygon points="2 19 11 12 2 5 2 19" fill="currentColor" />
          </svg>
          {currentSpeed}x
        </div>
      )}

      {/* Autoplay countdown */}
      {autoplayCount !== null && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6">
          <p className="text-gray-400 text-xs uppercase tracking-widest font-semibold mb-2">Fine dell'episodio</p>
          <h3 className="text-xl font-bold text-white mb-6">
            Il prossimo episodio inizierà tra <span className="text-accent text-2xl font-black">{autoplayCount}</span> secondi
          </h3>
          <div className="flex gap-4">
            <button onClick={onCancelAutoplay} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-xl font-semibold text-xs transition-all hover:scale-105">Annulla</button>
            <button onClick={onPlayNow} className="px-5 py-2.5 bg-accent hover:bg-accent-h text-white rounded-xl font-semibold text-xs transition-all shadow-[0_0_20px_rgba(251,56,75,0.4)] hover:scale-105">Riproduci Ora</button>
          </div>
        </div>
      )}

      {/* ── CUSTOM CONTROLS ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ${showControls || !isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar area */}
        <div className="px-3 pt-4 pb-1">
          {/* Thumbnail preview tooltip */}
          {thumbPos && duration > 0 && (
            <div
              className="absolute bottom-[72px] pointer-events-none z-40 flex flex-col items-center"
              style={{ left: `${Math.max(80, Math.min(thumbPos.x + 12, (progressRef.current?.offsetWidth || 0) - 80))}px` }}
            >
              <div className="bg-black border border-white/20 rounded-lg overflow-hidden shadow-2xl">
                {thumbSrc ? (
                  <img src={thumbSrc} alt="preview" width="160" height="90" className="block" />
                ) : (
                  <div className="w-[160px] h-[90px] flex items-center justify-center bg-gray-900">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" className="opacity-40">
                      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                    </svg>
                  </div>
                )}
                <div className="text-center text-white text-[11px] font-bold py-1 bg-black/80">
                  {formatTime(thumbPos.time)}
                </div>
              </div>
              {/* Arrow */}
              <div className="w-2 h-2 bg-black border-r border-b border-white/20 rotate-45 -mt-1" />
            </div>
          )}

          {/* Progress track */}
          <div
            ref={progressRef}
            className="relative h-1.5 rounded-full cursor-pointer group/prog"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            onClick={handleProgressClick}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={handleProgressLeave}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
          >
            {/* Buffer bar */}
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{ width: `${buffered}%`, background: 'rgba(255,255,255,0.3)' }}
            />
            {/* Progress bar */}
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-none"
              style={{ width: `${progress}%`, background: 'var(--color-accent, #fc384b)' }}
            />
            {/* Hover expand effect */}
            <div className="absolute inset-0 rounded-full group-hover/prog:scale-y-[2] transition-transform origin-bottom" />
            
            {/* Highlight Markers (Opening: 10s and 150s) */}
            {duration > 180 && (
              <>
                {/* Intro Start Dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-yellow-400 border border-black shadow z-10 cursor-help"
                  style={{ left: `${(10 / duration) * 100}%` }}
                  title="Inizio Sigla"
                />
                {/* Intro End Dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-yellow-400 border border-black shadow z-10 cursor-help"
                  style={{ left: `${(150 / duration) * 100}%` }}
                  title="Fine Sigla"
                />
              </>
            )}

            {/* Scrubber thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover/prog:opacity-100 transition-opacity -translate-x-1/2"
              style={{ left: `${progress}%` }}
            />
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-accent transition-colors w-8 h-8 flex items-center justify-center flex-shrink-0">
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
          </button>

          {/* Volume — always visible */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} className="text-white hover:text-accent transition-colors w-7 h-7 flex items-center justify-center flex-shrink-0">
              {isMuted || volume === 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              ) : volume < 0.5 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              )}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className={`w-16 accent-accent cursor-pointer hidden md:block ${isSticky ? '!hidden' : ''}`}
              style={{ height: '3px' }}
            />
          </div>

          {/* Time display */}
          <div className="text-white text-xs font-mono ml-1 select-none whitespace-nowrap">
            {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
          </div>

          {/* Spacer to push controls to the right */}
          <div className="flex-grow" />

          {/* Playback speed */}
          <div className="relative">
            <button
              onClick={() => { setShowSpeedMenu(v => !v); setShowQualityMenu(false) }}
              className="text-white hover:text-accent transition-colors text-xs font-bold px-2 py-1 rounded border border-white/20 hover:border-accent/50 whitespace-nowrap"
            >
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-8 right-0 bg-gray-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50">
                {speeds.map(s => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`block w-full px-4 py-1.5 text-xs text-left transition-colors hover:bg-white/10 ${playbackRate === s ? 'text-accent font-bold' : 'text-white'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quality Selector */}
          <div className="relative ml-1">
            <button
              onClick={() => { setShowQualityMenu(v => !v); setShowSpeedMenu(false) }}
              className="text-white hover:text-accent transition-colors text-xs font-bold px-2.5 py-1 rounded border border-white/20 hover:border-accent/50 bg-white/5 flex items-center gap-1 whitespace-nowrap"
            >
              <span>{getQualityLabel()}</span>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showQualityMenu && (
              <div className="absolute bottom-8 right-0 bg-gray-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 min-w-[120px]">
                {[
                  { id: 'auto', label: 'Auto (Sorgente)' },
                  { id: 'upscale', label: 'Upscale 1080p' },
                  { id: 'vivid', label: 'Vivid (Anime)' },
                  { id: 'cinema', label: 'Cinema (Soft)' }
                ].map(q => (
                  <button
                    key={q.id}
                    onClick={() => { setQualityFilter(q.id); setShowQualityMenu(false) }}
                    className={`block w-full px-4 py-2 text-xs text-left transition-colors hover:bg-white/10 ${qualityFilter === q.id ? 'text-accent font-bold' : 'text-white'}`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right icon group ── */}
          <div className={`items-center gap-0.5 ml-1 bg-black/30 rounded-lg px-1 py-0.5 hidden md:flex ${isSticky ? '!hidden' : ''}`}>

            {/* Screenshot 📸 */}
            <button
              onClick={takeScreenshot}
              title="Cattura screenshot"
              className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>

            {/* Ambilight */}
            <button
              onClick={onToggleAmbilight}
              title={ambilightActive ? 'Disattiva Ambilight' : 'Attiva Ambilight'}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${ambilightActive ? 'text-accent' : 'text-white/70 hover:text-white'}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
                {ambilightActive && <circle cx="12" cy="10" r="2" fill="currentColor" className="animate-pulse" />}
              </svg>
            </button>

            {/* PiP */}
            {'pictureInPictureEnabled' in document && (
              <button
                onClick={togglePiP}
                title={isPiP ? 'Esci da Picture-in-Picture' : 'Picture-in-Picture'}
                className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${isPiP ? 'text-accent' : 'text-white/70 hover:text-white'}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <rect x="13" y="10" width="8" height="5" rx="1" fill="currentColor" stroke="none"/>
                </svg>
              </button>
            )}

            {/* Web Fullscreen = Cinema Mode */}
            <button
              onClick={onToggleCinema}
              title={cinemaMode ? 'Disattiva Modalità Cinema' : 'Modalità Cinema (espande il player)'}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${cinemaMode ? 'text-accent' : 'text-white/70 hover:text-white'}`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.20 3.01L21 3H3L2.79 3.01C2.30 3.06 1.84 3.29 1.51 3.65C1.18 4.02 .99 4.50 1 5V19L1.01 19.20C1.05 19.66 1.26 20.08 1.58 20.41C1.91 20.73 2.33 20.94 2.79 20.99L3 21H21L21.20 20.98C21.66 20.94 22.08 20.73 22.41 20.41C22.73 20.08 22.94 19.66 22.99 19.20L23 19V5C23.00 4.50 22.81 4.02 22.48 3.65C22.15 3.29 21.69 3.06 21.20 3.01ZM3 15V5H21V15H3ZM3 19V17H21V19H3Z"/>
              </svg>
            </button>

          </div>

          {/* OS Fullscreen — sempre visibile */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Esci dal Fullscreen' : 'Fullscreen'}
            className="w-7 h-7 flex items-center justify-center rounded text-white/70 hover:text-white transition-colors ml-1"
          >
            {isFullscreen ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            )}
          </button>

          </div>
        </div>

      {/* Big play button center overlay when paused */}
      {!isPlaying && !isBuffering && autoplayCount === null && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-accent/80 hover:border-accent transition-all duration-300 hover:scale-110 shadow-2xl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </div>
        </div>
      )}
    </div>
  )
}
