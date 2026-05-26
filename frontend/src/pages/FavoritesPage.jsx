import { Link } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard.jsx'
import { useFavorites } from '../hooks/useFavorites.jsx'

export default function FavoritesPage() {
  const { favorites, removeFavorite } = useFavorites()
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link to="/" className="text-muted hover:text-text transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <h1 className="font-display text-4xl tracking-wide">I MIEI PREFERITI</h1>
        {favorites.length > 0 && <span className="ml-auto text-sm text-muted font-body">{favorites.length} anime</span>}
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-border mb-4">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"/>
          </svg>
          <p className="text-text-dim font-body mb-3">Nessun preferito ancora</p>
          <Link to="/" className="text-accent hover:underline font-body text-sm">Cerca un anime →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {favorites.map(anime => <AnimeCard key={anime.id} anime={anime} onRemove={removeFavorite} />)}
        </div>
      )}
    </div>
  )
}
