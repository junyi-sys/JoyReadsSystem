import { useEffect, useState } from 'react'
import { Card, Col, Row, Spin, Statistic, Progress, Typography } from 'antd'
import { ReadOutlined, TrophyOutlined, FireOutlined, BookOutlined } from '@ant-design/icons'
import { motion } from 'framer-motion'
import { statsApi } from '../services/api'
import type { StatsOverview } from '../types'
import { colors } from '../theme/tokens'
import { pageTransition, fadeInUp, staggerContainer } from '../theme/animations'

export default function StatsPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    statsApi.overview()
      .then(({ data }) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !stats) return <Spin spinning style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />

  const zoneTotal = stats.zone_distribution.total || 1

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible"
      style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontFamily: '"ZCOOL KuaiLe",cursive', marginBottom: 24 }}>学习统计</h1>

      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
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
