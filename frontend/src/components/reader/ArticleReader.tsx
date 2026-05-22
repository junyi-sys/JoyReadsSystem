import { motion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '../../theme/animations'
import type { ArticleWithPinyin } from '../../types'
import PinyinWord from './PinyinWord'
import { Card, Tag, Typography } from 'antd'
import { BookOutlined } from '@ant-design/icons'

interface Props {
  article: ArticleWithPinyin
  onParagraphRead?: (index: number) => void
}

export default function ArticleReader({ article }: Props) {
  return (
    <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
      {article.image_url && (
        <motion.div variants={fadeInUp} style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src={article.image_url}
            alt={article.topic}
            style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
          />
        </motion.div>
      )}

      <motion.div variants={fadeInUp} style={{ marginBottom: 16 }}>
        <Tag color="blue" icon={<BookOutlined />} style={{ borderRadius: 10 }}>
          {article.character_count} 字
        </Tag>
        <Tag color="purple" style={{ borderRadius: 10 }}>{article.category}</Tag>
      </motion.div>

      {article.paragraphs.map((para, i) => (
        <motion.div
          key={i}
          variants={fadeInUp}
          style={{
            fontSize: 20, lineHeight: 2.0, padding: '16px 24px',
            background: i % 2 === 0 ? '#fafae8' : '#f0fdf4',
            borderRadius: 12, marginBottom: 12,
            fontFamily: '"KaiTi", "楷体", serif',
          }}
        >
          {para.tokens.map((token, j) => (
            <PinyinWord key={j} char={token.char} pinyin={token.pinyin} />
          ))}
        </motion.div>
      ))}

      {article.series_id && (
        <motion.div variants={fadeInUp} style={{ marginTop: 16, textAlign: 'center' }}>
          <Typography.Text type="secondary">
            系列第 {article.chapter_number} 章 / 共 {article.total_chapters} 章
          </Typography.Text>
        </motion.div>
      )}
    </motion.div>
  )
}
