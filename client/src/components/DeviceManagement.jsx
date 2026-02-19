import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { useToast } from './ui/toast'
import { Select } from './ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Loader2, History, Shield, ShieldOff, RotateCcw } from 'lucide-react'

function DeviceManagement() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('last_queue_attempt')
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [queueHistory, setQueueHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadDevices()
    const interval = setInterval(loadDevices, 5000)
    return () => clearInterval(interval)
  }, [filter, sortBy])

  const loadDevices = async () => {
    try {
      const params = { sort: sortBy }
      if (filter !== 'all') params.status = filter
      const response = await axios.get('/api/admin/devices', { params })
      setDevices(response.data.devices)
    } catch {} finally { setLoading(false) }
  }

  const resetCooldown = async (deviceId) => {
    try { await axios.post(`/api/admin/devices/${deviceId}/reset-cooldown`); loadDevices(); toast({ title: 'Cooldown reset' }) } catch { toast({ title: 'Error', description: 'Failed to reset cooldown', variant: 'destructive' }) }
  }

  const blockDevice = async (deviceId) => {
    if (!window.confirm('Block this device?')) return
    try { await axios.post(`/api/admin/devices/${deviceId}/block`); loadDevices(); toast({ title: 'Device blocked' }) } catch { toast({ title: 'Error', description: 'Failed to block device', variant: 'destructive' }) }
  }

  const unblockDevice = async (deviceId) => {
    try { await axios.post(`/api/admin/devices/${deviceId}/unblock`); loadDevices(); toast({ title: 'Device unblocked' }) } catch { toast({ title: 'Error', description: 'Failed to unblock device', variant: 'destructive' }) }
  }

  const resetAllCooldowns = async () => {
    if (!window.confirm('Reset cooldowns for all devices?')) return
    try { await axios.post('/api/admin/devices/reset-all-cooldowns'); loadDevices(); toast({ title: 'All cooldowns reset' }) } catch { toast({ title: 'Error', description: 'Failed to reset cooldowns', variant: 'destructive' }) }
  }

  const viewHistory = async (deviceId) => {
    setHistoryLoading(true); setShowHistory(true)
    try {
      const response = await axios.get(`/api/admin/devices/${deviceId}`, { params: { limit: 100 } })
      setSelectedDevice({ ...response.data.device, display_id: response.data.device.id.substring(0, 8) + '...' })
      setQueueHistory(response.data.attempts || [])
    } catch { toast({ title: 'Error', description: 'Failed to load history', variant: 'destructive' }); setShowHistory(false) }
    finally { setHistoryLoading(false) }
  }

  const formatTime = (ts) => { if (!ts) return 'Never'; return new Date(ts * 1000).toLocaleString() }
  const formatDuration = (s) => { if (!s) return '0s'; return `${Math.floor(s / 60)}m ${s % 60}s` }

  if (loading) return <Card><CardContent className="py-12 text-center text-muted-foreground"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></CardContent></Card>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Devices</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </Select>
        <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="last_queue_attempt">Last Activity</option>
          <option value="first_seen">First Seen</option>
          <option value="cooldown_expires">Cooldown Expiry</option>
        </Select>
        <Button variant="outline" size="sm" onClick={resetAllCooldowns}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset All Cooldowns
        </Button>
      </div>

      {devices.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No devices found</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <Card key={device.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm">{device.display_id}</span>
                      {device.username && <span className="text-sm text-muted-foreground">({device.username})</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={device.status === 'blocked' ? 'destructive' : 'secondary'}>
                        {device.status === 'blocked' ? 'Blocked' : 'Active'}
                      </Badge>
                      {device.is_cooling_down && <Badge variant="outline">Cooldown: {formatDuration(device.cooldown_remaining)}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Last: {formatTime(device.last_queue_attempt)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => viewHistory(device.id)}><History className="h-3.5 w-3.5" /></Button>
                    {device.status === 'blocked' ? (
                      <Button size="sm" variant="outline" onClick={() => unblockDevice(device.id)}><ShieldOff className="h-3.5 w-3.5" /></Button>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => resetCooldown(device.id)} disabled={!device.is_cooling_down}><RotateCcw className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => blockDevice(device.id)}><Shield className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Queue History {selectedDevice && `- ${selectedDevice.display_id}`}</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></div>
          ) : queueHistory.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No history found</p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto divide-y">
              {queueHistory.map((attempt) => (
                <div key={attempt.id} className="py-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{attempt.track_name || '-'}</span>
                    <Badge variant={attempt.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                      {attempt.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{attempt.artist_name || '-'} · {formatTime(attempt.timestamp)}</p>
                  {attempt.error_message && <p className="text-xs text-destructive">{attempt.error_message}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DeviceManagement
