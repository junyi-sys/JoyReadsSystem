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

export interface CharStats {
  total: number
  target: string[]
  scout: string[]
  ally: string[]
  lost: string[]
  unknown: string[]
  today_new: string[]
  zone_counts: {
    target: number
    scout: number
    ally: number
    lost: number
    unknown: number
    today_new: number
  }
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
  char_stats?: CharStats
}

export interface ArticleParams {
  recommended: { min_chars: number; max_chars: number; density: number; reinforce: number }
  current: { min_chars: number; max_chars: number; density: number; reinforce: number }
  zone_stats: { known_count: number; target_count: number; scout_count: number; ally_count: number; lost_count: number; total: number }
  today_new_chars: string[]
  tier_index: number
  total_tiers: number
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
  socratic_mode?: boolean
  follow_up_question?: string | null
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

export interface ReadingPlan {
  id: number; student_id: number; name: string
  start_date: string; end_date: string
  status: 'active' | 'completed' | 'paused'
  week_count: number; current_week: number
}

export interface PlanDay {
  id: number; plan_id: number; week_number: number; day_of_week: number
  topic_category: string; focus: string
  article_id: number | null; guide_text: string | null
  status: 'pending' | 'reading' | 'completed' | 'skipped'
}

export interface CuriositySeed {
  id: number; student_id: number; question_text: string
  source: 'curiosity_chat' | 'reading_summary' | 'manual'
  source_article_id: number | null
  status: 'pending' | 'growing' | 'converted' | 'skipped'
  converted_article_id: number | null; created_at: string
}

export interface KnowledgeNode {
  id: number; student_id: number; concept: string; depth: number
  first_exposed_at: string; updated_at: string
  source: 'curiosity' | 'reading' | 'theory' | 'manual'
  evidence: string | null
}

export interface ComprehensionRecord {
  id: number; student_id: number; article_id: number
  plan_day_id: number | null; focus: string
  question: string; correct_answer: string; child_answer: string
  is_correct: boolean; created_at: string
}

export interface FeatureFlags {
  student_id: number; socratic_enabled: boolean
  seed_auto_grow: boolean; ai_review_enabled: boolean
  reading_plan_enabled: boolean
}

export interface TheoryItem {
  id: number; title: string; content: string | null
  transcript: string | null; ai_summary: string | null
  ai_encouragement: string | null
  linked_curiosity_event_id: number | null
  linked_article_id: number | null
  has_audio: boolean; created_at: string
}

export interface RadarData {
  plot: number; character: number; detail: number
  association: number; imagination: number
}

export interface ParentStudentOverview {
  id: number; name: string; age: number; level: number
  articles_read: number; ally_chars: number
  last_activity: string | null; is_active: boolean
}

export interface ClueParagraph {
  text: string
  clue_prompt: string
  clue_hint: string
}

export interface SubQuestion {
  type: 'find_clue' | 'infer_cause' | 'connect_life'
  label: string
  question: string
  answer_hint: string
}

export interface LessonPlan {
  main_question: string
  pre_reading: {
    background: string
    hook: string
  }
  paragraphs: ClueParagraph[]
  sub_questions: SubQuestion[]
  extension: {
    back_to_main: string
    ai_feedback_hint: string
  }
}

export interface AnswerItem {
  question_type: string
  question: string
  child_answer: string
  is_correct: boolean
}

export interface StartDayResponse {
  day_id: number
  article_id: number
  guide_text: string
  lesson_json: LessonPlan | null
  status: string
}

export interface CompleteDayResponse {
  ok: boolean
  record_ids: number[]
  theory_id: number | null
}
