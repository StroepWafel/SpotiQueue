import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent } from './ui/card'

function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/api/admin/stats')
        setStats(res.data)
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    load()
    const i = setInterval(load, 5000)
    return () => clearInterval(i)
  }, [])

  if (loading) return <Card><CardContent className="py-12 text-center text-muted-foreground">Loading statistics...</CardContent></Card>
  if (!stats) return <Card><CardContent className="py-12 text-center text-destructive">Failed to load statistics</CardContent></Card>

  const successRate = stats.queue_attempts.total > 0
    ? ((stats.queue_attempts.successful / stats.queue_attempts.total) * 100).toFixed(1)
    : 0

  const cards = [
    { label: 'Total Devices', value: stats.devices.total },
    { label: 'Active Devices', value: stats.devices.active },
    { label: 'Blocked Devices', value: stats.devices.blocked },
    { label: 'In Cooldown', value: stats.devices.cooling_down },
    { label: 'Total Queue Attempts', value: stats.queue_attempts.total },
    { label: 'Successful Queues', value: stats.queue_attempts.successful },
    { label: 'Success Rate', value: `${successRate}%` },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-sm text-muted-foreground">{c.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default Stats
