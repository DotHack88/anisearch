import { Link, useLocation } from 'react-router-dom'
import SearchBar from './SearchBar.jsx'
import { useDownloads } from '../hooks/useDownloads.js'

export default function Navbar() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const { activeCount } = useDownloads()

  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link to="/" className="flex-shrink-0 flex items-baseline">
          <span className="font-display text-2xl text-accent tracking-wider">ANI</span>
          <span className="font-display text-2xl text-text tracking-wider">SEARCH</span>
        </Link>

        {!isHome && (
          <div className="flex-1 max-w-md">
            <SearchBar />
          </div>
        )}

        <nav className="ml-auto flex items-center gap-4">
          <Link to="/catalog"
            className={`text-sm font-body transition-colors flex items-center gap-1.5
              ${pathname === '/catalog' ? 'text-accent' : 'text-muted hover:text-text'}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Catalogo
          </Link>
          <Link to="/favorites"
            className={`text-sm font-body transition-colors flex items-center gap-1.5
              ${pathname === '/favorites' ? 'text-accent' : 'text-muted hover:text-text'}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-accent">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
            Preferiti
          </Link>
          <Link to="/downloads"
            className={`text-sm font-body transition-colors flex items-center gap-1.5 relative
              ${pathname === '/downloads' ? 'text-accent' : 'text-muted hover:text-text'}`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={pathname === '/downloads' ? 'text-accent' : ''}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Downloads
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-accent text-[9px] text-white font-bold items-center justify-center">
                  {activeCount}
                </span>
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}
