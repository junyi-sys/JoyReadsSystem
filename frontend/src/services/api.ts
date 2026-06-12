import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
})

api.interceptors.request.use((config) => {
  const studentId = localStorage.getItem('currentStudentId') || '1'
  config.headers['X-Student-ID'] = studentId
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err?.response?.data?.detail || err?.message || '请求失败'
    return Promise.reject(new Error(msg))
  }
)

export default api

// ===== Articles =====
export const articlesApi = {
  today: () => api.get('/articles/today'),
  history: (limit = 50, offset = 0) => api.get('/articles/history', { params: { limit, offset } }),
  generate: (body: { topic: string; summary?: string; characters?: string[]; min_chars?: number; max_chars?: number; category?: string; density?: number; reinforce?: number }) =>
    api.post('/articles/generate', body),
  computeParams: (override?: Record<string, number>) =>
    api.post('/articles/compute-params', { override: override || {} }),
  get: (id: number) => api.get(`/articles/${id}`),
  revise: (id: number, suggestions: string) => api.post(`/articles/${id}/revise`, { suggestions }),
  delete: (id: number) => api.delete(`/articles/${id}`),
  updateReadStatus: (id: number, body: { status: string; read_count: number; total_count: number }) =>
    api.post(`/articles/${id}/read-status`, body),
  getSeries: (seriesId: number) => api.get(`/articles/series/${seriesId}`),
  getSeriesChapter: (seriesId: number, chapterNum: number) =>
    api.get(`/articles/series/${seriesId}/chapters/${chapterNum}`),
}

// ===== Curiosity =====
export const curiosityApi = {
  events: () => api.get('/curiosity/events'),
  ask: (text: string, mode: string = 'one_shot', tags?: string[]) =>
    api.post('/curiosity/ask', { raw_text: text, mode, tags }),
  askSeries: (text: string) => api.post('/curiosity/ask-series', { raw_text: text }),
  seriesNext: (eventId: number, wantNext: boolean, userQuestion?: string) =>
    api.post('/curiosity/series-next', { event_id: eventId, want_next: wantNext, user_question: userQuestion }),
  askSocratic: (text: string) => api.post('/curiosity/ask-socratic', { raw_text: text }),
  submitSocraticAnswer: (eventId: number, childResponse: string) =>
    api.post('/curiosity/socratic-answer', { event_id: eventId, child_response: childResponse }),
}

// ===== Characters =====
export const charactersApi = {
  stats: () => api.get('/characters/stats'),
  zone: (zone: string) => api.get(`/characters/zone/${zone}`),
  add: (characters: string, zone: string) => api.post('/characters/add', { characters, zone }),
  move: (character: string, fromZone: string, toZone: string) =>
    api.post('/characters/move', { character, from_zone: fromZone, to_zone: toZone }),
  reportInteraction: (character: string, articleId?: number) =>
    api.post('/characters/interaction', { character, article_id: articleId || null }),
}

// ===== TTS =====
export const ttsApi = {
  synthesize: (text: string, speed?: number) =>
    api.post('/tts/synthesize', { text, speed }, { responseType: 'blob' }),
}

// ===== Stats =====
export const statsApi = {
  overview: () => api.get('/stats/overview'),
  trend: (days?: number) => api.get('/stats/trend', { params: { days } }),
}

// ===== STT (Speech to Text) =====
export const sttApi = {
  transcribe: (audioBlob: Blob, ext: string = 'webm') => {
    const fd = new FormData()
    fd.append('file', audioBlob, `recording.${ext}`)
    return api.post('/stt/transcribe', fd)
  },
}

// ===== Students =====
export const studentsApi = {
  list: () => api.get('/students/'),
  switch: (id: number) => api.post(`/students/switch/${id}`),
  levelProgress: (studentId: number) => api.get(`/students/${studentId}/level-progress`),
}
