import { useState, useEffect, useRef } from 'react'

export function useAuraColor(imageUrl) {
  const [rgb, setRgb] = useState(null)
  const prevUrlRef = useRef(null)

  useEffect(() => {
    if (!imageUrl || imageUrl === prevUrlRef.current) return
    prevUrlRef.current = imageUrl

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    img.onload = async () => {
      if (cancelled) return
      try {
        const ColorThief = (await import('colorthief')).default
        const colorThief = new ColorThief()
        const [r, g, b] = colorThief.getColor(img)
        if (!cancelled) setRgb([r, g, b])
      } catch {
        if (!cancelled) setRgb(null)
      }
    }

    img.onerror = () => {
      if (!cancelled) setRgb(null)
    }

    return () => { cancelled = true }
  }, [imageUrl])

  return rgb ? rgb.join(', ') : null
}
