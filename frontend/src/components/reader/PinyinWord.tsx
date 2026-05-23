import { useState } from 'react'
import { motion } from 'framer-motion'
import { popIn } from '../../theme/animations'
import { getCached } from './audioCache'
import { charactersApi } from '../../services/api'

const voiceReady = new Promise<SpeechSynthesisVoice[]>((resolve) => {
  const voices = speechSynthesis.getVoices()
  if (voices.length > 0) { resolve(voices); return }
  speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices())
})

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const zh = voices.filter(v => v.lang === 'zh-CN')
  return zh.find(v => v.name.includes('Yaoyao'))
    || zh.find(v => v.name.includes('Huihui'))
    || zh[0]
    || null
}

interface Props {
  char: string
  pinyin: string
  articleId?: number
}

export default function PinyinWord({ char, pinyin, articleId }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const speak = async () => {
    speechSynthesis.cancel()
    setIsSpeaking(false)

    // Report tap asynchronously (fire-and-forget)
    charactersApi.reportInteraction(char, articleId).catch(() => {})

    // Prefer cached Edge-TTS audio
    const cachedUrl = getCached(char)
    if (cachedUrl) {
      const audio = new Audio(cachedUrl)
      audio.onended = () => setIsSpeaking(false)
      audio.onerror = () => setIsSpeaking(false)
      setIsSpeaking(true)
      audio.play().catch(() => setIsSpeaking(false))
      return
    }

    // Fallback: browser speech synthesis
    const voices = await voiceReady
    const voice = pickVoice(voices)
    if (!voice) return
    const u = new SpeechSynthesisUtterance(char)
    u.voice = voice
    u.rate = 0.7
    u.pitch = 0.95
    u.volume = 1
    u.onstart = () => setIsSpeaking(true)
    u.onend = () => setIsSpeaking(false)
    u.onerror = () => setIsSpeaking(false)
    setIsSpeaking(true)
    speechSynthesis.speak(u)
  }

  return (
    <motion.span
      variants={popIn}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      animate={isSpeaking ? { scale: 1.08 } : { scale: 1 }}
      onClick={speak}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'pointer', padding: '2px 4px', borderRadius: 8,
        background: isSpeaking ? '#E8F5E9' : '#FFF8E1',
        margin: '0 1px', userSelect: 'none',
        boxShadow: isSpeaking ? '0 0 0 2px #6DBF6E' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}
    >
      <span style={{ fontSize: 11, color: '#888', lineHeight: 1.2, minHeight: 14 }}>
        {pinyin || ' '}
      </span>
      <span style={{
        fontSize: 22, fontWeight: 600, color: '#3D3D3D',
        fontFamily: '"KaiTi", "楷体", serif',
      }}>
        {char}
      </span>
    </motion.span>
  )
}
