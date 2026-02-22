import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'

function DeviceManagement() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('last_queue_attempt')
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [queueHistory, setQueueHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 5000)
    return () => clearInterval(interval)
  }, [filter, sortBy])

  const loadDevices = async () => {
    try {
      const params = { sort: sortBy }
      if (filter !== 'all') params.status = filter
      const res = await axios.get('/api/admin/devices', { params })
      setDevices(res.data.devices)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const resetCooldown = async (id) => {
    try {
      await axios.post(`/api/admin/devices/${id}/reset-cooldown`)
      loadDevices()
    } catch (e) { alert('Failed to reset cooldown') }
  }

  const blockDevice = async (id) => {
    if (!window.confirm('Block this device?')) return
    try {
      await axios.post(`/api/admin/devices/${id}/block`)
      loadDevices()
    } catch (e) { alert('Failed to block device') }
  }

  const unblockDevice = async (id) => {
    try {
      await axios.post(`/api/admin/devices/${id}/unblock`)
      loadDevices()
    } catch (e) { alert('Failed to unblock device') }
  }

  const resetAllCooldowns = async () => {
    if (!window.confirm('Reset cooldowns for all devices?')) return
    try {
      await axios.post('/api/admin/devices/reset-all-cooldowns')
      loadDevices()
    } catch (e) { alert('Failed to reset cooldowns') }
  }

  const formatTime = (ts) => ts ? new Date(ts * 1000).toLocaleString() : 'Never'
  const formatDuration = (s) => s ? `${Math.floor(s / 60)}m ${s % 60}s` : '0s'

  const viewQueueHistory = async (id) => {
    setHistoryLoading(true)
    setShowHistoryModal(true)
    try {
      const res = await axios.get(`/api/admin/devices/${id}`, { params: { limit: 100 } })
      setSelectedDevice({ ...res.data.device, display_id: res.data.device.id.substring(0, 8) + '...' })
      setQueueHistory(res.data.attempts || [])
    } catch (e) {
      alert('Failed to load queue history')
      setShowHistoryModal(false)
    }
    finally { setHistoryLoading(false) }
  }

  if (loading) return <Card><CardContent className="py-12 text-center text-muted-foreground">Loading devices...</CardContent></Card>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 items-center">
          <label className="text-sm">Filter:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-9 rounded-md border px-3 text-sm bg-background">
            <option value="all">All Devices</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm">Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-9 rounded-md border px-3 text-sm bg-background">
            <option value="last_queue_attempt">Last Activity</option>
            <option value="first_seen">First Seen</option>
            <option value="cooldown_expires">Cooldown Expiry</option>
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={resetAllCooldowns}>Reset All Cooldowns</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {devices.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No devices found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Device ID</th>
                    <th className="text-left py-2 font-medium">Username</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">First Seen</th>
                    <th className="text-left py-2 font-medium">Last Activity</th>
                    <th className="text-left py-2 font-medium">Cooldown</th>
                    <th className="text-left py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr key={d.id} className="border-b">
                      <td className="py-2 font-mono text-xs">{d.display_id}</td>
                      <td className="py-2">{d.username || '-'}</td>
                      <td className="py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${d.status === 'blocked' ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                          {d.status === 'blocked' ? 'BLOCKED' : 'ACTIVE'}
                        </span>
                        {d.is_cooling_down && <span className="ml-1 px-2 py-0.5 rounded text-xs bg-muted">COOLING DOWN</span>}
                      </td>
                      <td className="py-2">{formatTime(d.first_seen)}</td>
                      <td className="py-2">{formatTime(d.last_queue_attempt)}</td>
                      <td className="py-2">{d.is_cooling_down ? formatDuration(d.cooldown_remaining) : 'None'}</td>
                      <td className="py-2 flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => viewQueueHistory(d.id)}>History</Button>
                        {d.status === 'blocked' ? (
                          <Button size="sm" onClick={() => unblockDevice(d.id)}>Unblock</Button>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => resetCooldown(d.id)} disabled={!d.is_cooling_down}>Reset Cooldown</Button>
                            <Button variant="destructive" size="sm" onClick={() => blockDevice(d.id)}>Block</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHistoryModal(false)}>
          <div className="bg-card rounded-xl border shadow-lg max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold">Queue History</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowHistoryModal(false)}>×</Button>
            </div>
            {selectedDevice && (
              <div className="p-4 border-b text-sm space-y-1">
                <div><strong>Device ID:</strong> {selectedDevice.display_id}</div>
                {selectedDevice.username && <div><strong>Username:</strong> {selectedDevice.username}</div>}
                <div><strong>Status:</strong> {selectedDevice.status}</div>
                <div><strong>First Seen:</strong> {formatTime(selectedDevice.first_seen)}</div>
              </div>
            )}
            <div className="p-4 overflow-auto max-h-96">
              {historyLoading ? <div className="text-center text-muted-foreground">Loading...</div> :
                queueHistory.length === 0 ? <div className="text-center text-muted-foreground">No queue history</div> :
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Time</th>
                      <th className="text-left py-2 font-medium">Track</th>
                      <th className="text-left py-2 font-medium">Artist</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueHistory.map((a) => (
                      <tr key={a.id} className="border-b">
                        <td className="py-2">{formatTime(a.timestamp)}</td>
                        <td className="py-2">{a.track_name || '-'}</td>
                        <td className="py-2">{a.artist_name || '-'}</td>
                        <td className="py-2"><span className="font-medium">{a.status}</span></td>
                        <td className="py-2 text-muted-foreground">{a.error_message || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeviceManagement
