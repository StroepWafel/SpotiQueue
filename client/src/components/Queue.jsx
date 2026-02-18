import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Music, Clock, ChevronUp } from 'lucide-react'

const CACHE_KEY = 'spotiqueue.queue.current.v1'
const CACHE_TTL_MS = 30_000
const POLL_MS = 15_000
const BACKOFF_BASE_MS = 30_000
const BACKOFF_MAX_MS = 60_000
const VOTES_POLL_MS = 12_000

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || !parsed?.data) return null
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch {
    // ignore
  }
}

function formatDuration(ms) {
  return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
}

export default function Queue({ fingerprintId }) {
  const [queue, setQueue] = useState(() => readCache())
  const [loading, setLoading] = useState(() => !readCache())
  const [votes, setVotes] = useState({})
  const [userVotes, setUserVotes] = useState([])
  const [votingId, setVotingId] = useState(null)
  const [votingEnabled, setVotingEnabled] = useState(false)
  const timerRef = useRef(null)
  const backoffRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    const scheduleNext = (ms) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(tick, ms)
    }

    const tick = async () => {
      if (cancelled) return
      try {
        const response = await axios.get('/api/queue/current')
        if (cancelled) return
        setQueue(response.data)
        writeCache(response.data)
        backoffRef.current = 0
        setLoading(false)
        scheduleNext(POLL_MS)
      } catch (error) {
        console.error('Error fetching queue:', error)
        const status = error?.response?.status
        const retryAfter = error?.response?.headers?.['retry-after']
        let nextMs
        if (status === 429 && retryAfter) {
          const seconds = Number(retryAfter)
          nextMs = Number.isFinite(seconds) ? seconds * 1000 : BACKOFF_BASE_MS
        } else {
          const prev = backoffRef.current || BACKOFF_BASE_MS
          nextMs = Math.min(prev * 2, BACKOFF_MAX_MS)
        }
        backoffRef.current = nextMs
        setLoading(false)
        scheduleNext(nextMs)
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Fetch voting_enabled config once on mount
  useEffect(() => {
    axios.get('/api/config/public/voting_enabled', { timeout: 5000 })
      .then(res => setVotingEnabled(res.data?.value === 'true'))
      .catch(() => setVotingEnabled(false))
  }, [])

  // Poll votes (only when voting is enabled)
  useEffect(() => {
    if (!votingEnabled) return
    let cancelled = false

    const fetchVotes = async () => {
      if (cancelled) return
      try {
        const params = fingerprintId ? { fingerprint_id: fingerprintId } : {}
        const res = await axios.get('/api/queue/votes', { params, timeout: 5000 })
        if (cancelled) return
        setVotes(res.data?.votes ?? {})
        setUserVotes(res.data?.userVotes ?? [])
      } catch {
        // non-critical, keep stale data
      }
    }

    fetchVotes()
    const interval = setInterval(fetchVotes, VOTES_POLL_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [fingerprintId, votingEnabled])

  const handleVote = async (trackId) => {
    if (!fingerprintId || votingId) return
    setVotingId(trackId)

    // Optimistic update
    const alreadyVoted = userVotes.includes(trackId)
    setUserVotes(prev => alreadyVoted ? prev.filter(id => id !== trackId) : [...prev, trackId])
    setVotes(prev => ({
      ...prev,
      [trackId]: Math.max(0, (prev[trackId] ?? 0) + (alreadyVoted ? -1 : 1))
    }))

    try {
      await axios.post('/api/queue/vote', { track_id: trackId, fingerprint_id: fingerprintId }, { timeout: 5000 })
    } catch {
      // Revert optimistic update on failure
      setUserVotes(prev => alreadyVoted ? [...prev, trackId] : prev.filter(id => id !== trackId))
      setVotes(prev => ({
        ...prev,
        [trackId]: Math.max(0, (prev[trackId] ?? 0) + (alreadyVoted ? 1 : -1))
      }))
    } finally {
      setVotingId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 h-full">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Queue</h3>
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <div className="animate-pulse">Loading queue...</div>
        </div>
      </div>
    )
  }

  const tracks = queue?.queue || []

  return (
    <div className="bg-card border border-border rounded-xl p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">Queue</h3>
        {tracks.length > 0 && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {tracks.length}
          </span>
        )}
      </div>

      {tracks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Music className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No songs in queue</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2">
          {tracks.map((track, index) => {
            const voteCount = votes[track.id] ?? 0
            const hasVoted = userVotes.includes(track.id)
            const isPending = votingId === track.id
            return (
              <div
                key={`${track.uri}-${index}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                  {index + 1}
                </span>
                {track.album_art ? (
                  <img
                    src={track.album_art}
                    alt={track.album}
                    className="w-10 h-10 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                    <Music className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{track.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{track.artists}</div>
                </div>
                {fingerprintId && (
                  <button
                    onClick={() => handleVote(track.id)}
                    disabled={isPending}
                    title={hasVoted ? 'Remove vote' : 'Upvote'}
                    className={`flex items-center gap-0.5 shrink-0 px-1.5 py-1 rounded transition-colors disabled:opacity-50 ${
                      hasVoted
                        ? 'text-primary bg-primary/10 hover:bg-primary/20'
                        : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                    }`}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    {voteCount > 0 && (
                      <span className="text-xs font-semibold">{voteCount}</span>
                    )}
                  </button>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatDuration(track.duration_ms)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
