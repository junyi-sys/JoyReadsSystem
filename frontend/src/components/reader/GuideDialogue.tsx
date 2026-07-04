import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Space, Spin, Tag, Typography } from 'antd'
import { AudioOutlined, AudioMutedOutlined, EditOutlined, ForwardOutlined } from '@ant-design/icons'
import DialogueBubble from './DialogueBubble'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { planApi, ttsApi } from '../../services/api'
import type { DialogueMessage } from '../../types'

const { Text } = Typography

interface Props {
  dayId: number
  onComplete: () => void
  onSkip: () => void
}

export default function GuideDialogue({ dayId, onComplete, onSkip }: Props) {
  const [messages, setMessages] = useState<DialogueMessage[]>([])
  const [talkingPoints, setTalkingPoints] = useState<string[]>([])
  const [pointIndex, setPointIndex] = useState(0)
  const [roundInPoint, setRoundInPoint] = useState(1)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const { isListening, error: voiceError, start, stop, clearError } = useVoiceInput()
  const bottomRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Start dialogue on mount
  useEffect(() => {
    planApi.dialogueStart(dayId).then(({ data }) => {
      setTalkingPoints(data.talking_points)
      setMessages([{ role: 'guide', text: data.first_tts }])
      playTTS(data.first_tts)
      setLoading(false)
    }).catch((err: any) => {
      setError('启动对话失败: ' + (err?.message || '未知错误'))
      setLoading(false)
    })
  }, [dayId])

  const playTTS = useCallback(async (text: string) => {
    try {
      const { data } = await ttsApi.synthesize(text)
      const url = URL.createObjectURL(data)

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
      }
      blobUrlRef.current = url

      if (audioRef.current) {
        audioRef.current.pause()
      }

      const audio = new Audio(url)
      audioRef.current = audio
      audio.play().catch(() => { /* autoplay blocked, user can tap replay */ })
    } catch {
      // TTS failed silently — text is still visible
    }
  }, [])

  const handleVoiceResult = useCallback(async (text: string) => {
    if (!text.trim()) return
    setProcessing(true)
    setError(null)

    const childMsg: DialogueMessage = { role: 'child', text }
    setMessages(prev => [...prev, childMsg])

    try {
      const { data } = await planApi.dialogueTurn(dayId, {
        point_index: pointIndex,
        round_in_point: roundInPoint,
        child_text: text,
        talking_points: talkingPoints,
      })

      const guideMsg: DialogueMessage = { role: 'guide', text: data.tts_text }
      setMessages(prev => [...prev, guideMsg])
      playTTS(data.tts_text)

      if (data.done) {
        setDone(true)
        setTimeout(onComplete, 2000)
      } else if (data.next_point) {
        setPointIndex(prev => prev + 1)
        setRoundInPoint(1)
      } else {
        setRoundInPoint(prev => prev + 1)
      }
    } catch (err: any) {
      setError('对话出错了: ' + (err?.message || '未知错误'))
    } finally {
      setProcessing(false)
    }
  }, [pointIndex, roundInPoint, talkingPoints, dayId, playTTS, onComplete])

  const handleStartRecording = () => {
    clearError()
    start(handleVoiceResult)
  }

  const handleStopRecording = () => {
    stop()
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin tip="引导员正在准备……" />
      </div>
    )
  }

  if (error && messages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Text type="danger">{error}</Text>
        <br />
        <Button onClick={onSkip} type="primary" style={{ marginTop: 16, borderRadius: 12 }}>
          跳过对话，直接开始阅读
        </Button>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - 280px)',
      minHeight: 400,
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center', marginBottom: 16,
        padding: '8px 0', borderBottom: '1px solid #F0F0F0',
      }}>
        <Tag color="blue" style={{ fontSize: 13, padding: '2px 12px' }}>
          对话导读中 · 第 {pointIndex + 1}/{talkingPoints.length} 个话题
        </Tag>
        {done && <Tag color="green" style={{ marginLeft: 8 }}>即将进入阅读</Tag>}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0 4px',
        overscrollBehavior: 'contain',
      }}>
        {messages.map((msg, i) => (
          <DialogueBubble
            key={i}
            role={msg.role}
            text={msg.text}
            onReplay={msg.role === 'guide' ? () => playTTS(msg.text) : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <Text type="danger" style={{ fontSize: 12, textAlign: 'center', display: 'block', marginTop: 4 }}>
          {error}
        </Text>
      )}
      {voiceError && (
        <Text type="warning" style={{ fontSize: 12, textAlign: 'center', display: 'block', marginTop: 4 }}>
          {voiceError}
        </Text>
      )}

      {/* Input */}
      <div style={{
        marginTop: 12, paddingTop: 12,
        borderTop: '1px solid #F0F0F0',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12,
      }}>
        {processing ? (
          <Spin tip="引导员正在思考……" />
        ) : done ? (
          <Button type="primary" onClick={onComplete} style={{ borderRadius: 16 }}>
            开始阅读文章
          </Button>
        ) : (
          <Space size="middle">
            <Button
              type={isListening ? 'default' : 'primary'}
              shape="round"
              size="large"
              danger={isListening}
              icon={isListening ? <AudioMutedOutlined /> : <AudioOutlined />}
              onClick={isListening ? handleStopRecording : handleStartRecording}
              style={{ minWidth: 160 }}
            >
              {isListening ? '点击停止' : '用声音回答'}
            </Button>

            <Button
              shape="round"
              size="large"
              icon={<EditOutlined />}
              disabled
              title="打字模式即将支持"
            >
              打字
            </Button>

            <Button
              type="text"
              icon={<ForwardOutlined />}
              onClick={onSkip}
            >
              跳过对话
            </Button>
          </Space>
        )}
      </div>
    </div>
  )
}
