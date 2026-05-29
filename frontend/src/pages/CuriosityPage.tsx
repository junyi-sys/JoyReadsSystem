import { useEffect, useState } from 'react'
import { Card, Input, Button, Tag, Spin, Empty, message, Radio } from 'antd'
import { BulbOutlined, SendOutlined, BookOutlined, CommentOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { curiosityApi, articlesApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import type { CuriosityEvent, SeriesInfo } from '../types'
import CuriosityBubble from '../components/curiosity/CuriosityBubble'
import SeriesProgress from '../components/curiosity/SeriesProgress'
import VoiceRecorder from '../components/ui/VoiceRecorder'
import { pageTransition, fadeInUp, staggerContainer } from '../theme/animations'

export default function CuriosityPage() {
  const navigate = useNavigate()
  const currentStudent = useStudentStore((s) => s.currentStudent)
  const [events, setEvents] = useState<CuriosityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<'one_shot' | 'series' | 'socratic'>('one_shot')
  const [asking, setAsking] = useState(false)
  const [seriesState, setSeriesState] = useState<Record<number, SeriesInfo>>({})
  const [seriesGen, setSeriesGen] = useState<Set<number>>(new Set())

  // Socratic response state
  const [socraticResponses, setSocraticResponses] = useState<Record<number, string>>({})
  const [responding, setResponding] = useState<Set<number>>(new Set())

  const loadEvents = async () => {
    setLoading(true)
    try {
      const { data } = await curiosityApi.events()
      setEvents(data || [])
      for (const e of (data || [])) {
        if (e.mode === 'series' && e.is_answered && e.linked_article_id) {
          try {
            const artRes = await articlesApi.get(e.linked_article_id)
            if (artRes.data.series_id) {
              const seriesRes = await articlesApi.getSeries(artRes.data.series_id)
              setSeriesState((prev) => ({ ...prev, [e.id]: seriesRes.data }))
            }
          } catch { /* ignore */ }
        }
      }
    } catch { message.error('加载事件失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadEvents() }, [currentStudent])

  const handleAsk = async () => {
    if (!question.trim()) return
    setAsking(true)
    try {
      if (mode === 'socratic') {
        const { data } = await curiosityApi.askSocratic(question.trim())
        message.success('AI反问已生成！想想怎么回答吧 🤔')
        loadEvents()
      } else if (mode === 'one_shot') {
        const { data } = await curiosityApi.ask(question.trim(), 'one_shot')
        message.success('回答已生成！')
        if (data.article_id) {
          const paraCount = data.paragraphs?.length || 1
          articlesApi.updateReadStatus(data.article_id, { status: 'read', read_count: paraCount, total_count: paraCount }).catch(() => {})
        }
        loadEvents()
      } else {
        const { data } = await curiosityApi.askSeries(question.trim())
        setSeriesState((prev) => ({ ...prev, [data.event_id]: data }))
        message.success(`系列已生成：${data.total_chapters}章`)
        loadEvents()
        if (data.series_id) navigate(`/series/${data.series_id}`)
      }
      setQuestion('')
    } catch (err: any) {
      message.error(err?.message || '生成失败')
    } finally { setAsking(false) }
  }

  const handleSocraticRespond = async (eventId: number) => {
    const response = socraticResponses[eventId]?.trim()
    if (!response) return
    setResponding((prev) => { const s = new Set(prev); s.add(eventId); return s })
    try {
      const { data } = await curiosityApi.socraticRespond(eventId, response)
      message.success('回答已生成，融入了你的想法！')
      if (data.article_id) {
        const paraCount = data.paragraphs?.length || 1
        articlesApi.updateReadStatus(data.article_id, { status: 'read', read_count: paraCount, total_count: paraCount }).catch(() => {})
      }
      setSocraticResponses((prev) => { const n = { ...prev }; delete n[eventId]; return n })
      loadEvents()
    } catch (err: any) {
      message.error(err?.message || '回答失败')
    } finally {
      setResponding((prev) => { const s = new Set(prev); s.delete(eventId); return s })
    }
  }

  const handleSeriesNext = async (eventId: number, wantNext: boolean) => {
    setSeriesGen((prev) => { const s = new Set(prev); s.add(eventId); return s })
    try {
      const { data } = await curiosityApi.seriesNext(eventId, wantNext)
      if (!wantNext) {
        setSeriesState((prev) => ({ ...prev, [eventId]: { ...prev[eventId], status: 'abandoned' } }))
        message.info('系列已放弃')
        loadEvents()
      } else {
        setSeriesState((prev) => ({ ...prev, [eventId]: data }))
        navigate(`/series/${data.series_id}`)
      }
    } catch (err: any) {
      message.error(err?.message || '操作失败')
    } finally { setSeriesGen((prev) => { const s = new Set(prev); s.delete(eventId); return s }) }
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontFamily: '"ZCOOL KuaiLe",cursive', marginBottom: 24 }}>💡 好奇心问答</h1>

      {/* Input Area */}
      <motion.div variants={fadeInUp}>
        <Card style={{ borderRadius: 16, marginBottom: 24, boxShadow: '0 4px 16px rgba(109,191,110,0.12)', border: 'none' }}>
          <Input.TextArea
            placeholder="今天想了解什么呀？✨ 例如：'为什么天空是蓝色的？'"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            style={{ borderRadius: 12, fontSize: 15, marginBottom: 12 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} size="small"
              optionType="button" buttonStyle="solid">
              <Radio.Button value="one_shot">
                <BulbOutlined /> 快速回答
              </Radio.Button>
              <Radio.Button value="socratic">
                <CommentOutlined /> 苏格拉底追问
              </Radio.Button>
              <Radio.Button value="series">
                <BookOutlined /> 系列故事
              </Radio.Button>
            </Radio.Group>
            <VoiceRecorder onText={(t) => setQuestion((prev) => prev + t)} />
            <Button type="primary" icon={<SendOutlined />} onClick={handleAsk} loading={asking}
              style={{ borderRadius: 16, fontWeight: 600 }}>
              {mode === 'socratic' ? '开启追问' : '提问'}
            </Button>
          </div>
          {mode === 'socratic' && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#eb2f96', background: '#fff0f6', padding: '8px 12px', borderRadius: 10 }}>
              AI不会直接回答，而是反问一个问题引导你思考。等你写下自己的想法后，AI再基于你的想法给出回答。
            </div>
          )}
        </Card>
      </motion.div>

      {/* Event History */}
      {events.length === 0 ? (
        <Card style={{ borderRadius: 16, textAlign: 'center', padding: 40 }}>
          <Empty description="还没有提问哦~ 在上面输入你的问题吧！" />
        </Card>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          {events.map((event) => (
            <div key={event.id}>
              <CuriosityBubble event={event} />

              {/* Socratic response input */}
              {event.socratic_mode && !event.child_response && event.follow_up_question && (
                <motion.div variants={fadeInUp} style={{ marginTop: -8, marginBottom: 16 }}>
                  <Card size="small" style={{ borderRadius: 12, background: '#fff0f6', border: '1px solid #ffadd2' }}>
                    <div style={{ fontSize: 13, color: '#eb2f96', marginBottom: 8 }}>
                      写下你的想法，AI会基于你的想法来回答：
                    </div>
                    <Input.TextArea
                      placeholder="我觉得..."
                      value={socraticResponses[event.id] || ''}
                      onChange={(e) => setSocraticResponses((prev) => ({ ...prev, [event.id]: e.target.value }))}
                      rows={2}
                      style={{ borderRadius: 10, marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<SendOutlined />}
                        loading={responding.has(event.id)}
                        onClick={() => handleSocraticRespond(event.id)}
                        style={{ borderRadius: 10, background: '#eb2f96', borderColor: '#eb2f96' }}
                      >
                        提交我的想法
                      </Button>
                      <VoiceRecorder
                        size="small"
                        onText={(t) => setSocraticResponses((prev) => ({ ...prev, [event.id]: (prev[event.id] || '') + t }))}
                      />
                    </div>
                  </Card>
                </motion.div>
              )}

              {/* Series */}
              {event.mode === 'series' && seriesState[event.id] && (
                <SeriesProgress
                  series={seriesState[event.id]}
                  onContinue={() => navigate(`/series/${seriesState[event.id].id}`)}
                />
              )}
              {event.mode === 'series' && seriesState[event.id] && seriesState[event.id].status === 'in_progress' && (
                <div style={{ display: 'flex', gap: 8, marginTop: -8, marginBottom: 16 }}>
                  <Button size="small" type="primary" ghost
                    loading={seriesGen.has(event.id)}
                    onClick={() => handleSeriesNext(event.id, true)}
                    style={{ borderRadius: 10 }}>
                    继续生成下一章
                  </Button>
                  <Button size="small" danger
                    onClick={() => handleSeriesNext(event.id, false)}
                    style={{ borderRadius: 10 }}>
                    不看了
                  </Button>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
