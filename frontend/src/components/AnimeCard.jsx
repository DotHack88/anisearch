import { Link } from 'react-router-dom'

export default function AnimeCard({ anime, onRemove }) {
  const isFinished = anime.status?.toLowerCase().includes('finito')
  const isOngoing = anime.status?.toLowerCase().includes('corso')

  const statusClass = isFinished
    ? 'badge-finito'
    : isOngoing
    ? 'badge-corso'
    : 'bg-white/5 border-white/10 text-text-dim'

  return (
    <Link to={`/anime/${anime.id}`} state={anime}
      className="group relative flex flex-col bg-card border border-border rounded-xl overflow-hidden anime-card-hover">
      
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] bg-surface overflow-hidden">
        <img 
          src={anime.image} 
          alt={anime.title} 
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={e => { 
            e.target.src = `https://img.animeworld.ac/copertine/${anime.id}.png`
            e.target.onerror = () => { e.target.style.display = 'none' } 
          }} 
        />
        
        {/* Shadow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {anime.type && (
            <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-black/75 border border-white/10 text-white font-body">
              {anime.type}
            </span>
          )}
          {anime.year && (
            <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent/80 text-white font-body self-start">
              {anime.year}
            </span>
          )}
        </div>

        {/* Remove Button for Favorites */}
        {onRemove && (
          <button 
            onClick={e => { e.preventDefault(); onRemove(anime.id) }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/85 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-accent z-25">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}

        {/* Info overlay on hover */}
        <div className="absolute bottom-0 inset-x-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col gap-1 z-10">
          {anime.status && (
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border self-start font-body ${statusClass}`}>
              {anime.status}
            </span>
          )}
          
          {anime.genres && anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {anime.genres.slice(0, 2).map(genre => (
                <span key={genre} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white font-body">
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Title & Static Info Section */}
      <div className="p-3 flex-1 flex flex-col justify-between">
        <h3 className="text-xs font-bold text-text line-clamp-2 leading-snug font-body group-hover:text-accent transition-colors duration-200">
          {anime.title}
        </h3>
        
        {/* Inline Tags for non-hovered state */}
        <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-[10px] text-text-dim font-body">
          <span>{anime.year || 'N/A'}</span>
          <span className="truncate max-w-[60%] text-right font-medium">
            {anime.genres?.[0] || anime.type || ''}
          </span>
        </div>
      </div>
    </Link>
  )
}
