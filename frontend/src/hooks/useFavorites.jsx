import { useState, useEffect, useCallback } from 'react'
import { getFavorites, addFavorite, removeFavoriteApi } from '../utils/api'

export function useFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFavorites()
      .then(data => setFavorites(Array.isArray(data) ? data : []))
      .catch(() => setFavorites([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleFavorite = useCallback(async (anime) => {
    const already = favorites.some(f => f.id === anime.id)
    if (already) {
      setFavorites(prev => prev.filter(f => f.id !== anime.id))
      removeFavoriteApi(anime.id).catch(() => {
        // rollback on error
        setFavorites(prev => [anime, ...prev])
      })
    } else {
      setFavorites(prev => [anime, ...prev])
      addFavorite(anime.id).catch(() => {
        setFavorites(prev => prev.filter(f => f.id !== anime.id))
      })
    }
  }, [favorites])

  const removeFavorite = useCallback(async (id) => {
    setFavorites(prev => prev.filter(f => f.id !== id))
    removeFavoriteApi(id).catch(() => {})
  }, [])

  const isFavorite = useCallback((id) =>
    favorites.some(f => f.id === id), [favorites])

  return { favorites, loading, toggleFavorite, removeFavorite, isFavorite }
}
