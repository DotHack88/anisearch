import { useState, useEffect, useRef, useCallback } from 'react'
import { searchAnime } from '../utils/api'

const queryCache = new Map()

export function useSearch(debounceMs = 300) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [isOpen,  setIsOpen]  = useState(false)
  const [imageResult, setImageResult] = useState(null)
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
    setQuery(''); setResults([]); setIsOpen(false); setError(null); setImageResult(null)
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
    setImageResult(null);
    
    try {
      const compressedBlob = await compressImage(file);
      
      // 1. Trace.moe
      const formData = new FormData();
      formData.append("image", compressedBlob, "image.jpg");
      
      const traceResponse = await fetch("https://api.trace.moe/search?anilistInfo", {
        method: "POST",
        body: formData
      });
      
      let traceSuccess = false;
      let bestMatch = null;
      
      if (traceResponse.ok) {
        const data = await traceResponse.json();
        if (data.result && data.result.length > 0) {
          bestMatch = data.result[0];
          if (bestMatch.similarity >= 0.85) {
            traceSuccess = true;
          }
        }
      }
      
      if (traceSuccess) {
        const title = bestMatch.anilist?.title?.romaji || bestMatch.anilist?.title?.english || bestMatch.anilist?.title?.native || "";
        if (title) {
          setImageResult({
            image: bestMatch.image,
            video: bestMatch.video,
            episode: bestMatch.episode,
            similarity: bestMatch.similarity,
            title: title,
            source: 'Trace.moe'
          });
          setQuery(title.substring(0, 30).trim());
          return;
        }
      }

      // 2. SauceNAO Fallback (per fanart/loghi/cover)
      const sauceForm = new FormData();
      sauceForm.append("file", compressedBlob, "image.jpg");
      
      const sauceResponse = await fetch("https://saucenao.com/search.php?output_type=2", {
        method: "POST",
        body: sauceForm
      });

      if (sauceResponse.ok) {
        const sauceData = await sauceResponse.json();
        if (sauceData.results && sauceData.results.length > 0) {
          const bestSauce = sauceData.results[0];
          const similarity = parseFloat(bestSauce.header.similarity);
          if (similarity >= 60.0) { // Soglia più bassa per SauceNAO
             const title = bestSauce.data.source || bestSauce.data.title || bestSauce.data.eng_name || bestSauce.data.jp_name;
             if (title) {
               setImageResult({
                 image: bestSauce.header.thumbnail,
                 video: null,
                 episode: null,
                 similarity: similarity / 100,
                 title: title,
                 source: 'SauceNAO'
               });
               // Pulisce eventuali suffissi tra parentesi (es. "Title (Anime)")
               const cleanTitle = title.split(' (')[0].split('[')[0].substring(0, 30).trim();
               setQuery(cleanTitle);
               return;
             }
          }
        }
      }

      // Se entrambi falliscono
      setError("Nessun anime o artwork trovato per questa immagine con somiglianza sufficiente.");
    } catch (err) {
      setError(err.message || "Errore sconosciuto durante la ricerca.");
    } finally {
      setLoading(false);
    }
  }

  return { query, setQuery, results, loading, error, isOpen, setIsOpen, clearSearch, searchByImage, imageResult }
}
