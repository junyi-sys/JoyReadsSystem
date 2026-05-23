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
    // Small delay between batches to avoid rate-limiting
    if (i + CONCURRENCY < chars.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }
}
