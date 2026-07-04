import { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input } from 'antd'
import { CloseOutlined, SendOutlined } from '@ant-design/icons'
import { companionApi } from '../../services/api'
import type { CompanionChatMessage } from '../../services/api'
import ChatBubble from './ChatBubble'
import { useCompanionVoice } from '../../hooks/useCompanionVoice'

interface Props {
  articleId: number | undefined
  articleContext: string
  mainQuestion: string
  onTtsStop?: () => void
}

const EMOTION_COLORS: Record<string, string> = {
  boast: '#fa8c16',
  confused: '#1677ff',
  conflict: '#f5222d',
  ignorant: '#722ed1',
  neutral: '#52c41a',
}

export default function CompanionFloat({ articleId, articleContext, mainQuestion, onTtsStop }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'child' | 'companion'; content: string; emotion?: string; emotionLabel?: string; _id: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastEmotion, setLastEmotion] = useState<string>('')
  const [listening, setListening] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [micFailed, setMicFailed] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<string | null>(null)
  const _msgCounter = useRef(0)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const nextMsgId = useCallback(() => {
    _msgCounter.current += 1
    return `${Date.now()}-${_msgCounter.current}`
  }, [])

  const sendRef = useRef<(text: string) => void>(() => {})

  const voice = useCompanionVoice({
    onTranscript: (text) => sendRef.current(text),
    onTtsStop,
  })

  voice.setListeningRef.current = setListening

  useEffect(() => {
    const id = 'companion-animations'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = `
      @keyframes wingLeft {
        0%, 100% { transform: rotate(-10deg) scaleX(1); }
        50% { transform: rotate(-30deg) scaleX(-1); }
      }
      @keyframes wingRight {
        0%, 100% { transform: rotate(10deg) scaleX(1); }
        50% { transform: rotate(30deg) scaleX(-1); }
      }
      @keyframes pigTalk {
        0%, 100% { transform: scaleY(1); }
        40% { transform: scaleY(1.15); }
        60% { transform: scaleY(0.92); }
      }
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255,77,79,0.4); }
        50% { box-shadow: 0 0 0 12px rgba(255,77,79,0); }
      }
    `
    document.head.appendChild(style)
    return () => { document.getElementById(id)?.remove() }
  }, [])

  useEffect(() => {
    return () => { voice.cleanup() }
  }, [voice.cleanup])

  useEffect(() => {
    if (open) setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [messages, open])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || !articleId) return
    const msg = text.trim()
    if (loading) {
      pendingRef.current = msg
      return
    }
    setMessages(prev => [...prev, { role: 'child', content: msg, _id: nextMsgId() }])
    setInput('')
    setLoading(true)
    voice.stopSilenceDetection()
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    try {
      const history: CompanionChatMessage[] = messagesRef.current.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const { data } = await companionApi.chat({
        message: msg,
        article_id: articleId,
        article_context: articleContext,
        main_question: mainQuestion,
        chat_history: history,
      })
      setMessages(prev => [...prev, {
        role: 'companion', content: data.reply,
        emotion: data.emotion, emotionLabel: data.emotion_label, _id: nextMsgId(),
      }])
      setLastEmotion(data.emotion)
      voice.playReplyVoice(data.reply)
    } catch {
      setMessages(prev => [...prev, { role: 'companion', content: '嗯…我刚才走神了，你再说一遍？', _id: nextMsgId() }])
      voice.processingRef.current = false
      setTimeout(() => voice.startRecordingRef.current(), 500)
    } finally {
      setLoading(false)
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      const pending = pendingRef.current
      if (pending) {
        pendingRef.current = null
        setTimeout(() => sendRef.current(pending), 100)
      }
    }
  }, [loading, articleId, articleContext, mainQuestion, voice, nextMsgId])

  sendRef.current = send

  useEffect(() => {
    if (open && articleId && messages.length === 0 && !historyLoaded) {
      companionApi.history(articleId).then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(data.map((r: any, i: number) => ({
            role: r.role as 'child' | 'companion',
            content: r.content,
            emotion: r.emotion,
            emotionLabel: r.emotion_label,
            _id: `hist-${i}`,
          })))
        }
        setHistoryLoaded(true)
      }).catch(() => setHistoryLoaded(true))
    } else if (open && !articleId) {
      setHistoryLoaded(true)
    }
  }, [open, articleId, messages.length, historyLoaded])

  useEffect(() => {
    if (open && historyLoaded && messages.length === 0 && !listening && !loading && !voice.processingRef.current) {
      voice.startRecording()
      // If recording doesn't start within 1s, assume mic failed
      setTimeout(() => {
        if (!voice.listeningRef.current && !voice.processingRef.current) {
          setMicFailed(true)
        }
      }, 1000)
    }
  }, [open, historyLoaded, messages.length, listening, loading, voice])

  const handleClose = useCallback(() => {
    voice.cleanup()
    voice.stopRecording()
    setMessages([])
    setHistoryLoaded(false)
    setListening(false)
    setOpen(false)
  }, [voice])

  const handleOpen = useCallback(() => {
    voice.resetClosed()
    setOpen(true)
  }, [voice])

  const emotionColor = lastEmotion ? EMOTION_COLORS[lastEmotion] || '#6DBF6E' : '#6DBF6E'

  return (
    <div style={{ position: 'fixed', right: 24, top: 80, zIndex: 1000 }}>
      {!open && (
        <div
          onClick={handleOpen}
          style={{
            position: 'relative',
            width: 64, height: 64,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div style={{
            position: 'absolute', left: -12, top: 8,
            fontSize: 22,
            animation: 'wingLeft 1.2s ease-in-out infinite',
            transformOrigin: 'right center',
          }}>🪽</div>
          <div style={{
            position: 'absolute', right: -12, top: 8,
            fontSize: 22,
            animation: 'wingRight 1.2s ease-in-out infinite',
            transformOrigin: 'left center',
          }}>🪽</div>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: `linear-gradient(135deg, ${emotionColor}, ${emotionColor}CC)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${emotionColor}66`,
          }}>
            <div style={{
              fontSize: 30,
              animation: 'pigTalk 0.6s ease-in-out infinite',
            }}>🐷</div>
          </div>
          {messages.length > 0 && (
            <div style={{
              position: 'absolute', top: -4, right: -4,
              width: 20, height: 20, borderRadius: '50%',
              background: '#f5222d', color: '#fff',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #fff',
            }}>
              {messages.length}
            </div>
          )}
        </div>
      )}

      {open && (
        <div style={{
          width: 360, maxHeight: '70vh',
          background: '#fff', borderRadius: 20,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${emotionColor}33`,
          marginTop: 8,
        }}>
          <div style={{
            padding: '12px 16px',
            background: `linear-gradient(135deg, ${emotionColor}, ${emotionColor}CC)`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 16 }}>🐷</span>
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>阅读伙伴</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                  {listening ? '🎤 在听，说吧...' : loading ? '💭 伙伴在想...' : '💬 随时聊两句'}
                </div>
              </div>
            </div>
            <Button
              type="text" size="small"
              icon={<CloseOutlined style={{ color: '#fff' }} />}
              onClick={handleClose}
              style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8 }}
            />
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px',
            background: '#FAFAFA', minHeight: 200,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#bbb', fontSize: 13 }}>
                {listening ? '🎤 在听，说吧...' : micFailed ? '💬 打字也可以和我聊天哦' : '点小猪头就可以说话啦'}
              </div>
            )}
            <ChatBubble messages={messages} onReplay={voice.playReplyVoice} />
            {loading && (
              <div style={{ padding: '4px 0', color: '#999', fontSize: 13, textAlign: 'center' }}>
                伙伴在想...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {listening && (
            <div style={{
              padding: '6px 16px',
              background: '#FFF1F0',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderTop: '1px solid #FFCCC7',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#f5222d',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <span style={{ color: '#cf1322', fontSize: 12 }}>
                在听你说...说完会自动接上
              </span>
            </div>
          )}

          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid #F0F0F0',
            display: 'flex', gap: 8, alignItems: 'center',
            background: '#fff',
          }}>
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onPressEnter={() => {
                if (input.trim()) {
                  voice.stopRecording()
                  send(input)
                }
              }}
              placeholder="也可以打字..."
              disabled={loading}
              style={{ borderRadius: 20, flex: 1, fontSize: 14 }}
            />
            <Button
              type="primary" shape="circle" size="small"
              icon={<SendOutlined />}
              onClick={() => {
                if (input.trim()) {
                  voice.stopRecording()
                  send(input)
                }
              }}
              disabled={!input.trim() || loading}
              style={{ background: emotionColor, borderColor: emotionColor }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
