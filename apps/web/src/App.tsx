import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { MePage } from './features/auth/MePage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SessionBootstrap } from './features/auth/SessionBootstrap'

export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <MePage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionBootstrap>
    </BrowserRouter>
  )
}
