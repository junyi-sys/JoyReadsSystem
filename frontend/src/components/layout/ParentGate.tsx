import { useState } from 'react'
import { Input, Button, Card, Typography } from 'antd'
import { LockOutlined } from '@ant-design/icons'

interface Props {
  studentId: number
  onUnlock: () => void
}

export default function ParentGate({ studentId, onUnlock }: Props) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await (await import('../../services/api')).parentApi.verifyPin(studentId, pin)
      if (data.ok) {
        onUnlock()
      } else {
        setError('PIN码不正确')
      }
    } catch {
      setError('验证失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card style={{ maxWidth: 360, margin: '100px auto', borderRadius: 16, textAlign: 'center' }}>
      <LockOutlined style={{ fontSize: 48, color: '#FF6B6B', marginBottom: 16 }} />
      <Typography.Title level={4}>家长验证</Typography.Title>
      <Input.Password
        placeholder="输入6位PIN码"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onPressEnter={handleVerify}
        style={{ borderRadius: 12, marginBottom: 12 }}
      />
      {error && <Typography.Text type="danger">{error}</Typography.Text>}
      <Button type="primary" block loading={loading} onClick={handleVerify}
        style={{ borderRadius: 12, marginTop: 12 }}>验证</Button>
    </Card>
  )
}
