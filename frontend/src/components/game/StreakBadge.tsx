import { motion } from 'framer-motion'
import { popIn } from '../../theme/animations'

interface Props { days: number }

const colors = ['#B0A8A0', '#B0A8A0', '#FAAD14', '#FF8E72', '#FF6B6B', '#FF6B6B', '#FF6B6B']

export default function StreakBadge({ days }: Props) {
  if (days < 2) return null
  const color = colors[Math.min(days, colors.length - 1)]
  return (
    <motion.span variants={popIn} initial="hidden" animate="visible" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px',
      borderRadius: 12, background: color, color: 'white', fontSize: 13,
      fontWeight: 600, fontFamily: '"ZCOOL KuaiLe",cursive',
    }}>
      🔥 {days}天
    </motion.span>
  )
}
