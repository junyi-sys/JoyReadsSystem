import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fadeInUp, staggerContainer } from '../../theme/animations'
import type { ArticleWithPinyin } from '../../types'
import PinyinWord from './PinyinWord'
import { Card, Tag, Typography, Button, Tooltip } from 'antd'
import { BookOutlined, CheckCircleOutlined, StarOutlined, FireOutlined, BulbOutlined } from '@ant-design/icons'
import { prewarmChars } from './audioCache'
import { useMessage } from '../../hooks/useMessage'

interface Props {
  article: ArticleWithPinyin
  onParagraphRead?: (index: number) => void
  onReadComplete?: () => Promise<{ level_up?: { old_label: string; new_label: string } } | void>
  isRead?: boolean
}

const ZONE_COLORS: Record<string, string> = {
  target: '#ff4d4f',
  scout: '#faad14',
  ally: '#52c41a',
  lost: '#722ed1',
  unknown: '#d9d9d9',
}

const ZONE_LABELS: Record<string, string> = {
  target: '正在学',
  scout: '待评估',
  ally: '已掌握',
  lost: '困难字',
  unknown: '未收录',
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
  const message = useMessage()
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
            fontSize: 20, lineHeight: 'normal', padding: '12px 24px', textIndent: '2em',
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

      {/* Character Stats */}
      {article.char_stats && (
        <motion.div variants={fadeInUp} style={{ marginTop: 20 }}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: 14 }}>
                <StarOutlined style={{ marginRight: 6, color: '#faad14' }} />
                文章字库统计（共 {article.char_stats.total} 个不重复汉字）
              </span>
            }
            style={{ borderRadius: 12, border: '1px solid #e8e8e8' }}
          >
            {/* Zone distribution bars */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, height: 8, borderRadius: 4, overflow: 'hidden' }}>
              {(['target', 'scout', 'ally', 'lost', 'unknown'] as const).map((zone) => {
                const count = article.char_stats!.zone_counts[zone]
                const pct = article.char_stats!.total > 0 ? (count / article.char_stats!.total) * 100 : 0
                return pct > 0 ? (
                  <Tooltip key={zone} title={`${ZONE_LABELS[zone]}: ${count} 字 (${pct.toFixed(1)}%)`}>
                    <div style={{
                      height: '100%', width: `${pct}%`, backgroundColor: ZONE_COLORS[zone],
                      transition: 'width 0.3s', minWidth: 4,
                    }} />
                  </Tooltip>
                ) : null
              })}
            </div>

            {/* Zone legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 12 }}>
              {(['target', 'scout', 'ally', 'lost', 'unknown'] as const).map((zone) => {
                const count = article.char_stats!.zone_counts[zone]
                if (count === 0) return null
                return (
                  <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      backgroundColor: ZONE_COLORS[zone], display: 'inline-block',
                    }} />
                    <span style={{ color: '#666' }}>{ZONE_LABELS[zone]}</span>
                    <span style={{ fontWeight: 600 }}>{count}</span>
                    <span style={{ color: '#999' }}>
                      ({article.char_stats!.total > 0 ? ((count / article.char_stats!.total) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Today's new characters - highlighted */}
            {article.char_stats.today_new.length > 0 && (
              <div style={{
                background: '#fff7e6', borderRadius: 8, padding: '8px 12px',
                border: '1px solid #ffd591',
              }}>
                <span style={{ fontSize: 12, color: '#fa8c16', marginRight: 8 }}>
                  <FireOutlined /> 今日新字
                </span>
                {article.char_stats.today_new.map((ch) => (
                  <Tag key={ch} color="orange" style={{ borderRadius: 8, marginBottom: 4, fontSize: 15, fontFamily: '"KaiTi","楷体",serif' }}>
                    {ch}
                  </Tag>
                ))}
              </div>
            )}

            {/* Character lists by zone */}
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: '22px' }}>
              {article.char_stats.target.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: ZONE_COLORS.target, fontWeight: 500 }}>正在学：</span>
                  {article.char_stats.target.map((ch) => (
                    <Tag key={ch} style={{ borderRadius: 6, marginBottom: 2, fontSize: 13, fontFamily: '"KaiTi","楷体",serif', border: `1px solid ${ZONE_COLORS.target}30`, color: ZONE_COLORS.target, background: `${ZONE_COLORS.target}08` }}>{ch}</Tag>
                  ))}
                </div>
              )}
              {article.char_stats.lost.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: ZONE_COLORS.lost, fontWeight: 500 }}>需复习：</span>
                  {article.char_stats.lost.map((ch) => (
                    <Tag key={ch} style={{ borderRadius: 6, marginBottom: 2, fontSize: 13, fontFamily: '"KaiTi","楷体",serif', border: `1px solid ${ZONE_COLORS.lost}30`, color: ZONE_COLORS.lost, background: `${ZONE_COLORS.lost}08` }}>{ch}</Tag>
                  ))}
                </div>
              )}
            </div>
          </Card>
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
