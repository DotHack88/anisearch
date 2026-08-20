import { useEffect, useRef, useState, useMemo } from 'react'
import { Plyr } from 'plyr-react'
import 'plyr-react/plyr.css'

export default function VideoPlayer({
  src,
  videoRef: externalVideoRef,
  onEnded,
  isOfflinePlay,
  showSkipIntro,
  showSkipOutro,
  showSkipIntroAction,
  showSkipOutroAction,
  autoplayCount,
  onCancelAutoplay,
  onPlayNow,
  nextEpLabel,
  onClearProgress,
  initialTimeRef,
  onTimeUpdate,
  isGuest = false,
}) {
  const plyrRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Pass media ref to external ref so WatchPage can read duration and time.
  // Also seek to initialTimeRef.current once Plyr has the element available.
  useEffect(() => {
    let timeout
    let seeked = false

    const attachRef = () => {
      const media = plyrRef.current?.plyr?.media
      if (externalVideoRef && media) {
        externalVideoRef.current = media
      }
      if (media && initialTimeRef && !seeked) {
        const t = initialTimeRef.current
        if (t > 0) {
          // canplay fires when enough data is available to begin playback.
          // We use it (instead of loadedmetadata) to ensure we can actually seek.
          const doSeek = () => {
            if (seeked) return
            seeked = true
            // Avoid seeking past the end
            if (!media.duration || t < media.duration - 5) {
              media.currentTime = t
            }
            media.removeEventListener('canplay', doSeek)
          }
          if (media.readyState >= 3) {
            // Already have enough data — seek immediately
            doSeek()
          } else {
            media.addEventListener('canplay', doSeek)
          }
        }
      }
    }

    // Attempt immediately then retry after Plyr's internal 100ms mount
    attachRef()
    timeout = setTimeout(attachRef, 150)
    return () => clearTimeout(timeout)
  }, [src, externalVideoRef, initialTimeRef])

  // Attach event listeners to the media element instead of plyr instance.
  // Also wires up onTimeUpdate for saving progress in WatchPage.
  useEffect(() => {
    // Retry attaching if media is not immediately available
    let media = null;
    let timeout;
    let lastSaveTime = 0;

    const attachEvents = () => {
      media = plyrRef.current?.plyr?.media || plyrRef.current?.plyr?.elements?.original;
      if (!media) {
        timeout = setTimeout(attachEvents, 100);
        return;
      }

      const handlePlay = () => setIsPlaying(true)
      const handlePause = () => setIsPlaying(false)
      const handleEnded = () => {
        if (onEnded) onEnded()
      }
      const handleTimeUpdate = () => {
        const now = Date.now()
        if (onTimeUpdate && now - lastSaveTime > 1500) {
          lastSaveTime = now
          onTimeUpdate(media.currentTime, media.duration)
        }
      }

      media.addEventListener('play', handlePlay)
      media.addEventListener('pause', handlePause)
      media.addEventListener('ended', handleEnded)
      media.addEventListener('timeupdate', handleTimeUpdate)

      timeout = {
        cleanup: () => {
          media.removeEventListener('play', handlePlay)
          media.removeEventListener('pause', handlePause)
          media.removeEventListener('ended', handleEnded)
          media.removeEventListener('timeupdate', handleTimeUpdate)
        }
      }
    }

    attachEvents()

    return () => {
      if (timeout && timeout.cleanup) {
        timeout.cleanup()
      } else if (timeout) {
        clearTimeout(timeout)
      }
    }
  }, [onEnded, onTimeUpdate])

  const plyrOptions = useMemo(() => ({
    controls: isGuest 
      ? ['current-time', 'duration', 'mute', 'volume', 'fullscreen']
      : ['play-large', 'rewind', 'play', 'fast-forward', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
    clickToPlay: !isGuest,
    settings: isGuest ? [] : ['speed', 'loop'],
    speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    seekTime: 10,
    keyboard: { focused: !isGuest, global: !isGuest },
    storage: { enabled: true, key: 'plyr_volume' },
    attributes: { crossorigin: 'anonymous' }
  }), [isGuest])

  const plyrSource = useMemo(() => ({
    type: 'video',
    sources: [
      {
        src: src,
        provider: 'html5',
      },
    ],
  }), [src])

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden [&_.plyr]:h-full [&_.plyr__video-wrapper]:h-full [&_video]:h-full [&_video]:object-contain">
      <Plyr
        ref={plyrRef}
        source={plyrSource}
        options={plyrOptions}
      />

      {isOfflinePlay && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-green-500/20 text-green-400 text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          OFFLINE PLAYBACK
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onClearProgress?.() }}
        title="Cancella progresso"
        className={`absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/60 border border-white/20 text-white hover:bg-red-600 hover:border-red-500 hover:scale-110 transition-all duration-200 shadow-lg backdrop-blur-sm ${
          !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <line x1="1" y1="1" x2="9" y2="9" /><line x1="9" y1="1" x2="1" y2="9" />
        </svg>
      </button>

      {showSkipIntro && (
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
    </div>
  )
}
