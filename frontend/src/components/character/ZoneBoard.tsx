import { Card, Typography } from 'antd'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '../../theme/animations'
import CharacterCard from './CharacterCard'
import type { CharacterItem } from '../../types'
import { colors } from '../../theme/tokens'

interface Props {
  zone: string
  title: string
  icon: string
  characters: CharacterItem[]
  count: number
}

export default function ZoneBoard({ zone, title, icon, characters, count }: Props) {
  return (
    <Card
      size="small"
      title={
        <span style={{ fontSize: 16, fontFamily: '"ZCOOL KuaiLe",cursive' }}>
          {icon} {title}
          <span style={{ marginLeft: 8, fontSize: 13, color: '#888', fontWeight: 400 }}>({count})</span>
        </span>
      }
      style={{ borderRadius: 16, borderTop: `4px solid ${colors.zone[zone as keyof typeof colors.zone] || '#ccc'}`, height: '100%' }}
    >
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 80 }}
      >
        {characters.length === 0 ? (
          <Typography.Text type="secondary" style={{ width: '100%', textAlign: 'center', padding: 20 }}>
            暂无汉字
          </Typography.Text>
        ) : (
          characters.map((c) => (
            <motion.div key={c.id || c.character} variants={fadeInUp}>
              <CharacterCard character={c.character} pinyin={c.pinyin} zone={zone} tapCount={c.tap_count} />
            </motion.div>
          ))
        )}
      </motion.div>
    </Card>
  )
}
