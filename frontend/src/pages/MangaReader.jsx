import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { getChapterImages, saveMangaWatchProgress } from '../utils/api'

export default function MangaReader() {
  const { mangaId, chapterId } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()

  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [loadedCount, setLoadedCount] = useState(0)
  const [scrollMode, setScrollMode] = useState(true) // true = scroll continuo, false = pagina-per-pagina
  const [currentPage, setCurrentPage] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const hideTimer = useRef(null)
  const containerRef = useRef(null)

  const chapters = state?.chapters || []
  const currentIndex = chapters.findIndex(ch => ch.id === chapterId)
  const prevChapter = currentIndex > 0 ? chapters[currentIndex - 1] : null
  const nextChapter = currentIndex < chapters.length - 1 ? chapters[currentIndex + 1] : null
  const mangaTitle = state?.mangaTitle || 'Manga'
  const mangaImage = state?.mangaImage || ''

  // Carica immagini
  useEffect(() => {
    setLoading(true)
    setError(null)
    setImages([])
    setLoadedCount(0)
    setCurrentPage(0)
    window.scrollTo(0, 0)

    getChapterImages(chapterId)
      .then(data => {
        setImages(data.images || [])
        if (data.images?.length === 0) setError('Nessuna immagine trovata per questo capitolo.')
      })
      .catch(() => setError('Impossibile caricare le immagini del capitolo.'))
      .finally(() => setLoading(false))

    // Salva progress
    saveMangaWatchProgress(mangaId, chapterId).catch(() => {})
  }, [chapterId, mangaId])

  // Auto-nascondi controlli in scroll-mode
  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (scrollMode) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000)
    }
  }, [scrollMode])

  useEffect(() => {
    window.addEventListener('mousemove', resetHideTimer)
    window.addEventListener('click', resetHideTimer)
    return () => {
      window.removeEventListener('mousemove', resetHideTimer)
      window.removeEventListener('click', resetHideTimer)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [resetHideTimer])

  useEffect(() => { resetHideTimer() }, [scrollMode, resetHideTimer])

  // Pre-fetch immagini successive in modalità pagina
  useEffect(() => {
    if (images.length === 0 || scrollMode) return
    
    // Quante immagini pre-caricare in anticipo
    const preloadCount = 3
    const startIndex = currentPage + 1
    const endIndex = Math.min(startIndex + preloadCount, images.length)
    
    for (let i = startIndex; i < endIndex; i++) {
      const img = new Image()
      img.src = images[i]
    }
  }, [currentPage, images, scrollMode])

  // Navigazione tastiera in modalità pagina-per-pagina
  useEffect(() => {
    if (scrollMode) return
    const handleKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setCurrentPage(p => Math.min(p + 1, images.length - 1))
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setCurrentPage(p => Math.max(p - 1, 0))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [scrollMode, images.length])

  const navigateChapter = (ch) => {
    if (!ch) return
    navigate(`/manga/read/${mangaId}/${ch.id}`, {
      state: { ...state, chapters },
      replace: false
    })
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="w-8 h-8 border-2 border-accent/50 border-t-accent rounded-full animate-spin" />
      <p className="text-white/50 font-body text-sm">Caricamento capitolo...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-4 gap-4">
      <p className="text-4xl">😕</p>
      <p className="text-white/60 font-body">{error}</p>
      <button onClick={() => navigate(-1)} className="text-accent hover:underline font-body text-sm">← Indietro</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-black relative" ref={containerRef}>

      {/* Header controlli */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        <div className="bg-gradient-to-b from-black/90 to-transparent px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(`/manga/${mangaId}#chapters`)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>
          </button>

          {mangaImage && <img src={mangaImage} alt="" className="w-8 h-10 object-cover rounded-lg flex-shrink-0" />}

          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold font-body truncate">{mangaTitle}</p>
            <p className="text-white/50 text-xs font-body">Capitolo {chapterId} • {loadedCount}/{images.length} pagine</p>
          </div>

          {/* Toggle modalità */}
          <button
            onClick={() => setScrollMode(m => !m)}
            title={scrollMode ? 'Passa a modalità pagina' : 'Passa a modalità scroll'}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors"
          >
            {scrollMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* ---- MODALITÀ SCROLL CONTINUO ---- */}
      {scrollMode ? (
        <div className="flex flex-col items-center py-14">
          {images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`Pagina ${i + 1}`}
              loading="lazy"
              decoding="async"
              className="w-full md:max-w-3xl lg:max-w-4xl block object-contain shadow-2xl"
              style={{ display: 'block' }}
              onLoad={() => setLoadedCount(c => c + 1)}
              onError={e => { e.target.style.opacity = '0.3' }}
            />
          ))}

          {/* Pulsanti capitolo successivo/precedente (in fondo) */}
          <div className="flex items-center gap-4 mt-10 mb-20 px-4">
            {prevChapter ? (
              <button onClick={() => navigateChapter(prevChapter)}
                className="flex items-center gap-2 px-5 py-3 bg-surface border border-border rounded-xl text-text hover:border-accent/50 transition-colors font-body text-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
                Cap. precedente
              </button>
            ) : <div />}
            {nextChapter && (
              <button onClick={() => navigateChapter(nextChapter)}
                className="flex items-center gap-2 px-5 py-3 bg-accent hover:bg-accent-h text-white rounded-xl transition-colors font-body text-sm font-semibold shadow-lg shadow-accent/20">
                Cap. successivo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* ---- MODALITÀ PAGINA-PER-PAGINA ---- */
        <div className="flex flex-col items-center justify-center min-h-screen">
          {images[currentPage] && (
            <div className="relative w-full max-w-full md:max-w-5xl mx-auto px-0 md:px-2 flex justify-center items-center min-h-screen">
              <img
                src={images[currentPage]}
                alt={`Pagina ${currentPage + 1}`}
                className="w-full h-auto max-h-[100vh] object-contain select-none z-0"
                onLoad={() => setLoadedCount(c => Math.max(c, currentPage + 1))}
              />
              {/* Overlay invisibile per i controlli di click sinistra/destra */}
              <div 
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  // Metà sinistra -> indietro, Metà destra -> avanti
                  if (clickX < rect.width / 2) {
                    setCurrentPage(p => Math.max(p - 1, 0));
                  } else {
                    setCurrentPage(p => Math.min(p + 1, images.length - 1));
                  }
                }}
                title="Clicca a sinistra per tornare indietro, a destra per andare avanti"
              />
            </div>
          )}

          {/* Controlli pagina */}
          <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-8 pb-4">
            <div className="flex items-center justify-between max-w-2xl mx-auto gap-4">
              <button
                disabled={currentPage === 0}
                onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
                className="p-3 rounded-xl bg-surface border border-border text-text hover:border-accent/50 disabled:opacity-30 transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
              </button>

              <div className="flex-1 text-center">
                <p className="text-white text-sm font-semibold font-body">{currentPage + 1} / {images.length}</p>
                <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${((currentPage + 1) / images.length) * 100}%` }} />
                </div>
              </div>

              <button
                disabled={currentPage >= images.length - 1}
                onClick={() => setCurrentPage(p => Math.min(p + 1, images.length - 1))}
                className="p-3 rounded-xl bg-surface border border-border text-text hover:border-accent/50 disabled:opacity-30 transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>

            {/* Cambio capitolo (in fondo) */}
            {currentPage >= images.length - 1 && (
              <div className="flex items-center justify-center gap-3 mt-3 max-w-2xl mx-auto">
                {prevChapter && (
                  <button onClick={() => navigateChapter(prevChapter)}
                    className="text-xs font-body text-muted hover:text-text transition-colors">
                    ← Cap. precedente
                  </button>
                )}
                {nextChapter && (
                  <button onClick={() => navigateChapter(nextChapter)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-h text-white rounded-xl text-xs font-semibold font-body transition-colors">
                    Cap. successivo →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
