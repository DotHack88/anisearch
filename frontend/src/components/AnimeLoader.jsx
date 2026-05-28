import { useEffect, useState } from 'react'

const KATAKANA = ['ア','ニ','メ','サ','ー','チ','ス','タ','ー','ト','ウ','エ','オ','カ','キ','ク','ケ','コ']
const QUOTES = [
  '"Il potere non è il tuo obiettivo finale."',
  '"Un eroe non nasce, diventa."',
  '"Anche il cielo più buio ha le sue stelle."',
  '"Non arrenderti mai. Mai."',
  '"La forza non è nell\'invincibilità."',
]

function MatrixChar({ char, style }) {
  return (
    <span className="matrix-char" style={style}>
      {char}
    </span>
  )
}

export default function AnimeLoader({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)])
  const [visible, setVisible] = useState(true)
  const [chars] = useState(() =>
    Array.from({ length: 30 }, (_, i) => ({
      char: KATAKANA[Math.floor(Math.random() * KATAKANA.length)],
      left: `${Math.random() * 100}%`,
      animDelay: `${Math.random() * 3}s`,
      animDuration: `${2 + Math.random() * 3}s`,
      fontSize: `${10 + Math.floor(Math.random() * 18)}px`,
      opacity: 0.04 + Math.random() * 0.10,
    }))
  )

  useEffect(() => {
    // Simula un progresso rapido
    const steps = [
      { target: 30, delay: 100 },
      { target: 60, delay: 400 },
      { target: 80, delay: 800 },
      { target: 95, delay: 1200 },
      { target: 100, delay: 1700 },
    ]

    let current = 0
    const timers = []

    steps.forEach(({ target, delay }) => {
      const t = setTimeout(() => {
        // Anima in modo fluido tra current e target
        const start = current
        const diff = target - start
        const duration = 300
        const startTime = performance.now()
        const animate = (now) => {
          const elapsed = now - startTime
          const pct = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - pct, 3)
          setProgress(Math.round(start + diff * eased))
          if (pct < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
        current = target
      }, delay)
      timers.push(t)
    })

    // Quando raggiunge 100%, aspetta un momento poi scompare
    const done = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onComplete?.(), 400)
    }, 2200)
    timers.push(done)

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  if (!visible) return null

  return (
    <div
      className="anime-loader-overlay"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    >
      {/* Background katakana rain */}
      <div className="katakana-rain" aria-hidden>
        {chars.map((c, i) => (
          <MatrixChar
            key={i}
            char={c.char}
            style={{
              left: c.left,
              fontSize: c.fontSize,
              opacity: c.opacity,
              animationDelay: c.animDelay,
              animationDuration: c.animDuration,
            }}
          />
        ))}
      </div>

      {/* Center content */}
      <div className="loader-center">
        {/* Torii Gate SVG */}
        <div className="torii-gate" aria-hidden>
          <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" width="120" height="84">
            {/* Top beam */}
            <rect x="10" y="18" width="180" height="14" rx="4" fill="var(--color-accent)" opacity="0.9" />
            {/* Second beam */}
            <rect x="28" y="38" width="144" height="10" rx="3" fill="var(--color-accent)" opacity="0.7" />
            {/* Left pillar */}
            <rect x="36" y="48" width="16" height="90" rx="4" fill="var(--color-accent)" opacity="0.8" />
            {/* Right pillar */}
            <rect x="148" y="48" width="16" height="90" rx="4" fill="var(--color-accent)" opacity="0.8" />
            {/* Left foot */}
            <rect x="26" y="126" width="36" height="10" rx="3" fill="var(--color-accent)" opacity="0.6" />
            {/* Right foot */}
            <rect x="138" y="126" width="36" height="10" rx="3" fill="var(--color-accent)" opacity="0.6" />
            {/* Top curved ends */}
            <path d="M10 22 Q0 10 10 5 Q15 18 10 22Z" fill="var(--color-accent)" opacity="0.7" />
            <path d="M190 22 Q200 10 190 5 Q185 18 190 22Z" fill="var(--color-accent)" opacity="0.7" />
          </svg>
        </div>

        {/* Logo */}
        <div className="loader-logo">
          <span style={{ color: 'var(--color-accent)' }}>ANI</span>
          <span style={{ color: 'var(--color-text)' }}>SEARCH</span>
        </div>

        {/* Quote */}
        <p className="loader-quote">{quote}</p>

        {/* Progress bar */}
        <div className="loader-bar-track">
          <div
            className="loader-bar-fill"
            style={{ width: `${progress}%` }}
          />
          <div className="loader-bar-glow" style={{ left: `calc(${progress}% - 20px)` }} />
        </div>

        {/* Percentage */}
        <span className="loader-pct">{progress}%</span>
      </div>
    </div>
  )
}
