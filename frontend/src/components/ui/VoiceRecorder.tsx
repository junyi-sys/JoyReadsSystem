import { useState, useRef, useCallback, useEffect } from 'react'
import { Button, message } from 'antd'
import { AudioOutlined, AudioMutedOutlined, LoadingOutlined } from '@ant-design/icons'
import { sttApi } from '../../services/api'

const getMimeType = (): string | undefined => {
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return undefined
}

interface Props {
  onText: (text: string) => void
  size?: 'small' | 'middle' | 'large'
}

// Check if native Android audio bridge is available (Capacitor APK)
const hasNativeAudio = typeof (window as any).NativeAudio !== 'undefined'

export default function VoiceRecorder({ onText, size = 'middle' }: Props) {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const nativeCallbackId = useRef(0)

  // Register global callback for native audio bridge
  useEffect(() => {
    if (!hasNativeAudio) return
    const w = window as any
    w._nativeAudioCallback = (id: string, type: string, payload: string) => {
      if (id !== String(nativeCallbackId.current)) return
      if (type === 'started') {
        setRecording(true)
      } else if (type === 'data') {
        setRecording(false)
        processBase64(payload)
      } else if (type === 'error') {
        setRecording(false)
        if (payload === 'PERMISSION_DENIED') {
          message.error('请允许麦克风权限后重试')
        } else {
          message.error('录音失败: ' + payload)
        }
      }
    }
    return () => { delete w._nativeAudioCallback }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
        mediaRecorder.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const processBase64 = useCallback(async (b64: string) => {
    setTranscribing(true)
    try {
      const byteChars = atob(b64)
      const byteNums = new Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
      const blob = new Blob([new Uint8Array(byteNums)], { type: 'audio/m4a' })
      const { data } = await sttApi.transcribe(blob)
      if (data.text) {
        onText(data.text)
        message.success('识别完成')
      } else {
        message.warning('没听清楚，再试一次？')
      }
    } catch {
      message.error('语音识别失败')
    } finally {
      setTranscribing(false)
    }
  }, [onText])

  const processBlob = useCallback(async (blob: Blob, mimeType: string | undefined) => {
    setTranscribing(true)
    try {
      const blobType = mimeType || 'audio/webm'
      const finalBlob = new Blob([blob], { type: blobType })
      const { data } = await sttApi.transcribe(finalBlob)
      if (data.text) {
        onText(data.text)
        message.success('识别完成')
      } else {
        message.warning('没听清楚，再试一次？')
      }
    } catch {
      message.error('语音识别失败')
    } finally {
      setTranscribing(false)
    }
  }, [onText])

  const startRecording = useCallback(async () => {
    // Android native path
    if (hasNativeAudio) {
      nativeCallbackId.current = Date.now()
      ;(window as any).NativeAudio.startRecord(String(nativeCallbackId.current))
      return
    }

    // Browser getUserMedia path
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = getMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {})
      mediaRecorder.current = recorder
      chunks.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        if (chunks.current.length === 0) return
        const blob = new Blob(chunks.current)
        await processBlob(blob, mimeType)
      }

      recorder.start()
      setRecording(true)
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        message.error('请允许麦克风权限后重试')
      } else if (err?.name === 'NotFoundError') {
        message.error('未检测到麦克风设备')
      } else {
        message.error('录音失败: ' + (err?.message || err?.name || String(err)))
      }
    }
  }, [processBlob])

  const stopRecording = useCallback(() => {
    // Android native path
    if (hasNativeAudio) {
      ;(window as any).NativeAudio.stopRecord()
      return
    }

    if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
      mediaRecorder.current.stop()
      setRecording(false)
    }
  }, [])

  if (transcribing) {
    return (
      <Button size={size} style={{ borderRadius: 20, minWidth: 40 }}>
        <LoadingOutlined spin />
      </Button>
    )
  }

  if (recording) {
    return (
      <Button
        type="primary" danger
        size={size}
        icon={<AudioMutedOutlined />}
        onClick={stopRecording}
        style={{ borderRadius: 20, animation: 'pulse 1.5s infinite' }}
      >
        点击停止
      </Button>
    )
  }

  return (
    <Button
      size={size}
      icon={<AudioOutlined />}
      onClick={startRecording}
      style={{ borderRadius: 20 }}
      title="语音录入"
    />
  )
}
