import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './features/auth/LoginPage'
import { MePage } from './features/auth/MePage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SessionBootstrap } from './features/auth/SessionBootstrap'
import { LibraryPage } from './features/content/LibraryPage'
import { TrainingPage } from './features/training/TrainingPage'
import { AcceptInvitePage } from './features/org/AcceptInvitePage'
import { OrgPage } from './features/org/OrgPage'

export default function App() {
  return (
    <BrowserRouter>
      <SessionBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <LibraryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/training"
            element={
              <RequireAuth>
                <TrainingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/org"
            element={
              <RequireAuth>
                <OrgPage />
              </RequireAuth>
            }
          />
          <Route
            path="/me"
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
