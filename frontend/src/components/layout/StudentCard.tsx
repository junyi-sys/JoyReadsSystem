import { useEffect, useState } from 'react'
import { Avatar, Popover, List, Tag, Skeleton } from 'antd'
import { UserOutlined, BookOutlined, ReadOutlined, SwapOutlined, CrownOutlined } from '@ant-design/icons'
import { useStudentStore } from '../../store/useStudentStore'
import { statsApi } from '../../services/api'
import { COGNITION_SHORT_LABELS } from '../../types'

export default function StudentCard() {
  const { currentStudent, students, loading, loadStudents, switchStudent } = useStudentStore()
  const [stats, setStats] = useState({ chars: 0, articles: 0 })
  const [statsLoading, setStatsLoading] = useState(false)

  useEffect(() => { loadStudents() }, [])

  useEffect(() => {
    if (!currentStudent) return
    setStatsLoading(true)
    statsApi.overview().then(({ data }) => {
      setStats({
        chars: data.total_characters_learned ?? 0,
        articles: data.total_articles_read ?? 0,
      })
    }).catch(() => {}).finally(() => setStatsLoading(false))
  }, [currentStudent?.id])

  if (loading || !currentStudent) {
    return <Skeleton.Button active style={{ width: 180, height: 40 }} />
  }

  const switcherContent = (
    <List
      size="small"
      dataSource={students}
      style={{ maxHeight: 220, overflow: 'auto', minWidth: 180 }}
      renderItem={(s) => (
        <List.Item
          onClick={() => switchStudent(s.id)}
          style={{
            cursor: 'pointer', padding: '6px 8px', borderRadius: 8,
            background: s.id === currentStudent?.id ? '#F0F7F4' : 'transparent',
            transition: 'background 0.2s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <Avatar size={28} icon={<UserOutlined />}
              style={{ background: s.id === currentStudent?.id ? '#6DBF6E' : '#ccc', flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: s.id === currentStudent?.id ? 600 : 400 }}>{s.name}</span>
            <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}>
              {COGNITION_SHORT_LABELS[s.cognition_level] || `L${s.cognition_level}`}
            </Tag>
          </div>
        </List.Item>
      )}
    />
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'white', borderRadius: 16, padding: '10px 18px',
      boxShadow: '0 2px 12px rgba(109, 191, 110, 0.10)',
      border: '1px solid #E8F5E9',
      lineHeight: 1.5,
    }}>
      <Popover content={switcherContent} title="切换学生" trigger="click" placement="bottomRight">
        <div style={{ cursor: 'pointer', position: 'relative' }}>
          <Avatar size={42} icon={<UserOutlined />}
            style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)', flexShrink: 0 }} />
          <SwapOutlined style={{
            position: 'absolute', bottom: -2, right: -2,
            fontSize: 12, color: '#6DBF6E', background: 'white', borderRadius: '50%', padding: 2,
          }} />
        </div>
      </Popover>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: '#2C3E34', whiteSpace: 'nowrap' }}>
            {currentStudent.name}
          </span>
          <Tag style={{
            borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: 'linear-gradient(135deg, #4DABF7, #74C0FC)',
            color: 'white', border: 'none', lineHeight: '20px',
            padding: '0 10px', margin: 0,
          }}>
            {COGNITION_SHORT_LABELS[currentStudent.cognition_level] || `L${currentStudent.cognition_level}`}
          </Tag>
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 4, fontSize: 13, color: '#5A6B5E', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <CrownOutlined style={{ color: '#FFD43B' }} />
            {currentStudent.age}岁
          </span>
          {statsLoading ? (
            <span style={{ color: '#bbb' }}>加载中...</span>
          ) : (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <BookOutlined style={{ color: '#6DBF6E' }} />
                识字 {stats.chars}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ReadOutlined style={{ color: '#4DABF7' }} />
                阅读 {stats.articles}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
