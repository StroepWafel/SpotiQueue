import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Download, ImageIcon } from 'lucide-react'

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
  const qrCanvasRef = useRef(null)

  const handleCopy = () => {
    if (!displayUrl) return
    navigator.clipboard.writeText(displayUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadQR = () => {
    if (!displayUrl || !qrCanvasRef.current) return
    const canvas = qrCanvasRef.current
    const link = document.createElement('a')
    link.download = 'queue-qr-code.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleDownloadShareableImage = () => {
    if (!displayUrl || !qrCanvasRef.current) return
    const qrCanvas = qrCanvasRef.current
    const qrSize = 200
    const padding = 32
    const textHeight = 80
    const canvas = document.createElement('canvas')
    canvas.width = qrSize + padding * 2
    canvas.height = qrSize + padding * 2 + textHeight
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(qrCanvas, padding, padding, qrSize, qrSize)
    ctx.fillStyle = '#1a1a1a'
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Scan to queue music', canvas.width / 2, qrSize + padding + 28)
    ctx.font = '14px system-ui, sans-serif'
    ctx.fillStyle = '#666'
    const line2 = 'Or visit: ' + displayUrl
    const maxWidth = canvas.width - 24
    if (ctx.measureText(line2).width > maxWidth) {
      ctx.font = '12px system-ui, sans-serif'
    }
    ctx.fillText(line2, canvas.width / 2, qrSize + padding + 56)
    const link = document.createElement('a')
    link.download = 'queue-scan-me.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
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
                <div className="fixed -left-[9999px] top-0 w-[200px] h-[200px]" aria-hidden="true">
                  <QRCodeCanvas ref={qrCanvasRef} value={displayUrl} size={200} level="M" />
                </div>
                <span className="text-xs text-muted-foreground">Scan to open queue</span>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadQR}>
                    <Download className="h-4 w-4 mr-1" /> Download QR
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadShareableImage}>
                    <ImageIcon className="h-4 w-4 mr-1" /> Shareable image
                  </Button>
                </div>
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Queue URL</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://your-queue.com"
                    className="font-mono text-sm w-full"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopy} disabled={!displayUrl} className="sm:shrink-0">
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
