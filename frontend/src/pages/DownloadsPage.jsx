import { Link } from 'react-router-dom'
import { useDownloads } from '../hooks/useDownloads.js'

export default function DownloadsPage() {
  const { downloads, removeDownload, cancelDownload } = useDownloads()

  // Calculate storage space
  const totalSize = downloads.reduce((acc, cur) => acc + (cur.size || 0), 0)
  const totalMB = (totalSize / (1024 * 1024)).toFixed(1)

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB'
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-8 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted hover:text-text transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="font-display text-4xl tracking-wide">I MIEI DOWNLOAD</h1>
        </div>
        
        {downloads.length > 0 && (
          <span className="text-xs px-3.5 py-1.5 bg-surface border border-border text-muted font-body rounded-full self-start sm:self-center shadow-sm">
            Spazio utilizzato: <span className="text-accent font-semibold">{totalMB} MB</span>
          </span>
        )}
      </div>

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6 shadow-xl">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <p className="text-text font-body mb-2 text-xl font-bold">Nessun episodio offline</p>
          <p className="text-muted font-body text-sm mb-8 leading-relaxed">
            Scarica i tuoi episodi preferiti per guardarli offline ovunque ti trovi, in treno, in aereo o dove non prende la rete.
          </p>
          <Link to="/catalog" className="px-6 py-3 bg-accent hover:bg-accent-h text-white rounded-xl font-body text-xs font-bold shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95">
            Esplora il Catalogo
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {downloads.map((item) => {
            const isCompleted = item.status === 'completed'
            const isDownloading = item.status === 'downloading'
            const isFailed = item.status === 'failed'

            return (
              <div 
                key={item.episodeId} 
                className="glass-card rounded-2xl overflow-hidden border border-border/40 p-4 flex gap-4 items-center transition-all duration-300 hover:border-border/80 hover:bg-surface/30"
              >
                {/* Poster / Thumbnail */}
                <div className="relative w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden bg-surface flex-shrink-0 shadow-lg border border-white/5">
                  <img 
                    src={item.animeImage || `https://img.animeworld.ac/locandine/${item.animeId}.jpg`} 
                    alt={item.animeTitle} 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      e.target.src = `https://img.animeworld.ac/copertine/${item.animeId}.png`
                    }}
                  />
                  {isDownloading && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center p-1">
                      <div className="text-accent font-bold text-sm font-body">
                        {item.progress}%
                      </div>
                      <div className="w-10 bg-white/20 h-0.5 rounded-full overflow-hidden mt-1">
                        <div className="bg-accent h-full" style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold font-body text-text truncate mb-1">
                    {item.animeTitle}
                  </h3>
                  <p className="text-xs text-text-dim font-body mb-3">
                    Episodio {item.episodeNumber}
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-muted font-body">
                      {formatSize(item.size)}
                    </span>

                    {isCompleted && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold font-body text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Pronto offline
                      </span>
                    )}

                    {isDownloading && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold font-body text-accent bg-accent/10 border border-accent/20 px-2.5 py-0.5 rounded-full">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        Download...
                      </span>
                    )}

                    {isFailed && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold font-body text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-0.5 rounded-full" title={item.errorMsg}>
                        ⚠️ Fallito
                      </span>
                    )}
                  </div>

                  {/* Progress Bar below details on mobile/tablet */}
                  {isDownloading && (
                    <div className="w-full bg-border/30 rounded-full h-1 mt-3.5 overflow-hidden max-w-md">
                      <div 
                        className="bg-accent h-1 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isCompleted && (
                    <Link 
                      to={`/watch/${item.animeId}/${item.episodeId}`}
                      className="p-2.5 bg-accent hover:bg-accent-h text-white rounded-xl transition-all shadow-lg shadow-accent/10 flex items-center justify-center hover:scale-105 active:scale-95"
                      title="Guarda Offline"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </Link>
                  )}

                  {isDownloading ? (
                    <button 
                      onClick={() => cancelDownload(item.episodeId)}
                      className="p-2.5 bg-border hover:bg-border/80 text-text rounded-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95"
                      title="Annulla download"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  ) : (
                    <button 
                      onClick={() => removeDownload(item.episodeId)}
                      className="p-2.5 bg-surface border border-border hover:border-accent/40 text-muted hover:text-accent rounded-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95"
                      title="Elimina file offline"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
