import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDownloads } from '../hooks/useDownloads.js'

// ─── Icons ───────────────────────────────────────────────────────────────────
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
)
const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
    <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
  </svg>
)
const CancelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const CheckboxIcon = ({ checked }) => (
  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
    checked ? 'bg-accent border-accent' : 'border-border bg-surface'
  }`}>
    {checked && (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    )}
  </div>
)

// ─── Storage Meter ────────────────────────────────────────────────────────────
function StorageMeter({ usedBytes }) {
  const [quota, setQuota] = useState(null)
  const [usageFromBrowser, setUsageFromBrowser] = useState(null)

  useEffect(() => {
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        setQuota(quota)
        setUsageFromBrowser(usage)
      })
    }
  }, [])

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB'
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
    return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  }

  const used = usageFromBrowser ?? usedBytes
  const total = quota
  const pct = total ? Math.min(100, Math.round((used / total) * 100)) : null
  const barColor = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-400' : 'bg-accent'

  return (
    <div className="bg-surface/60 border border-border rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          <span className="text-sm font-semibold text-text">Spazio Dispositivo</span>
        </div>
        {pct !== null && (
          <span className={`text-xs font-bold ${pct > 80 ? 'text-red-400' : 'text-text-dim'}`}>{pct}% usato</span>
        )}
      </div>

      {/* Bar */}
      <div className="w-full h-2.5 bg-border/50 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700`}
          style={{ width: pct !== null ? `${pct}%` : '0%' }}
        />
      </div>

      <div className="flex justify-between text-[11px] text-text-dim font-body">
        <span>Download anime: <span className="text-text font-semibold">{formatBytes(usedBytes)}</span></span>
        {total && <span>Totale: <span className="text-text font-semibold">{formatBytes(total)}</span></span>}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DownloadsPage() {
  const { downloads, removeDownload, cancelDownload } = useDownloads()
  const [selected, setSelected] = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [speeds, setSpeeds] = useState({}) // episodeId -> speed string

  // Compute total size from completed downloads
  const totalSize = downloads.reduce((acc, d) => acc + (d.status === 'completed' ? (d.size || 0) : 0), 0)

  const formatSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  }

  // Simulate speed tracking for active downloads
  useEffect(() => {
    const active = downloads.filter(d => d.status === 'downloading')
    if (active.length === 0) {
      setSpeeds({})
      return
    }
    // Track last progress snapshot to compute speed
    const prevProgress = {}
    active.forEach(d => { prevProgress[d.episodeId] = d.progress })

    const interval = setInterval(() => {
      setSpeeds(prev => {
        const next = { ...prev }
        active.forEach(d => {
          const delta = (d.progress || 0) - (prevProgress[d.episodeId] || 0)
          prevProgress[d.episodeId] = d.progress || 0
          const sizePerPct = (d.size || 50 * 1024 * 1024) / 100 // estimate from total size
          const bytesPerSec = (delta * sizePerPct) / 2 // per 2s interval
          if (bytesPerSec > 0) {
            next[d.episodeId] = bytesPerSec >= 1024 ** 2
              ? `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`
              : `${Math.round(bytesPerSec / 1024)} KB/s`
          }
        })
        return next
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [downloads])

  // Selection helpers
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    const completedIds = downloads.filter(d => d.status === 'completed').map(d => d.episodeId)
    if (selected.size === completedIds.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(completedIds))
    }
  }

  const deleteSelected = () => {
    if (selected.size === 0) return
    if (window.confirm(`Eliminare ${selected.size} episodi scaricati?`)) {
      selected.forEach(id => removeDownload(id))
      setSelected(new Set())
      setSelectMode(false)
    }
  }

  const completed = downloads.filter(d => d.status === 'completed')
  const downloading = downloads.filter(d => d.status === 'downloading')
  const failed = downloads.filter(d => d.status === 'failed')

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between mb-8 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-text-dim hover:text-text transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div>
            <h1 className="font-display text-4xl tracking-wide">I MIEI DOWNLOAD</h1>
            <p className="text-xs text-text-dim font-body mt-1">
              {completed.length} episodi salvati · {downloading.length} in corso
            </p>
          </div>
        </div>

        {/* Bulk select controls */}
        {completed.length > 0 && (
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <button
                  onClick={toggleAll}
                  className="px-3 py-2 text-xs bg-surface border border-border rounded-xl text-text-dim hover:text-text transition-colors font-body"
                >
                  {selected.size === completed.length ? 'Deseleziona tutto' : 'Seleziona tutto'}
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={deleteSelected}
                    className="px-3 py-2 text-xs bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-colors font-body flex items-center gap-1.5"
                  >
                    <TrashIcon />
                    Elimina {selected.size}
                  </button>
                )}
                <button
                  onClick={() => { setSelectMode(false); setSelected(new Set()) }}
                  className="px-3 py-2 text-xs bg-surface border border-border rounded-xl text-text-dim hover:text-text transition-colors font-body"
                >
                  Annulla
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelectMode(true)}
                className="px-4 py-2 text-xs bg-surface border border-border rounded-xl text-text-dim hover:text-text hover:border-accent/40 transition-colors font-body flex items-center gap-1.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="9 11 12 14 22 4"/>
                </svg>
                Seleziona
              </button>
            )}
          </div>
        )}
      </div>

      {/* Storage Meter */}
      {downloads.length > 0 && <StorageMeter usedBytes={totalSize} />}

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-6 shadow-xl">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-accent">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <p className="text-text font-body mb-2 text-xl font-bold">Nessun episodio offline</p>
          <p className="text-text-dim font-body text-sm mb-8 leading-relaxed">
            Scarica i tuoi episodi preferiti per guardarli offline ovunque ti trovi — in treno, in aereo o dove non prende la rete.
          </p>
          <Link to="/catalog" className="px-6 py-3 bg-accent hover:bg-accent/80 text-white rounded-xl font-body text-xs font-bold shadow-lg shadow-accent/20 transition-all hover:scale-105 active:scale-95">
            Esplora il Catalogo
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Downloads */}
          {downloading.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-text-dim font-body mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse"/>
                In Download ({downloading.length})
              </h2>
              <div className="space-y-3">
                {downloading.map(item => (
                  <DownloadRow
                    key={item.episodeId}
                    item={item}
                    speed={speeds[item.episodeId]}
                    formatSize={formatSize}
                    onCancel={() => cancelDownload(item.episodeId)}
                    selectMode={false}
                    selected={false}
                    onToggle={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Failed */}
          {failed.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-text-dim font-body mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-400"/>
                Falliti ({failed.length})
              </h2>
              <div className="space-y-3">
                {failed.map(item => (
                  <DownloadRow
                    key={item.episodeId}
                    item={item}
                    formatSize={formatSize}
                    onDelete={() => removeDownload(item.episodeId)}
                    selectMode={false}
                    selected={false}
                    onToggle={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section>
              <h2 className="text-xs uppercase tracking-wider text-text-dim font-body mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400"/>
                Pronti Offline ({completed.length}) · {formatSize(totalSize)}
              </h2>
              <div className="space-y-3">
                {completed.map(item => (
                  <DownloadRow
                    key={item.episodeId}
                    item={item}
                    formatSize={formatSize}
                    onDelete={() => removeDownload(item.episodeId)}
                    selectMode={selectMode}
                    selected={selected.has(item.episodeId)}
                    onToggle={() => toggleSelect(item.episodeId)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Row component ────────────────────────────────────────────────────────────
function DownloadRow({ item, speed, formatSize, onCancel, onDelete, selectMode, selected, onToggle }) {
  const isCompleted = item.status === 'completed'
  const isDownloading = item.status === 'downloading'
  const isFailed = item.status === 'failed'

  return (
    <div
      className={`flex gap-4 items-center bg-surface/40 border rounded-2xl p-4 transition-all duration-200 hover:bg-surface/60 ${
        selected ? 'border-accent/50 bg-accent/5' : 'border-border/50 hover:border-border/80'
      }`}
      onClick={selectMode && isCompleted ? onToggle : undefined}
      style={selectMode && isCompleted ? { cursor: 'pointer' } : {}}
    >
      {/* Checkbox (select mode) */}
      {selectMode && isCompleted && (
        <CheckboxIcon checked={selected} />
      )}

      {/* Poster */}
      <div className="relative w-16 aspect-[2/3] rounded-xl overflow-hidden bg-surface flex-shrink-0 shadow-lg border border-white/5">
        <img
          src={item.animeImage || `https://img.animeworld.ac/locandine/${item.animeId}.jpg`}
          alt={item.animeTitle}
          className="w-full h-full object-cover"
          onError={e => { e.target.src = `https://img.animeworld.ac/copertine/${item.animeId}.png` }}
        />
        {isDownloading && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center p-1">
            <span className="text-accent font-bold text-xs font-body">{item.progress}%</span>
            <div className="w-8 bg-white/20 h-0.5 rounded-full overflow-hidden mt-1">
              <div className="bg-accent h-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold font-body text-text truncate mb-0.5">{item.animeTitle}</h3>
        <p className="text-xs text-text-dim font-body mb-2">Episodio {item.episodeNumber}</p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-dim font-body">{formatSize(item.size)}</span>

          {isCompleted && (
            <span className="flex items-center gap-1 text-[10px] font-semibold font-body text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
              ✓ Offline
            </span>
          )}
          {isDownloading && (
            <span className="flex items-center gap-1 text-[10px] font-semibold font-body text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              {item.progress}%{speed ? ` · ${speed}` : ''}
            </span>
          )}
          {isFailed && (
            <span className="text-[10px] font-semibold font-body text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
              ⚠ Fallito
            </span>
          )}
        </div>

        {isDownloading && (
          <div className="w-full bg-border/30 rounded-full h-1 mt-2.5 overflow-hidden max-w-xs">
            <div className="bg-accent h-1 rounded-full transition-all duration-300" style={{ width: `${item.progress}%` }} />
          </div>
        )}
      </div>

      {/* Actions */}
      {!selectMode && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCompleted && (
            <Link
              to={`/watch/${item.animeId}/${item.episodeId}`}
              className="p-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl transition-all shadow-lg shadow-accent/10 hover:scale-105 active:scale-95"
              title="Guarda Offline"
            >
              <PlayIcon />
            </Link>
          )}
          {isDownloading ? (
            <button
              onClick={onCancel}
              className="p-2.5 bg-surface border border-border hover:border-red-500/40 text-text-dim hover:text-red-400 rounded-xl transition-all hover:scale-105 active:scale-95"
              title="Annulla"
            >
              <CancelIcon />
            </button>
          ) : (
            <button
              onClick={onDelete}
              className="p-2.5 bg-surface border border-border hover:border-red-500/40 text-text-dim hover:text-red-400 rounded-xl transition-all hover:scale-105 active:scale-95"
              title="Elimina"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
