import { useState, useRef, useCallback } from 'react'
import { ttsApi } from '../services/api'

export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const play = useCallback(async (text: string, speed: number = 1.0) => {
    stop()
    try {
      const { data } = await ttsApi.synthesize(text, speed)
      const blob = data as Blob
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onplay = () => setIsPlaying(true)
      audio.onended = () => { setIsPlaying(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setIsPlaying(false); URL.revokeObjectURL(url) }
      await audio.play()
    } catch { setIsPlaying(false) }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsPlaying(false)
  }, [])

  return { play, stop, isPlaying }
}
