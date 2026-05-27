import { useEffect, useState } from 'react'
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import EpisodeList from '../components/EpisodeList.jsx'
import { useFavorites } from '../hooks/useFavorites.jsx'
import { getAnimeDetail, getWatchProgress } from '../utils/api.js'

const Sk = ({ className }) => <div className={`skeleton rounded-lg ${className}`} />

export default function AnimePage() {
  const { id } = useParams()
  const { state: base } = useLocation()
  const { toggleFavorite, isFavorite } = useFavorites()
  const navigate = useNavigate()

  const [anime, setAnime] = useState(base?.title ? base : null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null)
  const fav = isFavorite(id)

  useEffect(() => {
    window.scrollTo(0, 0)
    setLoading(true); setError(null)
    getAnimeDetail(id)
      .then(data => setAnime(prev => ({ ...prev, ...data })))
      .catch(() => setError('Impossibile caricare i dettagli.'))
      .finally(() => setLoading(false))

    getWatchProgress(id)
      .then(data => {
        if (data && data.episode_id) {
          setProgress(data)
        }
      })
      .catch(err => console.error('Error fetching progress:', err))
  }, [id])

  if (error && !anime) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-4xl mb-3">😕</p>
      <p className="text-text-dim font-body mb-4">{error}</p>
      <Link to="/" className="text-accent hover:underline font-body text-sm">← Torna alla home</Link>
    </div>
  )

  const img = anime?.image || `https://img.animeworld.ac/locandine/${id}.jpg`
  const cover = anime?.cover || `https://img.animeworld.ac/copertine/${id}.png`

  const lastWatchedEpisode = anime?.episodes?.find(ep => ep.id === progress?.episode_id)

  return (
    <div className="min-h-screen relative">
      {/* Tasto Indietro */}
      <button onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-10 px-4 py-2 bg-black/50 hover:bg-black/70 text-white rounded-xl font-body text-xs font-semibold backdrop-blur-md border border-white/10 transition-all flex items-center gap-1.5 shadow-lg">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Indietro
      </button>

      {/* Banner sfocato */}
      <div className="relative h-52 md:h-64 overflow-hidden">
        <img src={cover} alt="" className="w-full h-full object-cover scale-110 blur-sm"
          onError={e => { e.target.style.display = 'none' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/20 via-bg/50 to-bg" />
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-32 md:-mt-40 relative">
        <div className="flex flex-col md:flex-row gap-6">

          {/* Copertina */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <div className="w-36 md:w-44 aspect-[2/3] rounded-2xl overflow-hidden border-2 border-border shadow-2xl bg-surface">
              {loading && !anime?.image
                ? <Sk className="w-full h-full" />
                : <img src={img} alt={anime?.title} className="w-full h-full object-cover"
                  onError={e => { e.target.src = cover; e.target.onerror = () => { e.target.style.display = 'none' } }} />
              }
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-2 text-center md:text-left">
            {loading && !anime?.title
              ? <Sk className="h-9 w-3/4 mb-3" />
              : <h1 className="font-display text-3xl sm:text-4xl md:text-5xl text-text tracking-wide leading-tight">{anime?.title}</h1>
            }

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
              {anime?.type && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/20 text-accent font-body">{anime.type}</span>}
              {anime?.status && <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-body">{anime.status}</span>}
              {anime?.year && <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-body">{anime.year}</span>}
              {anime?.genres?.slice(0, 4).map(g => (
                <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-muted font-body">{g}</span>
              ))}
            </div>

            {/* Descrizione */}
            {loading && !anime?.description
              ? <div className="mt-4 space-y-2"><Sk className="h-3 w-full" /><Sk className="h-3 w-5/6" /><Sk className="h-3 w-4/6" /></div>
              : anime?.description && <p className="mt-4 text-sm text-text-dim font-body leading-relaxed line-clamp-3">{anime.description}</p>
            }

            {/* Azioni */}
            <div className="flex items-center gap-3 mt-5 justify-center md:justify-start flex-wrap">
              {lastWatchedEpisode ? (
                <Link to={`/watch/${id}/${lastWatchedEpisode.id}`} state={{ episodes: anime.episodes, animeTitle: anime.title, animeImage: img }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-h text-white rounded-xl font-body font-medium text-sm transition-colors shadow-lg shadow-accent/20">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  Riprendi da Ep. {lastWatchedEpisode.number}
                </Link>
              ) : (
                anime?.episodes?.[0] && (
                  <Link to={`/watch/${id}/${anime.episodes[0].id}`} state={{ episodes: anime.episodes, animeTitle: anime.title, animeImage: img }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-h text-white rounded-xl font-body font-medium text-sm transition-colors shadow-lg shadow-accent/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    Guarda Ep. 1
                  </Link>
                )
              )}
              {anime?.url && (
                <a href={anime.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border hover:border-accent/50 text-text rounded-xl font-body text-sm transition-colors">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                  AnimeWorld
                </a>
              )}
              {anime && (
                <button onClick={() => toggleFavorite({ id, title: anime.title, image: img, type: anime.type })}
                  className={`p-2.5 rounded-xl border transition-colors ${fav ? 'bg-accent/20 border-accent text-accent' : 'bg-surface border-border text-muted hover:border-accent/50 hover:text-accent'}`}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Episodi */}
        <div className="mt-10 pb-16">
          <h2 className="font-display text-2xl tracking-wide text-text mb-5 flex items-center gap-2">
            EPISODI
            {anime?.episodes?.length > 0 && <span className="text-base text-muted font-body font-normal">({anime.episodes.length})</span>}
          </h2>
          {loading
            ? <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">{Array.from({ length: 20 }).map((_, i) => <Sk key={i} className="aspect-square rounded-xl" />)}</div>
            : <EpisodeList episodes={anime?.episodes} animeId={id} animeTitle={anime?.title} animeImage={img} />
          }
          {error && <p className="text-sm text-yellow-400 font-body mt-4">⚠️ {error}</p>}
        </div>
      </div>
    </div>
  )
}
