import { useEffect, useState, useRef } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { getMangaDetail, addMangaFavorite, removeMangaFavoriteApi, getMangaFavorites, addMangaWatchlist, removeMangaWatchlistApi, getMangaWatchlist, saveMangaWatchProgress, getMangaWatchProgress } from '../utils/api'

const Sk = ({ className }) => <div className={`skeleton rounded-lg ${className}`} />

const STATUS_CFG = {
  da_leggere:  { label: 'Da Leggere',  color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/40',   emoji: '📌' },
  in_lettura:  { label: 'In Lettura',  color: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/40', emoji: '📖' },
  completato:  { label: 'Completato',  color: 'text-emerald-400',bg: 'bg-emerald-500/15',border: 'border-emerald-500/40',emoji: '✅' },
  in_pausa:    { label: 'In Pausa',    color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', emoji: '⏸️' },
  abbandonato: { label: 'Abbandonato', color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/40',    emoji: '❌' },
}

export default function MangaDetail() {
  const { id } = useParams()
  const { state: base } = useLocation()
  const navigate = useNavigate()
  const chaptersRef = useRef(null)

  const [manga, setManga] = useState(base?.title ? base : null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isFav, setIsFav] = useState(false)
  const [watchStatus, setWatchStatus] = useState(null)
  const [wsOpen, setWsOpen] = useState(false)
  const [lastChapter, setLastChapter] = useState(null)
  const [chapSearch, setChapSearch] = useState('')

  // Scroll to chapters section if URL hash is #chapters
  useEffect(() => {
    if (window.location.hash === '#chapters') {
      setTimeout(() => {
        chaptersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 400)
    } else {
      window.scrollTo(0, 0)
    }
    setLoading(true); setError(null)
    
    getMangaDetail(id)
      .then(data => setManga(prev => ({ ...prev, ...data })))
      .catch(() => setError('Impossibile caricare i dettagli del manga.'))
      .finally(() => setLoading(false))

    // Carica stato preferiti
    getMangaFavorites()
      .then(favs => setIsFav(favs.some(f => f.id === id)))
      .catch(() => {})

    // Carica stato watchlist
    getMangaWatchlist()
      .then(wl => {
        const item = wl.find(w => w.id === id)
        setWatchStatus(item?.watchlist_status || null)
      })
      .catch(() => {})

    // Carica progress lettura
    getMangaWatchProgress(id)
      .then(data => { if (data?.chapter_id) setLastChapter(data.chapter_id) })
      .catch(() => {})
  }, [id])

  const toggleFav = async () => {
    if (isFav) {
      await removeMangaFavoriteApi(id)
      setIsFav(false)
    } else {
      await addMangaFavorite(id)
      setIsFav(true)
    }
  }

  const setStatus = async (status) => {
    if (status === watchStatus) { setWsOpen(false); return }
    await addMangaWatchlist(id, status)
    setWatchStatus(status)
    setWsOpen(false)
  }

  const removeStatus = async () => {
    await removeMangaWatchlistApi(id)
    setWatchStatus(null)
    setWsOpen(false)
  }

  if (error && !manga) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-4xl mb-3">😕</p>
      <p className="text-text-dim font-body mb-4">{error}</p>
      <Link to="/manga/catalog" className="text-accent hover:underline font-body text-sm">← Torna al catalogo manga</Link>
    </div>
  )

  const img = manga?.image || manga?.cover || ''
  const filteredChapters = manga?.chapters?.filter(ch =>
    !chapSearch || ch.title?.toLowerCase().includes(chapSearch.toLowerCase()) || String(ch.number || ch.id).includes(chapSearch)
  ) || []

  return (
    <div className="min-h-screen relative">
      {/* Tasto Indietro */}
      <button onClick={() => navigate('/manga/catalog')}
        className="absolute top-4 left-4 z-10 px-4 py-2 bg-black/50 hover:bg-black/70 text-white rounded-xl font-body text-xs font-semibold backdrop-blur-md border border-white/10 transition-all flex items-center gap-1.5 shadow-lg">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6" /></svg>
        Catalogo Manga
      </button>

      {/* Banner sfocato */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        <img src={img} alt="" className="w-full h-full object-cover scale-110 blur-sm" onError={e => { e.target.style.display = 'none' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/20 via-bg/50 to-bg" />
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-32 md:-mt-40 relative">
        <div className="flex flex-col md:flex-row gap-6">

          {/* Copertina */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <div className="w-36 md:w-44 aspect-[2/3] rounded-2xl overflow-hidden border-2 border-border shadow-2xl bg-surface">
              {loading && !manga?.image
                ? <Sk className="w-full h-full" />
                : <img src={img} alt={manga?.title} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
              }
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-2 text-center md:text-left">
            {loading && !manga?.title
              ? <Sk className="h-9 w-3/4 mb-3" />
              : <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-text tracking-wide leading-tight">{manga?.title}</h1>
            }

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
              {manga?.type && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent font-body">{manga.type}</span>}
              {manga?.status && <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-body">{manga.status}</span>}
              {manga?.year && <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-body">{manga.year}</span>}
              {manga?.author && <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-body">✍️ {manga.author}</span>}
              {manga?.genres?.slice(0, 4).map(g => (
                <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-body">{g}</span>
              ))}
            </div>

            {/* Descrizione */}
            {loading && !manga?.description
              ? <div className="mt-4 space-y-2"><Sk className="h-3 w-full" /><Sk className="h-3 w-5/6" /><Sk className="h-3 w-4/6" /></div>
              : manga?.description && <p className="mt-4 text-sm text-text-dim font-body leading-relaxed">{manga.description}</p>
            }

            {/* Azioni */}
            <div className="flex items-center gap-3 mt-5 justify-center md:justify-start flex-wrap">
              {/* Leggi primo/ultimo capitolo */}
              {manga?.chapters?.length > 0 && (
                <Link
                  to={`/manga/read/${id}/${lastChapter || manga.chapters[manga.chapters.length - 1]?.id}`}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-h text-white rounded-xl font-body font-medium text-sm transition-colors shadow-lg shadow-accent/20"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  {lastChapter ? 'Riprendi Lettura' : 'Inizia a Leggere'}
                </Link>
              )}

              {/* Preferito */}
              {manga && (
                <>
                  <button onClick={toggleFav} title="Aggiungi ai preferiti"
                    className={`p-2.5 rounded-xl border transition-colors ${isFav ? 'bg-accent/20 border-accent text-accent' : 'bg-surface border-border text-muted hover:border-accent/50 hover:text-accent'}`}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                    </svg>
                  </button>

                  {/* Watchlist status */}
                  {watchStatus && STATUS_CFG[watchStatus] ? (
                    <div className="relative">
                      <button onClick={() => setWsOpen(v => !v)}
                        className={`p-2.5 rounded-xl border transition-colors flex items-center gap-2 text-sm font-semibold ${STATUS_CFG[watchStatus].bg} ${STATUS_CFG[watchStatus].border} ${STATUS_CFG[watchStatus].color}`}>
                        <span>{STATUS_CFG[watchStatus].emoji}</span>
                        <span className="hidden sm:inline">{STATUS_CFG[watchStatus].label}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          style={{ transform: wsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {wsOpen && (
                        <div className="absolute left-0 top-full z-30 rounded-xl border overflow-hidden shadow-2xl"
                          style={{ background: '#0e0e1a', borderColor: 'rgba(255,255,255,0.12)', minWidth: '190px', marginTop: '6px' }}>
                          {Object.entries(STATUS_CFG).map(([key, c]) => (
                            <button key={key} onClick={() => setStatus(key)}
                              className={`w-full text-left px-4 py-2.5 text-xs font-semibold font-body flex items-center justify-between gap-2 transition-colors hover:bg-white/5 ${key === watchStatus ? c.color : 'text-text-dim'}`}>
                              <span className="flex items-center gap-2">{c.emoji} {c.label}</span>
                              {key === watchStatus && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                            </button>
                          ))}
                          <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <button onClick={removeStatus}
                              className="w-full text-left px-4 py-2.5 text-xs font-semibold font-body text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
                              Rimuovi dalla lista
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => setStatus('da_leggere')}
                      className="p-2.5 rounded-xl border transition-colors flex items-center gap-2 text-sm font-semibold bg-surface border-border text-muted hover:border-blue-500/50 hover:text-blue-400">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                      <span className="hidden sm:inline">+ La mia lista</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Lista Capitoli */}
        <div id="chapters" ref={chaptersRef} className="mt-10 pb-16">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-display text-2xl tracking-wide text-text flex items-center gap-2">
              CAPITOLI
              {manga?.chapters?.length > 0 && <span className="text-base text-muted font-body font-normal">({manga.chapters.length})</span>}
            </h2>
            {/* Ricerca capitoli */}
            {manga?.chapters?.length > 10 && (
              <input
                type="text"
                value={chapSearch}
                onChange={e => setChapSearch(e.target.value)}
                placeholder="Filtra capitoli..."
                className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs text-text placeholder-muted focus:outline-none focus:border-accent transition-colors font-body w-40"
              />
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Sk key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredChapters.length === 0 ? (
            <div className="text-center py-12 bg-surface/20 rounded-2xl border border-border">
              <p className="text-text-dim font-body">Nessun capitolo trovato</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
              {[...filteredChapters].map((ch) => {
                // Split title from date: e.g. "Capitolo 0112 Ottobre 2020" → ["Capitolo 01", "12 Ottobre 2020"]
                const rawTitle = ch.title || `Capitolo ${ch.number ?? ''}`
                // Try to detect a date pattern (digits + month word) at the end
                const dateMatch = rawTitle.match(/(\d{1,2}\s+\w+\s+\d{4})$/)
                const chapterName = dateMatch ? rawTitle.slice(0, rawTitle.lastIndexOf(dateMatch[0])).trim() : rawTitle
                const chapterDate = dateMatch ? dateMatch[0] : null

                return (
                <Link
                  key={ch.id}
                  to={`/manga/read/${id}/${ch.id}`}
                  state={{ chapterUrl: ch.url, mangaTitle: manga?.title, mangaImage: img, chapters: manga.chapters }}
                  onClick={() => saveMangaWatchProgress(id, ch.id).catch(() => {})}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all hover:border-accent/50 hover:bg-accent/5 group ${ch.id === lastChapter ? 'border-accent/30 bg-accent/5' : 'border-border bg-surface/50'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold font-body w-6 ${ch.id === lastChapter ? 'text-accent' : 'text-muted'}`}>
                      {ch.id === lastChapter ? '▶' : ''}
                    </span>
                    <p className="text-sm font-semibold text-text font-body">
                      {chapterName}
                      {chapterDate && (
                        <span className="font-normal text-muted"> — {chapterDate}</span>
                      )}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className="text-muted group-hover:text-accent transition-colors">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
                )
              })}

            </div>
          )}
          {error && <p className="text-sm text-yellow-400 font-body mt-4">⚠️ {error}</p>}
        </div>
      </div>
    </div>
  )
}
