import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { Music, ChevronUp, ChevronDown, WifiOff, GripVertical, GripHorizontal } from 'lucide-react'
import { useAuraColor } from '../hooks/useAuraColor'
import { cn } from '@/lib/utils'

const DISPLAY_SIZE_KEY = 'spotiqueue-display-left-size'
const QR_SIZE_KEY = 'spotiqueue-display-qr-size'
const MIN_PANEL = 25
const MAX_PANEL = 75
const MIN_QR = 15
const MAX_QR = 50

const POLL_NOW_PLAYING_MS = 5000
const POLL_QUEUE_MS = 8000
const POLL_VOTES_MS = 10000

function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms)) return '0:00'
  return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
}

function ProgressBar({ progress, auraColor }) {
  return (
    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.min(Math.max(progress, 0), 100)}%`,
          backgroundColor: auraColor ? `rgb(${auraColor})` : '#4ade80',
          transition: 'width 500ms'
        }}
      />
    </div>
  )
}

function QrCodeScaled({ value }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState(80)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? {}
      if (width > 0 && height > 0) {
        setSize(Math.floor(Math.min(width, height)) - 16)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const qrSize = Math.max(50, size)
  return (
    <div ref={containerRef} className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
      <div className="bg-white p-2 rounded-xl" style={{ maxWidth: '100%', maxHeight: '100%' }}>
        <QRCodeSVG value={value} size={qrSize} />
      </div>
    </div>
  )
}

function AlbumArt({ src, alt, size = 'lg', auraColor }) {
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
      style={auraColor ? { boxShadow: `0 0 60px rgba(${auraColor}, 0.5)` } : {}}
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
  const [auraEnabled, setAuraEnabled] = useState(false)
  const [queueUrl, setQueueUrl] = useState('')
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0)
  const [cachedLyrics, setCachedLyrics] = useState(null)
  const [finishedTrackId, setFinishedTrackId] = useState(null)

  const nowPlayingRef = useRef(null)
  const lastFetchedAtRef = useRef(null)
  const progressTimerRef = useRef(null)

  const [leftSize, setLeftSize] = useState(() => {
    try {
      const v = localStorage.getItem(DISPLAY_SIZE_KEY)
      return v ? Math.min(MAX_PANEL, Math.max(MIN_PANEL, parseInt(v, 10))) : 50
    } catch { return 50 }
  })
  const sizeRef = useRef(leftSize)
  sizeRef.current = leftSize

  const [qrSize, setQrSize] = useState(() => {
    try {
      const v = localStorage.getItem(QR_SIZE_KEY)
      return v ? Math.min(MAX_QR, Math.max(MIN_QR, parseInt(v, 10))) : 25
    } catch { return 25 }
  })
  const qrSizeRef = useRef(qrSize)
  qrSizeRef.current = qrSize

  const handleResizeStart = useCallback((e) => {
    e.preventDefault()
    const startX = e.clientX
    const startSize = sizeRef.current

    const onMove = (e) => {
      const container = document.querySelector('[data-display-panels]')
      if (!container) return
      const rect = container.getBoundingClientRect()
      const delta = ((e.clientX - startX) / rect.width) * 100
      const next = Math.min(MAX_PANEL, Math.max(MIN_PANEL, startSize + delta))
      setLeftSize(next)
    }
    const onUp = () => {
      try { localStorage.setItem(DISPLAY_SIZE_KEY, String(Math.round(sizeRef.current))) } catch {}
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleQrResizeStart = useCallback((e) => {
    e.preventDefault()
    const startY = e.clientY
    const startSize = qrSizeRef.current

    const onMove = (e) => {
      const container = document.querySelector('[data-display-right]')
      if (!container) return
      const rect = container.getBoundingClientRect()
      const delta = ((startY - e.clientY) / rect.height) * 100
      const next = Math.min(MAX_QR, Math.max(MIN_QR, startSize + delta))
      setQrSize(next)
    }
    const onUp = () => {
      try { localStorage.setItem(QR_SIZE_KEY, String(Math.round(qrSizeRef.current))) } catch {}
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const appUrl = queueUrl || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '')

  const auraColor = useAuraColor(auraEnabled ? nowPlaying?.album_art : null)

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

        if (track?.id && nowPlayingRef.current?.id && track.id !== nowPlayingRef.current.id) {
          setFinishedTrackId(nowPlayingRef.current.id)
        }

        if (track?.id !== nowPlayingRef.current?.id) {
          setCachedLyrics(null)
        }

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
        // keep showing last known queue
      }
    }

    fetchQueue()
    const interval = setInterval(fetchQueue, POLL_QUEUE_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Optimistic: remove first from queue when track changes
  useEffect(() => {
    if (finishedTrackId) {
      setUpNext((prev) => prev.slice(1))
    }
  }, [finishedTrackId])

  // Poll public config for voting_enabled and aura_enabled
  useEffect(() => {
    let cancelled = false

    const fetchConfig = async () => {
      if (cancelled) return
      try {
        const res = await axios.get('/api/config/public', { timeout: 5000 })
        if (cancelled) return
        setVotingEnabled(res.data?.voting_enabled ?? false)
        setAuraEnabled(res.data?.aura_enabled ?? false)
        setQueueUrl(res.data?.queue_url || '')
      } catch {
        if (!cancelled) setVotingEnabled(false)
      }
    }

    fetchConfig()
    const interval = setInterval(fetchConfig, 10000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  useEffect(() => {
    if (!votingEnabled) setVotes({})
  }, [votingEnabled])

  // Poll votes when voting enabled
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
        // non-critical
      }
    }

    fetchVotes()
    const interval = setInterval(fetchVotes, POLL_VOTES_MS)
    return () => { cancelled = true; clearInterval(interval) }
  }, [votingEnabled])

  return (
    <div className="fixed inset-0 bg-gray-950 text-white flex flex-col overflow-hidden select-none">
      {!connected && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-red-900/80 backdrop-blur px-3 py-1.5 rounded-full text-sm text-red-200">
          <WifiOff className="h-3.5 w-3.5" />
          Reconnecting…
        </div>
      )}

      <div
        data-display-panels
        className="flex flex-col lg:flex-row flex-1 min-h-0"
        style={{ '--left-pct': `${leftSize}%`, '--right-pct': `${100 - leftSize}%` }}
      >
        <div
          className="flex flex-col items-center justify-center flex-shrink-0 w-full lg:w-[var(--left-pct)] lg:min-w-0 p-8 lg:p-14 gap-6 transition-colors duration-300"
          style={auraColor ? { background: `radial-gradient(ellipse at center, rgba(${auraColor}, 0.25) 0%, transparent 70%)` } : {}}
        >
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
              <AlbumArt src={nowPlaying.album_art} alt={nowPlaying.album} size="lg" auraColor={auraColor} />

              <div className="w-full max-w-sm space-y-3 text-center">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold leading-tight truncate">
                    {nowPlaying.name}
                  </h2>
                  <p className="text-white/60 text-lg truncate mt-1">{nowPlaying.artists}</p>
                </div>

                <div className="space-y-1">
                  <ProgressBar progress={progress} auraColor={auraColor} />
                  <div className="flex justify-between text-xs text-white/40 font-mono">
                    <span>{formatDuration((nowPlaying.progress_ms ?? 0) + (Date.now() - (lastFetchedAtRef.current ?? Date.now())))}</span>
                    <span>{formatDuration(nowPlaying.duration_ms)}</span>
                  </div>
                </div>

                {nowPlaying.lyrics?.lines && (
                  <div className="mt-4 pt-4 border-t border-white/10 max-h-40 overflow-y-auto overflow-x-hidden scroll-smooth">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Lyrics</p>
                    <div className="space-y-2 whitespace-normal">
                      {nowPlaying.lyrics.lines.map((line, idx) => (
                        <div
                          key={idx}
                          ref={idx === currentLyricIndex ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
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

        <div
          className="hidden lg:flex w-1 flex-shrink-0 cursor-col-resize items-center justify-center border-white/10 bg-white/5 hover:bg-white/10 transition-colors group"
          onMouseDown={handleResizeStart}
          role="separator"
          aria-label="Resize panels"
        >
          <GripVertical className="h-5 w-5 text-white/40 group-hover:text-white/60" />
        </div>

        <div
          data-display-right
          className="flex flex-col flex-1 min-w-0 lg:w-[var(--right-pct)] border-t lg:border-t-0 lg:border-l border-white/10"
        >
          <div className="flex-1 min-h-0 flex flex-col p-6 lg:p-10 pb-0">
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
                  const netVotes = votes[track.id] ?? 0
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
                      {votingEnabled && netVotes !== 0 && (
                        <div className={cn('flex items-center gap-1 shrink-0', netVotes > 0 ? 'text-green-400' : 'text-red-400')}>
                          {netVotes > 0 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          <span className="text-xs font-semibold">{netVotes}</span>
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

          {appUrl && (
            <>
              <div
                className="flex h-1 flex-shrink-0 cursor-row-resize items-center justify-center bg-white/5 hover:bg-white/10 transition-colors group"
                onMouseDown={handleQrResizeStart}
                role="separator"
                aria-label="Resize QR section"
              >
                <GripHorizontal className="h-4 w-4 text-white/40 group-hover:text-white/60" />
              </div>
              <div
                className="flex shrink-0 items-stretch gap-4 overflow-hidden px-6 lg:px-10 py-4 border-t border-white/10 min-h-[100px]"
                style={{ flex: `0 0 ${qrSize}%` }}
              >
                <QrCodeScaled value={appUrl} />
                <div className="min-w-0 flex-1 flex flex-col justify-center">
                  <p className="text-sm font-semibold">Queue a song</p>
                  <p className="text-xs text-white/40 mt-0.5 break-all">{appUrl}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

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
