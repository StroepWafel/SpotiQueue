import { useState, useEffect } from 'react'
import axios from 'axios'
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">SpotiQueue Admin</h1>
        <ThemeToggle />
      </header>

      <div className="flex">
        <nav className="w-48 border-r p-4 flex flex-col gap-1 shrink-0">
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

        <main className="flex-1 p-6 overflow-auto">
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
