import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMangaCatalog, searchManga } from '../utils/api'

const Sk = ({ className }) => <div className={`skeleton rounded-lg ${className}`} />

function MangaCard({ manga }) {
  return (
    <Link
      to={`/manga/${manga.id}`}
      state={manga}
      className="group flex flex-col bg-card border border-border rounded-xl overflow-hidden hover:border-accent/50 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/10"
    >
      <div className="aspect-[2/3] overflow-hidden bg-surface relative">
        <img
          src={manga.image}
          alt={manga.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { e.target.style.display = 'none' }}
        />
        {/* Badge stato */}
        {manga.status && (
          <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 font-body">
            {manga.status}
          </span>
        )}
        {/* Overlay hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="text-[10px] text-white/90 font-body font-semibold flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Leggi
          </span>
        </div>
      </div>
      <div className="p-2 flex flex-col gap-1 flex-1">
        <p className="text-xs font-semibold text-text font-body leading-tight line-clamp-2">{manga.title}</p>
        <p className="text-[10px] text-muted font-body mt-auto">
          {manga.genres?.slice(0, 2).join(', ')}
          {manga.year && <span className="ml-1 opacity-60">• {manga.year}</span>}
        </p>
      </div>
    </Link>
  )
}

export default function MangaList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState(null)
  const [selectedGenre, setSelectedGenre] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [sortBy, setSortBy] = useState('title')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => {
    if (searchResults !== null) return // se stiamo mostrando ricerca live, non aggiornare catalogo
    setLoading(true)
    setError(null)
    getMangaCatalog({
      page,
      per_page: 24,
      sort: sortBy,
      genre: selectedGenre,
      status: selectedStatus,
      search: '',
    })
      .then(data => {
        setItems(data.items || [])
        setTotalPages(data.total_pages || 0)
        setTotalItems(data.total || 0)
      })
      .catch(() => setError('Impossibile caricare il catalogo manga.'))
      .finally(() => setLoading(false))
  }, [page, sortBy, selectedGenre, selectedStatus, searchResults])

  // Ricerca live via scraper
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null)
      return
    }
    const timer = setTimeout(() => {
      setSearching(true)
      searchManga(search.trim())
        .then(res => setSearchResults(res || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false))
    }, 600)
    return () => clearTimeout(timer)
  }, [search])

  const displayItems = searchResults !== null ? searchResults : items

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wide text-text">
            CATALOGO <span className="text-accent">MANGA</span>
          </h1>
          <p className="text-xs text-text-dim mt-1 font-body">
            {searchResults !== null
              ? `${searchResults.length} risultati trovati su MangaWorld`
              : `${totalItems.toLocaleString()} manga nel database locale`
            }
          </p>
        </div>

        {/* Barra di ricerca */}
        <div className="w-full md:w-80 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            {searching
              ? <div className="w-4 h-4 border-2 border-accent/50 border-t-accent rounded-full animate-spin" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            }
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca un manga..."
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors font-body"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text p-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Filtri (solo se non ricerca live) */}
      {searchResults === null && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 bg-surface/40 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider font-body px-1">Stato</label>
            <select value={selectedStatus} onChange={e => { setSelectedStatus(e.target.value); setPage(0) }} className="filter-select">
              <option value="">Tutti</option>
              <option value="In corso">In corso</option>
              <option value="Completato">Completato</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider font-body px-1">Ordina Per</label>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0) }} className="filter-select">
              <option value="title">Titolo (A-Z)</option>
              <option value="year">Anno (Nuovi prima)</option>
            </select>
          </div>
          <div className="flex items-end col-span-2 sm:col-span-2">
            <button
              onClick={() => { setSearch(''); setSelectedGenre(''); setSelectedStatus(''); setSortBy('title'); setPage(0) }}
              className="w-full bg-border hover:bg-border/80 border border-white/5 text-text font-medium text-xs py-2.5 rounded-xl transition-all font-body flex items-center justify-center gap-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
              Resetta Filtri
            </button>
          </div>
        </div>
      )}

      {/* Griglia */}
      {error ? (
        <div className="text-center py-20 bg-surface/20 rounded-2xl border border-border">
          <p className="text-4xl mb-3">😕</p>
          <p className="text-text-dim font-body mb-4">{error}</p>
          <p className="text-xs text-muted font-body">Il catalogo manga viene popolato dopo la prima ricerca.</p>
        </div>
      ) : loading && !searchResults ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col bg-card border border-border rounded-xl overflow-hidden">
              <Sk className="aspect-[2/3] w-full" />
              <div className="p-2 space-y-1.5"><Sk className="h-3 w-3/4" /><Sk className="h-2.5 w-1/2" /></div>
            </div>
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="text-center py-24 bg-surface/20 rounded-2xl border border-border">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/50 mx-auto mb-4">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {search
            ? <p className="text-text-dim font-body">Nessun manga trovato per "{search}"</p>
            : <><p className="text-text-dim font-body mb-2">Il catalogo manga è vuoto</p><p className="text-xs text-muted font-body">Usa la ricerca per trovare un manga</p></>
          }
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {displayItems.map(manga => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>
          {/* Paginazione (solo catalogo locale) */}
          {searchResults === null && totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4 font-body">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="p-2.5 rounded-xl border border-border bg-surface text-text-dim hover:text-text hover:border-accent disabled:opacity-30 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <span className="text-sm font-semibold text-text-dim">
                Pagina <span className="text-text">{page + 1}</span> di <span className="text-text">{totalPages}</span>
              </span>
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                className="p-2.5 rounded-xl border border-border bg-surface text-text-dim hover:text-text hover:border-accent disabled:opacity-30 transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
