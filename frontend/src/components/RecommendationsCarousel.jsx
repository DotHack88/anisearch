import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getRecommendations } from '../utils/api'

export default function RecommendationsCarousel() {
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getRecommendations()
      .then(data => {
        if (active) {
          setRecommendations(data || [])
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('Error fetching recommendations:', err)
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  if (loading) {
    return (
      <div className="mb-10">
        <h2 className="text-xl font-bold font-display text-text mb-4 flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          Consigliati per Te
        </h2>
        <div className="flex gap-4 overflow-x-hidden">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex-none w-[140px] sm:w-[180px] h-[210px] sm:h-[270px] bg-surface rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return null
  }

  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold font-display text-text mb-4 flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Consigliati per Te
      </h2>
      
      <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x snap-mandatory">
        {recommendations.map((anime) => (
          <Link
            to={`/anime/${anime.id}`}
            key={anime.id}
            className="flex-none w-[140px] sm:w-[180px] group relative rounded-2xl overflow-hidden snap-start focus:outline-none focus:ring-2 focus:ring-accent bg-surface border border-border hover:border-accent/50 transition-all duration-300 hover:-translate-y-1 shadow-md hover:shadow-xl"
          >
            {/* Poster */}
            <div className="aspect-[2/3] w-full overflow-hidden bg-surface relative">
              <img
                src={anime.image}
                alt={anime.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
                onError={e => { e.target.style.display = 'none' }}
              />
              
              {/* Overlay info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="absolute bottom-0 left-0 w-full p-3">
                <h3 className="font-bold text-white text-sm line-clamp-2 font-body leading-tight drop-shadow-md">
                  {anime.title}
                </h3>
                
                {anime.genres && anime.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {anime.genres.slice(0, 2).map((g, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-accent/80 text-white text-[9px] font-bold rounded uppercase tracking-wider backdrop-blur-sm">
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
