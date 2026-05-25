import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '../../theme/animations'
import type { ArticleWithPinyin } from '../../types'
import PinyinWord from './PinyinWord'
import { Card, Tag, Typography, Button, message } from 'antd'
import { BookOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { prewarmChars } from './audioCache'

interface Props {
  article: ArticleWithPinyin
  onParagraphRead?: (index: number) => void
  onReadComplete?: () => Promise<{ level_up?: { old_label: string; new_label: string } } | void>
  isRead?: boolean
}

function uniqueChars(article: ArticleWithPinyin): string[] {
  const seen = new Set<string>()
  for (const para of article.paragraphs) {
    for (const tok of para.tokens) {
      if (/^[一-鿿]$/.test(tok.char)) seen.add(tok.char)
    }
  }
  return Array.from(seen)
}

export default function ArticleReader({ article, onReadComplete, isRead }: Props) {
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    prewarmChars(uniqueChars(article))
  }, [article])

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
            fontSize: 20, lineHeight: 2.0, padding: '16px 24px', textIndent: '2em',
            background: i % 2 === 0 ? '#fafae8' : '#f0fdf4',
            borderRadius: 12, marginBottom: 12,
            fontFamily: '"KaiTi", "楷体", serif',
          }}
        >
          {para.tokens.map((token, j) => (
            <PinyinWord key={j} char={token.char} pinyin={token.pinyin} articleId={article.id} />
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

      {onReadComplete && (
        <motion.div variants={fadeInUp} style={{ textAlign: 'center', marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            loading={completing}
            disabled={isRead}
            onClick={async () => {
              setCompleting(true)
              try {
                const result = await onReadComplete()
                if (result?.level_up) {
                  message.success(
                    `太棒了！升级啦：${result.level_up.old_label} → ${result.level_up.new_label}！`,
                    5,
                  )
                } else {
                  message.success('阅读完成！')
                }
              } catch {
                message.error('标记失败')
              } finally {
                setCompleting(false)
              }
            }}
            style={{ borderRadius: 20, paddingInline: 32, fontWeight: 600 }}
          >
            {isRead ? '已读完' : '完成阅读'}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}
