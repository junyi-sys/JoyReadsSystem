import { useState } from 'react'
import { motion } from 'framer-motion'
import { popIn } from '../../theme/animations'
import { getCached, setCached } from './audioCache'
import { ttsApi, charactersApi } from '../../services/api'

interface Props {
  char: string
  pinyin: string
  articleId?: number
}

function speakChar(char: string) {
  const utter = new SpeechSynthesisUtterance(char)
  utter.lang = 'zh-CN'
  utter.rate = 0.85
  utter.volume = 1
  speechSynthesis.speak(utter)
}

export default function PinyinWord({ char, pinyin, articleId }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const speak = async () => {
    speechSynthesis.cancel()
    setIsSpeaking(false)

    charactersApi.reportInteraction(char, articleId).catch(() => {})

    // 1. Prewarmed Edge-TTS cache hit
    const cachedUrl = getCached(char)
    if (cachedUrl) {
      const audio = new Audio(cachedUrl)
      audio.onended = () => setIsSpeaking(false)
      audio.onerror = () => setIsSpeaking(false)
      setIsSpeaking(true)
      audio.play().catch(() => setIsSpeaking(false))
      return
    }

    // 2. Fetch Edge-TTS on demand
    try {
      const { data } = await ttsApi.synthesize(char, 0.7)
      const url = URL.createObjectURL(data as Blob)
      setCached(char, url)
      const audio = new Audio(url)
      audio.onended = () => setIsSpeaking(false)
      audio.onerror = () => setIsSpeaking(false)
      setIsSpeaking(true)
      audio.play().catch(() => setIsSpeaking(false))
    } catch {
      // 3. Final fallback: browser speech synthesis
      setIsSpeaking(true)
      speakChar(char)
      setTimeout(() => setIsSpeaking(false), 1000)
    }
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
