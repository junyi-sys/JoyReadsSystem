import { Layout } from 'antd'
import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import StudentSwitcher from './StudentSwitcher'
import { useAppStore } from '../../store/useAppStore'
import { pageTransition } from '../../theme/animations'

const { Header, Sider, Content } = Layout

export default function AppShell() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible collapsed={collapsed} onCollapse={toggleSidebar}
        width={220} collapsedWidth={60}
        style={{ background: '#fafafa', borderRight: '1px solid #f0f0f0' }}
        breakpoint="lg"
      >
        <Sidebar collapsed={collapsed} />
      </Sider>
      <Layout>
        <Header style={{
          background: 'var(--color-bg, #FFF8F0)', padding: '12px 24px', display: 'flex',
          justifyContent: 'flex-end', alignItems: 'center',
          borderBottom: '1px solid #f0f0f0', height: 'auto', lineHeight: 1.5,
        }}>
          <StudentSwitcher />
        </Header>
        <Content style={{ background: 'var(--color-bg, #FFF8F0)', overflow: 'auto' }}>
          <motion.div variants={pageTransition} initial="hidden" animate="visible">
            <Outlet />
          </motion.div>
        </Content>
      </Layout>
    </Layout>
  )
}
