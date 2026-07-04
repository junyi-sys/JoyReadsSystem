import { useEffect, useState } from 'react'
import { Card, Tabs, Table, Switch, Tag, Typography, App, Spin } from 'antd'
import { motion } from 'framer-motion'
import ParentGate from '../components/layout/ParentGate'
import { parentApi, studentsApi } from '../services/api'
import { pageTransition } from '../theme/animations'
import type { ParentStudentOverview, FeatureFlags } from '../types'

export default function ParentDashboardPage() {
  const { message } = App.useApp()
  const [unlocked, setUnlocked] = useState(false)
  const [students, setStudents] = useState<ParentStudentOverview[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<number | null>(null)
  const [flags, setFlags] = useState<FeatureFlags | null>(null)
  const [thresholds, setThresholds] = useState<{ level: number; word_threshold: number; article_threshold: number }[]>([])

  const loadStudents = async () => {
    setLoading(true)
    try {
      const { data } = await parentApi.students()
      setStudents(data)
    } catch {} finally { setLoading(false) }
  }

  const loadStudentDetail = async (studentId: number) => {
    try {
      const { data } = await parentApi.studentDetail(studentId)
      setFlags(data.feature_flags)
      setThresholds(data.level_configs)
    } catch {}
  }

  useEffect(() => {
    if (unlocked) loadStudents()
  }, [unlocked])

  const handleStudentClick = (studentId: number) => {
    setSelectedStudent(studentId)
    loadStudentDetail(studentId)
  }

  const handleFlagChange = async (key: string, value: boolean) => {
    if (!selectedStudent) return
    try {
      await studentsApi.updateFeatureFlags(selectedStudent, { [key]: value })
      setFlags((prev) => prev ? { ...prev, [key]: value } : prev)
      message.success('已更新')
    } catch { message.error('更新失败') }
  }

  if (!unlocked) {
    return <ParentGate studentId={1} onUnlock={() => setUnlocked(true)} />
  }

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible"
      style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>家长后台</h1>

      <Tabs items={[
        {
          key: 'students', label: '学生总览',
          children: (
            <Table
              dataSource={students}
              rowKey="id"
              loading={loading}
              onRow={(record) => ({ onClick: () => handleStudentClick(record.id), style: { cursor: 'pointer' } })}
              columns={[
                { title: '姓名', dataIndex: 'name', key: 'name' },
                { title: '年龄', dataIndex: 'age', key: 'age' },
                { title: '等级', dataIndex: 'level', key: 'level' },
                { title: '阅读篇数', dataIndex: 'articles_read', key: 'articles_read' },
                { title: '识字量', dataIndex: 'ally_chars', key: 'ally_chars' },
                { title: '状态', dataIndex: 'is_active', key: 'is_active',
                  render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '活跃' : '停用'}</Tag> },
              ]}
            />
          ),
        },
        {
          key: 'settings', label: '功能开关',
          children: selectedStudent && flags ? (
            <Card style={{ borderRadius: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>苏格拉底反问引导</span>
                  <Switch checked={flags.socratic_enabled} onChange={(v) => handleFlagChange('socratic_enabled', v)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>种子自动生长</span>
                  <Switch checked={flags.seed_auto_grow} onChange={(v) => handleFlagChange('seed_auto_grow', v)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>AI归纳点评</span>
                  <Switch checked={flags.ai_review_enabled} onChange={(v) => handleFlagChange('ai_review_enabled', v)} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>精读计划</span>
                  <Switch checked={flags.reading_plan_enabled} onChange={(v) => handleFlagChange('reading_plan_enabled', v)} />
                </div>
              </div>
            </Card>
          ) : <Typography.Text type="secondary">先点击左侧学生列表选择一个学生</Typography.Text>,
        },
        {
          key: 'thresholds', label: '等级阈值',
          children: selectedStudent ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {thresholds.map((t) => (
                <Card size="small" key={t.level} style={{ borderRadius: 12 }}>
                  <Typography.Text strong>等级 {t.level}</Typography.Text>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <span>识字量: {t.word_threshold}</span>
                    <span>篇数: {t.article_threshold}</span>
                  </div>
                </Card>
              ))}
            </div>
          ) : <Typography.Text type="secondary">先点击左侧学生列表选择一个学生</Typography.Text>,
        },
      ]} />
    </motion.div>
  )
}
