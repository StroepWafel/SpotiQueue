import { useState, useEffect } from 'react'
import axios from 'axios'
import { Menu, X } from 'lucide-react'
import { ThemeToggle } from './components/theme-toggle'
import DeviceManagement from './components/DeviceManagement'
import BannedTracks from './components/BannedTracks'
import Configuration from './components/Configuration'
import PrequeueManagement from './components/PrequeueManagement'
import QrCode from './components/QrCode'
import Stats from './components/Stats'
import SpotifyConnect from './components/SpotifyConnect'
import { Button } from './components/ui/button'
import { cn } from '@/lib/utils'

axios.defaults.withCredentials = true

function App() {
  const [activeTab, setActiveTab] = useState('spotify')
  const [authError, setAuthError] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    axios.get('/api/admin/stats').catch(error => {
      if (error.response?.status === 401) setAuthError(true)
    })
  }, [])

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
          <p className="text-muted-foreground mb-4">Please enter your admin credentials when prompted.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
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
    { id: 'stats', label: 'Statistics' },
  ]

  const selectTab = (id) => {
    setActiveTab(id)
    setSidebarOpen(false)
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-accent text-foreground touch-manipulation"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-bold">SpotiQueue Admin</h1>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile full-screen overlay */}
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
              onClick={() => setSidebarOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent text-foreground touch-manipulation pointer-events-auto"
              aria-label="Close menu"
            >
              <X className="h-6 w-6" />
            </button>
            <nav className="flex flex-col gap-2 flex-1 justify-center pointer-events-auto">
              {tabs.map((tab) => (
                <button
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
    </div>
  )
}

export default App
