import { useState, useEffect, useRef, useCallback } from 'react'
import { searchAnime } from '../utils/api'

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

  const compressImage = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.8);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const searchByImage = async (file) => {
    if (!file) return;
    
    // Error Handling: Size and Format
    if (file.size > 5 * 1024 * 1024) {
      setError("L'immagine è troppo grande. Dimensione massima 5MB.");
      setIsOpen(true);
      return;
    }
    if (file.type === 'image/webp' || file.type === 'image/gif') {
      setError("Formato non supportato (WebP, GIF). Usa JPG o PNG.");
      setIsOpen(true);
      return;
    }
    
    setLoading(true);
    setError(null);
    setIsOpen(true);
    setQuery('');
    setResults([]);
    
    try {
      const compressedBlob = await compressImage(file);
      const formData = new FormData();
      formData.append("image", compressedBlob, "image.jpg");
      
      const response = await fetch("https://api.trace.moe/search?anilistInfo", {
        method: "POST",
        body: formData
      });
      
      if (response.status === 429) {
        throw new Error("Rate limiting superato (troppe richieste). Riprova più tardi.");
      }
      if (!response.ok) {
        throw new Error("Errore durante la ricerca per immagine.");
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.result && data.result.length > 0) {
        const bestMatch = data.result[0];
        const title = bestMatch.anilist?.title?.romaji || bestMatch.anilist?.title?.english || bestMatch.anilist?.title?.native || "";
        
        if (title) {
          setQuery(title.substring(0, 30).trim());
        } else {
          setError("Nessun anime trovato per questa immagine.");
        }
      } else {
        setError("Nessun anime trovato per questa immagine.");
      }
    } catch (err) {
      setError(err.message || "Errore sconosciuto durante la ricerca.");
    } finally {
      setLoading(false);
    }
  }

  return { query, setQuery, results, loading, error, isOpen, setIsOpen, clearSearch, searchByImage }
}
