import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'

function BannedTracks() {
  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTrackId, setNewTrackId] = useState('')
  const [newReason, setNewReason] = useState('')

  useEffect(() => { loadBannedTracks() }, [])

  const loadBannedTracks = async () => {
    try {
      const response = await axios.get('/api/admin/banned-tracks')
      setTracks(response.data.tracks)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const addBannedTrack = async (e) => {
    e.preventDefault()
    if (!newTrackId.trim()) return
    try {
      await axios.post('/api/admin/banned-tracks', { track_id: newTrackId, reason: newReason || null })
      setNewTrackId('')
      setNewReason('')
      loadBannedTracks()
    } catch (e) { alert(e.response?.data?.error || 'Failed to ban track') }
  }

  const removeBannedTrack = async (trackId) => {
    if (!window.confirm('Remove this track from the ban list?')) return
    try {
      await axios.delete(`/api/admin/banned-tracks/${trackId}`)
      loadBannedTracks()
    } catch (e) { alert('Failed to remove banned track') }
  }

  const formatTime = (ts) => ts ? new Date(ts * 1000).toLocaleString() : 'Unknown'

  if (loading) return <Card><CardContent className="py-12 text-center text-muted-foreground">Loading banned tracks...</CardContent></Card>

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Ban a Track</h2>
          <form onSubmit={addBannedTrack} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Spotify Track ID</label>
              <Input value={newTrackId} onChange={(e) => setNewTrackId(e.target.value)} placeholder="e.g., 4uLU6hMCjMI75M1A2tKUQC" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Reason (optional)</label>
              <Input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g., Meme song" />
            </div>
            <Button type="submit">Ban Track</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Banned Tracks ({tracks.length})</h2>
          {tracks.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No banned tracks</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Track ID</th>
                    <th className="text-left py-2 font-medium">Reason</th>
                    <th className="text-left py-2 font-medium">Banned At</th>
                    <th className="text-left py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tracks.map((t) => (
                    <tr key={t.id} className="border-b">
                      <td className="py-2 font-mono text-xs">{t.track_id}</td>
                      <td className="py-2">{t.reason || '-'}</td>
                      <td className="py-2">{formatTime(t.created_at)}</td>
                      <td className="py-2"><Button variant="destructive" size="sm" onClick={() => removeBannedTrack(t.track_id)}>Unban</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default BannedTracks
