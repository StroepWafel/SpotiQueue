import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { Music, ChevronUp, WifiOff } from 'lucide-react'

const POLL_NOW_PLAYING_MS = 5000
const POLL_QUEUE_MS = 8000
const POLL_VOTES_MS = 10000

function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms)) return '0:00'
  return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
}

function ProgressBar({ progress }) {
  return (
    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
      <div
        className="h-full bg-green-400 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
      />
    </div>
  )
}

function AlbumArt({ src, alt, size = 'lg' }) {
  const [error, setError] = useState(false)
  const sizeClass = size === 'lg'
    ? 'w-48 h-48 md:w-64 md:h-64 lg:w-72 lg:h-72'
    : 'w-14 h-14'
  const iconSize = size === 'lg' ? 'h-16 w-16' : 'h-5 w-5'

  if (!src || error) {
    return (
      <div className={`${sizeClass} rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0`}>
        <Music className={`${iconSize} text-white/40`} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt || 'Album art'}
      className={`${sizeClass} rounded-2xl object-cover shadow-2xl flex-shrink-0`}
      onError={() => setError(true)}
    />
  )
}

export default function Display() {
  const [nowPlaying, setNowPlaying] = useState(null)
  const [upNext, setUpNext] = useState([])
  const [votes, setVotes] = useState({})
  const [connected, setConnected] = useState(true)
  const [progress, setProgress] = useState(0)
  const [initialized, setInitialized] = useState(false)
  const [votingEnabled, setVotingEnabled] = useState(false)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0)
  const [cachedLyrics, setCachedLyrics] = useState(null)
  const [finishedTrackId, setFinishedTrackId] = useState(null)

  const nowPlayingRef = useRef(null)
  const lastFetchedAtRef = useRef(null)
  const progressTimerRef = useRef(null)
  const finishedTrackIdRef = useRef(null)

  const appUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : ''

  // Poll now playing
  useEffect(() => {
    let cancelled = false
    let failCount = 0

    const fetchNowPlaying = async () => {
      if (cancelled) return
      try {
        const res = await axios.get('/api/now-playing', { timeout: 5000 })
        if (cancelled) return
        const track = res.data?.track ?? null
        
        // If track changed, that means the previous one finished
        if (track?.id && nowPlayingRef.current?.id && track.id !== nowPlayingRef.current.id) {
          console.log('SONG FINISHED! Previous track ID:', nowPlayingRef.current.id)
          setFinishedTrackId(nowPlayingRef.current.id)
        }
        
        // If track changed, reset lyrics cache
        if (track?.id !== nowPlayingRef.current?.id) {
          setCachedLyrics(null)
        }
        
        // Use cached lyrics if available, otherwise use from response
        if (track && track.lyrics) {
          setCachedLyrics(track.lyrics)
          track.lyrics = track.lyrics
        } else if (track && cachedLyrics) {
          track.lyrics = cachedLyrics
        }
        
        setNowPlaying(track)
        nowPlayingRef.current = track
        lastFetchedAtRef.current = Date.now()
        setConnected(true)
        failCount = 0
        if (track?.progress_ms != null && track?.duration_ms) {
          setProgress((track.progress_ms / track.duration_ms) * 100)
        }
        setInitialized(true)
      } catch {
        failCount++
        if (failCount >= 3) setConnected(false)
        setInitialized(true)
      }
    }

    fetchNowPlaying()
    const interval = setInterval(fetchNowPlaying, POLL_NOW_PLAYING_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [cachedLyrics])

  // Animate progress bar between polls
  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    if (!nowPlayingRef.current?.is_playing) return

    progressTimerRef.current = setInterval(() => {
      const track = nowPlayingRef.current
      const fetchedAt = lastFetchedAtRef.current
      if (!track?.duration_ms || !fetchedAt) return
      const elapsed = Date.now() - fetchedAt
      const currentMs = (track.progress_ms ?? 0) + elapsed
      const newProgress = Math.min((currentMs / track.duration_ms) * 100, 100)
      setProgress(newProgress)
    }, 500)

    return () => clearInterval(progressTimerRef.current)
  }, [nowPlaying])

  // Sync lyrics with playback progress
  useEffect(() => {
    if (!nowPlaying?.lyrics?.lines || nowPlaying.lyrics.lines.length === 0) return

    const currentMs = (nowPlayingRef.current?.progress_ms ?? 0) + (Date.now() - (lastFetchedAtRef.current ?? Date.now()))
    
    // Find the current lyric line based on time
    let newIndex = 0
    for (let i = nowPlaying.lyrics.lines.length - 1; i >= 0; i--) {
      const lineStartMs = nowPlaying.lyrics.lines[i].startTimeMs ?? 0
      if (currentMs >= lineStartMs) {
        newIndex = i
        break
      }
    }
    setCurrentLyricIndex(newIndex)
  }, [progress, nowPlaying?.lyrics])

  useEffect(() => {
    let cancelled = false

    const fetchQueue = async () => {
      if (cancelled) return
      try {
        const res = await axios.get('/api/queue/current', { timeout: 8000 })
        if (cancelled) return
        const queue = res.data?.queue?.slice(0, 20) ?? []
        setUpNext(queue)
      } catch {
        // keep showing last known queue - no state reset
      }
    }

    fetchQueue()
    const interval = setInterval(fetchQueue, POLL_QUEUE_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Remove first item from queue when song finishes
  useEffect(() => {
    if (finishedTrackId) {
      console.log('Removing first item from queue')
      setUpNext(prev => prev.slice(1))
    }
  }, [finishedTrackId])

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
        const res = await axios.get('/api/queue/votes', { timeout: 5000 })
        if (cancelled) return
        setVotes(res.data?.votes ?? {})
      } catch {
        // non-critical, keep stale data
      }
    }

    fetchVotes()
    const interval = setInterval(fetchVotes, POLL_VOTES_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [votingEnabled])

  return (
    <div className="fixed inset-0 bg-gray-950 text-white flex flex-col overflow-hidden select-none">
      {/* Offline indicator */}
      {!connected && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-red-900/80 backdrop-blur px-3 py-1.5 rounded-full text-sm text-red-200">
          <WifiOff className="h-3.5 w-3.5" />
          Reconnecting…
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">

        {/* Left: Now Playing */}
        <div className="flex flex-col items-center justify-center lg:w-1/2 p-8 lg:p-14 gap-6">
          {!initialized ? (
            <div className="flex flex-col items-center gap-3 text-white/40">
              <div className="h-64 w-64 rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
            </div>
          ) : !nowPlaying ? (
            <div className="flex flex-col items-center gap-4 text-white/40">
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl bg-white/5 flex items-center justify-center">
                <Music className="h-16 w-16" />
              </div>
              <p className="text-lg">Nothing playing</p>
            </div>
          ) : (
            <>
              <AlbumArt src={nowPlaying.album_art} alt={nowPlaying.album} size="lg" />

              <div className="w-full max-w-sm space-y-3 text-center">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold leading-tight truncate">
                    {nowPlaying.name}
                  </h2>
                  <p className="text-white/60 text-lg truncate mt-1">{nowPlaying.artists}</p>
                </div>

                {/* Progress */}
                <div className="space-y-1">
                  <ProgressBar progress={progress} />
                  <div className="flex justify-between text-xs text-white/40 font-mono">
                    <span>{formatDuration((nowPlaying.progress_ms ?? 0) + (Date.now() - (lastFetchedAtRef.current ?? Date.now())))}</span>
                    <span>{formatDuration(nowPlaying.duration_ms)}</span>
                  </div>
                </div>

                {/* Lyrics */}
                {nowPlaying.lyrics?.lines && (
                  <div className="mt-4 pt-4 border-t border-white/10 max-h-40 overflow-y-auto overflow-x-hidden scroll-smooth">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Lyrics</p>
                    <div className="space-y-2 whitespace-normal">
                      {nowPlaying.lyrics.lines.map((line, idx) => (
                        <div
                          key={idx}
                          ref={idx === currentLyricIndex ? el => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
                        >
                          <p
                            className={`text-sm transition-all duration-300 ${
                              idx === currentLyricIndex
                                ? 'text-white font-semibold scale-105'
                                : idx < currentLyricIndex
                                ? 'text-white/40'
                                : 'text-white/60'
                            }`}
                          >
                            {line.words}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: Up Next + QR */}
        <div className="flex flex-col lg:w-1/2 p-6 lg:p-10 gap-6 border-t lg:border-t-0 lg:border-l border-white/10">

          {/* Up Next */}
          <div className="flex-1 min-h-0 flex flex-col">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
              Up Next
            </p>
            {upNext.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
                Queue is empty
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden space-y-1">
                {upNext.map((track, i) => {
                  const voteCount = votes[track.id] ?? 0
                  return (
                    <div
                      key={`${track.id}-${i}`}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <span className="text-white/30 text-sm w-5 text-right shrink-0">{i + 1}</span>
                      <AlbumArt src={track.album_art} alt={track.album} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{track.name}</p>
                        <p className="text-xs text-white/50 truncate">{track.artists}</p>
                      </div>
                      {votingEnabled && voteCount > 0 && (
                        <div className="flex items-center gap-1 text-green-400 shrink-0">
                          <ChevronUp className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold">{voteCount}</span>
                        </div>
                      )}
                      <span className="text-xs text-white/30 font-mono shrink-0">
                        {formatDuration(track.duration_ms)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* QR + label */}
          {appUrl && (
            <div className="flex items-center gap-4 pt-4 border-t border-white/10">
              <div className="bg-white p-2 rounded-xl shrink-0">
                <QRCodeSVG value={appUrl} size={80} />
              </div>
              <div>
                <p className="text-sm font-semibold">Queue a song</p>
                <p className="text-xs text-white/40 mt-0.5 break-all">{appUrl}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between px-8 py-3 border-t border-white/10 bg-black/20 shrink-0">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-green-400" />
          <span className="text-sm font-semibold tracking-tight">SpotiQueue</span>
        </div>
        {nowPlaying?.is_playing ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs text-white/50">Live</span>
          </div>
        ) : (
          <span className="text-xs text-white/30">Paused</span>
        )}
      </div>
    </div>
  )
}
