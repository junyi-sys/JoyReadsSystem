import { useEffect, useState } from 'react'
import { Card, Button, Tag, Progress, Spin, Empty, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { planApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import { pageTransition } from '../theme/animations'
import type { PlanDay, ReadingPlan } from '../types'

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四']
const FOCUS_COLORS: Record<string, string> = {
  '情节理解': '#1677ff', '人物动机': '#52c41a', '细节发现': '#fa8c16',
  '联想生活': '#eb2f96', '发挥想象': '#722ed1',
}

export default function PlanPage() {
  const navigate = useNavigate()
  const currentStudent = useStudentStore((s) => s.currentStudent)
  const [plan, setPlan] = useState<(ReadingPlan & { days: PlanDay[] }) | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await planApi.current()
      if (data) {
        setPlan(data)
      } else {
        const { data: newPlan } = await planApi.create()
        setPlan({ ...newPlan, days: [] })
      }
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [currentStudent])

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  if (!plan) return <Empty description="加载失败" />

  const completed = plan.days.filter((d) => d.status === 'completed').length
  const total = plan.days.length || 20

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible"
      style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>精读计划</h1>
        <Tag color="blue" style={{ fontSize: 14 }}>第 {plan.current_week}/{plan.week_count} 周</Tag>
      </div>
      <Progress percent={Math.round((completed / total) * 100)} style={{ marginBottom: 24 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plan.days.map((day) => (
          <Card key={day.id} size="small" style={{ borderRadius: 12 }}
            hoverable={day.status === 'pending'}
            onClick={() => day.status === 'pending' && navigate(`/reading/${day.id}`)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Tag color={FOCUS_COLORS[day.focus]}>{day.focus}</Tag>
                <Typography.Text strong> {DAY_NAMES[day.day_of_week]}</Typography.Text>
                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>{day.topic_category}</Typography.Text>
              </div>
              <Tag color={day.status === 'completed' ? 'green' : day.status === 'reading' ? 'blue' : 'default'}>
                {day.status === 'completed' ? '已完成' : day.status === 'reading' ? '阅读中' : '待开始'}
              </Tag>
            </div>
          </Card>
        ))}
      </div>
    </motion.div>
  )
}
