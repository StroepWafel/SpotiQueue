import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { Music, ChevronUp, ChevronDown, WifiOff, GripHorizontal } from 'lucide-react'
import { useAuraColor } from '../hooks/useAuraColor'
import { cn } from '@/lib/utils'

const QR_SIZE_KEY = 'spotiqueue-display-qr-size'
const MIN_QR = 15
const MAX_QR = 50

const POLL_NOW_PLAYING_MS = 3000
const POLL_QUEUE_MS = 8000
const POLL_VOTES_MS = 10000
/** Spotify progress_ms + client extrapolation often lags real audio; nudge lyric line earlier (ms). */
const LYRIC_SYNC_OFFSET_MS = -220

function computeLyricLineIndex(lines, currentMs) {
  if (!lines?.length) return 0
  const t = Math.max(0, currentMs)
  let idx = 0
  for (let i = lines.length - 1; i >= 0; i--) {
    const lineStartMs = lines[i].startTimeMs ?? 0
    if (t >= lineStartMs) {
      idx = i
      break
    }
  }
  return idx
}

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
  /* Bigscreen: scale with viewport (vmin/vh) so 1080p TVs stay compact; cap max on large screens */
  const sizeClass = size === 'lg'
    ? 'max-w-full w-[min(18rem,min(85vw,38vh))] h-[min(18rem,min(85vw,38vh))] max-h-[min(40vh,20rem)] aspect-square'
    : 'w-14 h-14'
  const iconSize = size === 'lg' ? 'h-[min(4rem,10vmin)] w-[min(4rem,10vmin)]' : 'h-5 w-5'

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
  const displayRightRef = useRef(null)

  const [qrSize, setQrSize] = useState(() => {
    try {
      const v = localStorage.getItem(QR_SIZE_KEY)
      return v ? Math.min(MAX_QR, Math.max(MIN_QR, parseInt(v, 10))) : 25
    } catch { return 25 }
  })
  const qrSizeRef = useRef(qrSize)
  qrSizeRef.current = qrSize

  const handleQrResizePointerDown = useCallback((e) => {
    if (!e.isPrimary) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    const pid = e.pointerId
    const startY = e.clientY
    const startSize = qrSizeRef.current

    const onMove = (ev) => {
      if (ev.pointerId !== pid) return
      if (ev.cancelable) ev.preventDefault()
      const container = displayRightRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      if (rect.height <= 0) return
      const delta = ((startY - ev.clientY) / rect.height) * 100
      const next = Math.min(MAX_QR, Math.max(MIN_QR, startSize + delta))
      setQrSize(next)
    }
    const onUp = (ev) => {
      if (ev.pointerId !== pid) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      try { localStorage.setItem(QR_SIZE_KEY, String(Math.round(qrSizeRef.current))) } catch {}
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }, [])

  const appUrl = queueUrl || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : '')

  const auraColor = useAuraColor(auraEnabled ? nowPlaying?.album_art : null)

  /** Extrapolated playback position (ms). Does not advance while paused. */
  function getPlaybackMs() {
    const track = nowPlayingRef.current
    if (!track) return 0
    const base = track.progress_ms ?? 0
    if (!track.is_playing) return base
    const fetchedAt = lastFetchedAtRef.current
    if (fetchedAt == null) return base
    return base + (Date.now() - fetchedAt)
  }

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

  // Progress bar + lyric line: tick every 100ms while playing (500ms was too coarse for sync)
  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current)
    if (!nowPlayingRef.current?.is_playing) return

    const tick = () => {
      const track = nowPlayingRef.current
      const fetchedAt = lastFetchedAtRef.current
      if (!track?.duration_ms || !fetchedAt) return
      const currentMs = getPlaybackMs()
      const newProgress = Math.min((currentMs / track.duration_ms) * 100, 100)
      setProgress(newProgress)
      const lines = track.lyrics?.lines
      if (lines?.length) {
        setCurrentLyricIndex(computeLyricLineIndex(lines, currentMs + LYRIC_SYNC_OFFSET_MS))
      }
    }
    tick()
    progressTimerRef.current = setInterval(tick, 100)

    return () => clearInterval(progressTimerRef.current)
  }, [nowPlaying])

  // When paused (or lyrics arrive while paused), align lyric line without extrapolation
  useEffect(() => {
    const track = nowPlayingRef.current
    if (!track?.lyrics?.lines?.length) return
    if (track.is_playing) return
    const currentMs = track.progress_ms ?? 0
    setCurrentLyricIndex(computeLyricLineIndex(track.lyrics.lines, currentMs + LYRIC_SYNC_OFFSET_MS))
  }, [nowPlaying?.id, nowPlaying?.is_playing, nowPlaying?.lyrics])

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
        className="flex flex-col sm:flex-row flex-1 min-h-0"
      >
        <div
          className="flex flex-col items-center justify-center flex-1 min-h-0 w-full min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar p-4 sm:p-8 2xl:p-12 gap-4 sm:gap-6 transition-colors duration-300 sm:min-w-0 sm:flex-1"
          style={auraColor ? { background: `radial-gradient(ellipse at center, rgba(${auraColor}, 0.25) 0%, transparent 70%)` } : {}}
        >
          {!initialized ? (
            <div className="flex flex-col items-center gap-3 text-white/40">
              <div className="h-48 w-48 sm:h-56 sm:w-56 max-h-[min(40vh,16rem)] max-w-[min(90vw,16rem)] rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
            </div>
          ) : !nowPlaying ? (
            <div className="flex flex-col items-center gap-4 text-white/40">
              <div className="w-[min(18rem,min(85vw,38vh))] h-[min(18rem,min(85vw,38vh))] max-h-[min(40vh,20rem)] rounded-2xl bg-white/5 flex items-center justify-center aspect-square">
                <Music className="h-[min(4rem,10vmin)] w-[min(4rem,10vmin)]" />
              </div>
              <p className="text-[clamp(0.9375rem,1.5vw+0.5rem,1.125rem)]">Nothing playing</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full max-w-lg min-w-0 flex-1 min-h-0 gap-4 overflow-x-hidden px-1 py-2">
              <div className="flex flex-col items-center justify-center w-full min-w-0 max-w-full gap-4">
                <AlbumArt src={nowPlaying.album_art} alt={nowPlaying.album} size="lg" auraColor={auraColor} />

                <div className="w-full max-w-sm min-w-0 max-w-full flex flex-col space-y-3 text-center overflow-x-hidden">
                  <div className="shrink-0 px-0.5 min-w-0 max-w-full">
                    <h2
                      className="font-bold leading-tight line-clamp-3 [overflow-wrap:anywhere] break-words"
                      style={{ fontSize: 'clamp(1rem, 1.75vw + 0.5rem, 1.625rem)' }}
                    >
                      {nowPlaying.name}
                    </h2>
                    <p
                      className="text-white/60 mt-1 line-clamp-3 [overflow-wrap:anywhere] break-words"
                      style={{ fontSize: 'clamp(0.8125rem, 0.9vw + 0.45rem, 1rem)' }}
                    >
                      {nowPlaying.artists}
                    </p>
                  </div>

                  <div className="space-y-1 shrink-0 w-full min-w-0">
                    <ProgressBar progress={progress} auraColor={auraColor} />
                    <div className="flex justify-between gap-2 text-xs text-white/40 font-mono min-w-0">
                      <span className="min-w-0 truncate tabular-nums">{formatDuration(getPlaybackMs())}</span>
                      <span className="shrink-0 tabular-nums">{formatDuration(nowPlaying.duration_ms)}</span>
                    </div>
                  </div>

                  {nowPlaying.lyrics?.lines && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex w-full min-w-0 max-w-full flex-col overflow-hidden max-h-[min(10rem,min(24vh,32dvh))]">
                      <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2 shrink-0 text-center">Lyrics</p>
                      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth rounded-md px-0.5">
                        <div className="space-y-2 whitespace-normal [overflow-wrap:anywhere] break-words text-center">
                          {nowPlaying.lyrics.lines.map((line, idx) => (
                            <div
                              key={idx}
                              ref={idx === currentLyricIndex ? (el) => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }) : null}
                            >
                              <p
                                className={`max-w-full transition-all duration-300 leading-snug [overflow-wrap:anywhere] ${
                                  idx === currentLyricIndex
                                    ? 'text-white font-semibold text-[clamp(0.8125rem,0.85vw+0.5rem,0.9375rem)]'
                                    : idx < currentLyricIndex
                                      ? 'text-white/40 text-[clamp(0.75rem,0.65vw+0.45rem,0.8125rem)]'
                                      : 'text-white/60 text-[clamp(0.75rem,0.65vw+0.45rem,0.8125rem)]'
                                }`}
                              >
                                {line.words}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          ref={displayRightRef}
          data-display-right
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-white/10 sm:border-t-0 sm:border-l sm:border-white/10"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 sm:p-10 pb-0">
            <p className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-widest text-white/40">
              Up Next
            </p>
            {upNext.length === 0 ? (
              <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-white/30">
                Queue is empty
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-pb-6 [scrollbar-gutter:stable]">
                <div className="w-full min-w-0 space-y-1 pb-14 pt-0.5">
                  {upNext.map((track, i) => {
                    const netVotes = votes[track.id] ?? 0
                    return (
                      <div
                        key={`${track.id}-${i}`}
                        className="flex items-start gap-2 sm:gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <span className="text-white/30 text-sm w-5 text-right shrink-0 pt-0.5">{i + 1}</span>
                        <AlbumArt src={track.album_art} alt={track.album} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug line-clamp-2 [overflow-wrap:anywhere] break-words">
                            {track.name}
                          </p>
                          <p className="text-xs text-white/50 mt-0.5 leading-snug line-clamp-2 [overflow-wrap:anywhere] break-words">
                            {track.artists}
                          </p>
                        </div>
                        {votingEnabled && track.votable && netVotes !== 0 && (
                          <div className={cn('flex items-center gap-1 shrink-0 pt-0.5', netVotes > 0 ? 'text-green-400' : 'text-red-400')}>
                            {netVotes > 0 ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            <span className="text-xs font-semibold">{netVotes}</span>
                          </div>
                        )}
                        <span className="text-xs text-white/30 font-mono shrink-0 tabular-nums self-center whitespace-nowrap">
                          {formatDuration(track.duration_ms)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {appUrl && (
            <>
              <div className="relative z-20 flex h-px flex-shrink-0 flex-col">
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Resize QR section"
                  className="absolute inset-x-0 -top-2 -bottom-2 z-10 cursor-row-resize touch-none"
                  onPointerDown={handleQrResizePointerDown}
                />
                <div className="relative z-0 flex h-px w-full flex-shrink-0 items-center justify-center border-t border-white/10 bg-white/5">
                  <GripHorizontal className="h-3.5 w-3.5 text-white/40 pointer-events-none" />
                </div>
              </div>
              <div
                className="flex min-h-[100px] shrink-0 items-stretch gap-4 overflow-hidden border-t border-white/10 px-6 py-4 sm:px-10"
                style={{ flex: `0 0 ${qrSize}%` }}
              >
                <QrCodeScaled value={appUrl} />
                <div className="@container min-w-0 flex-1 flex flex-col justify-center">
                  <p
                    className="font-semibold"
                    style={{ fontSize: 'clamp(0.8125rem, 3.25cqi + 0.35rem, 1.375rem)' }}
                  >
                    Queue a song
                  </p>
                  <p
                    className="text-white/40 mt-1.5 break-all leading-snug"
                    style={{ fontSize: 'clamp(0.75rem, 3.5cqi + 0.4rem, 1.125rem)' }}
                  >
                    {appUrl}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="relative flex items-center justify-between px-6 sm:px-8 py-3 border-t border-white/10 bg-gray-950/95 backdrop-blur-sm shrink-0">
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
