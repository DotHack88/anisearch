import { useState, useEffect, useCallback } from 'react'
import { getMangaFavorites, addMangaFavorite, removeMangaFavoriteApi } from '../utils/api'

export function useMangaFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMangaFavorites()
      .then(data => setFavorites(Array.isArray(data) ? data : []))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleFavorite = useCallback(async (manga) => {
    const already = favorites.some(f => f.id === manga.id)
    if (already) {
      setFavorites(prev => prev.filter(f => f.id !== manga.id))
      removeMangaFavoriteApi(manga.id).catch(() => {
        // rollback on error
        setFavorites(prev => [manga, ...prev])
      })
    } else {
      setFavorites(prev => [manga, ...prev])
      addMangaFavorite(manga.id).catch(() => {
        setFavorites(prev => prev.filter(f => f.id !== manga.id))
      })
    }
  }, [favorites])

  const removeFavorite = useCallback(async (id) => {
    setFavorites(prev => prev.filter(f => f.id !== id))
    removeMangaFavoriteApi(id).catch(() => {})
  }, [])

  const isFavorite = useCallback((id) =>
    favorites.some(f => f.id === id), [favorites])

  return { favorites, loading, toggleFavorite, removeFavorite, isFavorite }
}
