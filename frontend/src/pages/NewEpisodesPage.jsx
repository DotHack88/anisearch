import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function NewEpisodesPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNewEpisodes = async () => {
      try {
        setLoading(true);
        const res = await api.get('/new?limit=100');
        setData(res.data.episodes || []);
      } catch (err) {
        setError("Errore nel caricamento dei nuovi episodi.");
      } finally {
        setLoading(false);
      }
    };
    fetchNewEpisodes();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
        <h1 className="text-3xl font-display font-bold text-text tracking-wide uppercase">
          Tutti i Nuovi Episodi
        </h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
            <div key={i} className="aspect-[3/4] bg-surface rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-400 font-body">{error}</div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 text-text-dim font-body">Nessun episodio trovato.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {data.map((item, index) => (
            <Link key={index} to={`/watch/${item.anime_id}/${item.id}`} className="group relative rounded-xl overflow-hidden aspect-[3/4] bg-surface block border border-border/40 hover:border-accent/40 transition-colors shadow-md hover:shadow-xl">
              <img 
                src={item.anime_image || `https://img.animeworld.ac/locandine/${item.anime_id}.jpg`} 
                alt={item.anime_title} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px] z-10">
                <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end z-20">
                <h3 className="text-sm font-bold text-white font-body line-clamp-2 mb-2 group-hover:text-accent transition-colors drop-shadow-md">
                  {item.anime_title}
                </h3>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {item.episode && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/90 text-white shadow-sm border border-white/10 backdrop-blur-sm">
                      Episodio {item.episode}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
