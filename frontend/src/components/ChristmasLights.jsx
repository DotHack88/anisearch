import { memo } from 'react'

const LIGHT_COLORS = [
  { bg: '#ff3b30', glow: 'rgba(255, 59, 48, 0.85)', delay: '0s' },
  { bg: '#34c759', glow: 'rgba(52, 199, 89, 0.85)', delay: '0.4s' },
  { bg: '#ffd60a', glow: 'rgba(255, 214, 10, 0.9)', delay: '0.8s' },
  { bg: '#0a84ff', glow: 'rgba(10, 132, 255, 0.85)', delay: '1.2s' },
  { bg: '#ff375f', glow: 'rgba(255, 55, 95, 0.85)', delay: '0.6s' },
  { bg: '#30d158', glow: 'rgba(48, 209, 88, 0.85)', delay: '1.0s' },
  { bg: '#ff9f0a', glow: 'rgba(255, 159, 10, 0.85)', delay: '0.2s' },
]

export default memo(function ChristmasLights({ count = 28 }) {
  const lights = Array.from({ length: count })

  return (
    <div className="absolute -bottom-2.5 left-0 right-0 h-4 pointer-events-none overflow-hidden flex justify-around items-start z-50">
      {/* Cavo sottile della ghirlanda */}
      <svg
        className="absolute top-0 left-0 w-full h-2.5 text-white/10 pointer-events-none"
        preserveAspectRatio="none"
        viewBox="0 0 100 10"
      >
        <path
          d="M0 2 Q 5 7, 10 2 Q 15 7, 20 2 Q 25 7, 30 2 Q 35 7, 40 2 Q 45 7, 50 2 Q 55 7, 60 2 Q 65 7, 70 2 Q 75 7, 80 2 Q 85 7, 90 2 Q 95 7, 100 2"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        />
      </svg>

      {/* Lampadine natalizie */}
      {lights.map((_, i) => {
        const color = LIGHT_COLORS[i % LIGHT_COLORS.length]
        return (
          <div key={i} className="relative flex flex-col items-center">
            {/* Attacco lampadina */}
            <div className="w-1 h-1 bg-zinc-700 rounded-t-sm" />
            {/* Lampadina */}
            <div
              className="w-2.5 h-3.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor: color.bg,
                boxShadow: `0 0 8px 2px ${color.glow}, 0 0 16px 4px ${color.glow}`,
                animation: `xmas-glow 1.8s infinite ease-in-out ${color.delay}`,
              }}
            />
          </div>
        )
      })}

      <style>{`
        @keyframes xmas-glow {
          0%, 100% {
            opacity: 0.95;
            transform: scale(1);
            filter: brightness(1.2);
          }
          50% {
            opacity: 0.45;
            transform: scale(0.85);
            filter: brightness(0.7);
          }
        }
      `}</style>
    </div>
  )
})

