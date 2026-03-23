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
  const [rateLimitedAdminUrl, setRateLimitedAdminUrl] = useState('')
  const [inputMethod, setInputMethod] = useState('search')
  const [config, setConfig] = useState({
    search_ui_enabled: true,
    url_input_enabled: true,
    prequeue_enabled: false,
    admin_panel_url: '',
    rate_limit_redirect_to_admin: false,
    rate_limit_custom_message_enabled: false,
    rate_limit_custom_message: ''
  })

  useEffect(() => {
    const fetchConfig = () => {
      axios.get('/api/config/public')
        .then(res => setConfig(prev => ({ ...prev, ...res.data })))
        .catch(() => {})
    }
    fetchConfig()
    const interval = setInterval(fetchConfig, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleQueueError = (error, latestConfig) => {
    const status = error.response?.status
    const apiError = error.response?.data?.error
    const isRateLimited = status === 429

    if (isRateLimited) {
      const customMessageEnabled = !!latestConfig?.rate_limit_custom_message_enabled
      const customMessage = (latestConfig?.rate_limit_custom_message || '').trim()
      const fallbackMessage = apiError || 'You are currently rate limited.'
      setMessage(customMessageEnabled && customMessage ? customMessage : fallbackMessage)
      setMessageType('error')

      if (latestConfig?.rate_limit_redirect_to_admin) {
        setRateLimitedAdminUrl((latestConfig.admin_panel_url || '').trim() || '/admin')
      } else {
        setRateLimitedAdminUrl('')
      }
      return
    }

    setRateLimitedAdminUrl('')
    setMessage(apiError || 'Failed to queue track')
    setMessageType('error')
  }

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
    let latestConfig = config

    try {
      const configRes = await axios.get('/api/config/public')
      latestConfig = { ...config, ...(configRes.data || {}) }
      const prequeueEnabled = latestConfig.prequeue_enabled ?? config.prequeue_enabled
      setConfig(latestConfig)

      const url = prequeueEnabled ? '/api/prequeue/submit' : '/api/queue/add'
      const response = await axios.post(url, {
        fingerprint_id: fingerprintId,
        track_id: trackId
      })
      setMessage(response.data.message || (prequeueEnabled ? 'Track submitted for approval!' : 'Track queued successfully!'))
      setMessageType('success')
      setRateLimitedAdminUrl('')
    } catch (error) {
      handleQueueError(error, latestConfig)
    } finally {
      setIsQueueing(false)
    }
  }

  const handleQueueUrl = async (e) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    setIsQueueing(true)
    setMessage(null)
    let latestConfig = config

    try {
      const configRes = await axios.get('/api/config/public')
      latestConfig = { ...config, ...(configRes.data || {}) }
      const prequeueEnabled = latestConfig.prequeue_enabled ?? config.prequeue_enabled
      setConfig(latestConfig)

      const url = prequeueEnabled ? '/api/prequeue/submit' : '/api/queue/add'
      const response = await axios.post(url, {
        fingerprint_id: fingerprintId,
        track_url: urlInput
      })
      setMessage(response.data.message || (prequeueEnabled ? 'Track submitted for approval!' : 'Track queued successfully!'))
      setMessageType('success')
      setRateLimitedAdminUrl('')
      setUrlInput('')
    } catch (error) {
      handleQueueError(error, latestConfig)
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
            {rateLimitedAdminUrl && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[40px]"
                  onClick={() => { window.location.href = rateLimitedAdminUrl }}
                >
                  Go to Admin
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mb-4 flex-wrap">
          {config.search_ui_enabled !== false && (
            <Button
              variant={inputMethod === 'search' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('search')}
              className="min-h-[44px] px-4 touch-manipulation"
            >
              Search
            </Button>
          )}
          {config.url_input_enabled !== false && (
            <Button
              variant={inputMethod === 'url' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('url')}
              className="min-h-[44px] px-4 touch-manipulation"
            >
              Paste URL
            </Button>
          )}
        </div>

        {inputMethod === 'search' && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a song..."
                disabled={isSearching || isQueueing}
                className="flex-1 min-h-[44px] text-base sm:text-sm"
                autoComplete="off"
              />
              <Button type="submit" disabled={isSearching || isQueueing || !searchQuery.trim()} className="min-h-[44px] touch-manipulation shrink-0">
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 active:bg-accent/70 cursor-pointer transition-colors touch-manipulation"
                    onClick={() => handleQueueTrack(track.id)}
                  >
                    {track.album_art && (
                      <img src={track.album_art} alt={track.album} className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {track.name}
                        {track.explicit && <span className="text-xs px-1.5 py-0.5 rounded bg-muted">E</span>}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">{track.artists}</div>
                    </div>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); handleQueueTrack(track.id) }} disabled={isQueueing} className="min-h-[40px] min-w-[64px] touch-manipulation shrink-0">
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
              type="url"
              inputMode="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste Spotify track URL"
              disabled={isQueueing}
              className="min-h-[44px] text-base sm:text-sm"
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Examples:</div>
              <code className="block break-all">https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC</code>
              <code className="block break-all">spotify:track:4uLU6hMCjMI75M1A2tKUQC</code>
            </div>
            <Button type="submit" disabled={isQueueing || !urlInput.trim()} className="w-full min-h-[44px] touch-manipulation">
              {isQueueing ? 'Queueing...' : 'Queue Track'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default QueueForm
