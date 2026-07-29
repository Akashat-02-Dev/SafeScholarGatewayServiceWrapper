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
import { SocraticTutorPage } from './pages/SocraticTutorPage'
import LessonPlanner from './pages/ai/LessonPlanner'
import TextLeveler from './pages/ai/TextLeveler'
import VideoAssessor from './pages/ai/VideoAssessor'
import IepGenerator from './pages/ai/IepGenerator'
import { RAGIngestionPanel } from './pages/admin/RAGIngestionPanel'
import { InstitutionAdminDashboard } from './pages/admin/InstitutionAdminDashboard'
import { SuperAdminDashboard } from './pages/superadmin/SuperAdminDashboard'

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

          <Route element={<RoleGuard requiredPermissions={['EXECUTE_AI_TUTOR']} />}>
            <Route
              path="/socratic-tutor"
              element={
                <AuthedLayout>
                  <SocraticTutorPage sessionId="student-sandbox-session-101" />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['GENERATE_LESSON_PLAN']} />}>
            <Route
              path="/ai/lesson-planner"
              element={
                <AuthedLayout>
                  <LessonPlanner />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['USE_TEXT_LEVELER']} />}>
            <Route
              path="/ai/leveler"
              element={
                <AuthedLayout>
                  <TextLeveler />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['USE_VIDEO_ASSESSOR']} />}>
            <Route
              path="/ai/video-assessor"
              element={
                <AuthedLayout>
                  <VideoAssessor />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['GENERATE_IEP_RUBRIC']} />}>
            <Route
              path="/ai/iep-generator"
              element={
                <AuthedLayout>
                  <IepGenerator />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['MANAGE_GLOBAL_TENANTS']} />}>
            <Route
              path="/superadmin/dashboard"
              element={
                <AuthedLayout>
                  <SuperAdminDashboard />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['MANAGE_LOCAL_ROLES']} />}>
            <Route
              path="/admin/dashboard"
              element={
                <AuthedLayout>
                  <InstitutionAdminDashboard />
                </AuthedLayout>
              }
            />
          </Route>

          <Route element={<RoleGuard requiredPermissions={['MANAGE_DISTRICT_AI_KNOWLEDGE']} />}>
            <Route
              path="/rag-ingestion"
              element={
                <AuthedLayout>
                  <RAGIngestionPanel />
                </AuthedLayout>
              }
            />
          </Route>

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
