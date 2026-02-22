import { useState, useEffect } from 'react'
import axios from 'axios'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'

function QrCode() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [customUrl, setCustomUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    axios.get('/api/admin/client-url')
      .then(res => {
        setUrl(res.data.url || '')
        setCustomUrl(res.data.url || '')
      })
      .catch(() => setUrl(''))
      .finally(() => setLoading(false))
  }, [])

  const displayUrl = customUrl.trim() || url
  const handleCopy = () => {
    if (!displayUrl) return
    navigator.clipboard.writeText(displayUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Queue URL QR Code</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Generate a QR code for guests to scan and open the queue. Use a custom URL below if your public URL differs from the default.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {displayUrl && (
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG value={displayUrl} size={200} level="M" />
                </div>
                <span className="text-xs text-muted-foreground">Scan to open queue</span>
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Queue URL</label>
                <div className="flex gap-2">
                  <Input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://your-queue.com"
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopy} disabled={!displayUrl}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  From Configuration → URLs (Queue URL), or CLIENT_URL env. Override here for one-off use.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default QrCode
