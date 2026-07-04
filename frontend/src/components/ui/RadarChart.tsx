import type { RadarData } from '../../types'

const LABELS = ['情节理解', '人物分析', '细节发现', '联想表达', '想象力']
const KEYS = ['plot', 'character', 'detail', 'association', 'imagination']
const CENTER = 120
const RADIUS = 90
const ANGLES = KEYS.map((_, i) => (Math.PI * 2 * i) / KEYS.length - Math.PI / 2)

function polar(angle: number, r: number) {
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) }
}

export function RadarChart({ data }: { data: RadarData }) {
  const values = KEYS.map((k) => (data[k as keyof RadarData] || 50) / 100)
  const points = values.map((v, i) => polar(ANGLES[i], RADIUS * v))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={CENTER * 2 + 40} height={CENTER * 2 + 40} viewBox={`0 0 ${CENTER * 2 + 40} ${CENTER * 2 + 40}`}>
        <g transform={`translate(20,20)`}>
          {[0.25, 0.5, 0.75, 1].map((s) => {
            const pts = ANGLES.map((a) => polar(a, RADIUS * s))
            const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
            return (
              <path key={s} d={d} fill="none" stroke="#e8e8e8" strokeWidth={s === 1 ? 2 : 1} />
            )
          })}
          {ANGLES.map((a) => {
            const p = polar(a, RADIUS)
            return <line key={a} x1={CENTER} y1={CENTER} x2={p.x} y2={p.y} stroke="#e8e8e8" strokeWidth={1} />
          })}
          <path d={path} fill="#4DABF780" stroke="#4DABF7" strokeWidth={2} />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill="#4DABF7" />
          ))}
          {KEYS.map((_, i) => {
            const p = polar(ANGLES[i], RADIUS + 18)
            return (
              <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 12, fill: '#666', fontFamily: '"ZCOOL KuaiLe",cursive' }}>
                {LABELS[i]}
              </text>
            )
          })}
          <text x={CENTER} y={CENTER} textAnchor="middle" dominantBaseline="middle"
            style={{ fontSize: 14, fontWeight: 700, fill: '#4DABF7' }}>
            {Math.round(values.reduce((s, v) => s + v, 0) / values.length * 100)}%
          </text>
        </g>
      </svg>
    </div>
  )
}
