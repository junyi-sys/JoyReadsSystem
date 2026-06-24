import { Typography, Button } from 'antd'
import { SoundOutlined, UserOutlined, SmileOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'

const { Text } = Typography

interface Props {
  role: 'guide' | 'child'
  text: string
  onReplay?: () => void
}

export default function DialogueBubble({ role, text, onReplay }: Props) {
  const isGuide = role === 'guide'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        flexDirection: isGuide ? 'row' : 'row-reverse',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 16,
        paddingLeft: isGuide ? 0 : 40,
        paddingRight: isGuide ? 40 : 0,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: isGuide ? 'linear-gradient(135deg, #4DABF7, #74C0FC)' : 'linear-gradient(135deg, #FFD43B, #FFA94D)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isGuide ? (
          <SmileOutlined style={{ color: '#fff', fontSize: 18 }} />
        ) : (
          <UserOutlined style={{ color: '#fff', fontSize: 18 }} />
        )}
      </div>

      <div style={{ flex: 1, maxWidth: '80%' }}>
        <div style={{
          background: isGuide ? '#F0F7FF' : '#FFF8E1',
          borderRadius: isGuide ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          padding: '12px 16px',
          border: isGuide ? '1px solid #BAE0FF' : '1px solid #FFE58F',
        }}>
          <Text style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: isGuide ? '#1A1A1A' : '#5C3D00',
          }}>
            {text}
          </Text>
        </div>

        {isGuide && onReplay && (
          <Button
            type="text"
            size="small"
            icon={<SoundOutlined />}
            onClick={onReplay}
            style={{ marginTop: 4, color: '#4DABF7', padding: '0 4px' }}
          >
            重播
          </Button>
        )}
      </div>
    </motion.div>
  )
}
