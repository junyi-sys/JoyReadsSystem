import { ttsApi } from '../../services/api'

const cache = new Map<string, string>()

export function getCached(char: string): string | undefined {
  return cache.get(char)
}

export function setCached(char: string, url: string) {
  cache.set(char, url)
}

export async function prewarmChars(chars: string[]) {
  const CONCURRENCY = 3
  for (let i = 0; i < chars.length; i += CONCURRENCY) {
    const batch = chars.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(async (ch) => {
        if (cache.has(ch)) return
        const { data } = await ttsApi.synthesize(ch, 0.7)
        cache.set(ch, URL.createObjectURL(data as Blob))
      })
    )
    if (i + CONCURRENCY < chars.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

/** Fetch Edge-TTS for a single char in background — caches for next tap. */
export async function fetchInBackground(char: string) {
  if (cache.has(char)) return
  try {
    const { data } = await ttsApi.synthesize(char, 0.7)
    cache.set(char, URL.createObjectURL(data as Blob))
  } catch { /* silent */ }
}

// ---- Audio unlock / GC-safe Audio playback (required by mobile) ----

let audioCtx: AudioContext | null = null
let unlocked = false

/** Must be called inside a user-gesture event handler (click/touchstart) */
export function unlockAudio() {
  if (audioCtx) {
    // resume suspended context (happens after backgrounding on mobile)
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } else {
    try {
      audioCtx = new AudioContext()
      if (audioCtx.state === 'suspended') audioCtx.resume()
    } catch { /* WebView may not support AudioContext */ }
  }

  // Unlock HTML5 Audio on iOS/Android by playing silent sound within gesture.
  // This MUST complete before any real audio play in the same gesture thread.
  if (!unlocked) {
    unlocked = true
    try {
      const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAB')
      silent.volume = 0.01
      silent.play().then(() => { silent.pause(); silent.currentTime = 0 }).catch(() => {})
    } catch { /* ignore */ }
  }
}

/** Playing audio element — kept in scope to prevent GC on mobile */
let currentAudio: HTMLAudioElement | null = null

export function playAudioUrl(url: string): boolean {
  try {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      currentAudio = null
    }
    const audio = new Audio(url)
    currentAudio = audio // prevent GC
    audio.onended = () => { if (currentAudio === audio) currentAudio = null }
    audio.onerror = () => { if (currentAudio === audio) currentAudio = null }
    audio.play().catch(() => { if (currentAudio === audio) currentAudio = null })
    return true
  } catch {
    return false
  }
}
