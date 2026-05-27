import { useEffect, useState } from 'react'
import { getCatalog, getFilters } from '../utils/api.js'
import AnimeCard from '../components/AnimeCard.jsx'

export default function CatalogPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters State
  const [genres, setGenres] = useState([])
  const [years, setYears] = useState([])
  const [statuses, setStatuses] = useState([])

  // Selection state
  const [search, setSearch] = useState('')
  const [selectedGenre, setSelectedGenre] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedYear, setSelectedYear] = useState('')
  const [sortBy, setSortBy] = useState('title')
  
  // Pagination
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)

  // Load Filters once
  useEffect(() => {
    getFilters()
      .then(data => {
        setGenres(data.genres || [])
        setYears(data.years || [])
        setStatuses(data.statuses || [])
      })
      .catch(err => console.error('Error fetching filters:', err))
  }, [])

  // Load Catalog data whenever query, filters, sort, or page changes
  useEffect(() => {
    setLoading(true)
    setError(null)
    
    getCatalog({
      page,
      per_page: 24,
      sort: sortBy,
      genre: selectedGenre,
      status: selectedStatus,
      year: selectedYear,
      search: search
    })
      .then(data => {
        setItems(data.items || [])
        setTotalPages(data.total_pages || 0)
        setTotalItems(data.total || 0)
      })
      .catch(() => setError('Impossibile caricare il catalogo. Riprova più tardi.'))
      .finally(() => setLoading(false))
  }, [page, sortBy, selectedGenre, selectedStatus, selectedYear, search])

  // Reset page to 0 on filter change
  const handleFilterChange = (setter, value) => {
    setter(value)
    setPage(0)
  }

  const handleClearFilters = () => {
    setSearch('')
    setSelectedGenre('')
    setSelectedStatus('')
    setSelectedYear('')
    setSortBy('title')
    setPage(0)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wide text-text">
            CATALOGO <span className="text-accent">ANIME</span>
          </h1>
          <p className="text-xs text-text-dim mt-1 font-body">
            {totalItems.toLocaleString()} anime trovati nel database locale
          </p>
        </div>

        {/* Search bar inside Catalog */}
        <div className="w-full md:w-80 relative">
          <input
            type="text"
            value={search}
            onChange={e => handleFilterChange(setSearch, e.target.value)}
            placeholder="Filtra per titolo..."
            className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors font-body"
          />
          {search && (
            <button 
              onClick={() => handleFilterChange(setSearch, '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text p-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-8 bg-surface/40 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
        {/* Genre filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider font-body px-1">Genere</label>
          <select
            value={selectedGenre}
            onChange={e => handleFilterChange(setSelectedGenre, e.target.value)}
            className="filter-select"
          >
            <option value="">Tutti i generi</option>
            {genres.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider font-body px-1">Stato</label>
          <select
            value={selectedStatus}
            onChange={e => handleFilterChange(setSelectedStatus, e.target.value)}
            className="filter-select"
          >
            <option value="">Tutti gli stati</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Year filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider font-body px-1">Anno</label>
          <select
            value={selectedYear}
            onChange={e => handleFilterChange(setSelectedYear, e.target.value)}
            className="filter-select"
          >
            <option value="">Tutti gli anni</option>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Sorting filter */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider font-body px-1">Ordina Per</label>
          <select
            value={sortBy}
            onChange={e => handleFilterChange(setSortBy, e.target.value)}
            className="filter-select"
          >
            <option value="title">Titolo (A-Z)</option>
            <option value="year">Anno (Nuovi prima)</option>
            <option value="rating">Voto (Top prima)</option>
          </select>
        </div>

        {/* Reset button */}
        <div className="flex items-end col-span-2 sm:col-span-3 md:col-span-1">
          <button
            onClick={handleClearFilters}
            className="w-full bg-border hover:bg-border/80 border border-white/5 text-text font-medium text-xs py-2.5 rounded-xl transition-all font-body flex items-center justify-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Resetta Filtri
          </button>
        </div>
      </div>

      {/* Main Grid */}
      {error ? (
        <div className="text-center py-20 bg-surface/20 rounded-2xl border border-border">
          <p className="text-4xl mb-3">😕</p>
          <p className="text-text-dim font-body mb-4">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex flex-col bg-card border border-border rounded-xl overflow-hidden aspect-[2/3.8] p-2 space-y-3">
              <div className="skeleton rounded-lg aspect-[2/3] w-full" />
              <div className="skeleton rounded h-4 w-3/4" />
              <div className="skeleton rounded h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 bg-surface/20 rounded-2xl border border-border">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/50 mx-auto mb-4">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <p className="text-text-dim font-body mb-2">Nessun anime corrisponde ai filtri impostati</p>
          <p className="text-xs text-muted font-body">Prova a cambiare o rimuovere qualche filtro</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {items.map(anime => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-4 font-body">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="p-2.5 rounded-xl border border-border bg-surface text-text-dim hover:text-text hover:border-accent disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text-dim transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              
              <span className="text-sm font-semibold text-text-dim">
                Pagina <span className="text-text">{page + 1}</span> di <span className="text-text">{totalPages}</span>
              </span>

              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="p-2.5 rounded-xl border border-border bg-surface text-text-dim hover:text-text hover:border-accent disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text-dim transition-all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
