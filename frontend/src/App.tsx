import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import HomePage from './pages/HomePage'
import ArticleHistoryPage from './pages/ArticleHistoryPage'
import CuriosityPage from './pages/CuriosityPage'
import SeriesReaderPage from './pages/SeriesReaderPage'
import CharacterZonesPage from './pages/CharacterZonesPage'
import StatsPage from './pages/StatsPage'
import ReadingBuddy from './components/game/ReadingBuddy'

export default function App() {
  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/articles" element={<ArticleHistoryPage />} />
          <Route path="/curiosity" element={<CuriosityPage />} />
          <Route path="/characters" element={<CharacterZonesPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        <Route path="/series/:seriesId" element={<SeriesReaderPage />} />
      </Routes>
      <ReadingBuddy />
    </>
  )
}
