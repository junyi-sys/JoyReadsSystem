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
  const [summary, setSummary] = useState('')
  const [characters, setCharacters] = useState('')
  const [generating, setGenerating] = useState(false)
  const [isRead, setIsRead] = useState(false)

  useEffect(() => { setIsRead(false) }, [article])

  const handleReadComplete = async () => {
    if (!article) return
    const total = article.character_count
    const { data } = await articlesApi.updateReadStatus(article.id, {
      status: 'read',
      read_count: total,
      total_count: total,
    })
    setIsRead(true)
    return data
  }

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
      const charList = characters.trim() ? characters.trim().split(/[,，、\s]+/) : []
      const { data } = await articlesApi.generate({
        topic: topic.trim(),
        summary: summary.trim(),
        characters: charList,
        category: 'daily',
      })
      setArticle(data)
      setGenOpen(false)
      setTopic('')
      setSummary('')
      setCharacters('')
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
          <ArticleReader article={article} isRead={isRead} onReadComplete={handleReadComplete} />
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

      <Modal title="AI 生成文章" open={genOpen} onCancel={() => { setGenOpen(false); setTopic(''); setSummary(''); setCharacters('') }} onOk={handleGenerate}
        confirmLoading={generating} okText="开始生成" cancelText="取消"
        okButtonProps={{ style: { borderRadius: 16 } }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>文章主题 <span style={{ color: '#ff4d4f' }}>*</span></div>
          <Input
            placeholder="例如：春天来了"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ borderRadius: 12 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>生字（选填）</div>
          <Input
            placeholder="输入生字，用逗号或空格分隔，例如：花,草,风"
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            style={{ borderRadius: 12 }}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>主题摘要（选填）</div>
          <Input.TextArea
            placeholder="描述文章要包含的内容，例如：'描写春天的变化，花草开始生长，小动物从冬眠中苏醒，孩子们在公园里玩耍'"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            style={{ borderRadius: 12 }}
          />
        </div>
      </Modal>
    </motion.div>
  )
}
