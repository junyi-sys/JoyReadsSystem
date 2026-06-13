import { useEffect, useState } from 'react'
import { Card, Tag, Spin, Empty, Typography, Modal, message } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { knowledgeApi, articlesApi } from '../services/api'
import { pageTransition } from '../theme/animations'
import ArticleReader from '../components/reader/ArticleReader'
import type { KnowledgeNode, ArticleWithPinyin } from '../types'

const DEPTH_COLORS: Record<number, string> = {
  1: '#bfbfbf', 2: '#91d5ff', 3: '#52c41a', 4: '#fa8c16',
}
const DEPTH_LABELS: Record<number, string> = {
  1: '听说过', 2: '能解释', 3: '能举例', 4: '能运用',
}
const SOURCE_LABELS: Record<string, string> = {
  curiosity: '好奇', reading: '阅读', theory: '理论', manual: '手动',
}

function extractArticleId(evidence: string | null): number | null {
  if (!evidence) return null
  const m = evidence.match(/文章ID:(\d+)/)
  return m ? Number(m[1]) : null
}

export default function KnowledgeGraphPage() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedArticle, setSelectedArticle] = useState<ArticleWithPinyin | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    knowledgeApi.graph().then(({ data }) => {
      setNodes(data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const viewArticle = async (articleId: number) => {
    setDetailLoading(true)
    try {
      const { data } = await articlesApi.get(articleId)
      setSelectedArticle(data)
    } catch {
      message.error('文章加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible"
      style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>知识图谱</h1>
      {nodes.length === 0 ? (
        <Empty description="还没有发现概念，多读几篇文章吧！" />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {nodes.map((n) => {
            const aid = extractArticleId(n.evidence)
            return (
              <Card key={n.concept} size="small" style={{ borderRadius: 12, minWidth: 120 }}
                hoverable={!!aid}
                onClick={() => aid && viewArticle(aid)}
                styles={{ body: { padding: '12px 16px' } }}>
                <Typography.Text strong style={{ fontSize: 16 }}>{n.concept}</Typography.Text>
                <br />
                <Tag color={DEPTH_COLORS[n.depth]} style={{ marginTop: 4 }}>
                  {DEPTH_LABELS[n.depth]}
                </Tag>
                <Tag style={{ marginTop: 4 }} color={n.source === 'reading' ? 'blue' : 'default'}>
                  {SOURCE_LABELS[n.source] || n.source}
                  {aid && <EyeOutlined style={{ marginLeft: 4, fontSize: 10 }} />}
                </Tag>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        title={selectedArticle?.topic}
        open={!!selectedArticle}
        onCancel={() => setSelectedArticle(null)}
        footer={null}
        width={800}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        {detailLoading ? <Spin spinning /> : selectedArticle && <ArticleReader article={selectedArticle} />}
      </Modal>
    </motion.div>
  )
}
