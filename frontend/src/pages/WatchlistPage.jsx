import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useWatchlist } from '../hooks/useWatchlist.jsx'

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  da_guardare: { label: 'Da Vedere',   emoji: '📌', color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/40' },
  in_visione:  { label: 'In Visione',  emoji: '▶️',  color: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/40' },
  completato:  { label: 'Completato',  emoji: '✅',  color: 'text-emerald-400',bg: 'bg-emerald-500/15',border: 'border-emerald-500/40' },
  in_pausa:    { label: 'In Pausa',    emoji: '⏸️',  color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/40' },
  abbandonato: { label: 'Abbandonato', emoji: '❌',  color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/40' },
}

const SORT_OPTIONS = [
  { value: 'last_update', label: 'Ultimo aggiornamento' },
  { value: 'added_at',    label: 'Data aggiunta' },
  { value: 'title_asc',   label: 'Titolo A→Z' },
  { value: 'title_desc',  label: 'Titolo Z→A' },
  { value: 'progress',    label: 'Avanzamento' },
]

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, status, hasTotal, episodesWatched }) {
  const color = status === 'completato' ? '#10b981'
    : status === 'in_pausa' ? '#f59e0b'
    : status === 'abbandonato' ? '#ef4444'
    : '#8b5cf6'

  // If no total is set but user has watched episodes, show an indeterminate-style fill
  const displayValue = hasTotal ? value : (episodesWatched > 0 ? Math.min(85, episodesWatched * 8) : 0)
  const isIndeterminate = !hasTotal && episodesWatched > 0

  return (
    <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
      <div
        className={`h-full rounded-full transition-all duration-700${isIndeterminate ? ' opacity-60' : ''}`}
        style={{ width: `${displayValue}%`, background: `linear-gradient(90deg, ${color}cc, ${color})` }}
      />
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ emoji, label, value, sub, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-1"
      style={{ background: 'rgba(11,11,18,0.7)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xl">{emoji}</span>
        <span className="text-3xl font-black" style={{ color: accent, fontFamily: 'var(--font-display)' }}>{value}</span>
      </div>
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-body)' }}>{label}</p>
      {sub && <p className="text-[10px]" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-body)' }}>{sub}</p>}
    </div>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({ anime, onSave, onClose }) {
  const [status, setStatus] = useState(anime.watchlist_status)
  const [watched, setWatched] = useState(anime.episodes_watched ?? 0)
  const [total, setTotal] = useState(anime.episodes_total ?? '')
  const [notes, setNotes] = useState(anime.notes ?? '')

  const progress = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0

  const handleWatched = (v) => {
    const n = Math.max(0, parseInt(v) || 0)
    setWatched(n)
    if (total > 0 && n >= total) setStatus('completato')
    else if (n > 0 && status === 'da_guardare') setStatus('in_visione')
    else if (n === 0 && status === 'in_visione') setStatus('da_guardare')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl border overflow-hidden shadow-2xl"
        style={{ background: '#0b0b12', borderColor: 'rgba(255,255,255,0.08)' }}>

        {/* Header */}
        <div className="relative h-24 overflow-hidden">
          <img src={anime.image || `https://img.animeworld.ac/copertine/${anime.id}.png`} alt=""
            className="w-full h-full object-cover scale-110 blur-sm opacity-40" />
          <div className="absolute inset-0 flex items-end p-4 gap-3" style={{ background: 'linear-gradient(to top, #0b0b12 30%, transparent)' }}>
            <img src={anime.image} alt={anime.title}
              className="w-12 h-16 object-cover rounded-lg border border-white/10 shadow-lg flex-shrink-0"
              onError={e => { e.target.src = `https://img.animeworld.ac/copertine/${anime.id}.png` }} />
            <div className="min-w-0">
              <p className="font-bold text-sm text-white line-clamp-1 font-body">{anime.title}</p>
              <p className="text-[10px] text-text-dim font-body">{anime.year} · {anime.type}</p>
            </div>
          </div>
          <button onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-text-dim hover:text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-text-dim font-body mb-2 block">STATO</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <button key={key} onClick={() => setStatus(key)}
                  className={`text-xs font-semibold py-2 px-2 rounded-xl border transition-all font-body text-center ${status === key ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-surface border-border text-muted hover:border-white/20'}`}>
                  <span className="mr-1">{cfg.emoji}</span>{cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Episodi */}
          <div>
            <label className="text-xs font-semibold text-text-dim font-body mb-2 block">PROGRESSO EPISODI</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-muted font-body mb-1 block">Visti</label>
                <input type="number" min="0" max={total || 9999} value={watched}
                  onChange={e => handleWatched(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm font-body text-text font-semibold focus:outline-none border transition-colors"
                  style={{ background: '#13131f', borderColor: 'rgba(255,255,255,0.08)' }} />
              </div>
              <span className="text-text-dim text-lg mt-5">/</span>
              <div className="flex-1">
                <label className="text-[10px] text-muted font-body mb-1 block">Totali</label>
                <input type="number" min="0" placeholder="?" value={total}
                  onChange={e => setTotal(parseInt(e.target.value) || '')}
                  className="w-full px-3 py-2 rounded-xl text-sm font-body text-text focus:outline-none border transition-colors"
                  style={{ background: '#13131f', borderColor: 'rgba(255,255,255,0.08)' }} />
              </div>
            </div>
            {total > 0 && (
              <div className="mt-3 space-y-1.5">
                <ProgressBar value={progress} status={status} />
                <p className="text-right text-[10px] text-muted font-body">{progress}%</p>
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="text-xs font-semibold text-text-dim font-body mb-2 block">NOTE PERSONALI</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Aggiungi una nota..."
              className="w-full px-3 py-2 rounded-xl text-sm font-body text-text focus:outline-none border transition-colors resize-none"
              style={{ background: '#13131f', borderColor: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border text-sm font-semibold font-body text-text-dim hover:text-text transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'transparent' }}>
              Annulla
            </button>
            <button onClick={() => onSave(status, watched, total || null, notes || null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold font-body text-white transition-all hover:brightness-110 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #c084fc)' }}>
              Salva
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Watchlist Card ───────────────────────────────────────────────────────────
function WatchlistCard({ anime, onEdit, onRemove }) {
  const cfg = STATUS_CONFIG[anime.watchlist_status] || STATUS_CONFIG.da_guardare
  const img = anime.image || `https://img.animeworld.ac/locandine/${anime.id}.jpg`
  const episodesWatched = anime.episodes_watched ?? 0
  const episodesTotal = anime.episodes_total ?? null
  // Compute progress locally: if total is known use it, otherwise 0 but show activity bar
  const progress = episodesTotal > 0
    ? Math.min(100, Math.round((episodesWatched / episodesTotal) * 100))
    : (anime.progress ?? 0)
  const hasTotal = episodesTotal != null && episodesTotal > 0

  const dateLabel = anime.last_update
    ? new Date(anime.last_update).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
    : null

  return (
    <div className="group relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{ background: 'rgba(13,13,20,0.9)', borderColor: 'rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}>

      {/* Poster */}
      <Link to={`/anime/${anime.id}`} state={anime} className="relative block aspect-[2/3] overflow-hidden bg-surface flex-shrink-0">
        <img src={img} alt={anime.title} loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={e => { e.target.src = `https://img.animeworld.ac/copertine/${anime.id}.png`; e.target.onerror = null }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status Badge */}
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}
          style={{ fontFamily: 'var(--font-body)' }}>
          {cfg.emoji} {cfg.label}
        </div>

        {/* Action buttons (hover) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button onClick={e => { e.preventDefault(); onEdit(anime) }}
            className="w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-white hover:bg-violet-500/80 transition-colors"
            title="Modifica">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={e => { e.preventDefault(); onRemove(anime.id) }}
            className="w-7 h-7 rounded-full bg-black/80 border border-white/10 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors"
            title="Rimuovi">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <Link to={`/anime/${anime.id}`} state={anime}>
          <h3 className="text-xs font-bold line-clamp-2 leading-snug group-hover:text-accent transition-colors"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}>
            {anime.title}
          </h3>
        </Link>

        {/* Episode progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]" style={{ fontFamily: 'var(--font-body)' }}>
            <span style={{ color: 'var(--color-muted)' }}>
              Ep. <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{episodesWatched}</span>
              {hasTotal && <span style={{ color: 'var(--color-muted)' }}>/{episodesTotal}</span>}
            </span>
            <span className={`font-bold ${cfg.color}`}>
              {hasTotal ? `${progress}%` : (episodesWatched > 0 ? `${episodesWatched} ep` : '—')}
            </span>
          </div>
          <ProgressBar value={progress} status={anime.watchlist_status} hasTotal={hasTotal} episodesWatched={episodesWatched} />
        </div>

        {/* Notes */}
        {anime.notes && (
          <p className="text-[9px] line-clamp-1 italic border-t pt-1.5"
            style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-body)', borderColor: 'rgba(255,255,255,0.05)' }}>
            "{anime.notes}"
          </p>
        )}

        {/* Date */}
        {dateLabel && (
          <p className="text-[9px]" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-body)' }}>
            Aggiornato {dateLabel}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WatchlistPage() {
  const { watchlist, stats, loading, updateStatus, removeWatchlist } = useWatchlist()
  const [activeTab, setActiveTab] = useState('tutti')
  const [sortBy, setSortBy] = useState('last_update')
  const [editTarget, setEditTarget] = useState(null)

  const filtered = useMemo(() => {
    let list = activeTab === 'tutti' ? watchlist : watchlist.filter(a => a.watchlist_status === activeTab)
    switch (sortBy) {
      case 'title_asc':   return [...list].sort((a, b) => a.title.localeCompare(b.title))
      case 'title_desc':  return [...list].sort((a, b) => b.title.localeCompare(a.title))
      case 'progress':    return [...list].sort((a, b) => (b.progress ?? 0) - (a.progress ?? 0))
      case 'added_at':    return [...list].sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0))
      default:            return [...list].sort((a, b) => new Date(b.last_update || 0) - new Date(a.last_update || 0))
    }
  }, [watchlist, activeTab, sortBy])

  const handleSave = (status, watched, total, notes) => {
    if (!editTarget) return
    updateStatus(editTarget.id, status, watched, total, notes)
    setEditTarget(null)
  }

  const tabs = [
    { key: 'tutti',       label: 'Tutti',        count: stats?.totale ?? 0 },
    { key: 'da_guardare', label: 'Da Vedere',     count: stats?.da_guardare ?? 0 },
    { key: 'in_visione',  label: 'In Visione',    count: stats?.in_visione ?? 0 },
    { key: 'completato',  label: 'Completati',    count: stats?.completati ?? 0 },
    { key: 'in_pausa',    label: 'In Pausa',      count: stats?.in_pausa ?? 0 },
    { key: 'abbandonato', label: 'Abbandonati',   count: stats?.abbandonati ?? 0 },
  ]

  return (
    <div className="min-h-screen page-enter">
      {/* Hero */}
      <div className="relative overflow-hidden py-14 px-4" style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, transparent 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(139,92,246,0.12), transparent)'
        }} />
        <div className="max-w-7xl mx-auto relative">
          <h1 className="text-5xl sm:text-6xl font-black tracking-wide mb-2"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
            <span style={{ background: 'linear-gradient(135deg, #c084fc, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              LA MIA LISTA
            </span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-body)' }}>La tua libreria personale di anime.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-20 -mt-4">

        {/* Stats Dashboard */}
        {stats && stats.totale > 0 && (
          <div className="mb-10">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <StatCard emoji="📚" label="Totale Anime" value={stats.totale} accent="#c084fc" />
              <StatCard emoji="✅" label="Completati" value={stats.completati} accent="#10b981" />
              <StatCard emoji="▶️" label="In Visione" value={stats.in_visione} accent="#8b5cf6" />
              <StatCard emoji="📌" label="Da Vedere" value={stats.da_guardare} accent="#60a5fa" />
              <StatCard emoji="⏸️" label="In Pausa" value={stats.in_pausa} accent="#f59e0b" />
              <StatCard emoji="❌" label="Abbandonati" value={stats.abbandonati} accent="#ef4444" />
            </div>
            {/* Global progress bar */}
            <div className="rounded-2xl border p-5" style={{ background: 'rgba(11,11,18,0.7)', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-body)' }}>Completamento Globale</p>
                <p className="text-2xl font-black" style={{ color: '#10b981', fontFamily: 'var(--font-display)' }}>{stats.completamento_globale}%</p>
              </div>
              <div className="relative h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${stats.completamento_globale}%`, background: 'linear-gradient(90deg, #059669, #10b981, #34d399)' }} />
              </div>
              <div className="flex justify-between mt-2 text-[10px]" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-body)' }}>
                <span>{stats.completati} completati su {stats.totale} totali</span>
                <span>{stats.totale - stats.completati} rimanenti</span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs + Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {tabs.map(({ key, label, count }) => {
              const cfg = STATUS_CONFIG[key]
              const isActive = activeTab === key
              return (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                    isActive
                      ? (cfg ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-violet-500/20 border-violet-500/40 text-violet-400')
                      : 'border-transparent hover:text-text'
                  }`}
                  style={{
                    fontFamily: 'var(--font-body)',
                    background: !isActive ? 'transparent' : undefined,
                    color: !isActive ? 'var(--color-muted)' : undefined,
                  }}>
                  {cfg?.emoji && <span>{cfg.emoji}</span>}
                  {label}
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-white/20' : 'bg-white/5'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-select text-xs shrink-0">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden">
                <div className="skeleton aspect-[2/3] rounded-xl" />
                <div className="p-3 space-y-2">
                  <div className="skeleton h-3 rounded w-4/5" />
                  <div className="skeleton h-1.5 rounded-full w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 rounded-2xl border border-dashed" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(11,11,18,0.5)' }}>
            <p className="text-5xl mb-4">{activeTab === 'tutti' ? '📺' : STATUS_CONFIG[activeTab]?.emoji}</p>
            <p className="text-lg font-bold mb-1" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-display)' }}>
              {activeTab === 'tutti' ? 'La tua lista è vuota' : `Nessun anime in "${STATUS_CONFIG[activeTab]?.label}"`}
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-body)' }}>
              {activeTab === 'tutti' ? 'Aggiungi un anime dalla sua scheda per iniziare a tracciarlo.' : 'Prova a esplorare le altre categorie.'}
            </p>
            {activeTab === 'tutti' && (
              <Link to="/catalog" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm font-body text-white"
                style={{ background: 'linear-gradient(135deg, #8b5cf6, #c084fc)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                Scopri anime
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map(anime => (
              <WatchlistCard key={anime.id} anime={anime} onEdit={setEditTarget} onRemove={removeWatchlist} />
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editTarget && (
        <EditModal anime={editTarget} onSave={handleSave} onClose={() => setEditTarget(null)} />
      )}
    </div>
  )
}
