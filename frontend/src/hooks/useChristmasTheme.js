import { useState, useEffect } from 'react'

export function useChristmasTheme() {
  const [isChristmas, setIsChristmas] = useState(() => {
    const saved = localStorage.getItem('anisearch_christmas_enabled')
    return saved !== null ? saved === 'true' : true
  })

  useEffect(() => {
    localStorage.setItem('anisearch_christmas_enabled', String(isChristmas))
  }, [isChristmas])

  const toggleChristmas = () => {
    setIsChristmas(prev => !prev)
  }

  return { isChristmas, toggleChristmas }
}

