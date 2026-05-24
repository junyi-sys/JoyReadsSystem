import { create } from 'zustand'
import type { Student } from '../types'
import { studentsApi } from '../services/api'

interface StudentState {
  currentStudent: Student | null
  students: Student[]
  loading: boolean
  loadStudents: () => Promise<void>
  switchStudent: (id: number) => void
}

export const useStudentStore = create<StudentState>((set, get) => ({
  currentStudent: null,
  students: [],
  loading: false,

  loadStudents: async () => {
    set({ loading: true })
    try {
      const { data } = await studentsApi.list()
      set({ students: data, loading: false })
      const currentId = Number(localStorage.getItem('currentStudentId') || '1')
      const matched = data.find((s: Student) => s.id === currentId)
      const current = matched || data[0] || null
      if (current) {
        if (!matched) localStorage.setItem('currentStudentId', String(current.id))
        set({ currentStudent: current })
      }
    } catch {
      set({ loading: false })
    }
  },

  switchStudent: (id: number) => {
    localStorage.setItem('currentStudentId', String(id))
    const student = get().students.find((s) => s.id === id) || null
    set({ currentStudent: student })
  },
}))
