import { useEffect, useState } from 'react'
import { List, Card, Tag, Typography, Spin, Empty, Button, Modal, Divider, Space } from 'antd'
import { ReadOutlined, EyeOutlined, BulbOutlined, SearchOutlined, LinkOutlined, TrophyOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { articlesApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import type { ArticleWithPinyin } from '../types'
import ArticleReader from '../components/reader/ArticleReader'
import { pageTransition, fadeInUp, staggerContainer } from '../theme/animations'

const { Title, Paragraph, Text } = Typography

const QUESTION_ICONS: Record<string, React.ReactNode> = {
  find_clue: <SearchOutlined />,
  infer_cause: <BulbOutlined />,
  connect_life: <LinkOutlined />,
}
const QUESTION_COLORS: Record<string, string> = {
  find_clue: '#1677ff', infer_cause: '#52c41a', connect_life: '#eb2f96',
}

interface ReadingRecord {
  article_id: number
  main_question: string | null
  lesson: any | null
  answers: { question_type: string; question: string; child_answer: string; answer_hint: string | null }[]
  has_record: boolean
}

export default function ArticleHistoryPage() {
  const currentStudent = useStudentStore((s) => s.currentStudent)
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ArticleWithPinyin | null>(null)
  const [readingRecord, setReadingRecord] = useState<ReadingRecord | null>(null)
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
    setReadingRecord(null)
    try {
      const { data } = await articlesApi.get(id)
      setSelected(data)
      // Fetch reading record in parallel
      articlesApi.readingRecord(id).then(({ data: rec }) => {
        if (rec?.has_record) setReadingRecord(rec)
      }).catch(() => {})
    } catch { /* ignore */ }
    finally { setDetailLoading(false) }
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>历史文章</h1>

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
        onCancel={() => { setSelected(null); setReadingRecord(null) }}
        footer={null}
        width={800}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        {detailLoading ? <Spin spinning /> : selected && (
          <div>
            <ArticleReader article={selected} />

            {readingRecord && (
              <>
                <Divider />
                <div style={{ marginTop: 8 }}>
                  <Title level={5} style={{ marginBottom: 16 }}>📖 精读记录</Title>

                  {/* Main Question */}
                  {readingRecord.main_question && (
                    <Card size="small" style={{
                      marginBottom: 16, borderRadius: 10,
                      background: 'linear-gradient(135deg, #FFF7E6, #FFF1CC)',
                      border: '1px solid #FFD666'
                    }}>
                      <Space>
                        <TrophyOutlined style={{ color: '#FFD666' }} />
                        <Text strong style={{ color: '#AD6800' }}>主问题：{readingRecord.main_question}</Text>
                      </Space>
                    </Card>
                  )}

                  {/* Sub-Questions from lesson */}
                  {readingRecord.lesson?.sub_questions && (
                    <div style={{ marginBottom: 16 }}>
                      <Text type="secondary" style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
                        子问题：
                      </Text>
                      {readingRecord.lesson.sub_questions.map((sq: any, i: number) => {
                        // Find matching answer
                        const ans = readingRecord.answers.find(a => a.question === sq.question)
                        return (
                          <Card key={i} size="small" style={{ marginBottom: 8, borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                              <Tag color={QUESTION_COLORS[sq.type]}>
                                {QUESTION_ICONS[sq.type]} {sq.label}
                              </Tag>
                              <Text style={{ fontSize: 13, flex: 1 }}>{sq.question}</Text>
                            </div>
                            {ans ? (
                              <div style={{ marginTop: 8, marginLeft: 4 }}>
                                <Tag color="green" style={{ maxWidth: '100%', whiteSpace: 'normal', lineHeight: 1.5, padding: '2px 8px' }}>
                                  💬 {ans.child_answer}
                                </Tag>
                              </div>
                            ) : (
                              <Tag style={{ marginTop: 8 }}>未回答</Tag>
                            )}
                            {sq.answer_hint && (
                              <Paragraph type="secondary" style={{ margin: '8px 0 0 4px', fontSize: 12 }}>
                                💡 参考：{sq.answer_hint}
                              </Paragraph>
                            )}
                          </Card>
                        )
                      })}
                    </div>
                  )}

                  {/* Answers without lesson context */}
                  {(!readingRecord.lesson || !readingRecord.lesson.sub_questions) && readingRecord.answers.length > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 13 }}>问答记录：</Text>
                      {readingRecord.answers.map((a, i) => (
                        <Card key={i} size="small" style={{ marginTop: 8, borderRadius: 8 }}>
                          <Text strong style={{ fontSize: 13 }}>{a.question}</Text>
                          <br />
                          <Tag color="green" style={{ marginTop: 4 }}>💬 {a.child_answer}</Tag>
                          {a.answer_hint && (
                            <Paragraph type="secondary" style={{ margin: '4px 0 0 0', fontSize: 12 }}>
                              💡 参考：{a.answer_hint}
                            </Paragraph>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  )
}
