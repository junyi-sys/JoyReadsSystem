import { useEffect, useState } from 'react'
import { Card, Button, Spin, Empty, Modal, Input, message, Tag, Select, Slider, Switch, Collapse } from 'antd'
import { PlusOutlined, BulbOutlined, SettingOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { articlesApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import type { ArticleWithPinyin, ArticleParams } from '../types'
import ArticleReader from '../components/reader/ArticleReader'
import { pageTransition, fadeInUp } from '../theme/animations'

const ARTICLE_LENGTHS = [30, 50, 80, 100, 150, 200, 300, 500, 800, 1200] as const

export default function HomePage() {
  const currentStudent = useStudentStore((s) => s.currentStudent)
  const [article, setArticle] = useState<ArticleWithPinyin | null>(null)
  const [loading, setLoading] = useState(true)
  const [genOpen, setGenOpen] = useState(false)
  const [topic, setTopic] = useState('')
  const [summary, setSummary] = useState('')
  const [characters, setCharacters] = useState('')
  const [generating, setGenerating] = useState(false)
  const [isRead, setIsRead] = useState(false)

  // Advanced params
  const [articleLength, setArticleLength] = useState(200)
  const [parentMode, setParentMode] = useState(false)
  const [densityOverride, setDensityOverride] = useState(false)
  const [overrideDensity, setOverrideDensity] = useState(7)
  const [overrideReinforce, setOverrideReinforce] = useState(2)
  const [overrideMinChars, setOverrideMinChars] = useState(300)
  const [articleParams, setArticleParams] = useState<ArticleParams | null>(null)
  const [paramsLoading, setParamsLoading] = useState(false)

  useEffect(() => { setIsRead(false) }, [article])

  const handleReadComplete = async () => {
    if (!article) return
    const total = article.character_count
    const { data } = await articlesApi.updateReadStatus(article.id, {
      status: 'read',
      read_count: total,
      total_count: total,
    })
    setIsRead(true)
    return data
  }

  const loadToday = async () => {
    setLoading(true)
    try {
      const { data } = await articlesApi.today()
      setArticle(data || null)
    } catch { message.error('加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadToday() }, [currentStudent])

  const openGenerateModal = async () => {
    setGenOpen(true)
    setParentMode(false)
    setDensityOverride(false)
    // Fetch recommended params
    setParamsLoading(true)
    try {
      const { data } = await articlesApi.computeParams()
      setArticleParams(data)
      const cur = data.current
      setArticleLength(cur.max_chars)
      setOverrideDensity(cur.density)
      setOverrideReinforce(cur.reinforce)
      setOverrideMinChars(cur.min_chars)
    } catch { /* use defaults */ }
    finally { setParamsLoading(false) }
  }

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    try {
      const charList = characters.trim() ? characters.trim().split(/[,，、\s]+/) : []
      const min = densityOverride ? overrideMinChars : articleLength
      const max = densityOverride ? overrideMinChars + Math.max(150, overrideMinChars / 2) : articleLength <= 80 ? articleLength + 50 : articleLength + 200
      const { data } = await articlesApi.generate({
        topic: topic.trim(),
        summary: summary.trim(),
        characters: charList,
        category: 'daily',
        min_chars: min,
        max_chars: Math.round(max),
        density: densityOverride ? overrideDensity : undefined,
        reinforce: densityOverride ? overrideReinforce : undefined,
      })
      setArticle(data)
      setGenOpen(false)
      setTopic('')
      setSummary('')
      setCharacters('')
      message.success('文章生成成功!')
    } catch (err: any) { message.error(err?.message || '生成失败') }
    finally { setGenerating(false) }
  }

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      <motion.div variants={fadeInUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>
          今日文章
          {currentStudent && (
            <Tag color="orange" style={{ marginLeft: 12, borderRadius: 10, fontSize: 14, verticalAlign: 'middle' }}>
              {currentStudent.name}
            </Tag>
          )}
        </h1>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openGenerateModal}
          style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(255,107,107,0.25)', fontWeight: 600 }}>
          生成文章
        </Button>
      </motion.div>

      {article ? (
        <Card style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(255,107,107,0.12)', border: 'none' }}
          title={<span style={{ fontSize: 18, fontFamily: '"ZCOOL KuaiLe",cursive' }}>{article.topic}</span>}>
          <ArticleReader article={article} isRead={isRead} onReadComplete={handleReadComplete} />
        </Card>
      ) : (
        <motion.div variants={fadeInUp}>
          <Card style={{ borderRadius: 16, textAlign: 'center', padding: '60px 0' }}>
            <Empty
              description={<span style={{ fontSize: 16, color: '#888' }}>今天还没有文章哦~ 点击"生成文章"开始吧！</span>}
              image={<BulbOutlined style={{ fontSize: 64, color: '#FFE66D' }} />}
            >
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openGenerateModal}
                style={{ borderRadius: 16, marginTop: 8 }}>
                生成今日文章
              </Button>
            </Empty>
          </Card>
        </motion.div>
      )}

      <Modal title="AI 生成文章" open={genOpen} onCancel={() => { setGenOpen(false); setTopic(''); setSummary(''); setCharacters('') }} onOk={handleGenerate}
        confirmLoading={generating} okText="开始生成" cancelText="取消" width={560}
        okButtonProps={{ style: { borderRadius: 16 } }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>文章主题 <span style={{ color: '#ff4d4f' }}>*</span></div>
          <Input
            placeholder="例如：春天来了"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ borderRadius: 12 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>生字（选填）</div>
          <Input
            placeholder="输入生字，用逗号或空格分隔，例如：花,草,风"
            value={characters}
            onChange={(e) => setCharacters(e.target.value)}
            style={{ borderRadius: 12 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>文章字数</div>
          <Select
            value={articleLength}
            onChange={setArticleLength}
            style={{ width: '100%' }}
            options={ARTICLE_LENGTHS.map((n) => ({ value: n, label: `${n} 字` }))}
          />
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 4, fontWeight: 500 }}>主题摘要（选填）</div>
          <Input.TextArea
            placeholder="描述文章要包含的内容"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            style={{ borderRadius: 12 }}
          />
        </div>

        <Collapse
          ghost
          items={[{
            key: 'advanced',
            label: <span><SettingOutlined style={{ marginRight: 6 }} />家长模式（高级设置）</span>,
            children: (
              <div style={{ padding: '8px 0' }}>
                {articleParams && (
                  <div style={{
                    background: '#f6ffed', borderRadius: 12, padding: '12px 16px',
                    marginBottom: 16, border: '1px solid #b7eb8f',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 8, color: '#52c41a' }}>
                      系统推荐参数（已知 {articleParams.zone_stats.known_count} 字，第 {articleParams.tier_index + 1}/{articleParams.total_tiers} 档）
                    </div>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: '22px' }}>
                      文章字数：{articleParams.recommended.min_chars}-{articleParams.recommended.max_chars} 字 &nbsp;|&nbsp;
                      生字密度：{articleParams.recommended.density} 个/百字 &nbsp;|&nbsp;
                      复习密度：{articleParams.recommended.reinforce} 个/百字
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      字库分布：target {articleParams.zone_stats.target_count} · scout {articleParams.zone_stats.scout_count} · ally {articleParams.zone_stats.ally_count} · lost {articleParams.zone_stats.lost_count}
                    </div>
                    {articleParams.today_new_chars.length > 0 && (
                      <div style={{ fontSize: 12, color: '#fa8c16', marginTop: 4 }}>
                        今日新字：{articleParams.today_new_chars.join(' ')}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontWeight: 500 }}>自定义覆盖参数</span>
                  <Switch checked={densityOverride} onChange={setDensityOverride} />
                </div>

                {densityOverride && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>生字密度（每百字新字数）</span>
                        <Tag color="blue">{overrideDensity} 个/百字</Tag>
                      </div>
                      <Slider
                        min={1} max={20} step={1}
                        value={overrideDensity}
                        onChange={setOverrideDensity}
                        marks={{ 1: '轻松', 7: '标准', 12: '挑战', 20: '极限' }}
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>战损复习密度（每百字复习字数）</span>
                        <Tag color="orange">{overrideReinforce} 个/百字</Tag>
                      </div>
                      <Slider
                        min={0} max={5} step={1}
                        value={overrideReinforce}
                        onChange={setOverrideReinforce}
                        marks={{ 0: '无', 1: '少量', 3: '适度', 5: '大量' }}
                      />
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>文章最短字数</span>
                        <Tag color="green">{overrideMinChars} 字</Tag>
                      </div>
                      <Slider
                        min={50} max={1200} step={50}
                        value={overrideMinChars}
                        onChange={setOverrideMinChars}
                        marks={{ 50: '50', 300: '300', 600: '600', 1200: '1200' }}
                      />
                    </div>
                  </>
                )}

                {!densityOverride && (
                  <div style={{ fontSize: 13, color: '#888' }}>
                    开启后将使用滑块精确控制文章的生字密度和复习比例。
                  </div>
                )}
              </div>
            ),
          }]}
        />
      </Modal>
    </motion.div>
  )
}
