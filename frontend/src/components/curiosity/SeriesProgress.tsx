import { Progress, Tag, Button, Typography } from 'antd'
import { ReadOutlined, CheckCircleOutlined } from '@ant-design/icons'
import type { SeriesInfo } from '../../types'

interface Props {
  series: SeriesInfo
  onContinue: () => void
}

export default function SeriesProgress({ series, onContinue }: Props) {
  const readCount = series.chapters.filter((c) => c.read_status === 'read').length
  const percent = series.total_chapters > 0 ? Math.round((readCount / series.total_chapters) * 100) : 0

  return (
    <div style={{
      padding: '12px 16px', background: '#f6ffed', borderRadius: 12,
      border: '1px solid #b7eb8f', marginTop: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Typography.Text strong style={{ fontSize: 13, color: '#52c41a' }}>
          第{series.current_chapter}/{series.total_chapters}章
        </Typography.Text>
        {series.status !== 'completed' && series.status !== 'abandoned' && (
          <Button size="small" type="link" onClick={onContinue} style={{ padding: 0 }}>
            继续阅读 →
          </Button>
        )}
        {series.status === 'completed' && (
          <Tag color="green" style={{ borderRadius: 10 }}><CheckCircleOutlined /> 已完成</Tag>
        )}
        {series.status === 'abandoned' && (
          <Tag color="default" style={{ borderRadius: 10 }}>已放弃</Tag>
        )}
      </div>
      <Progress percent={percent} size="small" status={percent === 100 ? 'success' : 'active'} />
      <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {series.chapters.map((ch) => (
          <div key={ch.chapter_number} style={{
            width: 24, height: 24, borderRadius: 12, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 11,
            background: ch.read_status === 'read' ? '#52c41a' : ch.read_status === 'reading' ? '#FFE66D' : '#f0f0f0',
            color: ch.read_status === 'read' ? 'white' : '#888',
          }}>
            {ch.read_status === 'read' ? <CheckCircleOutlined /> : ch.chapter_number}
          </div>
        ))}
      </div>
    </div>
  )
}
