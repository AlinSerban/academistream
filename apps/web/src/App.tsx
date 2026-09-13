import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { SyncBrowserRouter } from './components/SyncBrowserRouter'
import { LoginPage } from './features/auth/LoginPage'
import { MePage } from './features/auth/MePage'
import { RequireAuth } from './features/auth/RequireAuth'
import { SessionBootstrap } from './features/auth/SessionBootstrap'
import { LibraryPage } from './features/content/LibraryPage'
import { TrainingPage } from './features/training/TrainingPage'
import { AcceptInvitePage } from './features/org/AcceptInvitePage'
import { OrgPage } from './features/org/OrgPage'
import { NotificationsPage } from './features/notifications/NotificationsPage'

export default function App() {
  return (
    <SyncBrowserRouter>
      <SessionBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<LibraryPage />} />
            <Route path="/training" element={<TrainingPage />} />
            <Route path="/org" element={<OrgPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/me" element={<MePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionBootstrap>
    </SyncBrowserRouter>
  )
}
