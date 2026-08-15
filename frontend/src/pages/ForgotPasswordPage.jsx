import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api'
import { FiMail, FiAlertCircle, FiCheckCircle, FiArrowLeft, FiCopy } from 'react-icons/fi'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante il recupero delle credenziali.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (result?.reset_token) {
      navigator.clipboard.writeText(
        `${window.location.origin}/reset-password?token=${result.reset_token}`
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl border border-surface-light shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>

        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-text-dim hover:text-text text-sm mb-6 transition-colors relative z-10"
        >
          <FiArrowLeft /> Torna al login
        </Link>

        <h2 className="font-display text-3xl text-text mb-2 tracking-wide">Password dimenticata?</h2>
        <p className="text-text-dim text-sm mb-8">
          Inserisci la tua email. Se l'account esiste, riceverai un link per reimpostare la password.
        </p>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm">
            <FiAlertCircle className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {result && !result.reset_token && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl mb-6 text-sm">
            <FiCheckCircle className="shrink-0" />
            <p>{result.detail}</p>
          </div>
        )}

        {/* Dev mode: show reset token directly */}
        {result?.reset_token && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              Modalità sviluppo — Nessuna email configurata
            </div>
            <p className="text-text-dim text-xs">{result.detail}</p>
            <div className="bg-bg/60 rounded-lg p-3 text-xs font-mono text-text break-all border border-border/40">
              {`${window.location.origin}/reset-password?token=${result.reset_token}`}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
            >
              <FiCopy />
              {copied ? 'Copiato!' : 'Copia link di reset'}
            </button>
            <Link
              to={`/reset-password?token=${result.reset_token}`}
              className="block w-full text-center mt-2 px-4 py-2 bg-accent/15 hover:bg-accent/25 text-accent rounded-xl text-sm font-semibold transition-all border border-accent/30"
            >
              Vai alla pagina di reset →
            </Link>
          </div>
        )}

        {!result && (
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <label className="block text-sm font-medium text-text-dim mb-1 ml-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-dim">
                  <FiMail />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="nome@esempio.com"
                  className="w-full bg-bg border border-surface-light rounded-xl py-3 pl-10 pr-4 text-text placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Invia istruzioni di reset'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
