import { useState, useRef, useCallback, useEffect } from 'react'
import { sttApi } from '../services/api'

// Check if native Android audio bridge is available (Capacitor APK)
const hasNativeAudio = typeof (window as any).NativeAudio !== 'undefined'

export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supported = hasNativeAudio || !!(navigator.mediaDevices?.getUserMedia)

  // Web path refs
  const mediaRecRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const maxTimer = useRef<ReturnType<typeof setTimeout>>()
  const startingRef = useRef(false)

  // Native path refs
  const nativeCallbackId = useRef(0)
  const nativeStarted = useRef(false)

  // Outbound callback — use a ref so it's always current
  const onResultRef = useRef<((text: string) => void) | null>(null)

  // ---- Native bridge helpers ----

  const processNativeBase64 = useCallback(async (b64: string) => {
    const byteChars = atob(b64)
    const byteNums = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
    const blob = new Blob([new Uint8Array(byteNums)], { type: 'audio/m4a' })
    try {
      const res = await sttApi.transcribe(blob, 'm4a')
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
  }, [])

  // Register global callback for native audio bridge
  useEffect(() => {
    if (!hasNativeAudio) return
    const w = window as any
    w._nativeAudioCallback = (id: string, type: string, payload: string) => {
      if (id !== String(nativeCallbackId.current)) return
      if (type === 'started') {
        nativeStarted.current = true
        setIsListening(true)
      } else if (type === 'data') {
        setIsListening(false)
        nativeStarted.current = false
        processNativeBase64(payload)
      } else if (type === 'error') {
        setIsListening(false)
        nativeStarted.current = false
        startingRef.current = false
        if (payload === 'PERMISSION_DENIED') {
          setError('麦克风权限被拒绝，请在设置中允许访问麦克风')
        } else {
          setError('录音失败: ' + payload)
        }
      }
    }
    return () => { delete w._nativeAudioCallback }
  }, [processNativeBase64])

  // ---- Web path helpers (restored after completion) ----

  // ---- Public API ----

  const start = useCallback(async (onResult: (text: string) => void) => {
    if (startingRef.current) return
    setError(null)
    onResultRef.current = onResult

    // ---- Native Android path ----
    if (hasNativeAudio) {
      startingRef.current = true
      nativeCallbackId.current = Date.now()
      ;(window as any).NativeAudio.startRecord(String(nativeCallbackId.current))
      // Max timer: auto-stop after 15s
      maxTimer.current = setTimeout(() => {
        if (nativeStarted.current) {
          ;(window as any).NativeAudio.stopRecord()
        }
        startingRef.current = false
      }, 15000)
      return
    }

    // ---- Browser MediaRecorder path ----
    if (mediaRecRef.current?.state === 'recording') return
    startingRef.current = true

    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          noiseSuppression: true,
          echoCancellation: false,
          channelCount: 1,
        },
      })
      streamRef.current = rawStream
      chunksRef.current = []

      // Note: do NOT use Web Audio API GainNode — it distorts audio for STT.
      // Rely on autoGainControl + backend ffmpeg volume boost instead.

      // Pick supported MIME type (prefer mp4 for Safari, fall back to whatever works)
      const mimeTypes = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
      ]
      let selectedMime = ''
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
          selectedMime = mt
          break
        }
      }
      const mr = selectedMime
        ? new MediaRecorder(rawStream, { mimeType: selectedMime })
        : new MediaRecorder(rawStream)
      mediaRecRef.current = mr

      const startTime = Date.now()

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = async () => {
        startingRef.current = false
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setIsListening(false)
        clearTimeout(maxTimer.current)

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
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        setIsListening(false)
        clearTimeout(maxTimer.current)
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

    // Native path
    if (hasNativeAudio) {
      ;(window as any).NativeAudio.stopRecord()
      return
    }

    // Web path
    if (mediaRecRef.current?.state === 'recording') {
      mediaRecRef.current.stop()
    } else {
      setIsListening(false)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(maxTimer.current)
      if (hasNativeAudio && nativeStarted.current) {
        ;(window as any).NativeAudio.stopRecord()
      }
      if (mediaRecRef.current?.state === 'recording') {
        mediaRecRef.current.stop()
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      mediaRecRef.current = null
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { isListening, error, start, stop, clearError, supported }
}
