import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import { FiLock, FiAlertCircle, FiCheckCircle, FiEye, FiEyeOff } from 'react-icons/fi'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) setError('Token mancante. Richiedi un nuovo link di reset.')
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Le password non coincidono.')
      return
    }
    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await api.post('/auth/reset-password', { token, new_password: password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore durante il reset della password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl border border-surface-light shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>

        <h2 className="font-display text-3xl text-text mb-2 tracking-wide">Nuova Password</h2>
        <p className="text-text-dim text-sm mb-8">Scegli una nuova password sicura per il tuo account.</p>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-6 text-sm">
            <FiAlertCircle className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-sm">
              <FiCheckCircle className="shrink-0 text-lg" />
              <div>
                <p className="font-semibold">Password reimpostata con successo!</p>
                <p className="text-xs mt-1 opacity-80">Verrai reindirizzato al login tra pochi secondi...</p>
              </div>
            </div>
            <Link
              to="/login"
              className="block w-full text-center bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-xl transition-colors"
            >
              Vai al Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <label className="block text-sm font-medium text-text-dim mb-1 ml-1">Nuova Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-dim">
                  <FiLock />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 caratteri"
                  className="w-full bg-bg border border-surface-light rounded-xl py-3 pl-10 pr-12 text-text placeholder-text-dim focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-dim hover:text-text transition-colors"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-dim mb-1 ml-1">Conferma Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-dim">
                  <FiLock />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Ripeti la password"
                  className={`w-full bg-bg border rounded-xl py-3 pl-10 pr-4 text-text placeholder-text-dim focus:outline-none transition-all ${
                    confirm && password !== confirm
                      ? 'border-red-500/60 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                      : 'border-surface-light focus:border-accent focus:ring-1 focus:ring-accent'
                  }`}
                />
              </div>
              {confirm && password !== confirm && (
                <p className="text-red-400 text-xs mt-1 ml-1">Le password non coincidono</p>
              )}
            </div>

            {/* Password strength indicator */}
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        password.length >= i * 3
                          ? password.length >= 12 ? 'bg-green-400' : password.length >= 8 ? 'bg-yellow-400' : 'bg-red-400'
                          : 'bg-surface-light'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-text-dim ml-1">
                  {password.length < 6 ? 'Troppo corta' : password.length < 8 ? 'Debole' : password.length < 12 ? 'Discreta' : 'Forte ✓'}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full bg-accent hover:bg-accent-hover text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Reimposta Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
