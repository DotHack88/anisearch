import { useState, useEffect, useCallback } from 'react'

const KEY = 'anisearch_favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
  })

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(favorites)) } catch {}
  }, [favorites])

  const toggleFavorite = useCallback((anime) => {
    setFavorites(prev =>
      prev.find(f => f.id === anime.id)
        ? prev.filter(f => f.id !== anime.id)
        : [anime, ...prev]
    )
  }, [])

  const removeFavorite = useCallback((id) => {
    setFavorites(prev => prev.filter(f => f.id !== id))
  }, [])

  const isFavorite = useCallback((id) =>
    favorites.some(f => f.id === id), [favorites])

  return { favorites, toggleFavorite, removeFavorite, isFavorite }
}
