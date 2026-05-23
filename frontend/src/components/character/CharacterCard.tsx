import { motion } from 'framer-motion'
import { Card } from 'antd'
import { popIn } from '../../theme/animations'
import { colors } from '../../theme/tokens'

interface Props {
  character: string
  pinyin?: string
  zone: string
  tapCount?: number
}

export default function CharacterCard({ character, pinyin, zone, tapCount }: Props) {
  const zoneColor = colors.zone[zone as keyof typeof colors.zone] || '#ccc'

  return (
    <motion.div variants={popIn} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Card
        size="small"
        style={{
          borderRadius: 12, textAlign: 'center', cursor: 'pointer',
          borderTop: `3px solid ${zoneColor}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: '"KaiTi",serif', lineHeight: 1.2 }}>
          {character}
        </div>
        {pinyin && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{pinyin}</div>
        )}
        {tapCount !== undefined && tapCount > 0 && (
          <div style={{ fontSize: 10, color: '#FF8E72', marginTop: 2 }}>
            点读 {tapCount} 次
          </div>
        )}
      </Card>
    </motion.div>
  )
}
