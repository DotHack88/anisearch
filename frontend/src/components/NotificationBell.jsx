import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef()

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications')
        setNotifications(res.data)
      } catch (error) {
        console.error('Failed to fetch notifications', error)
      }
    }

    fetchNotifications()
    // Poll every 5 minutes
    const interval = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpen = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      markAsRead()
    }
  }

  const markAsRead = async () => {
    if (unreadCount === 0) return
    try {
      await api.post('/notifications/read')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (e) {
      console.error('Error marking notifications as read', e)
    }
  }

  if (!user) return null

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="relative ml-2" ref={menuRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full border border-surface hover:bg-surface transition-colors flex items-center justify-center text-text-dim hover:text-text"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 py-2 bg-surface border border-border rounded-xl shadow-xl animate-fade-in z-50">
          <div className="px-4 py-2 border-b border-border mb-1 flex justify-between items-center">
            <h3 className="font-display font-semibold text-text text-sm">Notifiche</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-accent font-medium">{unreadCount} nuove</span>
            )}
          </div>
          
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-text-dim text-sm font-body">
                Nessuna notifica
              </div>
            ) : (
              notifications.map((notif, idx) => (
                <Link
                  key={notif.id || idx}
                  to={`/anime/${notif.anime_id}`}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-3 border-b border-border/50 last:border-0 hover:bg-bg transition-colors ${!notif.is_read ? 'bg-accent/5' : ''}`}
                >
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" style={{ opacity: notif.is_read ? 0 : 1 }} />
                    <div>
                      <p className={`text-sm font-body leading-tight ${notif.is_read ? 'text-text-dim' : 'text-text font-medium'}`}>
                        {notif.message}
                      </p>
                      <p className="text-xs text-text-dim mt-1">
                        {new Date(notif.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
