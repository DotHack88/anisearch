import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function NewEpisodesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    const fetchLatest = async () => {
      try {
        setLoading(true);
        const res = await api.get('/latest-episodes');
        setData(res.data);
      } catch (err) {
        setError("Errore nel caricamento degli ultimi episodi");
      } finally {
        setLoading(false);
      }
    };
    fetchLatest();
  }, []);

  const tabs = [
    { id: 'all', label: 'Tutti' },
    { id: 'sub', label: 'Sub-ITA' },
    { id: 'dub', label: 'Dub-ITA' },
    { id: 'trending', label: 'Tendenze' }
  ];

  const currentItems = data ? (data[activeTab] || []) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 page-enter">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-text-dim hover:text-accent transition-colors" title="Torna alla Home">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <h1 className="text-3xl font-display font-bold text-text tracking-wide uppercase flex items-center gap-2">
            Ultimi Episodi Aggiornati
          </h1>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap cursor-pointer
                ${activeTab === tab.id 
                  ? 'bg-accent text-white shadow-lg shadow-accent/25 scale-105' 
                  : 'bg-surface text-text-dim hover:text-text hover:bg-surface/80 border border-border'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-surface rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-400 font-body">{error}</div>
      ) : currentItems.length === 0 ? (
        <div className="text-center py-20 text-text-dim font-body">Nessun episodio trovato per questa categoria.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {currentItems.map((item, index) => (
            <Link 
              key={index} 
              to={`/anime/${item.id}`} 
              state={item}
              className="group relative rounded-xl overflow-hidden aspect-[3/4] bg-surface block border border-border/40 hover:border-accent/40 transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1"
            >
              <img 
                src={item.image} 
                alt={item.title} 
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
                  {item.title}
                </h3>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {item.episode && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/90 text-white shadow-sm border border-white/10 backdrop-blur-sm">
                      {item.episode}
                    </span>
                  )}
                  {item.badges && item.badges.map((badge, i) => (
                    <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 text-white backdrop-blur-md uppercase">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
