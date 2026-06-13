import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Spin, Typography, Steps, Tag, Progress, Space } from 'antd'
import { SoundOutlined, BulbOutlined, SearchOutlined, LinkOutlined, TrophyOutlined, CheckCircleOutlined } from '@ant-design/icons'
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

const QUESTION_COLORS: Record<string, string> = {
  find_clue: '#1677ff',
  infer_cause: '#52c41a',
  connect_life: '#eb2f96',
}

const STAGE_LABELS = ['导读', '读中探究', '读后思考', '回到主问题']

export default function ReadingSessionPage() {
  const { dayId } = useParams<{ dayId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [article, setArticle] = useState<ArticleWithPinyin | null>(null)
  const [lesson, setLesson] = useState<LessonPlan | null>(null)
  const [guideText, setGuideText] = useState('')
  const [loading, setLoading] = useState(true)
  const [mainTranscript, setMainTranscript] = useState('')
  const [currentParagraph, setCurrentParagraph] = useState(0)
  const [subAnswers, setSubAnswers] = useState<Record<number, string>>({})
  const [answers, setAnswers] = useState<{ question_type: string; question: string; child_answer: string; is_correct: boolean }[]>([])

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
        {/* Stage 0: 导读 — 主问题 + 问题清单 */}
        {step === 0 && lesson && (
          <motion.div key="pre" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, textAlign: 'left', padding: '24px' }}>
              {/* 背景知识 */}
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>📖 背景小知识</Text>
                <Paragraph style={{ fontSize: 15, marginTop: 4, marginBottom: 0 }}>
                  {lesson.pre_reading.background}
                </Paragraph>
              </div>

              {/* 主问题 */}
              <div style={{
                padding: '20px 24px', marginBottom: 24,
                background: 'linear-gradient(135deg, #FFF7E6, #FFF1CC)',
                borderRadius: 12, border: '2px solid #FFD666'
              }}>
                <Text type="secondary" style={{ fontSize: 12 }}>🎯 今天要回答的问题</Text>
                <Title level={4} style={{ margin: '8px 0 0 0', color: '#AD6800' }}>
                  {lesson.main_question}
                </Title>
              </div>

              {/* 子问题清单 */}
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  📋 读完文章后，你要回答下面 {lesson.sub_questions.length + 1} 个问题：
                </Text>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lesson.sub_questions.map((sq, i) => (
                    <Card key={i} size="small" style={{
                      borderRadius: 8, background: '#FAFAFA', border: '1px solid #F0F0F0'
                    }}>
                      <Space>
                        <Tag color={QUESTION_COLORS[sq.type]} style={{ marginRight: 4 }}>
                          {QUESTION_ICONS[sq.type]} {sq.label}
                        </Tag>
                        <Text style={{ fontSize: 14 }}>{sq.question}</Text>
                      </Space>
                    </Card>
                  ))}
                  <Card size="small" style={{
                    borderRadius: 8, background: '#FFF7E6', border: '1px solid #FFD666'
                  }}>
                    <Space>
                      <Tag color="gold">🏆 主问题</Tag>
                      <Text strong style={{ fontSize: 14 }}>{lesson.main_question}</Text>
                    </Space>
                  </Card>
                </div>
              </div>

              {/* Hook */}
              <Paragraph style={{ fontSize: 15, marginBottom: 24, color: '#666', textAlign: 'center' }}>
                {lesson.pre_reading.hook}
              </Paragraph>

              <div style={{ textAlign: 'center' }}>
                <Button type="primary" size="large" onClick={() => setStep(1)}
                  style={{ borderRadius: 16 }}>我准备好了，开始读！</Button>
              </div>
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
                onReadComplete={async () => {
                  const cp = currentParagraph
                  addAnswer(
                    'find_clue',
                    lesson.paragraphs[cp].clue_prompt,
                    '已阅读',
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

        {/* Stage 2: 读后思考 — 子问题表单（全部展示） */}
        {step === 2 && lesson && (
          <motion.div key="post" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, padding: '24px' }}>
              <Title level={4} style={{ marginBottom: 4 }}>📝 回答问题</Title>
              <Paragraph type="secondary" style={{ marginBottom: 20 }}>
                读完文章了，现在来回答这些问题。每个问题都可以用语音回答哦！
              </Paragraph>

              {lesson.sub_questions.map((sq, i) => (
                <Card key={i} size="small" style={{
                  marginBottom: 16, borderRadius: 10,
                  border: subAnswers[i]
                    ? `1px solid ${QUESTION_COLORS[sq.type]}`
                    : '1px solid #F0F0F0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}>
                      <Tag color={QUESTION_COLORS[sq.type]}>
                        {QUESTION_ICONS[sq.type]} {sq.label} · {i + 1}
                      </Tag>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text strong style={{ fontSize: 14 }}>{sq.question}</Text>

                      <div style={{ marginTop: 12 }}>
                        {subAnswers[i] ? (
                          <div>
                            <Tag color="green" style={{ marginBottom: 8, maxWidth: '100%', whiteSpace: 'normal', lineHeight: '1.5', padding: '4px 8px' }}>
                              💬 你的回答：{subAnswers[i]}
                            </Tag>
                            {sq.answer_hint && (
                              <Card size="small" style={{
                                marginTop: 8, marginBottom: 8, background: '#FFFBE6', borderRadius: 8,
                                border: '1px dashed #FFD666'
                              }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>💡 参考答案</Text>
                                <Paragraph style={{ margin: '4px 0 0 0', fontSize: 13, color: '#8C6D00' }}>
                                  {sq.answer_hint}
                                </Paragraph>
                              </Card>
                            )}
                            <Button size="small" onClick={() => setSubAnswers(prev => {
                              const next = { ...prev }; delete next[i]; return next;
                            })} type="link" style={{ padding: 0 }}>重新回答</Button>
                          </div>
                        ) : (
                          <VoiceInputButton onResult={(text) => {
                            setSubAnswers(prev => ({ ...prev, [i]: text }))
                          }} />
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}

              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <Button type="primary" size="large" onClick={() => {
                  for (const i in subAnswers) {
                    addAnswer(
                      lesson.sub_questions[Number(i)].type,
                      lesson.sub_questions[Number(i)].question,
                      subAnswers[i],
                      true,
                    )
                  }
                  // Fill any unanswered with skip
                  lesson.sub_questions.forEach((sq, i) => {
                    if (!subAnswers[i]) {
                      addAnswer(sq.type, sq.question, '跳过', true)
                    }
                  })
                  setStep(3)
                }} style={{ borderRadius: 16 }}>提交所有答案，进入下一题</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Stage 3: 回到主问题 — 汇总所有子问题答案 */}
        {step === 3 && lesson && (
          <motion.div key="main" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Card style={{ borderRadius: 16, padding: '24px' }}>
              {/* 已回答的子问题一览 */}
              <Text type="secondary" style={{ fontSize: 13 }}>✅ 你已经回答了下面这些问题：</Text>
              <div style={{ marginTop: 8, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {lesson.sub_questions.map((sq, i) => (
                  <Card key={i} size="small" style={{ borderRadius: 8, background: '#FAFAFA' }}>
                    <Space>
                      <Tag color={QUESTION_COLORS[sq.type]}>
                        {QUESTION_ICONS[sq.type]} {sq.label}
                      </Tag>
                      <Text style={{ fontSize: 13 }}>{sq.question}</Text>
                      {subAnswers[i] && (
                        <Tag color="green" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {subAnswers[i].length > 20 ? subAnswers[i].slice(0, 20) + '...' : subAnswers[i]}
                        </Tag>
                      )}
                    </Space>
                  </Card>
                ))}
              </div>

              {/* 主问题 */}
              <div style={{
                padding: '20px 24px', marginBottom: 20,
                background: 'linear-gradient(135deg, #FFF7E6, #FFF1CC)',
                borderRadius: 12, border: '2px solid #FFD666', textAlign: 'center'
              }}>
                <TrophyOutlined style={{ fontSize: 32, color: '#FFD666', marginBottom: 8 }} />
                <Title level={4} style={{ margin: '0 0 8px 0', color: '#AD6800' }}>
                  🎯 回到最开始的问题
                </Title>
                <Text strong style={{ fontSize: 16, color: '#AD6800' }}>
                  {lesson.main_question}
                </Text>
                <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0, fontSize: 14 }}>
                  {lesson.extension.back_to_main}
                </Paragraph>
              </div>

              {mainTranscript ? (
                <div style={{ textAlign: 'center' }}>
                  <Tag color="blue" style={{ marginBottom: 12, fontSize: 14, padding: '4px 12px' }}>
                    {mainTranscript}
                  </Tag>
                  <br />
                  <Space>
                    <Button onClick={() => setMainTranscript('')} size="small" type="link">重新回答</Button>
                    <Button type="primary" size="large" onClick={() => {
                      addAnswer('main_question', lesson.main_question, mainTranscript, true)
                      handleComplete()
                    }} style={{ borderRadius: 16 }}>提交并完成！</Button>
                  </Space>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <VoiceInputButton onResult={(text) => setMainTranscript(text)} />
                  <br />
                  <Button onClick={() => {
                    addAnswer('main_question', lesson.main_question, '已完成精读', true)
                    handleComplete()
                  }} type="text" style={{ marginTop: 12 }}>跳过录音，直接完成</Button>
                </div>
              )}
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
                <ArticleReader article={article} isRead={false} onReadComplete={async () => {
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
                <VoiceInputButton onResult={(text) => setMainTranscript(text)} />
                {mainTranscript && (
                  <div style={{ marginTop: 16 }}>
                    <Tag color="blue">你说的：{mainTranscript}</Tag>
                    <br />
                    <Button type="primary" size="large" onClick={() => {
                      addAnswer('main_question', '这篇文章讲了什么？', mainTranscript || '已完成归纳', true)
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
