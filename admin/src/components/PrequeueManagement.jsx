import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Loader2, Check, X, Music } from 'lucide-react'

function PrequeueManagement() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState(null)

  useEffect(() => {
    fetchPending()
    const interval = setInterval(fetchPending, 3000)
    return () => clearInterval(interval)
  }, [])

  const fetchPending = async () => {
    try {
      const response = await axios.get('/api/prequeue/pending')
      setPending(response.data.pending)
    } catch {
      // Auth or network error
    } finally {
      setLoading(false)
    }
  }

  const approve = async (prequeueId) => {
    setActionInProgress(prequeueId)
    try {
      await axios.post(`/api/prequeue/approve/${prequeueId}`, { approved_by: 'admin' })
      setPending((p) => p.filter((x) => x.id !== prequeueId))
    } catch {
      // Error - will refetch on next poll
    } finally {
      setActionInProgress(null)
    }
  }

  const decline = async (prequeueId) => {
    setActionInProgress(prequeueId)
    try {
      await axios.post(`/api/prequeue/decline/${prequeueId}`, { approved_by: 'admin' })
      setPending((p) => p.filter((x) => x.id !== prequeueId))
    } catch {
      // Error
    } finally {
      setActionInProgress(null)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prequeue Requests</h2>
        {pending.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary">
            {pending.length} pending
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No pending requests
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pending.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {request.album_art ? (
                    <img
                      src={request.album_art}
                      alt={request.track_name}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Music className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{request.track_name}</p>
                    <p className="text-sm text-muted-foreground truncate">{request.artist_name}</p>
                    {request.approved_by && (
                      <p className="text-xs text-muted-foreground">Reviewed by: {request.approved_by}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => approve(request.id)}
                      disabled={actionInProgress === request.id}
                    >
                      {actionInProgress === request.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decline(request.id)}
                      disabled={actionInProgress === request.id}
                    >
                      {actionInProgress === request.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default PrequeueManagement
