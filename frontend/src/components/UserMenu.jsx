import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiUser, FiLogOut, FiSettings, FiDownload } from 'react-icons/fi'
import { usePWA } from '../hooks/usePWA'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef()
  const { isInstallable, installPWA } = usePWA()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) {
    return (
      <Link 
        to="/login"
        className="ml-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors"
      >
        Accedi
      </Link>
    )
  }

  return (
    <div className="relative ml-2" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-full border border-surface hover:bg-surface transition-colors"
      >
        <span className="text-sm font-medium text-text hidden sm:block max-w-[100px] truncate">
          {user.username}
        </span>
        <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="font-bold uppercase">{user.username.charAt(0)}</span>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 py-2 bg-surface border border-border rounded-xl shadow-xl animate-fade-in z-50">
          <div className="px-4 py-2 border-b border-border mb-1 sm:hidden">
            <p className="text-sm text-text font-medium truncate">{user.username}</p>
            <p className="text-xs text-text-dim truncate">{user.email}</p>
          </div>
          
          <Link 
            to="/profilo"
            onClick={() => setIsOpen(false)}
            className="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-accent flex items-center gap-2 transition-colors"
          >
            <FiUser /> Profilo
          </Link>
          
          <Link
            to="/impostazioni"
            onClick={() => setIsOpen(false)}
            className="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-accent flex items-center gap-2 transition-colors"
          >
            <FiSettings /> Impostazioni
          </Link>

          {isInstallable && (
            <button 
              onClick={() => { setIsOpen(false); installPWA(); }}
              className="w-full text-left px-4 py-2 text-sm text-text hover:bg-bg hover:text-accent flex items-center gap-2 transition-colors"
            >
              <FiDownload /> Installa App
            </button>
          )}

          <div className="h-px bg-border my-1"></div>

          <button 
            onClick={() => { setIsOpen(false); logout(); }}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-bg hover:text-red-300 flex items-center gap-2 transition-colors"
          >
            <FiLogOut /> Esci
          </button>
        </div>
      )}
    </div>
  )
}
