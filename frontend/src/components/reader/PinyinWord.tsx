import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { popIn } from '../../theme/animations'
import { getCached, fetchInBackground, unlockAudio } from './audioCache'
import { charactersApi } from '../../services/api'

interface Props {
  char: string
  pinyin: string
  articleId?: number
}

let voicesLoaded = false
let zhVoice: SpeechSynthesisVoice | null = null

function loadVoices() {
  const voices = speechSynthesis.getVoices()
  if (voices.length === 0) return
  voicesLoaded = true
  zhVoice =
    voices.find(v => v.lang === 'zh-CN' && v.localService) ||
    voices.find(v => v.lang.startsWith('zh')) ||
    voices.find(v => v.lang === 'zh-CN') ||
    null
}

function ensureVoices(): SpeechSynthesisVoice | null {
  if (!voicesLoaded) loadVoices()
  return zhVoice
}

// Preload voices when they become available (critical for mobile)
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener('voiceschanged', loadVoices)
  loadVoices() // Chrome may return voices synchronously
}

function speakViaSynthesis(char: string): boolean {
  try {
    if (!('speechSynthesis' in window)) return false
    speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(char)
    utter.lang = 'zh-CN'
    utter.rate = 0.7
    utter.volume = 1
    const voice = ensureVoices()
    if (voice) utter.voice = voice
    speechSynthesis.speak(utter)
    return true
  } catch {
    return false
  }
}

function playCached(char: string): boolean {
  const url = getCached(char)
  if (!url) return false
  const audio = new Audio(url)
  audio.play().catch(() => {})
  return true
}

export default function PinyinWord({ char, pinyin, articleId }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const speak = () => {
    unlockAudio()
    speechSynthesis.cancel()
    if (timerRef.current) clearTimeout(timerRef.current)

    // Always report interaction (sync, within gesture)
    charactersApi.reportInteraction(char, articleId).catch(() => {})

    let played = false

    // 1. Try cached Edge-TTS (sync — no await, gesture context preserved)
    played = playCached(char)

    // 2. Fallback to SpeechSynthesis immediately (sync, within gesture)
    if (!played) {
      played = speakViaSynthesis(char)
    }

    if (played) {
      setIsSpeaking(true)
      timerRef.current = setTimeout(() => setIsSpeaking(false), 800)
    }

    // 3. Fetch Edge-TTS in background for next tap (async, non-blocking)
    fetchInBackground(char)
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
