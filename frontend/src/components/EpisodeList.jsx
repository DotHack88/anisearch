import { Link } from 'react-router-dom'

export default function EpisodeList({ episodes, animeId, animeTitle }) {
  if (!episodes?.length) {
    return <p className="text-center py-10 text-muted font-body text-sm">Nessun episodio disponibile.</p>
  }
  
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
      {episodes.map((ep, i) => (
        <Link 
          key={ep.id || i} 
          to={`/watch/${animeId}/${ep.id}`}
          state={{ episodes, animeTitle }}
          aria-label={`${animeTitle} episodio ${ep.number}`}
          className="flex flex-col items-center justify-center aspect-square bg-surface border border-border rounded-xl hover:bg-accent hover:text-white hover:border-accent hover:scale-105 transition-all duration-200 font-body relative group overflow-hidden">
          
          <span className="text-sm font-semibold text-text group-hover:text-white transition-colors duration-200">
            {ep.number}
          </span>
          <span className="text-[8px] text-muted group-hover:text-white/80 transition-colors duration-200 uppercase tracking-widest mt-1">
            EP
          </span>

          {/* Subtle glow hover effect */}
          <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </Link>
      ))}
    </div>
  )
}
