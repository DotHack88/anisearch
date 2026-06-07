import { useState } from 'react'
import { getDisplayCode, importSessionId } from '../utils/session'

export default function SyncModal({ onClose }) {
  const myCode = getDisplayCode()
  const [tab, setTab] = useState('export')   // 'export' | 'import'
  const [inputCode, setInputCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(myCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleImport = () => {
    if (!inputCode.trim()) { setError('Inserisci il codice!'); return }
    if (inputCode.trim().toUpperCase() === myCode) { setError('È già il tuo codice!'); return }
    setConfirming(true)
    setError('')
  }

  const handleConfirm = () => {
    try {
      importSessionId(inputCode)
    } catch (e) {
      setError(e.message)
      setConfirming(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-20 p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-slide-down">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/>
                <path d="M14 17h6M17 14v6"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display font-bold text-text text-base">Sincronizza Dispositivi</h2>
              <p className="text-xs text-text-dim font-body">Condividi preferiti e progresso</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text transition-colors p-1 rounded-lg hover:bg-surface">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[['export', '📤 Il mio codice'], ['import', '📥 Importa codice']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setError(''); setConfirming(false) }}
              className={`flex-1 py-3 text-sm font-semibold font-body transition-colors cursor-pointer
                ${tab === id ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-text-dim hover:text-text hover:bg-surface/50'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6">
          {tab === 'export' ? (
            <div className="space-y-4">
              <p className="text-sm text-text-dim font-body leading-relaxed">
                Questo è il tuo codice personale. Copialo e incollalo su un altro dispositivo per sincronizzare tutto il tuo profilo (preferiti, cronologia, progresso).
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 px-4 py-3 bg-bg border border-border rounded-xl font-mono text-accent text-center font-bold tracking-widest text-sm select-all break-all min-h-[48px] flex items-center justify-center">
                  {myCode}
                </div>
                <button
                  onClick={handleCopy}
                  className={`px-4 py-3 rounded-xl font-semibold text-sm font-body transition-all cursor-pointer flex items-center gap-2 min-w-[90px] justify-center
                    ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-accent text-white hover:bg-accent/80'}`}
                >
                  {copied ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copiato!</>
                  ) : (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copia</>
                  )}
                </button>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                <p className="text-xs text-yellow-300/80 font-body leading-relaxed">
                  Tieni questo codice riservato: chiunque lo conosca può accedere al tuo profilo.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {!confirming ? (
                <>
                  <p className="text-sm text-text-dim font-body leading-relaxed">
                    Inserisci il codice dell'altro dispositivo. Il tuo profilo corrente verrà sostituito con quello del codice inserito.
                  </p>
                  <input
                    type="text"
                    value={inputCode}
                    onChange={e => { setInputCode(e.target.value); setError('') }}
                    placeholder="Incolla il tuo codice qui"
                    className="w-full px-4 py-3 bg-bg border border-border rounded-xl font-mono text-center text-accent text-base placeholder:text-muted placeholder:tracking-normal font-bold focus:outline-none focus:border-accent transition-colors"
                  />
                  {error && <p className="text-sm text-red-400 text-center font-body">{error}</p>}
                  <button
                    onClick={handleImport}
                    className="w-full py-3 bg-accent text-white rounded-xl font-semibold font-body hover:bg-accent/80 transition-colors cursor-pointer"
                  >
                    Importa Profilo
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                    <p className="text-sm font-semibold text-red-400 mb-1">⚠️ Attenzione</p>
                    <p className="text-xs text-text-dim font-body">
                      Stai per sostituire il tuo profilo corrente con quello del codice <span className="font-mono text-accent">{inputCode.trim().toUpperCase()}</span>. L'operazione è irreversibile su questo dispositivo.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirming(false)}
                      className="flex-1 py-3 border border-border text-text-dim rounded-xl font-semibold font-body hover:border-text/40 transition-colors cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold font-body hover:bg-red-400 transition-colors cursor-pointer"
                    >
                      Sì, importa
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
