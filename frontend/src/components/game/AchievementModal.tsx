import { Modal } from 'antd'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description: string
  emoji: string
}

export default function AchievementModal({ open, onClose, title, description, emoji }: Props) {
  return (
    <Modal open={open} onCancel={onClose} onOk={onClose} okText="太棒了！" cancelButtonProps={{ style: { display: 'none' } }}
      okButtonProps={{ style: { borderRadius: 16, background: '#FF6B6B', border: 'none', fontWeight: 600 } }}>
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{emoji}</div>
        <h2 style={{ fontFamily: '"ZCOOL KuaiLe",cursive', fontSize: 24, marginBottom: 8 }}>{title}</h2>
        <p style={{ color: '#888', fontSize: 15 }}>{description}</p>
      </div>
    </Modal>
  )
}
