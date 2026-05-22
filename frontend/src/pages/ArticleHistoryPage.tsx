import { useEffect, useState } from 'react'
import { List, Card, Tag, Typography, Spin, Empty, Button, Modal } from 'antd'
import { ReadOutlined, EyeOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { articlesApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import type { ArticleWithPinyin } from '../types'
import ArticleReader from '../components/reader/ArticleReader'
import { pageTransition, fadeInUp, staggerContainer } from '../theme/animations'

export default function ArticleHistoryPage() {
  const currentStudent = useStudentStore((s) => s.currentStudent)
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ArticleWithPinyin | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadHistory = async () => {
    setLoading(true)
    try {
      const { data } = await articlesApi.history()
      setArticles(data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadHistory() }, [currentStudent])

  const viewArticle = async (id: number) => {
    setDetailLoading(true)
    try {
      const { data } = await articlesApi.get(id)
      setSelected(data)
    } catch { /* ignore */ }
    finally { setDetailLoading(false) }
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 24, fontFamily: '"ZCOOL KuaiLe",cursive' }}>笔记 历史文章</h1>

      {articles.length === 0 ? (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: 40 }}>
          <Empty description="还没有文章，去首页生成第一篇吧！" />
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          <List
            dataSource={articles}
            renderItem={(item: any) => (
              <motion.div key={item.id} variants={fadeInUp}>
                <Card
                  hoverable
                  style={{ borderRadius: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  onClick={() => viewArticle(item.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Typography.Text strong style={{ fontSize: 16 }}>{item.topic}</Typography.Text>
                      <div style={{ marginTop: 4 }}>
                        <Tag color="blue" style={{ borderRadius: 10 }}>{item.record_date}</Tag>
                        <Tag style={{ borderRadius: 10 }}>{item.character_count} 字</Tag>
                        <Tag color="purple" style={{ borderRadius: 10 }}>{item.category}</Tag>
                        {item.series_id && <Tag color="orange" style={{ borderRadius: 10 }}>系列</Tag>}
                      </div>
                    </div>
                    <Button type="link" icon={<EyeOutlined />}>查看</Button>
                  </div>
                </Card>
              </motion.div>
            )}
          />
        </motion.div>
      )}

      <Modal
        title={selected?.topic}
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        width={800}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        {detailLoading ? <Spin spinning /> : selected && <ArticleReader article={selected} />}
      </Modal>
    </motion.div>
  )
}
