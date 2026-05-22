import { motion } from 'framer-motion'
import { popIn } from '../../theme/animations'
import { ttsApi } from '../../services/api'

export default function PinyinWord({ char, pinyin }: { char: string; pinyin: string }) {
  const speak = async () => {
    try {
      const { data } = await ttsApi.synthesize(char)
      const audio = new Audio(URL.createObjectURL(data as Blob))
      await audio.play()
    } catch {
      // Silently fail for TTS
    }
  }

  return (
    <motion.span
      variants={popIn}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      onClick={speak}
      style={{
        display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
        cursor: 'pointer', padding: '2px 4px', borderRadius: 8,
        background: '#FFF8E1', margin: '0 1px',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 11, color: '#888', lineHeight: 1.2, minHeight: 14 }}>
        {pinyin || ' '}
      </span>
      <span style={{
        fontSize: 22, fontWeight: 600, color: '#3D3D3D',
        fontFamily: '"KaiTi", "楷体", serif',
      }}>
        {char}
      </span>
    </motion.span>
  )
}
