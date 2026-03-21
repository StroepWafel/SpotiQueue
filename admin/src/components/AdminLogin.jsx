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
    <div className="flex min-h-0 w-full flex-1 flex-col justify-start px-4 pb-8 pt-4 sm:justify-center sm:py-8 sm:pb-safe sm:pt-safe">
      <Card className="mx-auto w-full max-w-md shrink-0 shadow-md">
        <CardContent className="px-4 pt-6 sm:px-6">
          <h1 className="mb-1 text-center text-xl font-semibold">SpotiQueue Admin</h1>
          <p className="mb-6 text-center text-sm text-muted-foreground">Sign in with your admin password</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium">
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
                <label htmlFor="admin-totp" className="mb-1.5 block text-sm font-medium">
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
            <Button type="submit" className="min-h-[48px] w-full sm:min-h-9" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminLogin
