import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Loader2, Users, Activity, ShieldBan, Timer, Target, CheckCircle, TrendingUp } from 'lucide-react'

function Stats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try { const response = await axios.get('/api/admin/stats'); setStats(response.data) }
    catch {} finally { setLoading(false) }
  }

  if (loading) return <Card><CardContent className="py-12 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground" /></CardContent></Card>
  if (!stats) return <Card><CardContent className="py-8 text-center text-destructive">Failed to load statistics</CardContent></Card>

  const successRate = stats.queue_attempts.total > 0
    ? ((stats.queue_attempts.successful / stats.queue_attempts.total) * 100).toFixed(1) : 0

  const statCards = [
    { label: 'Total Devices', value: stats.devices.total, icon: Users },
    { label: 'Active Devices', value: stats.devices.active, icon: Activity },
    { label: 'Blocked Devices', value: stats.devices.blocked, icon: ShieldBan },
    { label: 'In Cooldown', value: stats.devices.cooling_down, icon: Timer },
    { label: 'Total Attempts', value: stats.queue_attempts.total, icon: Target },
    { label: 'Successful Queues', value: stats.queue_attempts.successful, icon: CheckCircle },
    { label: 'Success Rate', value: `${successRate}%`, icon: TrendingUp },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {statCards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default Stats
