import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { popIn } from '../../theme/animations'
import { getCached, fetchInBackground, unlockAudio, playAudioUrl } from './audioCache'
import { charactersApi } from '../../services/api'

interface Props {
  char: string
  pinyin: string
  articleId?: number
}

// ---- SpeechSynthesis voice preloading ----

let voicesLoaded = false
let zhVoice: SpeechSynthesisVoice | null = null

function loadVoices() {
  try {
    const voices = speechSynthesis.getVoices()
    if (voices.length === 0) return
    voicesLoaded = true
    zhVoice =
      voices.find(v => v.lang === 'zh-CN' && v.localService) ||
      voices.find(v => v.lang.startsWith('zh')) ||
      voices.find(v => v.lang === 'zh-CN') ||
      null
  } catch { /* WebView may throw */ }
}

function ensureVoices(): SpeechSynthesisVoice | null {
  if (!voicesLoaded) loadVoices()
  return zhVoice
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    speechSynthesis.addEventListener('voiceschanged', loadVoices)
    loadVoices()
  } catch { /* ignore */ }
}

// ---- Unlock audio on first user interaction anywhere on the page ----

if (typeof document !== 'undefined') {
  const unlockOnFirstTouch = () => {
    unlockAudio()
    document.removeEventListener('touchstart', unlockOnFirstTouch)
    document.removeEventListener('click', unlockOnFirstTouch)
  }
  document.addEventListener('touchstart', unlockOnFirstTouch, { once: false })
  document.addEventListener('click', unlockOnFirstTouch, { once: false })
}

// ---- Audio playback helpers ----

let synFailed = false

function speakViaSynthesis(char: string): boolean {
  if (synFailed) return false // don't retry if it keeps failing
  try {
    const synth = window.speechSynthesis
    if (!synth) return false
    synth.cancel()
    const utter = new SpeechSynthesisUtterance(char)
    utter.lang = 'zh-CN'
    utter.rate = 0.7
    utter.volume = 1
    const voice = ensureVoices()
    if (voice) utter.voice = voice
    utter.onerror = () => { synFailed = true }
    synth.speak(utter)
    return true
  } catch {
    synFailed = true
    return false
  }
}

function tryCached(char: string): boolean {
  const url = getCached(char)
  if (!url) return false
  return playAudioUrl(url)
}

// ---- Component ----

export default function PinyinWord({ char, pinyin, articleId }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const touchedRef = useRef(false)

  const speak = useCallback(() => {
    // Prevent double-fire (touchstart + click on same gesture)
    if (touchedRef.current) return
    touchedRef.current = true
    setTimeout(() => { touchedRef.current = false }, 300)

    if (timerRef.current) clearTimeout(timerRef.current)

    // Report interaction (fire-and-forget)
    charactersApi.reportInteraction(char, articleId).catch(() => {})

    let played = false

    // 1. Try cached Edge-TTS blob URL
    try { played = tryCached(char) } catch {}

    // 2. Fallback to SpeechSynthesis
    if (!played) {
      try { played = speakViaSynthesis(char) } catch {}
    }

    // Visual feedback
    if (played) {
      setIsSpeaking(true)
      timerRef.current = setTimeout(() => setIsSpeaking(false), 800)
    }

    // 3. Prefetch Edge-TTS for next tap (async, fire-and-forget)
    fetchInBackground(char)
  }, [char, pinyin, articleId])

  return (
    <motion.span
      variants={popIn}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      animate={isSpeaking ? { scale: 1.08 } : { scale: 1 }}
      onClick={speak}
      onTouchEnd={(e) => { e.preventDefault(); speak() }}
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
