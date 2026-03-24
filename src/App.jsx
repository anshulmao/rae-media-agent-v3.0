import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { CreatorPage } from './pages/CreatorPage'
import { KnowledgeBasePage } from './pages/KnowledgeBasePage'
import { AdminControlPanel } from './pages/AdminControlPanel'
import { AppProvider } from './context/AppContext'
import { AgentSelector } from './pages/AgentSelector'
import { FeedPage } from './pages/FeedPage'
import { QAPage } from './pages/QAPage'

const SIDEBAR_WIDTH = 64

function App() {
  return (
    <AppProvider>
      <Router>
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
          <Sidebar />

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            marginLeft: `${SIDEBAR_WIDTH}px`,
            minWidth: 0,
          }}>
            <Header />
            <main style={{
              flex: 1,
              padding: '28px 28px 140px',
              overflowY: 'auto',
            }}>
              <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <Routes>
                  <Route path="/creator" element={<Navigate to="/creator/select" replace />} />
                  <Route path="/creator/select" element={<AgentSelector />} />
                  <Route path="/creator/generate" element={<CreatorPage />} />
                  <Route path="/creator/qa" element={<QAPage />} />
                  <Route path="/admin" element={<KnowledgeBasePage />} />
                  <Route path="/control-panel" element={<AdminControlPanel />} />
                  <Route path="/feed" element={<FeedPage />} />
                  <Route path="/" element={<Navigate to="/creator/select" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </Router>
    </AppProvider>
  )
}

export default App
