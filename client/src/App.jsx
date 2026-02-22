import { useState, useEffect } from 'react'
import axios from 'axios'
import { ThemeToggle } from './components/theme-toggle'
import NowPlaying from './components/NowPlaying'
import QueueForm from './components/QueueForm'
import Queue from './components/Queue'
import { Github, Tv } from 'lucide-react'

axios.defaults.withCredentials = true

function App() {
  const [fingerprintId, setFingerprintId] = useState(null)
  const [nowPlaying, setNowPlaying] = useState(null)
  const [loading, setLoading] = useState(true)
  const [requiresUsername, setRequiresUsername] = useState(false)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [githubConfigured, setGithubConfigured] = useState(false)
  const [googleConfigured, setGoogleConfigured] = useState(false)
  const [authError, setAuthError] = useState('')
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('github_auth') === 'success' || params.get('google_auth') === 'success') {
      window.history.replaceState({}, '', '/')
    }
    if (params.get('error')) {
      setAuthError(params.get('error') === 'github_auth_failed' || params.get('error') === 'google_auth_failed'
        ? 'Authentication failed. Please try again.'
        : params.get('error'))
      window.history.replaceState({}, '', '/')
    }

    axios.post('/api/fingerprint/generate')
      .then(response => {
        const d = response.data
        setFingerprintId(d.fingerprint_id)
        setRequiresUsername(d.requires_username || false)
        setRequiresAuth(!!(d.requires_github_auth || d.requires_google_auth))
        setGithubConfigured(d.github_oauth_configured || false)
        setGoogleConfigured(d.google_oauth_configured || false)
        setLoading(false)
      })
      .catch(error => {
        const d = error.response?.data || {}
        if (d.requires_username || d.requires_github_auth || d.requires_google_auth) {
          setRequiresUsername(!!d.requires_username)
          setRequiresAuth(!!(d.requires_github_auth || d.requires_google_auth))
          setGithubConfigured(d.github_oauth_configured || false)
          setGoogleConfigured(d.google_oauth_configured || false)
        } else {
          console.error('Error generating fingerprint:', error)
        }
        setLoading(false)
      })

    const updateNowPlaying = () => {
      axios.get('/api/now-playing')
        .then(response => setNowPlaying(response.data.track))
        .catch(error => console.error('Error fetching now playing:', error))
    }

    updateNowPlaying()
    const interval = setInterval(updateNowPlaying, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleUsernameSubmit = async (e) => {
    e.preventDefault()
    setUsernameError('')

    if (!username.trim()) {
      setUsernameError('Please enter your name')
      return
    }
    if (username.length > 50) {
      setUsernameError('Username must be 50 characters or less')
      return
    }

    try {
      const response = await axios.post('/api/fingerprint/generate', {
        username: username.trim()
      })
      setFingerprintId(response.data.fingerprint_id)
      setRequiresUsername(false)
    } catch (error) {
      setUsernameError(error.response?.data?.error || 'Failed to set username')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const handleGithubLogin = async () => {
    try {
      const res = await axios.get('/api/github/login')
      window.location.href = res.data.authUrl
    } catch (e) {
      setAuthError('GitHub OAuth not configured')
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const res = await axios.get('/api/google/login')
      window.location.href = res.data.authUrl
    } catch (e) {
      setAuthError('Google OAuth not configured')
    }
  }

  if (requiresAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow">
          <h1 className="text-2xl font-bold mb-2">Sign in to continue</h1>
          <p className="text-muted-foreground mb-6">You need to sign in to queue songs.</p>
          {authError && <div className="mb-4 text-sm text-destructive">{authError}</div>}
          <div className="space-y-2">
            {githubConfigured && (
              <button
                onClick={handleGithubLogin}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 hover:bg-accent transition-colors"
              >
                <Github className="h-5 w-5" /> Sign in with GitHub
              </button>
            )}
            {googleConfigured && (
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 hover:bg-accent transition-colors"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>
            )}
          </div>
          {!githubConfigured && !googleConfigured && (
            <p className="mt-4 text-sm text-muted-foreground">OAuth is not configured. Contact the admin.</p>
          )}
        </div>
      </div>
    )
  }

  if (requiresUsername) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow">
          <h1 className="text-2xl font-bold mb-2">Welcome!</h1>
          <p className="text-muted-foreground mb-6">Please enter your name to continue:</p>
          <form onSubmit={handleUsernameSubmit} className="space-y-4">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your name"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              maxLength={50}
              autoFocus
            />
            {usernameError && (
              <div className="text-sm text-destructive">{usernameError}</div>
            )}
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex justify-between items-center p-4">
        <a href="/display" title="Display mode" className="p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/50 transition-colors">
          <Tv className="h-4 w-4" />
        </a>
        <ThemeToggle />
      </header>
      <main className="container max-w-2xl mx-auto px-4 pb-12">
        <h1 className="text-2xl font-bold mb-6">Queue a Song</h1>
        <NowPlaying track={nowPlaying} />
        <QueueForm fingerprintId={fingerprintId} />
        <Queue fingerprintId={fingerprintId} />
      </main>
    </div>
  )
}

export default App
