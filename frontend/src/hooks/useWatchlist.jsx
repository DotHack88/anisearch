import { useState, useEffect, useCallback } from 'react'
import { getWatchlist, getWatchlistStats, addWatchlist, updateWatchlist, removeWatchlistApi } from '../utils/api'

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchWatchlist = useCallback(() => {
    setLoading(true)
    Promise.all([getWatchlist(), getWatchlistStats()])
      .then(([items, statsData]) => {
        setWatchlist(items)
        setStats(statsData)
      })
      .catch(err => console.error('Errore nel caricamento della watchlist:', err))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchWatchlist()
  }, [fetchWatchlist])

  const addToWatchlist = (anime, status = 'da_guardare', episodesTotal = null) => {
    addWatchlist(anime.id, status, 0, episodesTotal)
      .then(() => {
        const newItem = {
          ...anime,
          watchlist_status: status,
          episodes_watched: 0,
          episodes_total: episodesTotal,
          progress: 0,
          notes: null,
          added_at: new Date().toISOString(),
          last_update: new Date().toISOString(),
          completed_at: status === 'completato' ? new Date().toISOString() : null,
        }
        setWatchlist(prev => {
          const exists = prev.find(a => a.id === anime.id)
          if (exists) {
            return prev.map(a => a.id === anime.id ? { ...a, ...newItem } : a)
          }
          return [newItem, ...prev]
        })
        setStats(prev => prev ? refreshStats([...watchlist.filter(a => a.id !== anime.id), newItem]) : prev)
      })
      .catch(err => console.error('Errore aggiunta watchlist:', err))
  }

  const updateStatus = (animeId, status, episodesWatched, episodesTotal, notes) => {
    updateWatchlist(animeId, status, episodesWatched, episodesTotal, notes)
      .then(() => {
        setWatchlist(prev => {
          const updated = prev.map(a => {
            if (a.id !== animeId) return a
            const watched = episodesWatched ?? a.episodes_watched
            const total = episodesTotal ?? a.episodes_total
            const progress = total && total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : a.progress
            return {
              ...a,
              watchlist_status: status,
              episodes_watched: watched,
              episodes_total: total,
              progress,
              notes: notes ?? a.notes,
              last_update: new Date().toISOString(),
              completed_at: status === 'completato' ? (a.completed_at || new Date().toISOString()) : null,
            }
          })
          setStats(refreshStats(updated))
          return updated
        })
      })
      .catch(err => console.error('Errore aggiornamento watchlist:', err))
  }

  const removeWatchlist = (animeId) => {
    removeWatchlistApi(animeId)
      .then(() => {
        setWatchlist(prev => {
          const updated = prev.filter(a => a.id !== animeId)
          setStats(refreshStats(updated))
          return updated
        })
      })
      .catch(err => console.error('Errore rimozione watchlist:', err))
  }

  const getItemStatus = (animeId) => {
    const item = watchlist.find(a => a.id === animeId)
    return item ? item.watchlist_status : null
  }

  const getItem = (animeId) => watchlist.find(a => a.id === animeId) || null

  return { watchlist, stats, loading, addToWatchlist, updateStatus, removeWatchlist, getItemStatus, getItem, fetchWatchlist }
}

function refreshStats(items) {
  const totale = items.length
  const completati = items.filter(i => i.watchlist_status === 'completato').length
  const in_visione = items.filter(i => i.watchlist_status === 'in_visione').length
  const da_guardare = items.filter(i => i.watchlist_status === 'da_guardare').length
  const in_pausa = items.filter(i => i.watchlist_status === 'in_pausa').length
  const abbandonati = items.filter(i => i.watchlist_status === 'abbandonato').length
  return {
    totale,
    completati,
    in_visione,
    da_guardare,
    in_pausa,
    abbandonati,
    completamento_globale: totale > 0 ? Math.round((completati / totale) * 100) : 0,
  }
}
