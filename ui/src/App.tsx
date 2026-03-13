import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { AuthGuard } from './components/AuthGuard'
import { RoleGuard } from './components/RoleGuard'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { LoginPage } from './pages/LoginPage'
import { ModerationPanel } from './pages/ModerationPanel'
import { RoleManagement } from './pages/RoleManagement'
import { UserManagement } from './pages/UserManagement'

function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container">
      <div className="shell">
        <div className="sidebar">
          <Sidebar />
        </div>
        <div className="main">{children}</div>
      </div>
    </div>
  )
}

function App() {
  return (
    <div>
      <Navbar />

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AuthGuard />}>
          <Route
            path="/dashboard"
            element={
              <AuthedLayout>
                <Dashboard />
              </AuthedLayout>
            }
          />

          <Route element={<RoleGuard requiredPermissions={['MANAGE_USERS']} />}>
            <Route
              path="/user-management"
              element={
                <AuthedLayout>
                  <UserManagement />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['MODERATE_CONTENT']} />}>
            <Route
              path="/moderation"
              element={
                <AuthedLayout>
                  <ModerationPanel />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['MANAGE_ROLES']} />}>
            <Route
              path="/role-management"
              element={
                <AuthedLayout>
                  <RoleManagement />
                </AuthedLayout>
              }
            />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  )
}

export default App
