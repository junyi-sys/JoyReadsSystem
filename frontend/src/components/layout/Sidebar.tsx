import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Typography } from 'antd'
import { HomeOutlined, BulbOutlined, ReadOutlined, BookOutlined, BarChartOutlined } from '@ant-design/icons'

const items = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/curiosity', icon: <BulbOutlined />, label: '好奇心' },
  { key: '/characters', icon: <ReadOutlined />, label: '字库' },
  { key: '/articles', icon: <BookOutlined />, label: '文章' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计' },
]

export default function Sidebar({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div>
      {!collapsed && (
        <div style={{ padding: '16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Text style={{ fontSize: 20, fontFamily: '"ZCOOL KuaiLe",cursive', color: '#FF6B6B' }}>
            俊宜识字
          </Typography.Text>
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
