import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout, Menu, Spin, Empty, Button, Tag, Progress, Card, Input } from 'antd'
import { ArrowLeftOutlined, PlayCircleOutlined, CheckCircleOutlined, ReadOutlined, AudioOutlined, AudioMutedOutlined, SendOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { articlesApi, curiosityApi, sttApi } from '../services/api'
import { useMessage } from '../hooks/useMessage'
import type { SeriesInfo, ArticleWithPinyin, ChapterItem } from '../types'
import ArticleReader from '../components/reader/ArticleReader'
import { pageTransition, fadeInUp } from '../theme/animations'

const { Sider, Content } = Layout
const MAX_RECORD_SEC = 60

export default function SeriesReaderPage() {
  const message = useMessage()
  const { seriesId } = useParams()
  const navigate = useNavigate()
  const [series, setSeries] = useState<SeriesInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentChapter, setCurrentChapter] = useState<ArticleWithPinyin | null>(null)
  const [chapterLoading, setChapterLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [question, setQuestion] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [generatingNext, setGeneratingNext] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number>(0)

  const sid = parseInt(seriesId || '', 10)
  const invalidSeriesId = !seriesId || isNaN(sid)

  useEffect(() => {
    if (invalidSeriesId) return
    setLoading(true)
    articlesApi.getSeries(sid)
      .then(({ data }) => {
        setSeries(data)
        if (!data.chapters || data.chapters.length === 0) return
        const firstUnread = data.chapters.find((c: ChapterItem) => c.read_status === 'unread')
        const toLoad = firstUnread || data.chapters[0]
        if (toLoad) loadChapter(toLoad.chapter_number)
      })
      .catch(() => message.error('加载系列失败'))
      .finally(() => setLoading(false))

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [seriesId])

  const stopRecording = useCallback(() => {
    try { mediaRecorderRef.current?.stop() } catch {}
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    clearInterval(timerRef.current)
    setIsRecording(false)
  }, [])

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
        setIsTranscribing(true)
        try {
          const { data } = await sttApi.transcribe(blob)
          const text = data.text || ''
          if (text) {
            setQuestion((prev) => (prev ? prev + ' ' + text : text))
            message.success('语音已识别')
          } else {
            message.warning('未识别到语音内容')
          }
        } catch {
          message.error('语音识别失败，请尝试文字输入')
        } finally {
          setIsTranscribing(false)
          setRecordingTime(0)
        }
      }
      recorder.onerror = () => { stopRecording(); message.error('录音出错，请重试') }

      setRecordingTime(0)
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => {
          if (t + 1 >= MAX_RECORD_SEC) { stopRecording(); return 0 }
          return t + 1
        })
      }, 1000)
      recorder.start()
      setIsRecording(true)
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message.warning('请允许麦克风权限后重试')
      } else if (err.name === 'NotFoundError') {
        message.warning('未检测到麦克风设备')
      } else {
        message.error('无法启动录音：' + (err.message || '未知错误'))
      }
    }
  }, [isRecording, stopRecording])

  const loadChapter = async (chNum: number) => {
    // Mark current chapter as read before switching
    if (currentChapter && currentChapter.chapter_number !== chNum) {
      const paraCount = currentChapter.paragraphs?.length || 0
      articlesApi.updateReadStatus(currentChapter.id, { status: 'read', read_count: paraCount, total_count: paraCount }).then(() => {
        setSeries((prev) => {
          if (!prev) return prev
          return { ...prev, chapters: prev.chapters.map((c) => c.id === currentChapter.id ? { ...c, read_status: 'read' as const } : c) }
        })
      }).catch(() => {})
    }
    setChapterLoading(true)
    try {
      const { data } = await articlesApi.getSeriesChapter(sid, chNum)
      setCurrentChapter(data)
      articlesApi.updateReadStatus(data.id, { status: 'reading', read_count: 0, total_count: data.paragraphs?.length || 0 }).catch(() => {})
    } catch { message.error('加载章节失败') }
    finally { setChapterLoading(false) }
  }

  const handleFinishReading = (articleId: number) => {
    const paraCount = currentChapter?.paragraphs?.length || 0
    articlesApi.updateReadStatus(articleId, { status: 'read', read_count: paraCount, total_count: paraCount }).then(() => {
      setSeries((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          chapters: prev.chapters.map((c) => c.id === articleId ? { ...c, read_status: 'read' as const } : c),
        }
      })
    }).catch(() => {})
  }

  const handleNextChapter = async () => {
    if (!series || !currentChapter?.chapter_number) return
    if (isRecording) stopRecording()
    const nextCh = currentChapter.chapter_number + 1

    if (nextCh <= series.current_chapter) {
      loadChapter(nextCh)
      return
    }

    if (!series.curiosity_event_id) {
      message.warning('无法生成新章节')
      return
    }
    setGeneratingNext(true)
    try {
      const { data } = await curiosityApi.seriesNext(
        series.curiosity_event_id,
        true,
        question.trim() || undefined,
      )
      if (data.error) { message.error(data.error); return }
      if (data.completed) { message.success('系列已完结！'); return }

      const { data: updatedSeries } = await articlesApi.getSeries(series.id)
      setSeries(updatedSeries)
      loadChapter(nextCh)
      setQuestion('')
      message.success(question.trim() ? '已根据你的问题生成新章节！' : '新章节已生成')
    } catch { message.error('生成下一章失败') }
    finally { setGeneratingNext(false) }
  }

  if (invalidSeriesId) return <div style={{ textAlign: 'center', marginTop: 100, color: '#999' }}>无效的系列ID</div>
  if (loading || !series) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  const chapters = series.chapters || []
  const readCount = chapters.filter((c) => c.read_status === 'read').length
  const progress = series.total_chapters > 0 ? Math.round((readCount / series.total_chapters) * 100) : 0
  const currentCh = chapters.find((c) => c.chapter_number === (currentChapter as any)?.chapter_number)
  const isLastChapter = currentChapter?.chapter_number ? currentChapter.chapter_number >= series.current_chapter : false

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible">
      <Layout style={{ minHeight: '100vh', background: 'var(--color-bg, #FFF8F0)' }}>
        <Sider width={280} collapsedWidth={60} collapsible collapsed={collapsed} onCollapse={setCollapsed}
          style={{ background: '#fafafa', borderRight: '1px solid #f0f0f0' }} breakpoint="lg">
          <div style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
            {!collapsed && (
              <>
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/curiosity')}
                  style={{ marginBottom: 8 }}>返回</Button>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, fontFamily: '"ZCOOL KuaiLe",cursive' }}>
                  {series.topic}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Progress percent={progress} size="small" status={progress === 100 ? 'success' : 'active'} />
                  <span style={{ fontSize: 11, color: '#999' }}>{readCount}/{series.total_chapters} 章已读</span>
                </div>
                {series.status === 'completed' && progress === 100 && (
                  <Tag color="green" style={{ marginTop: 4, borderRadius: 10 }}>全部完成 ✓</Tag>
                )}
              </>
            )}
          </div>
          <Menu mode="inline" selectedKeys={currentCh ? [String(currentCh.chapter_number)] : []}
            style={{ border: 'none', background: 'transparent' }}
            items={chapters.map((ch) => ({
              key: String(ch.chapter_number),
              icon: ch.read_status === 'read' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ReadOutlined />,
              label: <span>第{ch.chapter_number}章 {!collapsed && <span style={{ fontSize: 12, color: '#888' }}>{ch.title.length > 20 ? ch.title.slice(0, 20) + '...' : ch.title}</span>}</span>,
            }))}
            onClick={({ key }) => {
              const ch = chapters.find((c) => c.chapter_number === parseInt(key, 10))
              if (ch) loadChapter(ch.chapter_number)
            }}
          />
        </Sider>

        <Content style={{ padding: '32px 48px', overflow: 'auto' }}>
          <Spin spinning={chapterLoading}>
            {currentChapter ? (
              <Card
                title={<span><Tag color="blue" style={{ borderRadius: 10, marginRight: 8 }}>第{currentChapter.chapter_number}章 / 共{series.total_chapters}章</Tag>{currentChapter.topic}</span>}
                extra={<Button type="primary" ghost icon={<CheckCircleOutlined />} onClick={() => handleFinishReading(currentChapter.id)} style={{ borderRadius: 16 }}>标记已读</Button>}
                style={{ maxWidth: 800, margin: '0 auto', borderRadius: 16 }}
              >
                <ArticleReader article={currentChapter} />

                <div style={{
                  marginTop: 24, padding: '16px 24px', background: '#f6ffed',
                  borderRadius: 12, border: '1px solid #b7eb8f',
                }}>
                  {/* Row 1: Navigation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Button disabled={!currentChapter.chapter_number || currentChapter.chapter_number <= 1}
                      onClick={() => { if (currentChapter.chapter_number) loadChapter(currentChapter.chapter_number - 1) }}
                      style={{ borderRadius: 12 }}>上一章</Button>
                    <span style={{ lineHeight: '32px', color: '#52c41a', fontWeight: 500 }}>
                      第{currentChapter.chapter_number}/{series.total_chapters}章
                    </span>
                    {series.status === 'completed' && isLastChapter ? (
                      <Tag color="green" style={{ borderRadius: 10, lineHeight: '32px' }}>已完成</Tag>
                    ) : (
                      <Button type="primary"
                        loading={generatingNext}
                        onClick={handleNextChapter}
                        icon={isLastChapter ? <SendOutlined /> : <PlayCircleOutlined />}
                        style={{ borderRadius: 12 }}>
                        {isLastChapter ? '生成下一章' : '下一章'}
                      </Button>
                    )}
                  </div>

                  {/* Row 2: Question input (only at last chapter, not completed) */}
                  {isLastChapter && series.status !== 'completed' && (
                    <div style={{
                      display: 'flex', gap: 8, marginTop: 12, paddingTop: 12,
                      borderTop: '1px dashed #b7eb8f', alignItems: 'center',
                    }}>
                      <span style={{ fontSize: 13, color: '#888', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        💬 有问题？
                      </span>
                      <Input
                        placeholder="输入孩子的问题，会影响下一章内容..."
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onPressEnter={handleNextChapter}
                        size="small"
                        style={{ borderRadius: 10, flex: 1 }}
                        suffix={
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {isRecording && (
                              <span style={{ fontSize: 11, color: '#ff4d4f', fontVariantNumeric: 'tabular-nums' }}>
                                {recordingTime}s
                              </span>
                            )}
                            {isTranscribing && (
                              <span style={{ fontSize: 11, color: '#4DABF7', whiteSpace: 'nowrap' }}>
                                转写中...
                              </span>
                            )}
                            <Button
                              type="text"
                              size="small"
                              icon={isRecording ? <AudioMutedOutlined style={{ color: '#ff4d4f' }} /> : <AudioOutlined style={{ color: '#4DABF7' }} />}
                              onClick={toggleRecording}
                              style={{
                                borderRadius: 8,
                                animation: isRecording ? 'pulse 1.5s infinite' : undefined,
                                fontSize: 12,
                                minWidth: 28, height: 28,
                              }}
                            />
                          </span>
                        }
                      />
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Empty description="选择左侧章节开始阅读" />
            )}
          </Spin>
        </Content>
      </Layout>
    </motion.div>
  )
}
