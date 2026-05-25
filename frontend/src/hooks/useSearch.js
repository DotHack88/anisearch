import { useState, useEffect, useRef, useCallback } from 'react'
import { searchAnime } from '../utils/api.js'

const queryCache = new Map()

export function useSearch(debounceMs = 300) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [isOpen,  setIsOpen]  = useState(false)
  const timer = useRef(null)

  const doSearch = useCallback(async (q) => {
    if (q.length < 2) { setResults([]); setIsOpen(false); return }
    const key = q.toLowerCase()
    if (queryCache.has(key)) { setResults(queryCache.get(key)); setIsOpen(true); return }
    setLoading(true); setError(null)
    try {
      const data = await searchAnime(q)
      queryCache.set(key, data)
      setResults(data); setIsOpen(true)
    } catch {
      setError('Errore di rete. Il backend è avviato?')
      setResults([])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    clearTimeout(timer.current)
    if (!query.trim()) { setResults([]); setIsOpen(false); return }
    timer.current = setTimeout(() => doSearch(query), debounceMs)
    return () => clearTimeout(timer.current)
  }, [query, debounceMs, doSearch])

  const clearSearch = useCallback(() => {
    setQuery(''); setResults([]); setIsOpen(false); setError(null)
  }, [])

  return { query, setQuery, results, loading, error, isOpen, setIsOpen, clearSearch }
}
