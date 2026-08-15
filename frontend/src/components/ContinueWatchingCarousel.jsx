import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getRecentWatchProgress, deleteWatchProgress } from '../utils/api'

export default function ContinueWatchingCarousel() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getRecentWatchProgress()
      .then(data => {
        if (active) {
          setHistory(data.slice(0, 10)) // Show up to 10 recent items
          setLoading(false)
        }
      })
      .catch(err => {
        console.error('Error fetching watch history:', err)
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const handleRemove = async (e, animeId, episodeId) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      localStorage.removeItem(`watch_${animeId}_${episodeId}`)
      localStorage.removeItem(`watch_progress_${animeId}_${episodeId}`)
      await deleteWatchProgress(animeId, episodeId)
      setHistory(prev => prev.filter(item => item.anime_id !== animeId))
    } catch (err) {
      console.error('Error removing watch progress:', err)
    }
  }


  if (loading) {
    return (
      <div className="mb-10">
        <h2 className="text-xl font-bold font-display text-text mb-4">Continua a Guardare</h2>
        <div className="flex gap-4 overflow-x-hidden">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex-none w-[280px] h-[160px] bg-surface rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return null
  }

  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold font-display text-text mb-4">Continua a Guardare</h2>
      
      <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x snap-mandatory">
        {history.map((item) => {
          // If we have a saved timestamp in localStorage, we can use it to resume directly
          // but for now we just link to the episode. The VideoPlayer logic already reads from localStorage
          return (
            <Link
              to={`/watch/${item.anime_id}/${item.episode_id}`}
              key={item.anime_id}
              className="flex-none w-[280px] sm:w-[320px] group relative rounded-2xl overflow-hidden snap-start focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {/* Background Image */}
              <div className="aspect-[16/9] w-full relative">
                <img 
                  src={item.anime_image} 
                  alt={item.anime_title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>
                
                {/* Remove Button */}
                <button
                  onClick={(e) => handleRemove(e, item.anime_id, item.episode_id)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100 z-10"
                  title="Rimuovi"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/40 transform scale-90 group-hover:scale-100 transition-all">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 w-full p-4">
                <h3 className="font-bold text-white text-sm truncate font-body shadow-black drop-shadow-md">
                  {item.anime_title}
                </h3>
                <p className="text-accent text-xs font-semibold mt-1 shadow-black drop-shadow-md">
                  Episodio {item.episode_number}
                </p>
                
                {/* Visual Progress Bar (simulated for now, as real timestamp is in localStorage not backend) */}
                <div className="w-full h-1 bg-white/20 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
