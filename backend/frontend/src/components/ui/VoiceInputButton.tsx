import { Button, message } from 'antd'
import { AudioOutlined, LoadingOutlined } from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useEffect } from 'react'

interface Props {
  onResult: (text: string) => void
  disabled?: boolean
  style?: React.CSSProperties
}

export default function VoiceInputButton({ onResult, disabled, style }: Props) {
  const { isListening, error, start, stop, clearError, supported } = useVoiceInput()
  const [messageApi, contextHolder] = message.useMessage()

  useEffect(() => {
    if (error) {
      messageApi.error(error)
      clearError()
    }
  }, [error, messageApi, clearError])

  if (!supported) return null

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', ...style }}>
      {contextHolder}
      <motion.div
        animate={isListening ? { scale: [1, 1.3, 1] } : { scale: 1 }}
        transition={isListening ? { repeat: Infinity, duration: 1.0 } : {}}
      >
        <Button
          type={isListening ? 'primary' : 'default'}
          danger={isListening}
          icon={isListening ? <LoadingOutlined spin style={{ color: '#fff' }} /> : <AudioOutlined />}
          onClick={() => isListening ? stop() : start(onResult)}
          disabled={disabled}
          shape="circle"
          style={{
            border: isListening ? '2px solid #ff4d4f' : '2px solid #d9d9d9',
            boxShadow: isListening ? '0 0 16px rgba(255,77,79,0.6)' : 'none',
            background: isListening ? '#ff4d4f' : undefined,
            transition: 'all 0.3s',
          }}
          title={isListening ? '点击停止录音' : '点击开始语音输入'}
        />
      </motion.div>
      <AnimatePresence>
        {isListening && (
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            style={{
              marginLeft: 8,
              color: '#ff4d4f',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            正在录音...
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
