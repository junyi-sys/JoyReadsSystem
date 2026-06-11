import { motion } from 'framer-motion'
import { Card, Tag, Typography } from 'antd'
import { fadeInUp } from '../../theme/animations'
import type { CuriosityEvent } from '../../types'

interface Props {
  event: CuriosityEvent
}

export default function CuriosityBubble({ event }: Props) {
  const intensityEmoji = (event.intensity_score || 0) >= 0.7 ? '🔥' : (event.intensity_score || 0) >= 0.4 ? '💡' : '🤔'

  return (
    <motion.div variants={fadeInUp} style={{ marginBottom: 16 }}>
      <Card
        size="small"
        style={{
          borderRadius: 16,
          background: event.is_answered ? '#f6ffed' : '#fff7e6',
          border: event.is_answered ? '1px solid #b7eb8f' : '1px solid #ffd591',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Typography.Text style={{ fontSize: 15, fontWeight: 500 }}>
              {intensityEmoji} {event.raw_text}
            </Typography.Text>
            <div style={{ marginTop: 6 }}>
              <Tag color={event.socratic_mode ? 'orange' : event.mode === 'series' ? 'orange' : 'blue'} style={{ borderRadius: 10 }}>
                {event.socratic_mode ? '苏格拉底' : event.mode === 'series' ? '系列故事' : '快速回答'}
              </Tag>
              {event.is_answered ? (
                <Tag color="green" style={{ borderRadius: 10 }}>已回答</Tag>
              ) : event.socratic_mode && event.follow_up_question ? (
                <Tag color="purple" style={{ borderRadius: 10 }}>等你回答</Tag>
              ) : (
                <Tag color="gold" style={{ borderRadius: 10 }}>处理中</Tag>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
