import { Routes, Route } from 'react-router-dom'
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<div style={{ padding: 40, textAlign: 'center', fontFamily: '"ZCOOL KuaiLe",cursive', fontSize: 24 }}>俊宜识字 v2 🚀</div>} />
    </Routes>
  )
}
