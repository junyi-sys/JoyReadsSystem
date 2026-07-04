import { useRef, useCallback, useEffect } from 'react'
import { sttApi, ttsApi } from '../services/api'

const hasNativeAudio = typeof (window as any).NativeAudio !== 'undefined'
const SILENCE_TIMEOUT = 2000
const MIN_RECORDING_TIME = 800
const MAX_STT_RETRIES = 3

interface UseCompanionVoiceOptions {
  onTranscript: (text: string) => void
  onTtsStop?: () => void
}

export function useCompanionVoice({ onTranscript, onTtsStop }: UseCompanionVoiceOptions) {
  const mediaRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordStartRef = useRef<number>(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processingRef = useRef(false)
  const closedRef = useRef(false)
  const sttRetryRef = useRef(0)
  const startRecordingRef = useRef<() => void>(() => {})
  const listeningRef = useRef(false)
  const setListeningRef = useRef<(v: boolean) => void>(() => {})
  const nativeCallbackId = useRef(0)
  const nativeStarted = useRef(false)
  const nativeTimer = useRef<ReturnType<typeof setTimeout>>()

  // ---- Native Android audio bridge ----
  const processNativeBase64 = useCallback(async (b64: string) => {
    const byteChars = atob(b64)
    const byteNums = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
    const blob = new Blob([new Uint8Array(byteNums)], { type: 'audio/m4a' })
    try {
      const res = await sttApi.transcribe(blob, 'm4a')
      const text = (res.data?.text || res.data?.transcript || '').trim()
      if (text) {
        sttRetryRef.current = 0
        onTranscript(text)
      } else {
        processingRef.current = false
        sttRetryRef.current += 1
        if (!closedRef.current && sttRetryRef.current < MAX_STT_RETRIES) {
          startRecordingRef.current()
        }
      }
    } catch {
      processingRef.current = false
      if (!closedRef.current) {
        sttRetryRef.current += 1
        if (sttRetryRef.current < MAX_STT_RETRIES) startRecordingRef.current()
      }
    }
  }, [onTranscript])

  useEffect(() => {
    if (!hasNativeAudio) return
    const w = window as any
    w._companionVoiceCallback = (id: string, type: string, payload: string) => {
      if (id !== String(nativeCallbackId.current)) return
      if (type === 'started') {
        nativeStarted.current = true
        setListeningRef.current(true)
      } else if (type === 'data') {
        setListeningRef.current(false)
        nativeStarted.current = false
        processNativeBase64(payload)
      } else if (type === 'error') {
        setListeningRef.current(false)
        nativeStarted.current = false
        processingRef.current = false
      }
    }
    return () => { delete w._companionVoiceCallback }
  }, [processNativeBase64])

  const stopSilenceDetection = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const startSilenceDetection = useCallback((stream: MediaStream) => {
    try {
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close() } catch {}
      }
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let silenceStart = 0
      let isSpeaking = false

      const checkSilence = () => {
        if (!analyserRef.current || processingRef.current || closedRef.current) return
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const now = Date.now()

        if (avg > 15) {
          isSpeaking = true
          silenceStart = 0
        } else if (isSpeaking && avg <= 15) {
          if (silenceStart === 0) silenceStart = now
          if (now - silenceStart > SILENCE_TIMEOUT && now - recordStartRef.current > MIN_RECORDING_TIME) {
            isSpeaking = false
            silenceStart = 0
            if (mediaRef.current && mediaRef.current.state === 'recording') {
              processingRef.current = true
              mediaRef.current.stop()
            }
            return
          }
        }
        silenceTimerRef.current = setTimeout(checkSilence, 200)
      }
      checkSilence()
    } catch {}
  }, [])

  const startRecording = useCallback(async () => {
    if (processingRef.current || closedRef.current) return

    // Native Android path
    if (hasNativeAudio) {
      nativeCallbackId.current = Date.now()
      ;(window as any).NativeAudio.startRecord(String(nativeCallbackId.current))
      nativeTimer.current = setTimeout(() => {
        if (nativeStarted.current) {
          ;(window as any).NativeAudio.stopRecord()
        }
      }, 15000)
      return
    }

    // Web MediaRecorder path
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      const chunks: Blob[] = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null
        audioCtxRef.current?.close()
        audioCtxRef.current = null
        analyserRef.current = null
        setListeningRef.current(false)
        if (closedRef.current) return
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
        const blob = new Blob(chunks, { type: mimeType })
        console.log('[CompanionVoice] STT blob size:', blob.size, 'type:', mimeType)
        try {
          const { data } = await sttApi.transcribe(blob, ext)
          console.log('[CompanionVoice] STT result:', data)
          const text = data?.text || data?.transcript || ''
          if (text.trim()) {
            sttRetryRef.current = 0
            onTranscript(text)
          } else {
            processingRef.current = false
            sttRetryRef.current += 1
            if (sttRetryRef.current < MAX_STT_RETRIES) {
              startRecordingRef.current()
            } else {
              sttRetryRef.current = 0
            }
          }
        } catch {
          processingRef.current = false
          if (closedRef.current) return
          sttRetryRef.current += 1
          if (sttRetryRef.current < MAX_STT_RETRIES) {
            startRecordingRef.current()
          } else {
            sttRetryRef.current = 0
          }
        }
      }
      mediaRef.current = recorder
      recordStartRef.current = Date.now()
      recorder.start()
      setListeningRef.current(true)
      startSilenceDetection(stream)
    } catch {
      setListeningRef.current(false)
      processingRef.current = false
    }
  }, [startSilenceDetection, onTranscript])

  startRecordingRef.current = startRecording

  const playReplyVoice = useCallback(async (text: string) => {
    onTtsStop?.()
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
      const { data } = await ttsApi.synthesize(text, 0.9)
      if (!(data instanceof Blob) || data.size < 100) {
        processingRef.current = false
        if (!closedRef.current) setTimeout(() => startRecordingRef.current(), 300)
        return
      }
      const url = URL.createObjectURL(data)
      blobUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        blobUrlRef.current = null
        processingRef.current = false
        if (!closedRef.current) setTimeout(() => startRecordingRef.current(), 300)
      }
      audio.onerror = () => {
        processingRef.current = false
        if (!closedRef.current) setTimeout(() => startRecordingRef.current(), 300)
      }
      audio.play().catch(() => {
        processingRef.current = false
        if (!closedRef.current) setTimeout(() => startRecordingRef.current(), 300)
      })
    } catch {
      processingRef.current = false
      if (!closedRef.current) setTimeout(() => startRecordingRef.current(), 300)
    }
  }, [onTtsStop])

  const stopRecording = useCallback(() => {
    clearTimeout(nativeTimer.current)
    if (hasNativeAudio) {
      ;(window as any).NativeAudio.stopRecord()
      return
    }
    stopSilenceDetection()
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.onstop = null
      mediaRef.current.stop()
      mediaRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    processingRef.current = false
    sttRetryRef.current = 0
  }, [stopSilenceDetection])

  const cleanup = useCallback(() => {
    closedRef.current = true
    clearTimeout(nativeTimer.current)
    if (hasNativeAudio && nativeStarted.current) {
      ;(window as any).NativeAudio.stopRecord()
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (mediaRef.current && mediaRef.current.state === 'recording') {
      mediaRef.current.onstop = null
      mediaRef.current.stop()
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    processingRef.current = false
  }, [])

  const resetClosed = useCallback(() => {
    closedRef.current = false
  }, [])

  return {
    startRecording,
    startRecordingRef,
    playReplyVoice,
    stopRecording,
    stopSilenceDetection,
    cleanup,
    resetClosed,
    processingRef,
    closedRef,
    listeningRef,
    setListeningRef,
  }
}