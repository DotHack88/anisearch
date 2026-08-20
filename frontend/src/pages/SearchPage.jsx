import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { searchAnime, searchManga } from '../utils/api'
import AnimeCard from '../components/AnimeCard.jsx'
import MangaCard from '../components/MangaCard.jsx'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  
  const [animeResults, setAnimeResults] = useState([])
  const [mangaResults, setMangaResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!q) {
      setAnimeResults([])
      setMangaResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    Promise.all([
      searchAnime(q).catch(() => []),
      searchManga(q).catch(() => [])
    ]).then(([anime, manga]) => {
      setAnimeResults(anime || [])
      setMangaResults(manga || [])
    }).catch(() => {
      setError('Errore durante la ricerca. Riprova più tardi.')
    }).finally(() => {
      setLoading(false)
    })
  }, [q])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl tracking-wide text-text">
          RISULTATI PER <span className="text-accent">"{q}"</span>
        </h1>
        <p className="text-sm text-text-dim mt-2 font-body">
          {animeResults.length + mangaResults.length} risultati trovati
        </p>
      </div>

      {error ? (
        <div className="text-center py-20 bg-surface/20 rounded-2xl border border-border">
          <p className="text-4xl mb-3">😕</p>
          <p className="text-text-dim font-body mb-4">{error}</p>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col bg-card border border-border rounded-xl overflow-hidden aspect-[2/3.8] p-2 space-y-3">
              <div className="skeleton rounded-lg aspect-[2/3] w-full" />
              <div className="skeleton rounded h-4 w-3/4" />
              <div className="skeleton rounded h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-12">
          {/* Anime Section */}
          <div>
            <h2 className="text-2xl font-display mb-4 border-b border-border/50 pb-2">Anime ({animeResults.length})</h2>
            {animeResults.length === 0 ? (
              <p className="text-muted font-body text-sm py-4">Nessun anime trovato.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {animeResults.map(anime => (
                  <AnimeCard key={anime.id} anime={anime} />
                ))}
              </div>
            )}
          </div>

          {/* Manga Section */}
          <div>
            <h2 className="text-2xl font-display mb-4 border-b border-border/50 pb-2">Manga ({mangaResults.length})</h2>
            {mangaResults.length === 0 ? (
              <p className="text-muted font-body text-sm py-4">Nessun manga trovato.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {mangaResults.map(manga => (
                  <MangaCard key={manga.id} manga={manga} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
