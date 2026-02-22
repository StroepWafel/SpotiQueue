import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { cn } from '@/lib/utils'

function QueueForm({ fingerprintId }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isQueueing, setIsQueueing] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState(null)
  const [inputMethod, setInputMethod] = useState('search')
  const [config, setConfig] = useState({ search_ui_enabled: 'true', url_input_enabled: 'true', prequeue_enabled: false })

  useEffect(() => {
    const fetchConfig = () => {
      axios.get('/api/config/public')
        .then(res => setConfig(prev => ({ ...prev, prequeue_enabled: res.data.prequeue_enabled })))
        .catch(() => {})
    }
    fetchConfig()
    const interval = setInterval(fetchConfig, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setMessage(null)

    try {
      const response = await axios.post('/api/queue/search', { query: searchQuery })
      setSearchResults(response.data.tracks)
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to search tracks')
      setMessageType('error')
    } finally {
      setIsSearching(false)
    }
  }

  const handleQueueTrack = async (trackId) => {
    setIsQueueing(true)
    setMessage(null)

    try {
      const configRes = await axios.get('/api/config/public')
      const prequeueEnabled = configRes.data?.prequeue_enabled ?? config.prequeue_enabled
      setConfig(prev => ({ ...prev, prequeue_enabled: prequeueEnabled }))

      const url = prequeueEnabled ? '/api/prequeue/submit' : '/api/queue/add'
      const response = await axios.post(url, {
        fingerprint_id: fingerprintId,
        track_id: trackId
      })
      setMessage(response.data.message || (prequeueEnabled ? 'Track submitted for approval!' : 'Track queued successfully!'))
      setMessageType('success')
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to queue track')
      setMessageType('error')
    } finally {
      setIsQueueing(false)
    }
  }

  const handleQueueUrl = async (e) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    setIsQueueing(true)
    setMessage(null)

    try {
      const configRes = await axios.get('/api/config/public')
      const prequeueEnabled = configRes.data?.prequeue_enabled ?? config.prequeue_enabled
      setConfig(prev => ({ ...prev, prequeue_enabled: prequeueEnabled }))

      const url = prequeueEnabled ? '/api/prequeue/submit' : '/api/queue/add'
      const response = await axios.post(url, {
        fingerprint_id: fingerprintId,
        track_url: urlInput
      })
      setMessage(response.data.message || (prequeueEnabled ? 'Track submitted for approval!' : 'Track queued successfully!'))
      setMessageType('success')
      setUrlInput('')
    } catch (error) {
      setMessage(error.response?.data?.error || 'Failed to queue track')
      setMessageType('error')
    } finally {
      setIsQueueing(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {message && (
          <div className={cn(
            'mb-4 rounded-lg p-3 text-sm',
            messageType === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
          )}>
            {message}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {config.search_ui_enabled !== 'false' && (
            <Button
              variant={inputMethod === 'search' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('search')}
            >
              Search
            </Button>
          )}
          {config.url_input_enabled !== 'false' && (
            <Button
              variant={inputMethod === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('url')}
            >
              Paste URL
            </Button>
          )}
        </div>

        {inputMethod === 'search' && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a song..."
                disabled={isSearching || isQueueing}
                className="flex-1"
              />
              <Button type="submit" disabled={isSearching || isQueueing || !searchQuery.trim()}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => handleQueueTrack(track.id)}
                  >
                    {track.album_art && (
                      <img src={track.album_art} alt={track.album} className="w-12 h-12 rounded object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {track.name}
                        {track.explicit && <span className="text-xs px-1.5 py-0.5 rounded bg-muted">E</span>}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{track.artists}</div>
                    </div>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleQueueTrack(track.id) }} disabled={isQueueing}>
                      Queue
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {inputMethod === 'url' && (
          <form onSubmit={handleQueueUrl} className="space-y-4">
            <Input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste Spotify track URL (e.g., https://open.spotify.com/track/...)"
              disabled={isQueueing}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Examples:</div>
              <code className="block break-all">https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC</code>
              <code className="block break-all">spotify:track:4uLU6hMCjMI75M1A2tKUQC</code>
            </div>
            <Button type="submit" disabled={isQueueing || !urlInput.trim()} className="w-full">
              {isQueueing ? 'Queueing...' : 'Queue Track'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default QueueForm
