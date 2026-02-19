import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Separator } from './ui/separator'
import { useToast } from './ui/toast'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, Save, Trash2, QrCode } from 'lucide-react'

function Configuration() {
  const [config, setConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const { toast } = useToast()

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    try { const response = await axios.get('/api/config'); setConfig(response.data.config) }
    catch {} finally { setLoading(false) }
  }

  const updateConfig = async (key, value) => {
    try {
      await axios.put(`/api/config/${key}`, { value })
      setConfig({ ...config, [key]: value })
      toast({ title: 'Saved', description: `${key} updated` })
    } catch { toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' }) }
  }

  const saveAll = async () => {
    setSaving(true)
    try { await axios.put('/api/config', config); toast({ title: 'All settings saved' }) }
    catch { toast({ title: 'Error', description: 'Failed to save', variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleChange = (key, value) => setConfig({ ...config, [key]: value })

  const handleReset = async () => {
    if (!window.confirm('Reset ALL data? This deletes devices, stats, and banned tracks.')) return
    if (!window.confirm('Final warning. This cannot be undone. Continue?')) return
    try { await axios.post('/api/admin/reset-all-data'); toast({ title: 'Data reset', description: 'All data has been cleared' }) }
    catch (error) { toast({ title: 'Error', description: error.response?.data?.error || 'Failed to reset', variant: 'destructive' }) }
  }

  const queueUrl = typeof window !== 'undefined' ? window.location.origin : ''

  if (loading) return <Card><CardContent className="py-12 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" /></CardContent></Card>

  return (
    <div className="space-y-6">
      {/* QR Code */}
      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><QrCode className="h-5 w-5" /> Event QR Code</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Share this QR code with guests so they can queue songs.</p>
          <div className="flex flex-col items-center gap-3">
            <Button variant="outline" onClick={() => setShowQR(!showQR)}>{showQR ? 'Hide QR Code' : 'Show QR Code'}</Button>
            {showQR && (
              <div className="p-4 bg-white rounded-lg">
                <QRCodeSVG value={queueUrl} size={200} level="M" />
              </div>
            )}
            <p className="text-xs text-muted-foreground font-mono">{queueUrl}</p>
          </div>
        </CardContent>
      </Card>

      {/* Queue Management */}
      <Card className="border-2">
        <CardHeader><CardTitle className="text-lg">Queue Management</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Enable Queueing</Label><p className="text-xs text-muted-foreground">When disabled, all queue requests are blocked</p></div>
            <Switch checked={config.queueing_enabled !== 'false'} onCheckedChange={(v) => updateConfig('queueing_enabled', v ? 'true' : 'false')} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Enable Song Voting</Label><p className="text-xs text-muted-foreground">Allow attendees to upvote queued songs</p></div>
            <Switch checked={config.voting_enabled === 'true'} onCheckedChange={(v) => updateConfig('voting_enabled', v ? 'true' : 'false')} />
          </div>
        </CardContent>
      </Card>

      {/* Visual & Social */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Visual & Social</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Album Aura (Color Theming)</Label><p className="text-xs text-muted-foreground">Page accent color follows the current song's album art</p></div>
            <Switch checked={config.aura_enabled !== 'false'} onCheckedChange={(v) => updateConfig('aura_enabled', v ? 'true' : 'false')} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Confetti on Queue</Label><p className="text-xs text-muted-foreground">Burst of confetti when a song is added to the queue</p></div>
            <Switch checked={config.confetti_enabled !== 'false'} onCheckedChange={(v) => updateConfig('confetti_enabled', v ? 'true' : 'false')} />
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Rate Limiting</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><Label>Cooldown Duration (seconds)</Label><Input type="number" value={config.cooldown_duration || '300'} onChange={(e) => handleChange('cooldown_duration', e.target.value)} min="0" className="mt-1" /></div>
            <div><Label>Songs Before Cooldown</Label><Input type="number" value={config.songs_before_cooldown || '1'} onChange={(e) => handleChange('songs_before_cooldown', e.target.value)} min="1" className="mt-1" /></div>
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Enable Fingerprinting & Cooldown</Label></div>
            <Switch checked={config.fingerprinting_enabled === 'true'} onCheckedChange={(v) => handleChange('fingerprinting_enabled', v ? 'true' : 'false')} />
          </div>
        </CardContent>
      </Card>

      {/* Content Filtering */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Content Filtering</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Ban Explicit Songs</Label><p className="text-xs text-muted-foreground">Block songs marked explicit by Spotify</p></div>
            <Switch checked={config.ban_explicit === 'true'} onCheckedChange={(v) => handleChange('ban_explicit', v ? 'true' : 'false')} />
          </div>
          <div><Label>Max Song Duration (seconds, 0 = no limit)</Label><Input type="number" value={config.max_song_duration || '0'} onChange={(e) => handleChange('max_song_duration', e.target.value)} min="0" className="mt-1" /><p className="text-xs text-muted-foreground mt-1">Songs longer than this will be rejected. Set to 0 to disable.</p></div>
        </CardContent>
      </Card>

      {/* Input Methods */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Input Methods</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable Search UI</Label>
            <Switch checked={config.search_ui_enabled === 'true'} onCheckedChange={(v) => handleChange('search_ui_enabled', v ? 'true' : 'false')} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Enable URL Input</Label>
            <Switch checked={config.url_input_enabled === 'true'} onCheckedChange={(v) => handleChange('url_input_enabled', v ? 'true' : 'false')} />
          </div>
        </CardContent>
      </Card>

      {/* Approval System */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Approval System</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div><Label>Enable Prequeue (Slack Approval)</Label><p className="text-xs text-muted-foreground">Requires SLACK_WEBHOOK_URL in .env</p></div>
            <Switch checked={config.prequeue_enabled === 'true'} onCheckedChange={(v) => handleChange('prequeue_enabled', v ? 'true' : 'false')} />
          </div>
        </CardContent>
      </Card>

      {/* User ID */}
      <Card>
        <CardHeader><CardTitle className="text-lg">User Identification</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div><Label>Require Username</Label><p className="text-xs text-muted-foreground">Users must enter a name before queueing</p></div>
            <Switch checked={config.require_username === 'true'} onCheckedChange={(v) => handleChange('require_username', v ? 'true' : 'false')} />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Security</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Admin Password</Label><Input type="password" value={config.admin_password || ''} onChange={(e) => handleChange('admin_password', e.target.value)} placeholder="Enter new password" className="mt-1" /></div>
          <div><Label>User Password (empty = public)</Label><Input type="password" value={config.user_password || ''} onChange={(e) => handleChange('user_password', e.target.value)} placeholder="Leave empty to disable" className="mt-1" /></div>
          <div><Label>Admin Panel URL</Label><Input value={config.admin_panel_url || ''} onChange={(e) => handleChange('admin_panel_url', e.target.value)} placeholder="https://admin.example.com" className="mt-1" /></div>
        </CardContent>
      </Card>

      {/* Save All */}
      <Button onClick={saveAll} disabled={saving} className="w-full">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save All Changes</>}
      </Button>

      {/* Danger Zone */}
      <Separator />
      <Card className="border-destructive/50">
        <CardHeader><CardTitle className="text-lg text-destructive">Danger Zone</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">Permanently delete all devices, statistics, and banned tracks. Config is preserved.</p>
          <Button variant="destructive" onClick={handleReset}><Trash2 className="h-4 w-4 mr-2" /> Reset All Data</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default Configuration
