import { motion } from 'framer-motion'
import { pulse } from '../../theme/animations'

export default function ReadingBuddy() {
  return (
    <motion.div
      variants={pulse}
      animate="animate"
      style={{
        position: 'fixed', bottom: 20, right: 20, width: 60, height: 60,
        borderRadius: 30, background: 'linear-gradient(135deg, #FFE66D, #FF8E72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30, cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,142,114,0.3)',
        zIndex: 1000, userSelect: 'none',
      }}
      title="加油！"
    >
      🐱
    </motion.div>
  )
}
