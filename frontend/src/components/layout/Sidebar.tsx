import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Typography, Progress, Tag } from 'antd'
import { HomeOutlined, BulbOutlined, ReadOutlined, BookOutlined, BarChartOutlined } from '@ant-design/icons'
import { useStudentStore } from '../../store/useStudentStore'
import { studentsApi } from '../../services/api'

const items = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/plan', icon: <ReadOutlined />, label: '精读计划' },
  { key: '/curiosity', icon: <BulbOutlined />, label: '好奇心' },
  { key: '/characters', icon: <ReadOutlined />, label: '字库' },
  { key: '/articles', icon: <BookOutlined />, label: '文章' },
  { key: '/knowledge', icon: <BulbOutlined />, label: '知识图谱' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计' },
]

const COGNITION_LABELS: Record<number, string> = {
  0: '学前', 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级',
}

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const studentId = useStudentStore((s) => s.currentStudent?.id)
  const [progress, setProgress] = useState<{ current_level: number; articles_read: number; articles_needed: number; ally_chars: number; chars_needed: number } | null>(null)

  useEffect(() => {
    if (!studentId) return
    studentsApi.levelProgress(studentId).then(({ data }) => setProgress(data)).catch(() => {})
  }, [studentId])

  return (
    <div>
      {!collapsed && (
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Text style={{ fontSize: 20, fontFamily: '"ZCOOL KuaiLe",cursive', color: '#FF6B6B' }}>
            俊宜阅读
          </Typography.Text>
          {progress && (
            <div style={{ marginTop: 8 }}>
              <Tag color="orange" style={{ marginBottom: 4 }}>
                {COGNITION_LABELS[progress.current_level]}
              </Tag>
              <Progress
                percent={Math.round(
                  ((progress.articles_read / Math.max(progress.articles_needed, 1)) * 0.5 +
                   (progress.ally_chars / Math.max(progress.chars_needed, 1)) * 0.5) * 100
                )}
                size="small"
                showInfo={false}
              />
            </div>
          )}
        </div>
      )}
      <Menu
        mode="inline"
        selectedKeys={[location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`]}
        items={items}
        onClick={({ key }) => navigate(key)}
        style={{ border: 'none', background: 'transparent', marginTop: 8 }}
      />
    </div>
  )
}
