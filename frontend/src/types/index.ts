export interface Student {
  id: number
  name: string
  age: number
  cognition_level: number
  avatar_url: string | null
  is_active: boolean
}

export interface PinyinToken {
  char: string
  pinyin: string
}

export interface Paragraph {
  text: string
  tokens: PinyinToken[]
}

export interface ArticleWithPinyin {
  id: number
  record_date: string
  topic: string
  content: string
  character_count: number
  source: string
  category: string
  image_url: string | null
  images: { url: string; caption: string }[]
  paragraphs: Paragraph[]
  series_id?: number
  chapter_number?: number
  total_chapters?: number
  created_at?: string
}

export interface SeriesInfo {
  id: number
  topic: string
  status: 'in_progress' | 'completed' | 'abandoned'
  total_chapters: number
  current_chapter: number
  chapter_titles: ChapterTitle[]
  chapters: ChapterItem[]
  curiosity_event_id: number
}

export interface ChapterTitle {
  ch: number
  title: string
  summary: string
}

export interface ChapterItem {
  id: number
  chapter_number: number
  title: string
  character_count: number
  read_status: 'unread' | 'reading' | 'read'
}

export interface CuriosityEvent {
  id: number
  student_id: number
  raw_text: string
  tags_json: string[] | null
  mode: 'one_shot' | 'series'
  is_answered: boolean
  linked_article_id: number | null
  intensity_score: number
  created_at: string
}

export interface ZoneStats {
  target: number
  scout: number
  ally: number
  lost: number
  total: number
}

export interface CharacterItem {
  id: number
  character: string
  pinyin?: string
  tap_count?: number
  appeared_in_articles?: number
  source?: string
}

export interface StatsOverview {
  total_characters_learned: number
  total_articles_read: number
  current_streak: number
  weekly_articles: number
  zone_distribution: ZoneStats
  recent_activity: { date: string; count: number }[]
}

export const COGNITION_LABELS: Record<number, string> = {
  0: '学前',
  1: '一年级',
  2: '二年级',
  3: '三年级',
  4: '四年级',
  5: '五年级',
  6: '六年级',
}

export const COGNITION_SHORT_LABELS: Record<number, string> = {
  0: 'L0',
  1: 'L1',
  2: 'L2',
  3: 'L3',
  4: 'L4',
  5: 'L5',
  6: 'L6',
}

export interface LevelProgress {
  current_level: number
  current_label: string
  next_level: number | null
  next_label: string | null
  articles_read: number
  articles_needed: number
  ally_chars: number
  chars_needed: number
  can_level_up: boolean
}
