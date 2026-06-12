import { useState, useRef, useCallback } from 'react'
import { sttApi } from '../services/api'

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState(true)
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const onResultRef = useRef<((text: string) => void) | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const maxTimer = useRef<ReturnType<typeof setTimeout>>()

  // Check support on first use
  const checkSupport = useCallback(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSupported(false)
      return false
    }
    return true
  }, [])

  const start = useCallback(async (onResult: (text: string) => void) => {
    if (!checkSupport()) return
    setError(null)
    onResultRef.current = onResult

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

      chunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecRef.current = mr

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        // Clean stream
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setIsListening(false)

        if (chunksRef.current.length === 0) {
          setError('没有录到声音，请再试一次')
          return
        }

        try {
          const blob = new Blob(chunksRef.current, { type: mimeType })
          const res = await sttApi.transcribe(blob)
          const text = res.data?.text?.trim()
          if (text) {
            onResultRef.current?.(text)
          } else {
            setError('没有识别出文字，请说清楚一点再试')
          }
        } catch (err: any) {
          const msg = err?.response?.data?.detail || err?.message || '语音识别失败，请再试一次'
          setError(typeof msg === 'string' ? msg : '语音识别失败，请再试一次')
        }
      }

      mr.onerror = () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setIsListening(false)
        setError('录音失败，请检查麦克风')
      }

      mr.start()
      setIsListening(true)

      // Auto-stop after 15s
      maxTimer.current = setTimeout(() => {
        if (mediaRecRef.current?.state === 'recording') {
          mediaRecRef.current.stop()
        }
      }, 15000)
    } catch (err: any) {
      setIsListening(false)
      if (err.name === 'NotAllowedError' || err.message?.includes('permission')) {
        setError('麦克风权限被拒绝，请在浏览器设置中允许访问麦克风')
      } else {
        setError('无法访问麦克风，请检查设备连接')
      }
    }
  }, [checkSupport])

  const stop = useCallback(() => {
    clearTimeout(maxTimer.current)
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop()
    } else {
      // If recording didn't even start, just clean up
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      setIsListening(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { isListening, interim: null, error, start, stop, clearError, supported }
}
