import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api'

export default function LatestChapters({ limit = 12 }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/manga/latest-chapters')
      .then(res => setItems(Array.isArray(res.data) ? res.data.slice(0, limit) : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [limit])

  if (loading) {
    return (
      <div className="mb-12">
        <div className="h-8 w-56 bg-surface rounded-lg mb-6 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!items.length) return null

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl tracking-wide text-text flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          ULTIMI CAPITOLI
        </h2>
        <Link to="/manga/catalog" className="text-xs text-muted hover:text-accent font-body transition-colors">
          Catalogo Manga →
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((manga) => (
          <div key={manga.id} className="group flex flex-col gap-0 bg-card/40 border border-border/50 rounded-2xl overflow-hidden hover:border-accent/40 hover:-translate-y-1 transition-all duration-300 shadow-md hover:shadow-xl">
            {/* Copertina */}
            <Link
              to={`/manga/${manga.id}`}
              state={{ id: manga.id, title: manga.title, image: manga.image, url: manga.url }}
              className="block aspect-[2/3] overflow-hidden relative bg-surface"
            >
              <img
                src={manga.image}
                alt={manga.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                onError={e => { e.target.style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            {/* Info */}
            <div className="p-2.5 flex flex-col gap-1.5 flex-1">
              <Link
                to={`/manga/${manga.id}`}
                state={{ id: manga.id, title: manga.title, image: manga.image, url: manga.url }}
                className="text-xs font-semibold text-text font-body line-clamp-2 leading-tight hover:text-accent transition-colors"
              >
                {manga.title}
              </Link>

              {/* Ultimi capitoli */}
              <div className="flex flex-col gap-1 mt-0.5">
                {manga.chapters?.slice(0, 2).map(ch => (
                  <Link
                    key={ch.id}
                    to={`/manga/read/${manga.id}/${ch.id}`}
                    state={{ mangaTitle: manga.title, mangaImage: manga.image }}
                    className="flex items-center justify-between group/ch"
                  >
                    <span className="text-[10px] text-accent hover:underline font-body truncate flex items-center gap-1">
                      {ch.is_new && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                      )}
                      {ch.title}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className="text-muted group-hover/ch:text-accent transition-colors flex-shrink-0 ml-1">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
