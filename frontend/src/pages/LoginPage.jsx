import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiMail, FiLock, FiAlertCircle } from 'react-icons/fi'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || "Errore durante il login. Controlla le credenziali.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl border border-surface-light shadow-2xl relative overflow-hidden">
        
        {/* Effetto glow sullo sfondo della card */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Pulsante chiusura (X) */}
        <button 
          onClick={() => navigate(-1)} 
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-light text-text-dim hover:text-text transition-colors z-20"
          aria-label="Chiudi"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        <h2 className="font-display text-4xl text-text mb-2 tracking-wide">Bentornato</h2>
        <p className="text-text-dim text-sm mb-8">Accedi per sincronizzare i tuoi progressi</p>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm">
            <FiAlertCircle className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10 mt-4">
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

          <div>
            <label className="block text-sm font-medium text-text-dim mb-1 ml-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-dim">
                <FiLock />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
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
              'Accedi con Email'
            )}
          </button>

          <div className="text-center">
            <Link to="/forgot-password" className="text-xs text-text-dim hover:text-accent transition-colors">
              Password dimenticata?
            </Link>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-text-dim relative z-10">
          Non hai un account?{' '}
          <Link to="/register" className="text-accent hover:underline font-medium">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  )
}
