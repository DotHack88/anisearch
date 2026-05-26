import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSearch } from '../hooks/useSearch.jsx'

const TypeBadge = ({ type }) => {
  if (!type) return null
  const map = { TV: 'text-blue-300', Movie: 'text-purple-300', OVA: 'text-green-300', ONA: 'text-yellow-300' }
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 font-body ${map[type] || 'text-gray-300'}`}>{type}</span>
}

export default function SearchBar({ large = false, autoFocus = false }) {
  const navigate = useNavigate()
  const { query, setQuery, results, loading, error, isOpen, setIsOpen, clearSearch } = useSearch()
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef   = useRef(null)
  const dropRef    = useRef(null)

  useEffect(() => { setActiveIdx(-1) }, [results])

  useEffect(() => {
    const handler = (e) => {
      if (!dropRef.current?.contains(e.target) && !inputRef.current?.contains(e.target))
        setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [setIsOpen])

  const handleKey = (e) => {
    if (!isOpen) return
    if (e.key === 'ArrowDown')  { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    if (e.key === 'Enter' && activeIdx >= 0) select(results[activeIdx])
    if (e.key === 'Escape')     { setIsOpen(false); inputRef.current?.blur() }
  }

  const select = (anime) => { clearSearch(); navigate(`/anime/${anime.id}`, { state: anime }) }

  const base = `w-full bg-surface border border-border rounded-xl text-text placeholder-muted focus:outline-none focus:border-accent transition-colors font-body`
  const cls  = large ? `${base} pl-14 pr-12 py-5 text-lg rounded-2xl` : `${base} pl-11 pr-10 py-3 text-sm`

  return (
    <div className="relative w-full">
      <div className="relative">
        {/* Icona sinistra */}
        <span className={`absolute ${large ? 'left-5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-muted pointer-events-none`}>
          {loading
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          }
        </span>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Cerca un anime..."
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
          className={cls}
        />

        {query && (
          <button onClick={clearSearch} className={`absolute ${large ? 'right-5' : 'right-3'} top-1/2 -translate-y-1/2 text-muted hover:text-text p-1`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && query.length >= 2 && (
        <div ref={dropRef} className="absolute top-full mt-2 w-full bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-down">
          {error ? (
            <p className="px-4 py-3 text-sm text-red-400 font-body">{error}</p>
          ) : results.length === 0 && !loading ? (
            <p className="px-4 py-4 text-sm text-muted font-body text-center">Nessun risultato per "<span className="text-text">{query}</span>"</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {results.map((anime, i) => (
                <li key={anime.id}
                  onClick={() => select(anime)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-border/50 last:border-0 transition-colors ${i === activeIdx ? 'bg-accent/10' : 'hover:bg-surface'}`}
                >
                  <div className="w-10 h-14 flex-shrink-0 rounded-md overflow-hidden bg-surface">
                    <img src={anime.image} alt={anime.title} loading="lazy" className="w-full h-full object-cover"
                      onError={e => { e.target.style.display = 'none' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate font-body">{anime.title}</p>
                    <div className="mt-0.5"><TypeBadge type={anime.type} /></div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted flex-shrink-0"><path d="m9 18 6-6-6-6"/></svg>
                </li>
              ))}
            </ul>
          )}
          {results.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-surface/50 text-center">
              <p className="text-xs text-muted font-body">
                <kbd className="bg-border px-1 rounded text-[10px]">↑↓</kbd> naviga &nbsp;
                <kbd className="bg-border px-1 rounded text-[10px]">Enter</kbd> apri &nbsp;
                <kbd className="bg-border px-1 rounded text-[10px]">Esc</kbd> chiudi
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
