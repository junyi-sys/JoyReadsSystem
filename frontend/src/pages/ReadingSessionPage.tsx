import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Spin, Typography, Steps, Tag } from 'antd'
import { SoundOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { planApi, articlesApi } from '../services/api'
import ArticleReader from '../components/reader/ArticleReader'
import VoiceInputButton from '../components/ui/VoiceInputButton'
import type { ArticleWithPinyin } from '../types'

const { Title, Paragraph } = Typography

const FOCUS_GUIDES: Record<string, string> = {
  '情节理解': '说说这个故事讲了什么？',
  '人物动机': '故事里的人为什么要那样做？',
  '细节发现': '有没有让你觉得有意思的小地方？',
  '联想生活': '你有没有见过类似的事？',
  '发挥想象': '如果你是作者，接下来会怎么写？',
}

export default function ReadingSessionPage() {
  const { dayId } = useParams<{ dayId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [article, setArticle] = useState<ArticleWithPinyin | null>(null)
  const [guideText, setGuideText] = useState('')
  const [focus, setFocus] = useState('')
  const [loading, setLoading] = useState(true)
  const [transcript, setTranscript] = useState('')

  useEffect(() => {
    if (!dayId) return
    planApi.startDay(Number(dayId)).then(({ data }) => {
      setGuideText(data.guide_text)
      articlesApi.get(data.article_id).then(({ data: art }) => {
        setArticle(art)
        setFocus(art?.topic_category || '')
        setLoading(false)
      })
    }).catch(() => setLoading(false))
  }, [dayId])

  const handleReadComplete = () => {
    if (article) {
      articlesApi.updateReadStatus(article.id, {
        status: 'read', read_count: article.character_count, total_count: article.character_count,
      })
    }
    setStep(2)
  }

  const handleComplete = async () => {
    if (!dayId) return
    await planApi.completeDay(Number(dayId), {
      answers: [{
        question_type: 'oral_summary',
        question: FOCUS_GUIDES[focus] || '这篇文章讲了什么？',
        child_answer: transcript || '已完成录音归纳',
        is_correct: true,
      }],
    })
    setStep(4)
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <Steps current={step} size="small" style={{ marginBottom: 24 }}
        items={[{ title: '导读' }, { title: '阅读' }, { title: '归纳' }, { title: '完成' }]} />

      {step === 0 && (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 0' }}>
          <SoundOutlined style={{ fontSize: 48, color: '#4DABF7' }} />
          <Title level={3} style={{ marginTop: 16 }}>{guideText}</Title>
          <Button type="primary" size="large" onClick={() => setStep(1)}
            style={{ borderRadius: 16, marginTop: 24 }}>开始阅读</Button>
        </Card>
      )}

      {step === 1 && article && (
        <Card style={{ borderRadius: 16 }}>
          <ArticleReader article={article} isRead={false} onReadComplete={handleReadComplete} />
        </Card>
      )}

      {step === 2 && (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
          <Title level={4}>说说你的想法</Title>
          <Paragraph type="secondary">{FOCUS_GUIDES[focus] || '这篇文章讲了什么？'}</Paragraph>
          <VoiceInputButton onResult={(text) => setTranscript(text)} />
          {transcript && (
            <div style={{ marginTop: 16 }}>
              <Tag color="blue">你说的：{transcript}</Tag>
              <br />
              <Button type="primary" size="large" onClick={handleComplete}
                style={{ borderRadius: 16, marginTop: 16 }}>完成今天的精读！</Button>
            </div>
          )}
          <Button onClick={handleComplete} type="text" style={{ marginTop: 8 }}>跳过录音，直接完成</Button>
        </Card>
      )}

      {step === 4 && (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 0' }}>
          <Title level={3}>太棒了！</Title>
          <Paragraph>今天的精读完成啦，明天见！</Paragraph>
          <Button type="primary" size="large" onClick={() => navigate('/plan')}
            style={{ borderRadius: 16, marginTop: 16 }}>返回计划</Button>
        </Card>
      )}
    </motion.div>
  )
}
