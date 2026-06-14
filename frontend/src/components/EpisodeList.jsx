import { Link } from 'react-router-dom'

export default function EpisodeList({ episodes, animeId, animeTitle, animeImage, lastWatchedId }) {
  if (!episodes?.length) {
    return <p className="text-center py-10 text-muted font-body text-sm">Nessun episodio disponibile.</p>
  }
  
  return (
    <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-10 lg:grid-cols-12 gap-2">
      {episodes.map((ep, i) => {
        const isWatched = lastWatchedId === ep.id;
        return (
        <Link 
          key={ep.id || i} 
          to={`/watch/${animeId}/${ep.id}`}
          state={{ episodes, animeTitle, animeImage }}
          aria-label={`${animeTitle} episodio ${ep.number}`}
          className={`flex flex-col items-center justify-center aspect-square border rounded-xl transition-all duration-200 font-body relative group overflow-hidden
            ${isWatched 
              ? 'bg-accent/10 border-accent/50 shadow-[0_0_15px_rgba(251,56,75,0.15)] ring-1 ring-accent/30 scale-105' 
              : 'bg-surface border-border hover:bg-accent hover:text-white hover:border-accent hover:scale-105'}`}
        >
          
          <span className={`text-sm font-semibold transition-colors duration-200 ${isWatched ? 'text-accent group-hover:text-white' : 'text-text group-hover:text-white'}`}>
            {ep.number}
          </span>
          <span className={`text-[8px] transition-colors duration-200 uppercase tracking-widest mt-1 ${isWatched ? 'text-accent/80 group-hover:text-white/80' : 'text-muted group-hover:text-white/80'}`}>
            EP
          </span>

          {/* Subtle glow hover effect */}
          <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </Link>
      )})}
    </div>
  )
}
