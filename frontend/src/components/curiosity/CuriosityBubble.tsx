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
          background: event.socratic_mode && !event.child_response ? '#fff0f6' : event.is_answered ? '#f6ffed' : '#fff7e6',
          border: event.socratic_mode && !event.child_response ? '1px solid #ffadd2' : event.is_answered ? '1px solid #b7eb8f' : '1px solid #ffd591',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Typography.Text style={{ fontSize: 15, fontWeight: 500 }}>
              {intensityEmoji} {event.raw_text}
            </Typography.Text>

            {/* Socratic follow-up question */}
            {event.socratic_mode && event.follow_up_question && (
              <div style={{
                marginTop: 8, padding: '8px 12px',
                background: 'rgba(235, 47, 150, 0.06)',
                borderRadius: 10, fontSize: 13, color: '#eb2f96',
                border: '1px dashed #ffadd2',
              }}>
                🤔 AI追问：{event.follow_up_question}
              </div>
            )}

            {/* Child's response */}
            {event.child_response && (
              <div style={{
                marginTop: 8, padding: '8px 12px',
                background: 'rgba(82, 196, 26, 0.06)',
                borderRadius: 10, fontSize: 13, color: '#389e0d',
                border: '1px solid #b7eb8f',
              }}>
                💬 我的想法：{event.child_response}
              </div>
            )}

            <div style={{ marginTop: 6 }}>
              <Tag color={event.socratic_mode ? 'magenta' : event.mode === 'series' ? 'orange' : 'blue'} style={{ borderRadius: 10 }}>
                {event.socratic_mode ? '苏格拉底' : event.mode === 'series' ? '系列故事' : '快速回答'}
              </Tag>
              {event.is_answered ? (
                <Tag color="green" style={{ borderRadius: 10 }}>已回答</Tag>
              ) : event.socratic_mode && !event.child_response ? (
                <Tag color="pink" style={{ borderRadius: 10 }}>等你想一想</Tag>
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
