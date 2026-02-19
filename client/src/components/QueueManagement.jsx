import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Loader2, Music } from 'lucide-react'

function QueueManagement() {
  const [queue, setQueue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [finishedTrackId, setFinishedTrackId] = useState(null)
  const nowPlayingRef = useRef(null)

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 20000)
    return () => clearInterval(interval)
  }, [])

  // Poll now playing to detect when track changes
  useEffect(() => {
    let cancelled = false

    const fetchNowPlaying = async () => {
      if (cancelled) return
      try {
        const res = await axios.get('/api/now-playing', { timeout: 5000 })
        const track = res.data?.track ?? null
        
        // If track changed, that means the previous one finished
        if (track?.id && nowPlayingRef.current?.id && track.id !== nowPlayingRef.current.id) {
          console.log('SONG FINISHED! Previous track ID:', nowPlayingRef.current.id)
          setFinishedTrackId(nowPlayingRef.current.id)
        }
        
        nowPlayingRef.current = track
      } catch {
        // ignore errors
      }
    }

    fetchNowPlaying()
    const interval = setInterval(fetchNowPlaying, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Remove first item from queue when song finishes
  useEffect(() => {
    if (finishedTrackId && queue) {
      console.log('Removing first item from queue in QueueManagement')
      setQueue(prev => ({
        ...prev,
        queue: prev.queue.slice(1)
      }))
    }
  }, [finishedTrackId])

  const fetchQueue = async () => {
    try { const response = await axios.get('/api/queue/current'); setQueue(response.data) }
    catch {} finally { setLoading(false) }
  }

  if (loading) return <Card><CardContent className="py-12 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" /></CardContent></Card>
  if (!queue || queue.queue.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Queue Management</h2>
        <Card><CardContent className="py-8 text-center text-muted-foreground">No songs in queue</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Queue Management</h2>

      {queue.currently_playing && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-primary">Now Playing</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-3">
            {queue.currently_playing.album_art ? (
              <img src={queue.currently_playing.album_art} alt={queue.currently_playing.album} className="w-12 h-12 rounded object-cover" />
            ) : (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center"><Music className="h-5 w-5 text-muted-foreground" /></div>
            )}
            <div className="min-w-0">
              <p className="font-medium truncate">{queue.currently_playing.name}</p>
              <p className="text-sm text-muted-foreground truncate">{queue.currently_playing.artists}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Upcoming ({queue.queue.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {queue.queue.map((track, index) => (
              <div key={`${track.uri}-${index}`} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm text-muted-foreground w-5 text-right flex-shrink-0">{index + 1}</span>
                {track.album_art ? (
                  <img src={track.album_art} alt={track.album} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0"><Music className="h-4 w-4 text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{track.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{track.artists}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 font-mono">
                  {Math.floor(track.duration_ms / 60000)}:{String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default QueueManagement
