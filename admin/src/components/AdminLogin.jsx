import { useState } from 'react'
import axios from '@/lib/api'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'

function AdminLogin({ totpRequired, onSuccess }) {
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await axios.post('/api/admin/login', {
        password,
        totp: totpRequired ? totp : undefined
      })
      onSuccess()
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <h1 className="text-xl font-semibold text-center mb-1">SpotiQueue Admin</h1>
          <p className="text-sm text-muted-foreground text-center mb-6">Sign in with your admin password</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="text-sm font-medium block mb-1.5">
                Password
              </label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {totpRequired && (
              <div>
                <label htmlFor="admin-totp" className="text-sm font-medium block mb-1.5">
                  Authenticator code
                </label>
                <Input
                  id="admin-totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  disabled={loading}
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminLogin
