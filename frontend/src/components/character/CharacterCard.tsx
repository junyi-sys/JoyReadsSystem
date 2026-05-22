import { motion } from 'framer-motion'
import { Card } from 'antd'
import { popIn } from '../../theme/animations'

interface Props {
  character: string
  pinyin?: string
  zone: string
  onMove?: (character: string) => void
}

const zoneColors: Record<string, string> = {
  target: '#FF6B6B',
  scout: '#FFE66D',
  ally: '#4ECDC4',
  lost: '#B0A8A0',
}

export default function CharacterCard({ character, pinyin, zone }: Props) {
  return (
    <motion.div variants={popIn} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Card
        size="small"
        style={{
          borderRadius: 12, textAlign: 'center', cursor: 'pointer',
          borderTop: `3px solid ${zoneColors[zone] || '#ccc'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ fontSize: 32, fontWeight: 700, fontFamily: '"KaiTi",serif', lineHeight: 1.2 }}>
          {character}
        </div>
        {pinyin && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{pinyin}</div>
        )}
      </Card>
    </motion.div>
  )
}
