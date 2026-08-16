import { Link } from 'react-router-dom'

export default function MangaCard({ manga, onRemove }) {
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
          <span className="absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 font-body z-10">
            {manga.status}
          </span>
        )}
        
        {/* Remove button (if onRemove provided) */}
        <div className="absolute top-2 right-2 z-20 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {onRemove && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onRemove(manga.id)
              }}
              className="w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors shadow-lg"
              title="Rimuovi dai preferiti"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Overlay hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
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
