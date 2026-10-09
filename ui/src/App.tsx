import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { AuthGuard } from './components/AuthGuard'
import { RoleGuard } from './components/RoleGuard'
import { Sidebar } from './components/Sidebar'
import { Footer } from './components/Footer'
import { Dashboard } from './pages/Dashboard'
import { LoginPage } from './pages/LoginPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { ModerationPanel } from './pages/ModerationPanel'
import { RoleManagement } from './pages/RoleManagement'
import { UserManagement } from './pages/UserManagement'
import { SocraticTutorPage } from './pages/SocraticTutorPage'
import { LessonPlannerPage } from './pages/educator/LessonPlannerPage'
import TextLeveler from './pages/ai/TextLeveler'
import VideoAssessor from './pages/ai/VideoAssessor'
import IepGenerator from './pages/ai/IepGenerator'
import ReportCardGeneratorPage from './pages/educator/ReportCardGeneratorPage'
import { RubricGeneratorPage } from './pages/educator/RubricGeneratorPage'
import { WorksheetGeneratorPage } from './pages/educator/WorksheetGeneratorPage'
import { AssessmentGeneratorPage } from './pages/educator/AssessmentGeneratorPage'
import CustomBotStudio from './pages/educator/CustomBotStudio'
import StudentOversightDashboard from './pages/educator/StudentOversightDashboard'
import { RAGIngestionPanel } from './pages/admin/RAGIngestionPanel'
import { InstitutionAdminDashboard } from './pages/admin/InstitutionAdminDashboard'
import { SuperAdminDashboard } from './pages/superadmin/SuperAdminDashboard'
import { TeacherManagementPage } from './pages/admin/TeacherManagementPage'
import { StudentManagementPage } from './pages/admin/StudentManagementPage'
import { WritingStudio } from './pages/student/WritingStudio'
import { StudentChatHub } from './pages/student/StudentChatHub'
import { StudentJoinRoom } from './pages/student/StudentJoinRoom'
import { StudentTextLevelerPage } from './pages/student/StudentTextLevelerPage'
import { StudentTestEnvironmentPage } from './pages/student/StudentTestEnvironmentPage'
import { ProfilePage } from './pages/ProfilePage'

import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'

function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 pb-28 md:pb-12 transition-all">
      <div className="flex flex-col md:flex-row gap-4 lg:gap-6 relative w-full items-start">
        <Sidebar />
        <main className="flex-1 min-w-0 w-full">{children}</main>
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
      className="w-full flex-1 flex flex-col"
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
          <Route path="/reset-password" element={<PageTransition><ResetPasswordPage /></PageTransition>} />

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

            <Route
              path="/profile"
              element={
                <PageTransition>
                  <AuthedLayout>
                    <ProfilePage />
                  </AuthedLayout>
                </PageTransition>
              }
            />

            {/* ========================================================= */}
            {/* 🎒 2. STUDENT FEATURES (Exact 5 segregrated modules)     */}
            {/* ========================================================= */}
            <Route element={<RoleGuard requiredPermissions={['EXECUTE_AI_TUTOR', 'SUPER_ADMIN']} />}>
              {/* (a) Socratic Sandbox AI Chat */}
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
              {/* (b) Text Leveler (Student reading simplifier) */}
              <Route
                path="/student/text-leveler"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <StudentTextLevelerPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              {/* (c) Join Custom Chatbot Room provided by Teacher */}
              <Route
                path="/student/join-room"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <StudentJoinRoom />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/student/quiz-me"
                element={<Navigate to="/student/join-room" replace />}
              />
              {/* (d) Writing Studio */}
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
              {/* (e) Test Environment to give the tests */}
              <Route
                path="/student/test-environment"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <StudentTestEnvironmentPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />

              {/* Student auxiliary rooms */}
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
                path="/student/join-room"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <StudentJoinRoom />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
            </Route>

            {/* ========================================================= */}
            {/* 🍎 1. TEACHER FEATURES (Exact 6 segregated modules)      */}
            {/* ========================================================= */}
            <Route element={<RoleGuard requiredPermissions={['GENERATE_LESSON_PLAN', 'USE_TEXT_LEVELER', 'SUPER_ADMIN']} />}>
              {/* (a) Lesson Planner */}
              <Route
                path="/educator/lesson-planner"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <LessonPlannerPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/ai/lesson-planner"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <LessonPlannerPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />

              {/* (b) Rubric Generator */}
              <Route
                path="/educator/rubric-generator"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <RubricGeneratorPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/ai/ismg-rubric-gen"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <RubricGeneratorPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />

              {/* (c) Worksheet Generator */}
              <Route
                path="/educator/worksheet-generator"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <WorksheetGeneratorPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />

              {/* (d) Assessment/Test/Quiz Generator */}
              <Route
                path="/educator/assessment-generator"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <AssessmentGeneratorPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />

              {/* (e) Custom Chat Bot */}
              <Route
                path="/educator/custom-bots"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <CustomBotStudio />
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

              {/* (f) Text Leveler */}
              <Route
                path="/educator/leveler"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <TextLeveler />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
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

              {/* Auxiliary educator tools */}
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
              <Route
                path="/ai/report-card-gen"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <ReportCardGeneratorPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
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

            {/* ========================================================= */}
            {/* 🏛️ 3. INSTITUTE MANAGEMENT (Exact 4 segregated modules)   */}
            {/* ========================================================= */}
            <Route element={<RoleGuard requiredPermissions={['MANAGE_LOCAL_ROLES', 'MANAGE_USERS', 'MANAGE_DISTRICT_AI_KNOWLEDGE', 'SUPER_ADMIN']} />}>
              {/* (a) RAG Ingestion and Update */}
              <Route
                path="/admin/rag-ingestion"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <RAGIngestionPanel />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
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

              {/* (b) Teacher Management */}
              <Route
                path="/admin/teachers"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <TeacherManagementPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />

              {/* (c) Student Management */}
              <Route
                path="/admin/students"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <StudentManagementPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />

              {/* (d) Report Card Generator */}
              <Route
                path="/admin/report-card"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <ReportCardGeneratorPage />
                    </AuthedLayout>
                  </PageTransition>
                }
              />

              {/* Administrative Dashboards */}
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
              <Route
                path="/superadmin"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <SuperAdminDashboard />
                    </AuthedLayout>
                  </PageTransition>
                }
              />
              <Route
                path="/admin/superadmin"
                element={
                  <PageTransition>
                    <AuthedLayout>
                      <SuperAdminDashboard />
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
