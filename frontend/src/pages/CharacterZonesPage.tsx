import { useEffect, useState } from 'react'
import { Col, Row, Spin, Modal, Input, Select, Button, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { charactersApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import type { ZoneStats, CharacterItem } from '../types'
import ZoneBoard from '../components/character/ZoneBoard'
import { pageTransition, fadeInUp } from '../theme/animations'

const ZONES = [
  { key: 'target', title: '目标区', icon: '🎯', desc: '正在学习' },
  { key: 'scout', title: '侦查区', icon: '🔍', desc: '即将引入' },
  { key: 'ally', title: '盟友区', icon: '🤝', desc: '已掌握' },
  { key: 'lost', title: '丢失区', icon: '💤', desc: '被遗忘' },
]

export default function CharacterZonesPage() {
  const currentStudent = useStudentStore((s) => s.currentStudent)
  const [stats, setStats] = useState<ZoneStats | null>(null)
  const [zoneChars, setZoneChars] = useState<Record<string, CharacterItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [newChar, setNewChar] = useState('')
  const [newZone, setNewZone] = useState('target')
  const [adding, setAdding] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes] = await Promise.all([charactersApi.stats()])
      setStats(statsRes.data)
      const zones = ['target', 'scout', 'ally', 'lost']
      const zoneResults = await Promise.all(zones.map((z) => charactersApi.zone(z).catch(() => ({ data: [] }))))
      const chars: Record<string, CharacterItem[]> = {}
      zones.forEach((z, i) => { chars[z] = zoneResults[i].data })
      setZoneChars(chars)
    } catch { message.error('加载字库失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [currentStudent])

  const handleAdd = async () => {
    if (!newChar.trim()) return
    setAdding(true)
    try {
      await charactersApi.add(newChar.trim(), newZone)
      message.success(`"${newChar}" 已添加！`)
      setNewChar('')
      setAddOpen(false)
      loadData()
    } catch (err: any) { message.error(err?.message || '添加失败') }
    finally { setAdding(false) }
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div variants={fadeInUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontFamily: '"ZCOOL KuaiLe",cursive', margin: 0 }}>📚 字库管理</h1>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setAddOpen(true)}
          style={{ borderRadius: 16, fontWeight: 600 }}>
          添加汉字
        </Button>
      </motion.div>

      {stats && (
        <motion.div variants={fadeInUp} style={{
          marginBottom: 24, padding: '16px 24px', background: 'white',
          borderRadius: 16, display: 'flex', gap: 32, justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <span style={{ fontSize: 18, fontFamily: '"ZCOOL KuaiLe",cursive' }}>
            总计: <strong style={{ color: '#FF6B6B' }}>{stats.total}</strong> 字
          </span>
          {ZONES.map((z) => (
            <span key={z.key} style={{ fontSize: 14 }}>
              {z.icon} {stats[z.key as keyof ZoneStats]}
            </span>
          ))}
        </motion.div>
      )}

      <Row gutter={[16, 16]}>
        {ZONES.map((z) => (
          <Col xs={24} sm={12} lg={6} key={z.key}>
            <ZoneBoard
              zone={z.key}
              title={z.title}
              icon={z.icon}
              characters={zoneChars[z.key] || []}
              count={stats?.[z.key as keyof ZoneStats] || 0}
            />
          </Col>
        ))}
      </Row>

      <Modal title="添加汉字" open={addOpen} onCancel={() => setAddOpen(false)} onOk={handleAdd}
        confirmLoading={adding} okText="添加" cancelText="取消">
        <Input
          placeholder="输入一个汉字"
          value={newChar}
          onChange={(e) => setNewChar(e.target.value.slice(-1))}
          maxLength={1}
          style={{ borderRadius: 12, fontSize: 24, textAlign: 'center', marginBottom: 12 }}
        />
        <Select value={newZone} onChange={setNewZone} style={{ width: '100%', borderRadius: 12 }}>
          {ZONES.map((z) => (
            <Select.Option key={z.key} value={z.key}>{z.icon} {z.title} - {z.desc}</Select.Option>
          ))}
        </Select>
      </Modal>
    </motion.div>
  )
}
