import { Card, Typography, Tag, Button } from 'antd'
import { PlayCircleOutlined, SoundOutlined, RobotOutlined } from '@ant-design/icons'
import { useState } from 'react'
import type { TheoryItem } from '../../types'

const { Text, Paragraph } = Typography

export default function TheoryCard({ theory }: { theory: TheoryItem }) {
  const [playing, setPlaying] = useState(false)

  const handlePlay = () => {
    if (!theory.has_audio) return
    setPlaying(true)
    const audio = new Audio(`/api/theory/${theory.id}/audio`)
    audio.onended = () => setPlaying(false)
    audio.onerror = () => setPlaying(false)
    audio.play()
  }

  return (
    <Card
      size="small"
      style={{ borderRadius: 12, marginBottom: 12 }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SoundOutlined style={{ color: '#6DBF6E' }} />
          <Text strong>{theory.title}</Text>
          <Tag color="blue" style={{ fontSize: 11 }}>
            {new Date(theory.created_at).toLocaleDateString()}
          </Tag>
        </div>
      }
      extra={
        theory.has_audio && (
          <Button type="primary" shape="circle" icon={<PlayCircleOutlined />}
            loading={playing} onClick={handlePlay} size="small" />
        )
      }
    >
      {theory.transcript && (
        <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8, color: '#555' }}>
          &ldquo;{theory.transcript}&rdquo;
        </Paragraph>
      )}
      {theory.ai_encouragement && (
        <div style={{ background: '#f6ffed', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
          <RobotOutlined style={{ marginRight: 6, color: '#52c41a' }} />
          <Text style={{ color: '#389e0d', fontSize: 13 }}>{theory.ai_encouragement}</Text>
        </div>
      )}
      {!theory.transcript && !theory.ai_encouragement && theory.content && (
        <Paragraph ellipsis={{ rows: 2 }} style={{ color: '#888' }}>{theory.content}</Paragraph>
      )}
    </Card>
  )
}
