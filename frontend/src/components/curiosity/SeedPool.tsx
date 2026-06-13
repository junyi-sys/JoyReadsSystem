import { List, Button, Tag, Typography, Empty, Popconfirm } from 'antd'
import { RocketOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { seedsApi } from '../../services/api'
import type { CuriositySeed } from '../../types'

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: '待生长' },
  growing: { color: 'blue', label: '生长中' },
  converted: { color: 'green', label: '已回答' },
  skipped: { color: 'default', label: '已跳过' },
}

export default function SeedPool() {
  const [seeds, setSeeds] = useState<CuriositySeed[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await seedsApi.list()
      setSeeds(data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleGrow = async (seedId: number) => {
    await seedsApi.grow(seedId)
    load()
  }

  const handleDelete = async (seedId: number) => {
    await seedsApi.delete(seedId)
    load()
  }

  return (
    <List
      loading={loading}
      dataSource={seeds}
      locale={{ emptyText: <Empty description="还没有好奇种子，去提问吧！" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      renderItem={(seed) => (
        <List.Item
          actions={[
            seed.status === 'pending' && (
              <Button type="primary" size="small" icon={<RocketOutlined />}
                onClick={() => handleGrow(seed.id)}>生长</Button>
            ),
            seed.status === 'converted' && (
              <Tag icon={<CheckCircleOutlined />} color="green">已生成文章</Tag>
            ),
            <Popconfirm title="确定删除这个种子？" onConfirm={() => handleDelete(seed.id)}>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>,
          ].filter(Boolean)}
        >
          <List.Item.Meta
            title={<Typography.Text>{seed.question_text}</Typography.Text>}
            description={
              <div style={{ display: 'flex', gap: 8 }}>
                <Tag color={STATUS_MAP[seed.status]?.color}>{STATUS_MAP[seed.status]?.label}</Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(seed.created_at).toLocaleDateString()}
                </Typography.Text>
              </div>
            }
          />
        </List.Item>
      )}
    />
  )
}
