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

// ---- AudioContext warmup (required by mobile browsers) ----

let audioCtx: AudioContext | null = null

export function unlockAudio() {
  if (audioCtx) return
  try {
    audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
  } catch { /* WebView may not support AudioContext */ }

  // Also unlock HTML5 Audio by playing a silent sound
  try {
    const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAB')
    silent.volume = 0.01
    silent.play().then(() => { silent.pause(); silent.currentTime = 0 }).catch(() => {})
  } catch { /* ignore */ }
}
