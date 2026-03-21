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
      <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!authenticated) {
    return <AdminLogin totpRequired={totpRequired} onSuccess={handleLoginSuccess} />
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

  const selectTab = (id) => {
    setActiveTab(id)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-accent text-foreground touch-manipulation shrink-0"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold truncate">SpotiQueue Admin</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-label="Navigation menu"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex flex-col p-6 pt-16 bg-background pointer-events-none">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent text-foreground touch-manipulation pointer-events-auto"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
            <nav className="flex flex-col gap-2 flex-1 justify-center pointer-events-auto">
              {tabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    'text-left px-6 py-4 rounded-xl text-lg font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-foreground'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="flex">
        <nav className="hidden md:flex w-48 border-r p-4 flex-col gap-1 shrink-0">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {activeTab === 'spotify' && <SpotifyConnect />}
          {activeTab === 'qr' && <QrCode />}
          {activeTab === 'prequeue' && <PrequeueManagement />}
          {activeTab === 'devices' && <DeviceManagement />}
          {activeTab === 'banned' && <BannedTracks />}
          {activeTab === 'config' && <Configuration />}
          {activeTab === 'stats' && <Stats />}
        </main>
      </div>
      <footer className="border-t py-2 px-4 flex justify-start">
        <a
          href="https://github.com/stroepwafel/spotiqueue"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </a>
      </footer>
    </div>
  )
}

export default App
