import { Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ArticleHistoryPage from './pages/ArticleHistoryPage'
import CharacterZonesPage from './pages/CharacterZonesPage'
import CuriosityPage from './pages/CuriosityPage'
import SeriesReaderPage from './pages/SeriesReaderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/articles" element={<ArticleHistoryPage />} />
      <Route path="/characters" element={<CharacterZonesPage />} />
      <Route path="/curiosity" element={<CuriosityPage />} />
      <Route path="/series/:seriesId" element={<SeriesReaderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
