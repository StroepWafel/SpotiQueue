import { useState, useEffect, useCallback } from 'react'
import axios, { authHandlers } from '@/lib/api'
import { Menu, X, Github, LogOut } from 'lucide-react'
import { ThemeToggle } from './components/theme-toggle'
import AdminLogin from './components/AdminLogin'
import DeviceManagement from './components/DeviceManagement'
import BannedTracks from './components/BannedTracks'
import Configuration from './components/Configuration'
import PrequeueManagement from './components/PrequeueManagement'
import QrCode from './components/QrCode'
import Stats from './components/Stats'
import SpotifyConnect from './components/SpotifyConnect'
import { Button } from './components/ui/button'
import { cn } from '@/lib/utils'

function App() {
  const [authReady, setAuthReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [activeTab, setActiveTab] = useState('spotify')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const refreshSession = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/session')
      setAuthenticated(!!data.authenticated)
      setTotpRequired(!!data.totpRequired)
    } catch {
      setAuthenticated(false)
      setTotpRequired(false)
    } finally {
      setAuthReady(true)
    }
  }, [])

  useEffect(() => {
    refreshSession()
  }, [refreshSession])

  useEffect(() => {
    authHandlers.onUnauthorized = () => {
      setAuthenticated(false)
    }
    return () => {
      authHandlers.onUnauthorized = null
    }
  }, [])

  useEffect(() => {
    if (!sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sidebarOpen])

  const handleLoginSuccess = () => {
    setAuthenticated(true)
    refreshSession()
  }

  const handleLogout = async () => {
    try {
      await axios.post('/api/admin/logout')
    } catch {
      /* ignore */
    }
    setAuthenticated(false)
  }

  if (!authReady) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <AdminLogin totpRequired={totpRequired} onSuccess={handleLoginSuccess} />
      </div>
    )
  }

  const tabs = [
    { id: 'spotify', label: 'Spotify' },
    { id: 'qr', label: 'QR Code' },
    { id: 'prequeue', label: 'Prequeue' },
    { id: 'devices', label: 'Devices' },
    { id: 'banned', label: 'Banned Tracks' },
    { id: 'config', label: 'Configuration' },
    { id: 'stats', label: 'Statistics' }
  ]

  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? ''

  const selectTab = (id) => {
    setActiveTab(id)
    setSidebarOpen(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3 pt-safe pl-safe pr-safe">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-accent active:bg-accent/80 md:hidden touch-manipulation"
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight sm:text-xl">SpotiQueue Admin</h1>
            <p className="truncate text-xs text-muted-foreground md:hidden">{activeLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="h-10 min-h-[40px] gap-1.5 px-3 sm:h-8 sm:min-h-0"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile: slide-in drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2.5rem))] max-w-[min(20rem,85vw)] flex-col border-r bg-background shadow-xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3 pt-safe">
              <span className="text-sm font-semibold">Sections</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg hover:bg-accent touch-manipulation"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 pb-safe" aria-label="Admin sections">
              {tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    'min-h-[48px] rounded-xl px-4 py-3 text-left text-base font-medium transition-colors touch-manipulation',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent active:bg-accent/80'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <nav className="hidden w-48 shrink-0 flex-col gap-1 border-r p-4 md:flex">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-lg px-4 py-2 text-left text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-safe">
            {activeTab === 'spotify' && <SpotifyConnect />}
            {activeTab === 'qr' && <QrCode />}
            {activeTab === 'prequeue' && <PrequeueManagement />}
            {activeTab === 'devices' && <DeviceManagement />}
            {activeTab === 'banned' && <BannedTracks />}
            {activeTab === 'config' && <Configuration />}
            {activeTab === 'stats' && <Stats />}
          </main>
        </div>

        <footer className="shrink-0 border-t px-4 py-2 pb-safe pl-safe pr-safe">
          <a
            href="https://github.com/stroepwafel/spotiqueue"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/80 sm:min-h-0"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </a>
        </footer>
      </div>
    </div>
  )
}

export default App
