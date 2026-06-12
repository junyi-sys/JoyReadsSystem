import { useState, useRef, useCallback } from 'react'
import { sttApi } from '../services/api'

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const onResultRef = useRef<((text: string) => void) | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout>>()
  const startingRef = useRef(false)

  const start = useCallback(async (onResult: (text: string) => void) => {
    // Prevent double-click from creating multiple concurrent MediaRecorders
    if (startingRef.current || mediaRecRef.current?.state === 'recording') return
    startingRef.current = true
    setError(null)
    onResultRef.current = onResult

    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          noiseSuppression: true,
          echoCancellation: false,
          channelCount: 1,
        },
      })
      chunksRef.current = []

      // Note: do NOT use Web Audio API GainNode — it distorts audio for STT.
      // Rely on autoGainControl + backend ffmpeg volume boost instead.
      const recordStream = rawStream

      // Pick supported MIME type (prefer Opus, fall back to whatever works)
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ]
      let selectedMime = ''
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          selectedMime = mt
          break
        }
      }
      const mr = selectedMime
        ? new MediaRecorder(recordStream, { mimeType: selectedMime })
        : new MediaRecorder(recordStream)
      mediaRecRef.current = mr

      const startTime = Date.now()

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        startingRef.current = false
        rawStream.getTracks().forEach((t) => t.stop())
        setIsListening(false)

        const duration = Date.now() - startTime
        if (duration < 600) {
          setError('录音时间太短，请点击开始说话，说完再点击停止')
          return
        }

        if (chunksRef.current.length === 0) {
          setError('没有录到声音，请再试一次')
          return
        }

        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const ext = mr.mimeType?.includes('mp4') ? 'mp4' : mr.mimeType?.includes('ogg') ? 'ogg' : 'webm'
        try {
          const res = await sttApi.transcribe(blob, ext)
          const text = res.data?.text?.trim()
          if (text) {
            onResultRef.current?.(text)
          } else {
            setError('没有识别出文字，请说清楚一点再试')
          }
        } catch (err: any) {
          const msg = err?.response?.data?.detail || err?.message || '语音识别失败'
          setError(typeof msg === 'string' ? msg : '语音识别失败')
        }
      }

      mr.onerror = () => {
        startingRef.current = false
        rawStream.getTracks().forEach((t) => t.stop())
        setIsListening(false)
        setError('录音失败，请检查麦克风')
      }

      mr.start(250)
      setIsListening(true)

      maxTimer.current = setTimeout(() => {
        if (mediaRecRef.current?.state === 'recording') {
          mediaRecRef.current.stop()
        }
      }, 15000)
    } catch (err: any) {
      startingRef.current = false
      setIsListening(false)
      if (err?.name === 'NotAllowedError' || err?.message?.includes('permission')) {
        setError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风')
      } else {
        setError('无法访问麦克风：' + (err?.message || '未知错误'))
      }
    }
  }, [])

  const stop = useCallback(() => {
    clearTimeout(maxTimer.current)
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop()
    } else {
      setIsListening(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const supported = !!(navigator.mediaDevices?.getUserMedia)

  return { isListening, error, start, stop, clearError, supported }
}
