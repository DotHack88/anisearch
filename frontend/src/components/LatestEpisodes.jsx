import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function LatestEpisodes({ limit }) {
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

  if (error) return null;
  if (loading) {
    return (
      <div className="mb-12">
        <div className="h-8 w-48 bg-surface rounded-lg mb-6 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="aspect-[3/4] bg-surface rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.error) return null;

  const tabs = [
    { id: 'all', label: 'Tutti' },
    { id: 'sub', label: 'Sub-ITA' },
    { id: 'dub', label: 'Dub-ITA' },
    { id: 'trending', label: 'Tendenze' }
  ];

  const allItems = data[activeTab] || [];
  const currentItems = limit ? allItems.slice(0, limit) : allItems;
  if (currentItems.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-display font-bold text-text flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Ultimi Episodi
          </h2>
          <Link to="/nuovi-episodi" className="hidden sm:inline-block text-xs text-muted hover:text-accent font-body transition-colors mt-1">
            Vedi tutti →
          </Link>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === tab.id 
                  ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                  : 'bg-surface text-text-dim hover:text-text hover:bg-surface/80 border border-border'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {currentItems.map((item, index) => (
          <Link key={index} to={`/anime/${item.id}`} state={item} className="group relative rounded-xl overflow-hidden aspect-[3/4] bg-surface block border border-border/40 hover:border-accent/40 transition-colors">
            <img 
              src={item.image} 
              alt={item.title} 
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
            
            <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col justify-end">
              <h3 className="text-sm font-bold text-white font-body line-clamp-2 mb-2 group-hover:text-accent transition-colors">
                {item.title}
              </h3>
              
              <div className="flex items-center gap-2 flex-wrap">
                {item.episode && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-accent/90 text-white shadow-sm">
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
    </div>
  );
}
