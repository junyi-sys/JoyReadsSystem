import { motion } from 'framer-motion'
import { Tag } from 'antd'

const EMOTION_STYLES: Record<string, { color: string; bg: string; emoji: string }> = {
  boast: { color: '#fa8c16', bg: '#FFF7E6', emoji: '✨' },
  confused: { color: '#1677ff', bg: '#F0F5FF', emoji: '🤔' },
  conflict: { color: '#f5222d', bg: '#FFF1F0', emoji: '⚡' },
  ignorant: { color: '#722ed1', bg: '#F9F0FF', emoji: '💫' },
  neutral: { color: '#52c41a', bg: '#F6FFED', emoji: '💬' },
}

interface ChatMessage {
  role: 'child' | 'companion'
  content: string
  emotion?: string
  emotionLabel?: string
  _id: string
}

interface Props {
  messages: ChatMessage[]
  onReplay?: (text: string) => void
}

export default function ChatBubble({ messages, onReplay }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
      {messages.map((msg, i) => {
        const isChild = msg.role === 'child'
        const emotionStyle = !isChild && msg.emotion ? EMOTION_STYLES[msg.emotion] || EMOTION_STYLES.neutral : null

        return (
          <motion.div
            key={msg._id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'flex',
              justifyContent: isChild ? 'flex-end' : 'flex-start',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            {!isChild && (
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #6DBF6E, #4DABF7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: '#fff', fontWeight: 700,
                boxShadow: '0 2px 8px rgba(109,191,110,0.3)',
              }}>
                伴
              </div>
            )}

            <div style={{ maxWidth: '75%' }}>
              {emotionStyle && (
                <Tag style={{
                  fontSize: 11, marginBottom: 4, borderRadius: 8,
                  color: emotionStyle.color, background: emotionStyle.bg,
                  border: `1px solid ${emotionStyle.color}33`,
                }}>
                  {emotionStyle.emoji} {msg.emotionLabel}
                </Tag>
              )}
              <div style={{
                padding: '10px 16px',
                borderRadius: isChild ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isChild
                  ? 'linear-gradient(135deg, #6DBF6E, #5BAF5C)'
                  : emotionStyle
                    ? emotionStyle.bg
                    : '#FFFFFF',
                color: isChild ? '#fff' : '#333',
                fontSize: 15,
                lineHeight: 1.6,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                border: isChild ? 'none' : `1px solid ${emotionStyle ? emotionStyle.color + '33' : '#E8E8E8'}`,
                wordBreak: 'break-word' as const,
              }}>
                {msg.content}
              </div>
              {!isChild && onReplay && (
                <div
                  onClick={() => onReplay(msg.content)}
                  style={{
                    fontSize: 11, color: '#999', cursor: 'pointer',
                    marginTop: 2, marginLeft: 46, display: 'inline-flex',
                    alignItems: 'center', gap: 2,
                  }}
                >
                  🔊 重播
                </div>
              )}
            </div>

            {isChild && (
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #FFD666, #FFA940)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16,
                boxShadow: '0 2px 8px rgba(255,214,102,0.3)',
              }}>
                🧒
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}