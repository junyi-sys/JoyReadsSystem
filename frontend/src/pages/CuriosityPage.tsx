import { useEffect, useState } from 'react'
import { Card, Input, Button, Tag, Spin, Empty, message, Radio } from 'antd'
import { BulbOutlined, SendOutlined, BookOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { curiosityApi, articlesApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import type { CuriosityEvent, SeriesInfo } from '../types'
import CuriosityBubble from '../components/curiosity/CuriosityBubble'
import SeriesProgress from '../components/curiosity/SeriesProgress'
import { pageTransition, fadeInUp, staggerContainer } from '../theme/animations'

export default function CuriosityPage() {
  const navigate = useNavigate()
  const currentStudent = useStudentStore((s) => s.currentStudent)
  const [events, setEvents] = useState<CuriosityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [mode, setMode] = useState<'one_shot' | 'series'>('one_shot')
  const [asking, setAsking] = useState(false)
  const [seriesState, setSeriesState] = useState<Record<number, SeriesInfo>>({})
  const [seriesGen, setSeriesGen] = useState<Set<number>>(new Set())

  const loadEvents = async () => {
    setLoading(true)
    try {
      const { data } = await curiosityApi.events()
      setEvents(data || [])
      // Load series state for series events
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
      if (mode === 'one_shot') {
        await curiosityApi.ask(question.trim(), 'one_shot')
        message.success('回答已生成！🎉')
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
        <Card style={{ borderRadius: 16, marginBottom: 24, boxShadow: '0 4px 16px rgba(255,107,107,0.12)', border: 'none' }}>
          <Input.TextArea
            placeholder="今天想了解什么呀？✨ 例如：'为什么天空是蓝色的？'"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            style={{ borderRadius: 12, fontSize: 15, marginBottom: 12 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)} size="small"
              optionType="button" buttonStyle="solid">
              <Radio.Button value="one_shot">
                <BulbOutlined /> 快速回答
              </Radio.Button>
              <Radio.Button value="series">
                <BookOutlined /> 系列故事
              </Radio.Button>
            </Radio.Group>
            <Button type="primary" icon={<SendOutlined />} onClick={handleAsk} loading={asking}
              style={{ borderRadius: 16, fontWeight: 600 }}>
              提问
            </Button>
          </div>
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
              {event.mode === 'series' && seriesState[event.id] && (
                <SeriesProgress
                  series={seriesState[event.id]}
                  onContinue={() => navigate(`/series/${seriesState[event.id].series_id}`)}
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
