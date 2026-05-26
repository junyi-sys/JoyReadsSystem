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
        display: 'inline-block', position: 'relative', textAlign: 'center',
        cursor: 'pointer', padding: '11px 8px 5px 8px', margin: '0', textIndent: 0, borderRadius: 4,
        background: isSpeaking ? '#E8F5E9' : 'transparent',
        userSelect: 'none', verticalAlign: 'top',
        boxShadow: isSpeaking ? '0 0 0 2px #6DBF6E' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}
    >
      <span style={{ fontSize: 10, color: '#888', lineHeight: 1.1, letterSpacing: '0.5px', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
        {pinyin || ' '}
      </span>
      <span style={{
        fontSize: 25, fontWeight: 600, color: '#3D3D3D', lineHeight: 1.1,
        fontFamily: '"KaiTi", "楷体", serif',
      }}>
        {char}
      </span>
    </motion.span>
  )
}
