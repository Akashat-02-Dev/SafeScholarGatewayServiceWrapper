import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { AuthGuard } from './components/AuthGuard'
import { RoleGuard } from './components/RoleGuard'
import { Sidebar } from './components/Sidebar'
import { Footer } from './components/Footer'
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
import CustomBotStudio from './pages/educator/CustomBotStudio'
import StudentOversightDashboard from './pages/educator/StudentOversightDashboard'
import { RAGIngestionPanel } from './pages/admin/RAGIngestionPanel'
import { InstitutionAdminDashboard } from './pages/admin/InstitutionAdminDashboard'
import { SuperAdminDashboard } from './pages/superadmin/SuperAdminDashboard'
import { WritingStudio } from './pages/student/WritingStudio'
import { StudentChatHub } from './pages/student/StudentChatHub'
import { QuizMe } from './pages/student/QuizMe'

import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[1100px] mx-auto px-3 sm:px-6 w-full pb-10">
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 relative">
        <Sidebar />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}

function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}

function App() {
  const location = useLocation()
  
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden">
      <Navbar />

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />

          <Route element={<AuthGuard />}>
            <Route
              path="/dashboard"
              element={
                <PageTransition>
                  <AuthedLayout>
                    <Dashboard />
                  </AuthedLayout>
                </PageTransition>
              }
            />

            <Route element={<RoleGuard requiredPermissions={['EXECUTE_AI_TUTOR']} />}>
              <Route
                path="/socratic-tutor"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <SocraticTutorPage sessionId="student-sandbox-session-101" />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/student/writing-studio"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <WritingStudio />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/student/chat-hub"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <StudentChatHub mode="character" />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/student/quiz-me"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <QuizMe />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['GENERATE_LESSON_PLAN']} />}>
              <Route
                path="/ai/lesson-planner"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <LessonPlanner />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/ai/bot-studio"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <CustomBotStudio />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/ai/student-oversight"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <StudentOversightDashboard />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['USE_TEXT_LEVELER']} />}>
              <Route
                path="/ai/leveler"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <TextLeveler />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['USE_VIDEO_ASSESSOR']} />}>
              <Route
                path="/ai/video-assessor"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <VideoAssessor />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['GENERATE_IEP_RUBRIC']} />}>
              <Route
                path="/ai/iep-generator"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <IepGenerator />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['MANAGE_GLOBAL_TENANTS']} />}>
              <Route
                path="/superadmin/dashboard"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <SuperAdminDashboard />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['MANAGE_LOCAL_ROLES']} />}>
              <Route
                path="/admin/dashboard"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <InstitutionAdminDashboard />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['MANAGE_DISTRICT_AI_KNOWLEDGE']} />}>
              <Route
                path="/rag-ingestion"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <RAGIngestionPanel />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['MANAGE_USERS']} />}>
              <Route
                path="/user-management"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <UserManagement />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['MODERATE_CONTENT']} />}>
              <Route
                path="/moderation"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <ModerationPanel />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            <Route element={<RoleGuard requiredPermissions={['MANAGE_ROLES']} />}>
              <Route
                path="/role-management"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <RoleManagement />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AnimatePresence>
      <Footer />
    </div>
  )
}

export default App
