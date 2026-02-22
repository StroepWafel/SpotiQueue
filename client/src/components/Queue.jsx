import { useState, useEffect } from 'react'
import axios from 'axios'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

const CACHE_KEY = 'spotiqueue.queue.current.v1'
const CACHE_TTL = 30000 // 30 seconds

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, expires } = JSON.parse(raw)
    if (Date.now() < expires) return data
  } catch (e) { /* ignore */ }
  return null
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      expires: Date.now() + CACHE_TTL
    }))
  } catch (e) { /* ignore */ }
}

function Queue({ fingerprintId }) {
  const [queue, setQueue] = useState(null)
  const [votes, setVotes] = useState({})
  const [userVotes, setUserVotes] = useState({})
  const [votingEnabled, setVotingEnabled] = useState(false)
  const [downvoteEnabled, setDownvoteEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  const fetchQueue = async () => {
    try {
      const res = await axios.get('/api/queue/current')
      setQueue(res.data)
      writeCache(res.data)
    } catch (e) {
      const cached = readCache()
      if (cached) setQueue(cached)
    }
    finally { setLoading(false) }
  }

  const fetchVotes = async () => {
    try {
      const params = fingerprintId ? { fingerprint_id: fingerprintId } : {}
      const res = await axios.get('/api/queue/votes', { params })
      setVotes(res.data.votes || {})
      setUserVotes(res.data.userVotes || {})
      setVotingEnabled(res.data.enabled !== false)
      setDownvoteEnabled(res.data.downvoteEnabled !== false)
    } catch (e) { setVotingEnabled(false) }
  }

  useEffect(() => {
    fetchQueue()
    fetchVotes()
    const qi = setInterval(fetchQueue, 5000)
    const vi = setInterval(fetchVotes, 3000)
    return () => { clearInterval(qi); clearInterval(vi) }
  }, [fingerprintId])

  const handleVote = async (trackId, direction) => {
    if (!fingerprintId || !votingEnabled) return
    try {
      const res = await axios.post('/api/queue/vote', { track_id: trackId, fingerprint_id: fingerprintId, direction })
      setVotes(prev => ({ ...prev, [trackId]: res.data.votes }))
      setUserVotes(prev => {
        const next = { ...prev }
        if (res.data.userVote == null) delete next[trackId]
        else next[trackId] = res.data.userVote
        return next
      })
    } catch (e) { /* ignore */ }
  }

  if (loading || !queue) return null

  const upNext = queue.queue || []
  if (upNext.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-3">Up Next</h2>
      <div className="space-y-2">
        {upNext.slice(0, 10).map((track, i) => (
          <div
            key={track.id}
            className="flex items-center gap-3 p-3 rounded-lg border bg-card"
          >
            <span className="text-sm text-muted-foreground w-6">{i + 1}</span>
            {track.album_art && (
              <img src={track.album_art} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{track.name}</div>
              <div className="text-sm text-muted-foreground truncate">{track.artists}</div>
            </div>
            {votingEnabled && fingerprintId && track.votable && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant={userVotes[track.id] === 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleVote(track.id, 1)}
                  className="h-8 px-2"
                >
                  <ThumbsUp className={cn('h-4 w-4', userVotes[track.id] === 1 && 'fill-current')} />
                </Button>
                {downvoteEnabled && (
                  <Button
                    variant={userVotes[track.id] === -1 ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => handleVote(track.id, -1)}
                    className="h-8 px-2"
                  >
                    <ThumbsDown className={cn('h-4 w-4', userVotes[track.id] === -1 && 'fill-current')} />
                  </Button>
                )}
                <span className={cn('text-sm font-medium min-w-[1.5rem] text-center', (votes[track.id] ?? 0) < 0 && 'text-destructive')}>
                  {votes[track.id] ?? 0}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Queue
