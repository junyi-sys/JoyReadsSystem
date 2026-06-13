import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Spin, Typography, Steps, Tag, Progress } from 'antd'
import { SoundOutlined, BulbOutlined, SearchOutlined, LinkOutlined, TrophyOutlined } from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { planApi, articlesApi } from '../services/api'
import ArticleReader from '../components/reader/ArticleReader'
import VoiceInputButton from '../components/ui/VoiceInputButton'
import type { ArticleWithPinyin, LessonPlan } from '../types'

const { Title, Paragraph, Text } = Typography

const QUESTION_ICONS: Record<string, React.ReactNode> = {
  find_clue: <SearchOutlined />,
  infer_cause: <BulbOutlined />,
  connect_life: <LinkOutlined />,
}

const STAGE_LABELS = ['读前热身', '读中探究', '读后思考', '回到主问题']

export default function ReadingSessionPage() {
  const { dayId } = useParams<{ dayId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [article, setArticle] = useState<ArticleWithPinyin | null>(null)
  const [lesson, setLesson] = useState<LessonPlan | null>(null)
  const [guideText, setGuideText] = useState('')
  const [loading, setLoading] = useState(true)
  const [transcript, setTranscript] = useState('')
  const [currentParagraph, setCurrentParagraph] = useState(0)
  const [currentSubQuestion, setCurrentSubQuestion] = useState(0)
  const [answers, setAnswers] = useState<{ question_type: string; question: string; child_answer: string; is_correct: boolean }[]>([])
  const [clueAnswers, setClueAnswers] = useState<string[]>([])

  useEffect(() => {
    if (!dayId) return
    planApi.startDay(Number(dayId)).then(({ data }) => {
      setGuideText(data.guide_text)
      if (data.lesson_json) {
        setLesson(data.lesson_json)
      }
      articlesApi.get(data.article_id).then(({ data: art }) => {
        setArticle(art)
        setLoading(false)
      }).catch(() => setLoading(false))
    }).catch(() => setLoading(false))
  }, [dayId])

  const addAnswer = useCallback((questionType: string, question: string, childAnswer: string, isCorrect = true) => {
    setAnswers(prev => [...prev, { question_type: questionType, question, child_answer: childAnswer, is_correct: isCorrect }])
  }, [])

  const handleComplete = async () => {
    if (!dayId) return
    await planApi.completeDay(Number(dayId), { answers })
    setStep(4)
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Main question fixed at top */}
      {step < 4 && lesson?.main_question && (
        <Card size="small" style={{
          marginBottom: 16, borderRadius: 12, background: 'linear-gradient(135deg, #FFF7E6, #FFF1CC)',
          border: '1px solid #FFD666'
        }}>
          <Text strong style={{ fontSize: 15, color: '#AD6800' }}>
            🎯 今天要搞懂：{lesson.main_question}
          </Text>
        </Card>
      )}

      {/* Progress steps */}
      <Steps current={step} size="small" style={{ marginBottom: 24 }}
        items={STAGE_LABELS.map(label => ({ title: label }))} />

      <AnimatePresence mode="wait">
        {/* Stage 0: Pre-reading / Warm-up */}
        {step === 0 && lesson && (
          <motion.div key="pre" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
              <SoundOutlined style={{ fontSize: 48, color: '#4DABF7' }} />
              <Title level={4} style={{ marginTop: 16 }}>你知道吗？</Title>
              <Paragraph style={{ fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
                {lesson.pre_reading.background}
              </Paragraph>
              <div style={{
                marginTop: 24, padding: '16px 24px',
                background: '#FFF7E6', borderRadius: 12, display: 'inline-block'
              }}>
                <Text style={{ fontSize: 16 }}>{lesson.pre_reading.hook}</Text>
              </div>
              <br />
              <Button type="primary" size="large" onClick={() => setStep(1)}
                style={{ borderRadius: 16, marginTop: 24 }}>我准备好了，开始读！</Button>
            </Card>
          </motion.div>
        )}

        {/* Stage 1: During-reading — paragraph by paragraph with clue prompts */}
        {step === 1 && article && lesson && (
          <motion.div key="during" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16 }}>
              <Progress percent={Math.round(((currentParagraph + 1) / lesson.paragraphs.length) * 100)}
                size="small" style={{ marginBottom: 16 }}
                format={() => `段落 ${currentParagraph + 1}/${lesson.paragraphs.length}`} />

              <ArticleReader
                article={{ ...article, content: lesson.paragraphs[currentParagraph].text }}
                isRead={false}
                onReadComplete={() => {
                  const cp = currentParagraph
                  addAnswer(
                    'find_clue',
                    lesson.paragraphs[cp].clue_prompt,
                    clueAnswers[cp] || '继续阅读',
                  )
                  if (cp < lesson.paragraphs.length - 1) {
                    setCurrentParagraph(cp + 1)
                  } else {
                    setStep(2)
                  }
                }}
              />

              <Card size="small" style={{ marginTop: 16, background: '#F0F5FF', borderRadius: 8 }}>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  🔍 {lesson.paragraphs[currentParagraph].clue_prompt}
                </Text>
              </Card>
            </Card>
          </motion.div>
        )}

        {/* Stage 2: Post-reading — sub-question chain */}
        {step === 2 && lesson && (
          <motion.div key="post" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
              <Progress percent={Math.round(((currentSubQuestion) / lesson.sub_questions.length) * 100)}
                size="small" style={{ marginBottom: 16 }}
                format={() => `子问题 ${currentSubQuestion + 1}/${lesson.sub_questions.length}`} />

              <Tag color="blue" style={{ marginBottom: 12, fontSize: 13 }}>
                {QUESTION_ICONS[lesson.sub_questions[currentSubQuestion].type]}
                {' '}{lesson.sub_questions[currentSubQuestion].label}
              </Tag>

              <Title level={4}>{lesson.sub_questions[currentSubQuestion].question}</Title>

              <VoiceInputButton onResult={(text) => setTranscript(text)} />

              {transcript && (
                <div style={{ marginTop: 16 }}>
                  <Tag color="green">你说的：{transcript}</Tag>
                  <br />
                  <Button type="primary" size="large" onClick={() => {
                    addAnswer(
                      lesson.sub_questions[currentSubQuestion].type,
                      lesson.sub_questions[currentSubQuestion].question,
                      transcript,
                      true,
                    )
                    setTranscript('')
                    if (currentSubQuestion < lesson.sub_questions.length - 1) {
                      setCurrentSubQuestion(prev => prev + 1)
                    } else {
                      setStep(3)
                    }
                  }} style={{ borderRadius: 16, marginTop: 16 }}>下一题</Button>
                </div>
              )}
              <Button onClick={() => {
                addAnswer(
                  lesson.sub_questions[currentSubQuestion].type,
                  lesson.sub_questions[currentSubQuestion].question,
                  '跳过此题',
                  true,
                )
                setTranscript('')
                if (currentSubQuestion < lesson.sub_questions.length - 1) {
                  setCurrentSubQuestion(prev => prev + 1)
                } else {
                  setStep(3)
                }
              }} type="text" style={{ marginTop: 8 }}>跳过，直接下一题</Button>
            </Card>
          </motion.div>
        )}

        {/* Stage 3: Back to main question */}
        {step === 3 && lesson && (
          <motion.div key="main" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
              <TrophyOutlined style={{ fontSize: 48, color: '#FFD666' }} />
              <Title level={4} style={{ marginTop: 16 }}>回到最开始的问题</Title>
              <Paragraph type="secondary" style={{ fontSize: 16 }}>
                {lesson.extension.back_to_main}
              </Paragraph>
              <VoiceInputButton onResult={(text) => setTranscript(text)} />
              {transcript && (
                <div style={{ marginTop: 16 }}>
                  <Tag color="blue">你的回答：{transcript}</Tag>
                  <br />
                  <Button type="primary" size="large" onClick={() => {
                    addAnswer('main_question', lesson.main_question, transcript, true)
                    handleComplete()
                  }} style={{ borderRadius: 16, marginTop: 16 }}>提交并完成！</Button>
                </div>
              )}
              <Button onClick={() => {
                addAnswer('main_question', lesson.main_question, '已完成精读', true)
                handleComplete()
              }} type="text" style={{ marginTop: 8 }}>跳过录音，直接完成</Button>
            </Card>
          </motion.div>
        )}

        {/* Fallback mode: when no lesson_json, show old simplified flow */}
        {!lesson && (
          <motion.div key="fallback" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
                <ArticleReader article={article} isRead={false} onReadComplete={() => {
                  articlesApi.updateReadStatus(article.id, {
                    status: 'read', read_count: article.character_count, total_count: article.character_count,
                  })
                  setStep(2)
                }} />
              </Card>
            )}
            {(step === 2 || step === 3) && (
              <Card style={{ borderRadius: 16, textAlign: 'center', padding: '20px 0' }}>
                <Title level={4}>说说你的想法</Title>
                <Paragraph type="secondary">这篇文章讲了什么？</Paragraph>
                <VoiceInputButton onResult={(text) => setTranscript(text)} />
                {transcript && (
                  <div style={{ marginTop: 16 }}>
                    <Tag color="blue">你说的：{transcript}</Tag>
                    <br />
                    <Button type="primary" size="large" onClick={() => {
                      addAnswer('main_question', '这篇文章讲了什么？', transcript || '已完成归纳', true)
                      handleComplete()
                    }} style={{ borderRadius: 16, marginTop: 16 }}>完成今天的精读！</Button>
                  </div>
                )}
                <Button onClick={() => {
                  addAnswer('main_question', '这篇文章讲了什么？', '已完成归纳', true)
                  handleComplete()
                }} type="text" style={{ marginTop: 8 }}>跳过录音，直接完成</Button>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stage 4: Completion */}
      {step === 4 && (
        <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <Card style={{ borderRadius: 16, textAlign: 'center', padding: '40px 0' }}>
            <Title level={3}>太棒了！</Title>
            <Paragraph>你把今天的问题都搞懂了，明天继续探索！</Paragraph>
            <Button type="primary" size="large" onClick={() => navigate('/plan')}
              style={{ borderRadius: 16, marginTop: 16 }}>返回计划</Button>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}
