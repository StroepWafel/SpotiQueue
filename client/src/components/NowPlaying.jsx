import { useState, useEffect, useRef } from 'react'
import { Music, Pause } from 'lucide-react'

function formatDuration(ms) {
  if (!ms || !Number.isFinite(ms)) return '0:00'
  return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
}

function NowPlaying({ track }) {
  const [progress, setProgress] = useState(0)
  const lastReceivedRef = useRef(null)
  const trackRef = useRef(null)

  useEffect(() => {
    trackRef.current = track
    lastReceivedRef.current = Date.now()
    if (track?.duration_ms) {
      setProgress(((track.progress_ms ?? 0) / track.duration_ms) * 100)
    } else {
      setProgress(0)
    }
  }, [track])

  useEffect(() => {
    if (!track?.is_playing) return
    const timer = setInterval(() => {
      const t = trackRef.current
      const since = lastReceivedRef.current
      if (!t?.duration_ms || !since) return
      const currentMs = (t.progress_ms ?? 0) + (Date.now() - since)
      setProgress(Math.min((currentMs / t.duration_ms) * 100, 100))
    }, 500)
    return () => clearInterval(timer)
  }, [track?.id, track?.is_playing])

  const elapsedMs = track && lastReceivedRef.current
    ? Math.min((track.progress_ms ?? 0) + (Date.now() - lastReceivedRef.current), track.duration_ms ?? 0)
    : 0

  if (!track) {
    return (
      <div className="mb-6 rounded-xl border bg-card overflow-hidden">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
          <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
            <Music className="h-8 w-8 opacity-30" />
          </div>
          <p className="text-sm font-medium">Nothing playing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-xl border bg-card overflow-hidden">
      <div className="flex gap-4 p-4">
        {track.album_art ? (
          <img src={track.album_art} alt={track.album} className="w-20 h-20 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Music className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-2">
          {track.is_playing ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
              Playing
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <Pause className="h-2.5 w-2.5" />
              Paused
            </span>
          )}

          <div>
            <div className="font-semibold truncate">{track.name}</div>
            <div className="text-sm text-muted-foreground truncate">{track.artists}</div>
          </div>

          <div className="space-y-1">
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(Math.max(progress, 0), 100)}%`,
                  backgroundColor: track.is_playing ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.4)'
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>{formatDuration(elapsedMs)}</span>
              <span>{formatDuration(track.duration_ms)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NowPlaying
