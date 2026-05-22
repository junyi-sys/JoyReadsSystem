import { useEffect, useState } from 'react'
import { Card, Button, Spin, Empty, Modal, Input, message, Tag } from 'antd'
import { PlusOutlined, BulbOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { articlesApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import type { ArticleWithPinyin } from '../types'
import ArticleReader from '../components/reader/ArticleReader'
import { pageTransition, fadeInUp } from '../theme/animations'

export default function HomePage() {
  const currentStudent = useStudentStore((s) => s.currentStudent)
  const [article, setArticle] = useState<ArticleWithPinyin | null>(null)
  const [loading, setLoading] = useState(true)
  const [genOpen, setGenOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [generating, setGenerating] = useState(false)

  const loadToday = async () => {
    setLoading(true)
    try {
      const { data } = await articlesApi.today()
      setArticle(data || null)
    } catch { message.error('加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadToday() }, [currentStudent])

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    try {
      const { data } = await articlesApi.generate({ topic: topic.trim(), characters: [], category: 'daily' })
      setArticle(data)
      setGenOpen(false)
      setTopic('')
      message.success('文章生成成功！🎉')
    } catch (err: any) { message.error(err?.message || '生成失败') }
    finally { setGenerating(false) }
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <motion.div variants={fadeInUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>
          今日文章
          {currentStudent && (
            <Tag color="orange" style={{ marginLeft: 12, borderRadius: 10, fontSize: 14, verticalAlign: 'middle' }}>
              {currentStudent.name}
            </Tag>
          )}
        </h1>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setGenOpen(true)}
          style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(255,107,107,0.25)', fontWeight: 600 }}>
          生成文章
        </Button>
      </motion.div>

      {article ? (
        <Card style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(255,107,107,0.12)', border: 'none' }}
          title={<span style={{ fontSize: 18, fontFamily: '"ZCOOL KuaiLe",cursive' }}>{article.topic}</span>}>
          <ArticleReader article={article} />
        </Card>
      ) : (
        <motion.div variants={fadeInUp}>
          <Card style={{ borderRadius: 16, textAlign: 'center', padding: '60px 0' }}>
            <Empty
              description={<span style={{ fontSize: 16, color: '#888' }}>今天还没有文章哦~ 点击"生成文章"开始吧！</span>}
              image={<BulbOutlined style={{ fontSize: 64, color: '#FFE66D' }} />}
            >
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setGenOpen(true)}
                style={{ borderRadius: 16, marginTop: 8 }}>
                生成今日文章
              </Button>
            </Empty>
          </Card>
        </motion.div>
      )}

      <Modal title="AI 生成文章" open={genOpen} onCancel={() => setGenOpen(false)} onOk={handleGenerate}
        confirmLoading={generating} okText="开始生成" cancelText="取消"
        okButtonProps={{ style: { borderRadius: 16 } }}>
        <Input.TextArea
          placeholder="输入文章主题，例如：'为什么天空是蓝色的？' 或 '春天来了'"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={3}
          style={{ borderRadius: 12, marginTop: 8 }}
        />
      </Modal>
    </motion.div>
  )
}
