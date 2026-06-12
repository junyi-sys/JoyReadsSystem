import { useEffect, useState } from 'react'
import { Card, Col, Row, Spin, Statistic, Progress, Typography } from 'antd'
import { ReadOutlined, TrophyOutlined, FireOutlined, BookOutlined, RiseOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { statsApi, studentsApi } from '../services/api'
import type { StatsOverview, LevelProgress } from '../types'
import { COGNITION_LABELS } from '../types'
import { colors } from '../theme/tokens'
import { pageTransition, fadeInUp, staggerContainer } from '../theme/animations'
import { useStudentStore } from '../store/useStudentStore'

export default function StatsPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null)
  const [levelProgress, setLevelProgress] = useState<LevelProgress | null>(null)
  // TODO: category stats — needs backend /api/stats/categories endpoint and CategoryStats type
  // const [categoryStats, setCategoryStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const currentStudent = useStudentStore((s) => s.currentStudent)

  useEffect(() => {
    setLoading(true)
    const studentId = currentStudent?.id || 1
    Promise.all([
      statsApi.overview().then(({ data }) => setStats(data)),
      studentsApi.levelProgress(studentId).then(({ data }) => setLevelProgress(data)),
      // statsApi.categories().then(({ data }) => setCategoryStats(data)),
    ]).catch(() => {}).finally(() => setLoading(false))
  }, [currentStudent])

  if (loading || !stats) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  const zoneTotal = stats.zone_distribution.total || 1

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible"
      style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontFamily: '"ZCOOL KuaiLe",cursive', marginBottom: 24 }}>学习统计</h1>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        {levelProgress && (
          <motion.div variants={fadeInUp} style={{ marginBottom: 24 }}>
            <Card
              style={{ borderRadius: 16, background: 'linear-gradient(135deg, #e8f5e9 0%, #e3f2fd 100%)' }}
              styles={{ body: { padding: '20px 24px' } }}
            >
              <Row align="middle" gutter={[16, 16]}>
                <Col xs={24} sm={6} style={{ textAlign: 'center' }}>
                  <RiseOutlined style={{ fontSize: 36, color: colors.primary }} />
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>当前等级</Typography.Text>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: '"ZCOOL KuaiLe",cursive', color: colors.primary }}>
                      {levelProgress.current_label}
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={14}>
                  {levelProgress.next_label ? (
                    <>
                      <Typography.Text style={{ fontSize: 13 }}>
                        距离升级到 <strong>{levelProgress.next_label}</strong>
                      </Typography.Text>
                      <Row gutter={[16, 4]} style={{ marginTop: 8 }}>
                        <Col span={12}>
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>阅读文章</Typography.Text>
                          <Progress
                            percent={Math.min(100, Math.round((levelProgress.articles_read / levelProgress.articles_needed) * 100))}
                            size="small"
                            strokeColor="#4ECDC4"
                            format={() => `${levelProgress.articles_read}/${levelProgress.articles_needed}`}
                          />
                        </Col>
                        <Col span={12}>
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>已掌握字</Typography.Text>
                          <Progress
                            percent={Math.min(100, Math.round((levelProgress.ally_chars / levelProgress.chars_needed) * 100))}
                            size="small"
                            strokeColor="#FF6B6B"
                            format={() => `${levelProgress.ally_chars}/${levelProgress.chars_needed}`}
                          />
                        </Col>
                      </Row>
                    </>
                  ) : (
                    <Typography.Text style={{ fontSize: 15, fontFamily: '"ZCOOL KuaiLe",cursive' }}>
                      已达到最高等级！
                    </Typography.Text>
                  )}
                </Col>
                <Col xs={24} sm={4} style={{ textAlign: 'center' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {levelProgress.can_level_up ? '满足升级条件！' : '继续加油'}
                  </Typography.Text>
                </Col>
              </Row>
            </Card>
          </motion.div>
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[
            { key: 'chars', title: '已学汉字', value: stats.total_characters_learned, icon: <ReadOutlined />, color: '#FF6B6B' },
            { key: 'articles', title: '已读文章', value: stats.total_articles_read, icon: <BookOutlined />, color: '#4ECDC4' },
            { key: 'streak', title: '连续天数', value: stats.current_streak, icon: <FireOutlined />, color: '#FF8E72' },
            { key: 'weekly', title: '本周文章', value: stats.weekly_articles, icon: <TrophyOutlined />, color: '#FFE66D' },
          ].map((item) => (
            <Col xs={12} sm={6} key={item.key}>
              <motion.div variants={fadeInUp}>
                <Card style={{ borderRadius: 16, textAlign: 'center', borderTop: `4px solid ${item.color}` }}>
                  <div style={{ fontSize: 28, color: item.color, marginBottom: 4 }}>{item.icon}</div>
                  <Statistic value={item.value} valueStyle={{ fontSize: 32, fontWeight: 700, fontFamily: '"ZCOOL KuaiLe",cursive' }} />
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>{item.title}</Typography.Text>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>

        <motion.div variants={fadeInUp}>
          <Card title={<span style={{ fontFamily: '"ZCOOL KuaiLe",cursive' }}>字库分布</span>}
            style={{ borderRadius: 16, marginBottom: 24 }}>
            <Row gutter={[16, 8]}>
              {[
                { zone: 'target', label: '目标区', key: 'target' as const, color: colors.zone.target },
                { zone: 'scout', label: '侦查区', key: 'scout' as const, color: colors.zone.scout },
                { zone: 'ally', label: '盟友区', key: 'ally' as const, color: colors.zone.ally },
                { zone: 'lost', label: '丢失区', key: 'lost' as const, color: colors.zone.lost },
              ].map((z) => (
                <Col span={24} key={z.zone}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Typography.Text style={{ width: 100, fontSize: 14 }}>{z.label}</Typography.Text>
                    <Progress
                      percent={Math.round((stats.zone_distribution[z.key] / zoneTotal) * 100)}
                      strokeColor={z.color}
                      style={{ flex: 1 }}
                    />
                    <Typography.Text strong style={{ width: 40, textAlign: 'right' }}>
                      {stats.zone_distribution[z.key]}
                    </Typography.Text>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </motion.div>

{/* TODO: category stats — blocked on backend /api/stats/categories endpoint */}

        <motion.div variants={fadeInUp} style={{ textAlign: 'center', padding: 40 }}>
          <Typography.Text type="secondary" style={{ fontSize: 16, fontFamily: '"ZCOOL KuaiLe",cursive' }}>
            {stats.current_streak >= 7 ? '太棒了！连续学习一周啦！' :
             stats.total_characters_learned >= 100 ? '你已经学会100个字了，真厉害！' :
             stats.total_characters_learned >= 50 ? '越来越棒了，继续加油！' :
             '每天进步一点点，加油！'}
          </Typography.Text>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
