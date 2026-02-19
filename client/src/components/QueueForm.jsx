import { useState, useEffect } from 'react'
import axios from 'axios'
import confetti from 'canvas-confetti'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Badge } from './ui/badge'
import { useToast } from './ui/toast'
import { Search, Link as LinkIcon, Loader2, Music, Clock } from 'lucide-react'

function QueueForm({ fingerprintId, onQueued }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isQueueing, setIsQueueing] = useState(false)
  const [inputMethod, setInputMethod] = useState('search')
  const [prequeueEnabled, setPrequeueEnabled] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [confettiEnabled, setConfettiEnabled] = useState(false)
  const [myQueuedTrack, setMyQueuedTrack] = useState(null)
  const { toast } = useToast()

  useEffect(() => {
    axios.get('/api/config/public/prequeue_enabled')
      .then(res => setPrequeueEnabled(res.data.value === 'true'))
      .catch(() => setPrequeueEnabled(false))

    axios.get('/api/config/public/confetti_enabled')
      .then(res => setConfettiEnabled(res.data?.value !== 'false'))
      .catch(() => {})
  }, [])

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const timer = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownRemaining])

  const formatCooldown = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  const fireConfetti = () => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.4 },
        colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']
      })
    } catch {
      // non-critical
    }
  }

  const fetchQueuePosition = async (trackId) => {
    try {
      const res = await axios.get('/api/queue/current', { timeout: 5000 })
      const queue = res.data?.queue ?? []
      const idx = queue.findIndex(t => t.id === trackId)
      if (idx === -1) return { position: null, waitMs: null }
      const waitMs = queue.slice(0, idx).reduce((sum, t) => sum + (t.duration_ms ?? 0), 0)
      return { position: idx + 1, waitMs }
    } catch {
      return { position: null, waitMs: null }
    }
  }

  const formatWait = (ms) => {
    if (!ms && ms !== 0) return null
    const mins = Math.round(ms / 60000)
    return mins < 1 ? 'up next' : `~${mins} min away`
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const response = await axios.post('/api/queue/search', { query: searchQuery })
      setSearchResults(response.data.tracks)
    } catch (error) {
      toast({ title: 'Search failed', description: error.response?.data?.error || 'Failed to search tracks', variant: 'destructive' })
    } finally {
      setIsSearching(false)
    }
  }

  const handleQueueTrack = async (trackId) => {
    setIsQueueing(true)
    setMyQueuedTrack(null)
    try {
      const endpoint = prequeueEnabled ? '/api/prequeue/submit' : '/api/queue/add'
      const response = await axios.post(endpoint, { fingerprint_id: fingerprintId, track_id: trackId })
      toast({ title: 'Success', description: response.data.message || 'Track queued!', variant: 'success' })

      if (confettiEnabled) fireConfetti()

      if (onQueued) onQueued(trackId)

      const track = searchResults.find(t => t.id === trackId)
      if (track) {
        fetchQueuePosition(trackId).then(({ position, waitMs }) => {
          setMyQueuedTrack({
            id: trackId,
            name: track.name,
            artists: track.artists,
            album_art: track.album_art,
            position,
            waitMs
          })
        })
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to queue track'
      if (error.response?.data?.cooldown_remaining) {
        setCooldownRemaining(error.response.data.cooldown_remaining)
      }
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' })
    } finally {
      setIsQueueing(false)
    }
  }

  const handleQueueUrl = async (e) => {
    e.preventDefault()
    if (!urlInput.trim()) return
    setIsQueueing(true)
    try {
      const endpoint = prequeueEnabled ? '/api/prequeue/submit' : '/api/queue/add'
      const response = await axios.post(endpoint, { fingerprint_id: fingerprintId, track_url: urlInput })
      toast({ title: 'Success', description: response.data.message || 'Track queued!', variant: 'success' })
      setUrlInput('')
      if (confettiEnabled) fireConfetti()
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Failed to queue track'
      if (error.response?.data?.cooldown_remaining) {
        setCooldownRemaining(error.response.data.cooldown_remaining)
      }
      toast({ title: 'Error', description: errorMsg, variant: 'destructive' })
    } finally {
      setIsQueueing(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Queue a Song</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cooldownRemaining > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">Cooldown: <span className="font-mono font-semibold">{formatCooldown(cooldownRemaining)}</span></span>
          </div>
        )}

        <Tabs value={inputMethod} onValueChange={setInputMethod}>
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1 gap-1.5">
              <Search className="h-3.5 w-3.5" /> Search
            </TabsTrigger>
            <TabsTrigger value="url" className="flex-1 gap-1.5">
              <LinkIcon className="h-3.5 w-3.5" /> Paste URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="mt-4 space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for a song..."
                disabled={isSearching || isQueueing}
                className="flex-1"
              />
              <Button type="submit" disabled={isSearching || isQueueing || !searchQuery.trim()}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </form>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer group"
                    onClick={() => handleQueueTrack(track.id)}
                  >
                    {track.album_art ? (
                      <img src={track.album_art} alt={track.album} className="w-12 h-12 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <Music className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate">{track.name}</p>
                        {track.explicit && <Badge variant="outline" className="text-[10px] px-1 py-0">E</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{track.artists}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); handleQueueTrack(track.id) }}
                      disabled={isQueueing || cooldownRemaining > 0}
                    >
                      Queue
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="url" className="mt-4">
            <form onSubmit={handleQueueUrl} className="space-y-3">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://open.spotify.com/track/..."
                disabled={isQueueing}
              />
              <p className="text-xs text-muted-foreground">
                Paste a Spotify track URL or URI
              </p>
              <Button type="submit" className="w-full" disabled={isQueueing || !urlInput.trim() || cooldownRemaining > 0}>
                {isQueueing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Queueing...</> : 'Queue Track'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {myQueuedTrack && (
          <div className="mt-4 p-3 rounded-lg border-2 border-primary/30 bg-primary/5 flex items-center gap-3">
            {myQueuedTrack.album_art ? (
              <img src={myQueuedTrack.album_art} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                <Music className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{myQueuedTrack.name}</p>
              <p className="text-xs text-muted-foreground truncate">{myQueuedTrack.artists}</p>
            </div>
            <div className="text-right shrink-0">
              {myQueuedTrack.position && (
                <p className="text-xs font-bold text-primary">#{myQueuedTrack.position} in queue</p>
              )}
              {myQueuedTrack.waitMs != null && (
                <p className="text-xs text-muted-foreground">{formatWait(myQueuedTrack.waitMs)}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default QueueForm
