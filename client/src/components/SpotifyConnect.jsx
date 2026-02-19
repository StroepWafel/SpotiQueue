import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from './ui/toast'
import { Wifi, WifiOff, ExternalLink } from 'lucide-react'

export default function SpotifyConnect() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const { toast } = useToast()

  useEffect(() => { checkStatus() }, [])

  const checkStatus = async () => {
    try {
      const response = await axios.get('/api/auth/status')
      setStatus(response.data)
    } catch (error) {
      console.error('Error checking auth status:', error)
      setStatus({ connected: false, hasRefreshToken: false, hasClientId: false, hasClientSecret: false })
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    try {
      const response = await axios.get('/api/auth/authorize')
      window.location.href = response.data.authUrl
    } catch (error) {
      toast({ description: 'Failed to start authorization. Check your Spotify credentials.', variant: 'destructive' })
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your Spotify account? You will need to reconnect to queue songs.')) return
    setDisconnecting(true)
    try {
      await axios.post('/api/auth/disconnect')
      await checkStatus()
      toast({ description: 'Spotify account disconnected.', variant: 'success' })
    } catch (error) {
      toast({ description: 'Failed to disconnect: ' + (error.response?.data?.error || error.message), variant: 'destructive' })
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <div className="animate-pulse">Checking connection status...</div>
      </div>
    )
  }

  const showConnectButton = status?.hasClientId && status?.hasClientSecret
  const isConnected = status?.connected

  return (
    <div className="max-w-lg mx-auto text-center space-y-6">
      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${isConnected ? 'bg-primary/10' : 'bg-muted'}`}>
        {isConnected ? (
          <Wifi className="h-8 w-8 text-primary" />
        ) : (
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">
          {isConnected ? 'Spotify Connected' : 'Connect Your Spotify Account'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isConnected
            ? 'Your Spotify account is connected. You can reconnect to refresh your token.'
            : 'To queue songs, you need to connect your Spotify account.'}
        </p>
      </div>

      {!status?.hasClientId && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
          SPOTIFY_CLIENT_ID not configured. Add it to your .env file.
        </div>
      )}
      {!status?.hasClientSecret && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
          SPOTIFY_CLIENT_SECRET not configured. Add it to your .env file.
        </div>
      )}

      {showConnectButton && (
        <div className="flex gap-3 justify-center flex-wrap">
          <button onClick={handleConnect} className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-6 py-3 font-medium hover:opacity-90 transition-opacity">
            <ExternalLink className="h-4 w-4" />
            {isConnected ? 'Reconnect Spotify' : 'Connect Spotify Account'}
          </button>
          {isConnected && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-2 bg-destructive/10 text-destructive rounded-lg px-6 py-3 font-medium hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )}
        </div>
      )}

      {isConnected && (
        <div className="bg-muted rounded-lg p-4 text-left text-sm space-y-1">
          <div className="font-medium mb-2">Connection Details</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="text-primary font-medium">Connected</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">No restart needed - connection is active immediately.</p>
        </div>
      )}
    </div>
  )
}
