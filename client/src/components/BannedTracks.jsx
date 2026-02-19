import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useToast } from './ui/toast'
import { Loader2, Ban, X } from 'lucide-react'

function BannedTracks() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTrackId, setNewTrackId] = useState('')
  const [newReason, setNewReason] = useState('')
  const { toast } = useToast()

  useEffect(() => { loadBannedTracks() }, [])

  const loadBannedTracks = async () => {
    try {
      const response = await axios.get('/api/admin/banned-tracks')
      setTracks(response.data.tracks)
    } catch {} finally { setLoading(false) }
  }

  const addBannedTrack = async (e) => {
    e.preventDefault()
    if (!newTrackId.trim()) return
    try {
      await axios.post('/api/admin/banned-tracks', { track_id: newTrackId, reason: newReason || null })
      setNewTrackId(''); setNewReason('')
      loadBannedTracks()
      toast({ title: 'Track banned' })
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.error || 'Failed to ban track', variant: 'destructive' })
    }
  }

  const removeBannedTrack = async (trackId) => {
    if (!window.confirm('Unban this track?')) return
    try { await axios.delete(`/api/admin/banned-tracks/${trackId}`); loadBannedTracks(); toast({ title: 'Track unbanned' }) }
    catch { toast({ title: 'Error', description: 'Failed to unban track', variant: 'destructive' }) }
  }

  const formatTime = (ts) => ts ? new Date(ts * 1000).toLocaleString() : 'Unknown'

  if (loading) return <Card><CardContent className="py-12 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" /></CardContent></Card>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Ban className="h-5 w-5" /> Ban a Track</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addBannedTrack} className="space-y-3">
            <div><Label>Spotify Track ID</Label><Input value={newTrackId} onChange={(e) => setNewTrackId(e.target.value)} placeholder="e.g., 4uLU6hMCjMI75M1A2tKUQC" className="mt-1" /></div>
            <div><Label>Reason (optional)</Label><Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g., Meme song" className="mt-1" /></div>
            <Button type="submit" variant="destructive">Ban Track</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Banned Tracks ({tracks.length})</CardTitle></CardHeader>
        <CardContent>
          {tracks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No banned tracks</p>
          ) : (
            <div className="divide-y">
              {tracks.map((track) => (
                <div key={track.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-mono text-sm">{track.track_id}</p>
                    <p className="text-xs text-muted-foreground">{track.reason || 'No reason'} · {formatTime(track.created_at)}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeBannedTrack(track.track_id)}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default BannedTracks
