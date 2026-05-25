import { useEffect } from 'react'
import { Select, Avatar, message, Tag } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useStudentStore } from '../../store/useStudentStore'
import { COGNITION_LABELS } from '../../types'

export default function StudentSwitcher() {
  const { currentStudent, students, loading, loadStudents, switchStudent } = useStudentStore()

  useEffect(() => { loadStudents() }, [])

  return (
    <Select
      value={currentStudent?.id}
      onChange={(id) => { switchStudent(id); message.success(`已切换到${currentStudent?.name}`) }}
      loading={loading}
      style={{ width: 180 }}
      options={students.map((s) => ({
        value: s.id,
        label: (
          <span>
            <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8, background: '#FF6B6B' }} />
            {s.name}
            <Tag color="blue" style={{ marginLeft: 8, fontSize: 10, lineHeight: '16px' }}>
              {COGNITION_LABELS[s.cognition_level] || `L${s.cognition_level}`}
            </Tag>
          </span>
        ),
      }))}
    />
  )
}
