import { Modal, Button, List, Tag, Typography } from 'antd'
import { TrophyOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'

const { Title, Text } = Typography

const LEVEL_NAMES: Record<number, string> = {
  0: '识字萌芽', 1: '初识汉字', 2: '探索者', 3: '小读者', 4: '博学者', 5: '小专家', 6: '小博士',
}

interface Props {
  open: boolean
  currentLevel: number
  nextLevel: number
  newFeatures: string[]
  onAccept: () => void
  onDecline: () => void
}

export default function LevelUpModal({ open, currentLevel, nextLevel, newFeatures, onAccept, onDecline }: Props) {
  return (
    <Modal open={open} closable={false} footer={null} width={440} centered>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        style={{ textAlign: 'center', padding: '16px 0' }}>
        <TrophyOutlined style={{ fontSize: 48, color: '#FFD700' }} />
        <Title level={3} style={{ marginTop: 16 }}>
          🎉 你解锁了新等级！
        </Title>
        <Tag color="orange" style={{ fontSize: 16, padding: '4px 16px', margin: '8px 0' }}>
          {LEVEL_NAMES[currentLevel]} → {LEVEL_NAMES[nextLevel]}
        </Tag>

        <div style={{ textAlign: 'left', margin: '16px 0', background: '#f6ffed', borderRadius: 12, padding: 16 }}>
          <Text strong>📦 新增功能：</Text>
          <List size="small" dataSource={newFeatures} renderItem={(f) => (
            <List.Item style={{ padding: '4px 0', border: 'none', fontSize: 14 }}>· {f}</List.Item>
          )} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
          <ClockCircleOutlined style={{ color: '#fa8c16' }} />
          <Text type="secondary">每天需要多花 5-10 分钟</Text>
        </div>

        <Text type="secondary">你准备好了吗？</Text>

        <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button size="large" onClick={onDecline} style={{ borderRadius: 12 }}>
            先保持现在
          </Button>
          <Button type="primary" size="large" onClick={onAccept}
            style={{ borderRadius: 12, background: '#FF6B6B', borderColor: '#FF6B6B' }}>
            我要升级
          </Button>
        </div>
      </motion.div>
    </Modal>
  )
}
