import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Icons
const MALIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
    <path d="M0 0v24h24V0zm9.364 4.955h1.59l1.637 4.773 1.628-4.773h1.59l-2.5 6.682h-1.455zm8.182 0h1.59v6.682h-1.59zM2.955 5h3.545v1.364H4.545v1.09h1.91v1.364h-1.91V11.5H2.955zm0 7.636h1.59v3.319l2.136-3.319h1.5V19h-1.59v-3.318L4.454 19h-1.5zm6.454 0h3.182c.892 0 1.5.664 1.5 1.455 0 .573-.3 1.064-.773 1.309.582.21.978.773.978 1.418 0 .937-.682 1.59-1.637 1.59H9.41zm1.59 1.228v1.09h1.319c.318 0 .545-.227.545-.545s-.227-.545-.545-.545zm0 2.227v1.137h1.455c.345 0 .59-.246.59-.573 0-.327-.245-.564-.59-.564zm4.592-3.455h1.59V19h-1.59z"/>
  </svg>
)

const AniListIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
    <path d="M6.361 2.943L0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H17.4L11.038 2.943zM7.632 13.967l1.79-5.2 1.764 5.2zM20.593 9.499l-4.044 11.557h3.817l.714-2.186h3.92l.697 2.186H24V9.499zm1.136 7.142l1.207-3.557 1.195 3.557z"/>
  </svg>
)

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)

const UnlinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    <line x1="2" y1="2" x2="22" y2="22"/>
  </svg>
)

export default function SettingsPage() {
  const { user, token, logout } = useAuth()
  const navigate = useNavigate()
  const [syncStatus, setSyncStatus] = useState({ mal: false, anilist: false })
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Utility per convertire la chiave VAPID da base64 a Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    // Fetch sync status
    const fetchStatus = async () => {
      try {
        const res = await api.get('/auth/me')
        setSyncStatus({
          mal: res.data.mal_linked,
          anilist: res.data.anilist_linked
        })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchStatus()

    // Check Push status
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.pushManager.getSubscription().then(subscription => {
          setPushEnabled(subscription !== null)
        })
      })
    }

    // Check for sync success from OAuth redirect
    const params = new URLSearchParams(window.location.search)
    if (params.get('sync') === 'success') {
      const provider = params.get('provider')
      showNotification(`Account ${provider === 'mal' ? 'MyAnimeList' : 'AniList'} collegato con successo! ✅`, 'success')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user])

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type })
    setTimeout(() => setNotification(null), 4000)
  }

  const handleTogglePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showNotification('Le notifiche Push non sono supportate da questo browser.', 'error')
      return
    }

    setPushLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      if (pushEnabled) {
        // Unsubscribe
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
        }
        setPushEnabled(false)
        showNotification('Notifiche disattivate.', 'success')
      } else {
        // Subscribe
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          showNotification('Permesso per le notifiche negato.', 'error')
          setPushLoading(false)
          return
        }
        
        // Fetch public key
        const { getVapidPublicKey, subscribePush } = await import('../utils/api')
        const vapidPublicKey = await getVapidPublicKey()
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey)
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        })
        
        await subscribePush(subscription.toJSON())
        setPushEnabled(true)
        showNotification('Notifiche attivate con successo!', 'success')
      }
    } catch (err) {
      console.error(err)
      showNotification('Errore durante la configurazione delle notifiche.', 'error')
    } finally {
      setPushLoading(false)
    }
  }

  const handleConnectMAL = () => {
    if (!token) return
    window.location.href = `${API_BASE}/sync/mal/login?token=${token}`
  }

  const handleConnectAniList = () => {
    if (!token) return
    window.location.href = `${API_BASE}/sync/anilist/login?token=${token}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"/>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">

        {/* Notification */}
        {notification && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium animate-fade-in border ${
            notification.type === 'success'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {notification.msg}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-display font-bold text-text mb-1">Impostazioni</h1>
          <p className="text-text-dim font-body text-sm">Gestisci il tuo account e le integrazioni esterne</p>
        </div>

        {/* Profilo Card */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h2 className="text-base font-display font-semibold text-text mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center text-accent text-xs">👤</span>
            Profilo
          </h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover"/>
                : user?.username?.charAt(0).toUpperCase()
              }
            </div>
            <div>
              <p className="font-semibold text-text text-base">{user?.username}</p>
              <p className="text-sm text-text-dim">{user?.email}</p>
            </div>
          </div>
        </section>

        {/* Notifiche Push */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-display font-semibold text-text mb-2 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400 text-xs">🔔</span>
                Notifiche Push
              </h2>
              <p className="text-xs text-text-dim font-body leading-relaxed">
                Ricevi una notifica sui tuoi dispositivi quando escono nuovi episodi degli anime che hai aggiunto ai Preferiti o alla tua Watchlist.
              </p>
            </div>
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg ${
                pushEnabled ? 'bg-accent' : 'bg-surface border-border'
              } ${pushLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                pushEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {pushEnabled && (
            <div className="mt-4 p-3 rounded-xl bg-green-500/5 border border-green-500/20 flex items-start gap-2">
              <CheckIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-green-300/80 font-body leading-relaxed">
                Le notifiche push sono attive su questo dispositivo.
              </p>
            </div>
          )}
        </section>

        {/* Sincronizzazione */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h2 className="text-base font-display font-semibold text-text mb-2 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs">🔗</span>
            Sincronizzazione Anime
          </h2>
          <p className="text-xs text-text-dim mb-5 font-body leading-relaxed">
            Collega il tuo account esterno per sincronizzare automaticamente gli episodi che guardi. 
            Ogni volta che segni un episodio come visto in AniSearch, lo stato verrà aggiornato anche su MyAnimeList/AniList.
          </p>

          <div className="space-y-3">
            {/* MyAnimeList */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border">
              <div className="text-[#2e51a2] flex-shrink-0">
                <MALIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">MyAnimeList</p>
                <p className="text-xs text-text-dim mt-0.5">
                  {syncStatus.mal ? (
                    <span className="text-green-400 flex items-center gap-1"><CheckIcon/> Collegato</span>
                  ) : 'Non collegato'}
                </p>
              </div>
              <button
                onClick={handleConnectMAL}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                  syncStatus.mal
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                    : 'bg-accent text-white hover:bg-accent/80'
                }`}
              >
                {syncStatus.mal ? <><UnlinkIcon /> Scollega</> : <><LinkIcon /> Collega</>}
              </button>
            </div>

            {/* AniList */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border">
              <div className="text-[#02a9ff] flex-shrink-0">
                <AniListIcon />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text">AniList</p>
                <p className="text-xs text-text-dim mt-0.5">
                  {syncStatus.anilist ? (
                    <span className="text-green-400 flex items-center gap-1"><CheckIcon/> Collegato</span>
                  ) : 'Non collegato'}
                </p>
              </div>
              <button
                onClick={handleConnectAniList}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${
                  syncStatus.anilist
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                    : 'bg-[#02a9ff]/90 text-white hover:bg-[#02a9ff]'
                }`}
              >
                {syncStatus.anilist ? <><UnlinkIcon /> Scollega</> : <><LinkIcon /> Collega</>}
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            <p className="text-xs text-yellow-300/80 font-body leading-relaxed">
              La sincronizzazione richiede che il server abbia configurato le API Key di MAL e AniList nel file <code className="font-mono bg-black/30 px-1 rounded">.env</code>.
            </p>
          </div>
        </section>

        {/* Account Actions */}
        <section className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-base font-display font-semibold text-text mb-4 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-xs">⚙</span>
            Gestione Account
          </h2>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Esci dall'account
          </button>
        </section>

      </div>
    </main>
  )
}
