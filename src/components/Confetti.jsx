// ============================================================
// Dependency-free canvas confetti. Mount with `active` true to fire a
// burst; calls onDone when it settles. Respects prefers-reduced-motion.
// ============================================================
import { useEffect, useRef } from 'react'

const COLORS = ['#FB7A3C', '#F5A524', '#34D399', '#60A5FA', '#F4F5F7']

export default function Confetti({ active, onDone, duration = 2600, intensity = 1 }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!active) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      const t = setTimeout(() => onDone?.(), 400)
      return () => clearTimeout(t)
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => window.innerWidth
    const H = () => window.innerHeight
    // Particle count scales with intensity (capped so big wins stay performant).
    const count = Math.min(320, Math.round((W() / 8) * intensity))
    // Two side cannons + a center fountain.
    const particles = Array.from({ length: count }, (_, i) => {
      const fromLeft = i % 3 === 0
      const fromRight = i % 3 === 1
      const x = fromLeft ? 0 : fromRight ? W() : W() / 2
      const angle = fromLeft ? -Math.PI / 4 : fromRight ? (-3 * Math.PI) / 4 : -Math.PI / 2
      const speed = 9 + Math.random() * 9
      const spread = (Math.random() - 0.5) * 1.0
      return {
        x,
        y: fromLeft || fromRight ? H() * 0.55 : H() * 0.95,
        vx: Math.cos(angle + spread) * speed,
        vy: Math.sin(angle + spread) * speed,
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[(Math.random() * COLORS.length) | 0],
      }
    })

    const start = performance.now()
    const tick = (t) => {
      const elapsed = t - start
      ctx.clearRect(0, 0, W(), H())
      for (const p of particles) {
        p.vy += 0.22 // gravity
        p.vx *= 0.995
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.globalAlpha = Math.max(0, 1 - elapsed / duration)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
        ctx.restore()
      }
      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, W(), H())
        onDone?.()
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [active, duration, onDone, intensity])

  if (!active) return null
  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[200]" aria-hidden="true" />
}
