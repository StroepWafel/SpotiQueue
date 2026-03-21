import { useState, useEffect } from 'react'
import axios from '@/lib/api'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'

function ConfigItem({ label, children, saveKey, saveVal, help, config, updateConfig }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        {label}
        {help && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
        {children}
        <Button size="sm" onClick={() => updateConfig(saveKey, saveVal !== undefined ? saveVal : config[saveKey])}>Save</Button>
      </div>
    </div>
  )
}

function Configuration() {
  const [config, setConfig] = useState({})
  const [adminPasswordDraft, setAdminPasswordDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState('success')

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    try {
      const res = await axios.get('/api/config')
      setConfig(res.data.config)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const updateConfig = async (key, value) => {
    try {
      await axios.put(`/api/config/${key}`, { value })
      setConfig(prev => ({ ...prev, [key]: value }))
      setMessage('Configuration updated!')
      setMessageType('success')
      setTimeout(() => setMessage(null), 3000)
    } catch (e) {
      alert('Failed to update configuration')
    }
  }

  const saveAdminPassword = async () => {
    if (!adminPasswordDraft.trim()) {
      alert('Enter a new password')
      return
    }
    try {
      await axios.put('/api/config/admin_password', { value: adminPasswordDraft })
      setAdminPasswordDraft('')
      setConfig(prev => ({ ...prev, admin_password_configured: true }))
      setMessage('Admin password updated (stored hashed).')
      setMessageType('success')
      setTimeout(() => setMessage(null), 3000)
    } catch (e) {
      alert('Failed to update password')
    }
  }

  const saveAllConfig = async () => {
    try {
      setSaving(true)
      const updates = Object.fromEntries(
        Object.entries(config).filter(
          ([k, v]) => v != null && k !== 'admin_password_configured'
        )
      )
      if (adminPasswordDraft.trim()) {
        updates.admin_password = adminPasswordDraft
      }
      const res = await axios.put('/api/config', updates)
      setConfig(res.data.config || config)
      if (adminPasswordDraft.trim()) setAdminPasswordDraft('')
      setMessage('All configuration saved!')
      setMessageType('success')
      setTimeout(() => setMessage(null), 3000)
    } catch (e) {
      setMessage('Failed to save configuration')
      setMessageType('error')
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (key, value) => setConfig(prev => ({ ...prev, [key]: value }))

  if (loading) return <Card><CardContent className="py-12 text-center text-muted-foreground">Loading configuration...</CardContent></Card>

  return (
    <div className="space-y-6">
      <div className="sticky top-2 z-40 flex justify-end">
        <Button
          onClick={saveAllConfig}
          disabled={saving}
          className="min-h-[44px] px-5 sm:min-h-9 sm:px-4"
        >
          {saving ? 'Saving…' : 'Save All'}
        </Button>
      </div>
      {message && (
        <div
          className={`fixed left-0 right-0 top-0 z-50 flex items-center justify-center border-b px-6 py-3 pt-safe pl-safe pr-safe text-sm shadow-md ${
            messageType === 'success'
              ? 'bg-primary/95 text-primary-foreground border-primary/30'
              : 'bg-destructive/95 text-destructive-foreground border-destructive/30'
          }`}
          style={{ animation: 'slideDown 0.25s ease-out' }}
        >
          {message}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Queue Management</h2>
          <ConfigItem config={config} updateConfig={updateConfig}
            label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.queueing_enabled !== 'false'} onChange={(e) => handleChange('queueing_enabled', e.target.checked ? 'true' : 'false')} /> Enable Queueing</label>}
            saveKey="queueing_enabled"
            saveVal={config.queueing_enabled || 'true'}
            help="When disabled, all queue requests and search will be blocked."
          />
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.prequeue_enabled === 'true'} onChange={(e) => handleChange('prequeue_enabled', e.target.checked ? 'true' : 'false')} /> Enable Prequeue (approval required)</label>} saveKey="prequeue_enabled" saveVal={config.prequeue_enabled || 'false'} help="When enabled, queue requests must be approved in the Prequeue tab before adding to Spotify." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Rate Limiting</h2>
          <ConfigItem config={config} updateConfig={updateConfig} label={<><span className="block font-medium">Cooldown Duration (seconds)</span><p className="text-xs text-muted-foreground mt-1">Time between queue attempts</p></>} saveKey="cooldown_duration" saveVal={config.cooldown_duration}>
            <Input type="number" value={config.cooldown_duration || '300'} onChange={(e) => handleChange('cooldown_duration', e.target.value)} min="0" className="w-full sm:w-24" />
          </ConfigItem>
          <ConfigItem config={config} updateConfig={updateConfig} label={<><span className="block font-medium">Songs Before Cooldown</span><p className="text-xs text-muted-foreground mt-1">Songs a user can queue before cooldown starts</p></>} saveKey="songs_before_cooldown" saveVal={config.songs_before_cooldown || '1'}>
            <Input type="number" value={config.songs_before_cooldown || '1'} onChange={(e) => handleChange('songs_before_cooldown', e.target.value)} min="1" className="w-full sm:w-20" />
          </ConfigItem>
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.fingerprinting_enabled === 'true'} onChange={(e) => handleChange('fingerprinting_enabled', e.target.checked ? 'true' : 'false')} /> Enable Fingerprinting & Cooldown</label>} saveKey="fingerprinting_enabled" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Song Voting</h2>
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.voting_enabled === 'true'} onChange={(e) => handleChange('voting_enabled', e.target.checked ? 'true' : 'false')} /> Enable Song Voting</label>} saveKey="voting_enabled" saveVal={config.voting_enabled || 'false'} help="Allow guests to vote on tracks in the queue (off by default)." />
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.voting_downvote_enabled !== 'false'} onChange={(e) => handleChange('voting_downvote_enabled', e.target.checked ? 'true' : 'false')} /> Enable Downvotes</label>} saveKey="voting_downvote_enabled" saveVal={config.voting_downvote_enabled !== 'false' ? 'true' : 'false'} help="Allow guests to downvote tracks in addition to upvoting. When disabled, only upvotes are shown." />
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.voting_auto_promote === 'true'} onChange={(e) => handleChange('voting_auto_promote', e.target.checked ? 'true' : 'false')} /> Auto-Promote by Votes</label>} saveKey="voting_auto_promote" saveVal={config.voting_auto_promote || 'false'} help="Sort the queue display by vote count (highest first). Note: Spotify playback order is unchanged; this only affects how the queue is shown." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Display Mode</h2>
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.aura_enabled === 'true'} onChange={(e) => handleChange('aura_enabled', e.target.checked ? 'true' : 'false')} /> Enable Album Aura</label>} saveKey="aura_enabled" saveVal={config.aura_enabled || 'false'} help="Show radial gradient from album art dominant color on the /display party view." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Input Methods</h2>
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.search_ui_enabled === 'true'} onChange={(e) => handleChange('search_ui_enabled', e.target.checked ? 'true' : 'false')} /> Enable Search UI</label>} saveKey="search_ui_enabled" />
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.url_input_enabled === 'true'} onChange={(e) => handleChange('url_input_enabled', e.target.checked ? 'true' : 'false')} /> Enable URL Input</label>} saveKey="url_input_enabled" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Content Filtering</h2>
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.ban_explicit === 'true'} onChange={(e) => handleChange('ban_explicit', e.target.checked ? 'true' : 'false')} /> Ban Explicit Songs</label>} saveKey="ban_explicit" help="Block songs marked explicit by Spotify." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Guest Authentication</h2>
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.require_github_auth === 'true'} onChange={(e) => handleChange('require_github_auth', e.target.checked ? 'true' : 'false')} /> Require GitHub Sign-in</label>} saveKey="require_github_auth" saveVal={config.require_github_auth || 'false'} help="Guests must sign in with GitHub to queue or vote. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env." />
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.require_google_auth === 'true'} onChange={(e) => handleChange('require_google_auth', e.target.checked ? 'true' : 'false')} /> Require Google Sign-in</label>} saveKey="require_google_auth" saveVal={config.require_google_auth || 'false'} help="Guests must sign in with Google to queue or vote. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">User Identification</h2>
          <ConfigItem config={config} updateConfig={updateConfig} label={<label className="flex items-center gap-2"><input type="checkbox" checked={config.require_username === 'true'} onChange={(e) => handleChange('require_username', e.target.checked ? 'true' : 'false')} /> Require Username on First Visit</label>} saveKey="require_username" saveVal={config.require_username || 'false'} help="Prompt users to enter a username before queueing." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">URLs</h2>
          <ConfigItem config={config} updateConfig={updateConfig} label="Queue URL:" saveKey="queue_url" help="Public URL for the queue (used in QR codes on Display mode and admin). Leave empty to use current host or CLIENT_URL.">
            <Input type="text" value={config.queue_url || ''} onChange={(e) => handleChange('queue_url', e.target.value)} placeholder="https://queue.example.com" className="w-full sm:w-64" />
          </ConfigItem>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Security</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-3 border-b">
            <div className="flex-1 min-w-0">
              <span className="font-medium">Admin password</span>
              <p className="text-xs text-muted-foreground mt-1">
                Stored as a scrypt hash in the database. Enter a new password to replace it.
                {config.admin_password_configured === false && (
                  <span className="block mt-1">No custom password saved yet—default is still <code className="text-xs">admin</code> until you set one.</span>
                )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Input
                type="password"
                value={adminPasswordDraft}
                onChange={(e) => setAdminPasswordDraft(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                className="w-full sm:w-48"
              />
              <Button size="sm" onClick={saveAdminPassword}>
                Save
              </Button>
            </div>
          </div>
          <ConfigItem config={config} updateConfig={updateConfig} label="Admin Panel Redirect URL:" saveKey="admin_panel_url" help="Full URL for 'Go to Admin Panel' after Spotify auth.">
            <Input type="text" value={config.admin_panel_url || ''} onChange={(e) => handleChange('admin_panel_url', e.target.value)} placeholder="https://admin.url.com" className="w-full sm:w-64" />
          </ConfigItem>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h2>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-medium mb-1">Reset All Data</div>
              <p className="text-sm text-muted-foreground">Permanently delete all devices, statistics, and banned tracks. Configuration preserved. Cannot be undone.</p>
            </div>
            <Button variant="destructive" onClick={async () => {
              if (!window.confirm('Reset all data? This cannot be undone.')) return
              if (!window.confirm('Final warning. Continue?')) return
              try {
                await axios.post('/api/admin/reset-all-data')
                setMessage('All data has been reset.')
                setMessageType('success')
                setTimeout(() => setMessage(null), 5000)
              } catch (e) { alert('Failed: ' + (e.response?.data?.error || e.message)) }
            }}>Reset All Data</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Configuration
