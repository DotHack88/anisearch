import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function ChristmasSnow({ enabled = true }) {
  const canvasRef = useRef(null)
  const { pathname } = useLocation()
  const isWatchingOrReading = pathname.startsWith('/watch/') || pathname.startsWith('/manga/read/')

  useEffect(() => {
    if (!enabled || isWatchingOrReading) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationFrameId
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    // Configurazione fiocchi di neve: leggeri, variati e soffusi
    const flakeCount = Math.min(50, Math.floor(width / 25))
    const flakes = Array.from({ length: flakeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2.5 + 0.8,
      speedY: Math.random() * 0.9 + 0.4,
      speedX: Math.random() * 0.6 - 0.3,
      opacity: Math.random() * 0.6 + 0.25,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.02 + 0.01,
    }))

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i]
        f.sway += f.swaySpeed
        f.x += f.speedX + Math.sin(f.sway) * 0.4
        f.y += f.speedY

        // Wrap around bordi
        if (f.y > height) {
          f.y = -5
          f.x = Math.random() * width
        }
        if (f.x > width) f.x = 0
        if (f.x < 0) f.x = width

        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${f.opacity})`
        ctx.shadowBlur = f.r * 2
        ctx.shadowColor = 'rgba(255, 255, 255, 0.6)'
        ctx.fill()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [enabled, isWatchingOrReading])

  if (!enabled || isWatchingOrReading) return null

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-30 opacity-90 transition-opacity duration-700"
      aria-hidden="true"
    />
  )
}

