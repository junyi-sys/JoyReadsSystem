import { useEffect, useState } from 'react'
import { Card, Button, Spin, Empty, Modal, Input, message, Tag, Select, Slider, Switch, Collapse, List, Tooltip } from 'antd'
import { PlusOutlined, BulbOutlined, SettingOutlined, QuestionCircleOutlined, BookOutlined, SoundOutlined, RightOutlined, FireOutlined, StarOutlined, ExperimentOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { articlesApi, curiosityApi, theoryApi, conceptsApi } from '../services/api'
import { useStudentStore } from '../store/useStudentStore'
import type { ArticleWithPinyin, ArticleParams, CuriosityEvent, Theory, AdvancedConcept } from '../types'
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

  // Curiosity & Theory data
  const [events, setEvents] = useState<CuriosityEvent[]>([])
  const [theories, setTheories] = useState<Theory[]>([])
  const [concepts, setConcepts] = useState<AdvancedConcept[]>([])
  const [conceptInput, setConceptInput] = useState('')
  const [addingConcept, setAddingConcept] = useState(false)

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

  const loadData = async () => {
    setLoading(true)
    try {
      const [todayRes, eventsRes, theoriesRes, conceptsRes] = await Promise.allSettled([
        articlesApi.today(),
        curiosityApi.events(),
        theoryApi.list(5, 0),
        conceptsApi.list(),
      ])
      if (todayRes.status === 'fulfilled') setArticle(todayRes.value.data || null)
      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.data || [])
      if (theoriesRes.status === 'fulfilled') setTheories(theoriesRes.value.data?.items || [])
      if (conceptsRes.status === 'fulfilled') setConcepts(conceptsRes.value.data || [])
    } catch { message.error('加载失败') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [currentStudent])

  const handleReadComplete = async () => {
    if (!article) return
    const total = article.character_count
    await articlesApi.updateReadStatus(article.id, {
      status: 'read',
      read_count: total,
      total_count: total,
    })
    setIsRead(true)
    loadData() // refresh data after reading
  }

  const openGenerateModal = async () => {
    setGenOpen(true)
    setParentMode(false)
    setDensityOverride(false)
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

  const handleAddConcept = async () => {
    if (!conceptInput.trim()) return
    setAddingConcept(true)
    try {
      await conceptsApi.add(conceptInput.trim())
      setConceptInput('')
      message.success(`已记录高级概念：${conceptInput.trim()}`)
      loadData()
    } catch (err: any) { message.error(err?.message || '添加失败') }
    finally { setAddingConcept(false) }
  }

  const handleRemoveConcept = async (id: number) => {
    try {
      await conceptsApi.remove(id)
      message.success('已移除')
      loadData()
    } catch { message.error('移除失败') }
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

  const unansweredCount = events.filter(e => !e.is_answered).length

  if (loading) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <motion.div variants={fadeInUp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>
          俊宜的思想飞船
          {currentStudent && (
            <Tag color="orange" style={{ marginLeft: 12, borderRadius: 10, fontSize: 14, verticalAlign: 'middle' }}>
              {currentStudent.name}
            </Tag>
          )}
        </h1>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openGenerateModal}
          style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(109,191,110,0.25)', fontWeight: 600 }}>
          生成文章
        </Button>
      </motion.div>

      {/* Today's Article (if exists) */}
      {article && (
        <motion.div variants={fadeInUp} style={{ marginBottom: 24 }}>
          <Card style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(109,191,110,0.12)', border: 'none' }}
            title={<span style={{ fontSize: 18, fontFamily: '"ZCOOL KuaiLe",cursive' }}>{article.topic}</span>}>
            <ArticleReader article={article} isRead={isRead} onReadComplete={handleReadComplete} />
          </Card>
        </motion.div>
      )}

      {/* Three Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Card 1: 我的好奇清单 */}
        <motion.div variants={fadeInUp}>
          <Card
            style={{ borderRadius: 16, height: '100%', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            title={
              <span style={{ fontSize: 16 }}>
                <QuestionCircleOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
                我的好奇清单
                {unansweredCount > 0 && (
                  <Tag color="orange" style={{ marginLeft: 8, borderRadius: 10 }}>{unansweredCount} 待探索</Tag>
                )}
              </span>
            }
            extra={<a href="/curiosity" style={{ fontSize: 13 }}>去提问 <RightOutlined /></a>}
          >
            {events.length === 0 ? (
              <Empty
                image={<BulbOutlined style={{ fontSize: 40, color: '#FFE66D' }} />}
                description={<span style={{ fontSize: 13, color: '#999' }}>还没有问题。去好奇心页提问吧！</span>}
              />
            ) : (
              <List
                size="small"
                dataSource={events.slice(0, 5)}
                renderItem={(e) => (
                  <List.Item style={{ border: 'none', padding: '6px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                      <span style={{ fontSize: 14, marginTop: 2 }}>
                        {e.socratic_mode ? '🤔' : e.is_answered ? '💡' : '⏳'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.raw_text}
                        </div>
                        {e.socratic_mode && e.follow_up_question && !e.child_response && (
                          <div style={{ fontSize: 12, color: '#fa8c16', marginTop: 2 }}>
                            AI反问: {e.follow_up_question.length > 50 ? e.follow_up_question.slice(0, 50) + '...' : e.follow_up_question}
                          </div>
                        )}
                        {e.child_response && (
                          <div style={{ fontSize: 12, color: '#52c41a', marginTop: 2 }}>
                            你的想法: {e.child_response.length > 40 ? e.child_response.slice(0, 40) + '...' : e.child_response}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                          {e.created_at ? new Date(e.created_at).toLocaleDateString('zh-CN') : ''}
                          {e.socratic_mode && !e.child_response && (
                            <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>等你回答</Tag>
                          )}
                          {e.mode === 'series' && (
                            <Tag color="purple" style={{ marginLeft: 6, fontSize: 10 }}>系列</Tag>
                          )}
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </motion.div>

        {/* Card 2: 我的理论库 */}
        <motion.div variants={fadeInUp}>
          <Card
            style={{ borderRadius: 16, height: '100%', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            title={
              <span style={{ fontSize: 16 }}>
                <ExperimentOutlined style={{ color: '#722ed1', marginRight: 8 }} />
                我的理论库
                {theories.length > 0 && (
                  <Tag color="purple" style={{ marginLeft: 8, borderRadius: 10 }}>{theories.length} 个想法</Tag>
                )}
              </span>
            }
          >
            {theories.length === 0 ? (
              <Empty
                image={<StarOutlined style={{ fontSize: 40, color: '#D3ADF7' }} />}
                description={<span style={{ fontSize: 13, color: '#999' }}>
                  记录你的想法，这里会变成你的思想宝库
                </span>}
              />
            ) : (
              <List
                size="small"
                dataSource={theories}
                renderItem={(t) => (
                  <List.Item style={{ border: 'none', padding: '6px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                      <span style={{ fontSize: 16, marginTop: 2 }}>🧠</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2, lineHeight: '18px' }}>
                          {t.content.length > 60 ? t.content.slice(0, 60) + '...' : t.content}
                        </div>
                        {t.audio_url && (
                          <Tag icon={<SoundOutlined />} color="green" style={{ fontSize: 10, marginTop: 4 }}>有录音</Tag>
                        )}
                        <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                          {t.created_at ? new Date(t.created_at).toLocaleDateString('zh-CN') : ''}
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </motion.div>

        {/* Card 3: 阅读地图 */}
        <motion.div variants={fadeInUp}>
          <Card
            style={{ borderRadius: 16, height: '100%', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            title={
              <span style={{ fontSize: 16 }}>
                <BookOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                阅读地图
              </span>
            }
            extra={<a href="/stats" style={{ fontSize: 13 }}>详细统计 <RightOutlined /></a>}
          >
            <div style={{ padding: '8px 0' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
                <div style={{
                  flex: 1, textAlign: 'center', background: '#f0f7f4',
                  borderRadius: 12, padding: '12px 8px',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#6DBF6E' }}>
                    {events.filter(e => e.is_answered).length}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>已回答</div>
                </div>
                <div style={{
                  flex: 1, textAlign: 'center', background: '#fff7e6',
                  borderRadius: 12, padding: '12px 8px',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#fa8c16' }}>
                    {theories.length}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>我的理论</div>
                </div>
                <div style={{
                  flex: 1, textAlign: 'center', background: '#e6f7ff',
                  borderRadius: 12, padding: '12px 8px',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#1890ff' }}>
                    {events.length}
                  </div>
                  <div style={{ fontSize: 12, color: '#888' }}>总提问</div>
                </div>
              </div>

              <div style={{ fontSize: 13, color: '#666', lineHeight: '22px' }}>
                {events.length === 0 ? (
                  '你的探索之旅即将开始。去好奇心页问第一个问题吧！'
                ) : theories.length === 0 ? (
                  '你有好奇心！下次试试苏格拉底模式——AI会反问问题，引导你形成自己的理论。'
                ) : (
                  <>
                    你已经形成了 <strong style={{ color: '#722ed1' }}>{theories.length}</strong> 个自己的想法，
                    探索了 <strong style={{ color: '#6DBF6E' }}>{events.filter(e => e.is_answered).length}</strong> 个问题。
                    继续提问，继续思考！
                  </>
                )}
              </div>

              {/* Concepts section */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>
                  <ThunderboltOutlined style={{ marginRight: 4 }} />
                  已掌握的高级概念
                </div>
                {concepts.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#ccc' }}>
                    暂无。当孩子展现出超出认知水平的概念时（如"引力塌缩"），在这里记录。
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {concepts.map((c) => (
                      <Tag key={c.id} color="red" closable onClose={() => handleRemoveConcept(c.id)}
                        style={{ borderRadius: 10, fontSize: 12 }}>
                        {c.concept}
                      </Tag>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <Input
                    size="small"
                    placeholder="例如：引力塌缩、事件视界..."
                    value={conceptInput}
                    onChange={(e) => setConceptInput(e.target.value)}
                    onPressEnter={handleAddConcept}
                    style={{ borderRadius: 10, fontSize: 12 }}
                  />
                  <Button size="small" type="primary" icon={<ThunderboltOutlined />}
                    loading={addingConcept} onClick={handleAddConcept}
                    style={{ borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap' }}>
                    升级
                  </Button>
                </div>
              </div>

              {theories.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: '#bbb', marginBottom: 8 }}>最近的活动</div>
                  {theories.slice(0, 3).map((t) => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 0', fontSize: 12, color: '#666',
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#722ed1', flexShrink: 0,
                      }} />
                      创建了理论「{t.title.length > 15 ? t.title.slice(0, 15) + '...' : t.title}」
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Generate Article Modal */}
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
                      <Slider min={1} max={20} step={1} value={overrideDensity} onChange={setOverrideDensity}
                        marks={{ 1: '轻松', 7: '标准', 12: '挑战', 20: '极限' }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>战损复习密度（每百字复习字数）</span>
                        <Tag color="orange">{overrideReinforce} 个/百字</Tag>
                      </div>
                      <Slider min={0} max={5} step={1} value={overrideReinforce} onChange={setOverrideReinforce}
                        marks={{ 0: '无', 1: '少量', 3: '适度', 5: '大量' }} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>文章最短字数</span>
                        <Tag color="green">{overrideMinChars} 字</Tag>
                      </div>
                      <Slider min={50} max={1200} step={50} value={overrideMinChars} onChange={setOverrideMinChars}
                        marks={{ 50: '50', 300: '300', 600: '600', 1200: '1200' }} />
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
