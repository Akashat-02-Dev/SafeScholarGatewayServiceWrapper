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
import { LandingPage } from './pages/LandingPage'

import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useRoleFilter } from './services/roleFilterContext'
import { RoleFilterBar } from './components/RoleFilterBar'
import { GraduationCap, Backpack, Building2, Shield, Sparkles } from 'lucide-react'

function AuthedLayout({ children }: { children: ReactNode }) {
  const { isSuperAdmin, effectiveRole } = useRoleFilter()
  const location = useLocation()

  // Detect domain by path
  const isTeacherPath = location.pathname.startsWith('/educator') || location.pathname.startsWith('/ai')
  const isStudentPath = location.pathname.startsWith('/student') || location.pathname.startsWith('/socratic-tutor')
  const isInstitutePath = location.pathname.startsWith('/admin')
  const isSuperAdminPath = location.pathname.startsWith('/superadmin')
  const isDashboard = location.pathname === '/dashboard'

  let currentDomain: 'teacher' | 'student' | 'institute' | 'superadmin' | 'all' = 'all'
  if (isSuperAdminPath) {
    currentDomain = 'superadmin'
  } else if (isTeacherPath) {
    currentDomain = 'teacher'
  } else if (isStudentPath) {
    currentDomain = 'student'
  } else if (isInstitutePath) {
    currentDomain = 'institute'
  } else if (isDashboard) {
    currentDomain = effectiveRole
  }

  // Domain presentation metadata
  const domainMeta = {
    teacher: {
      label: 'Educator Workspace',
      badge: 'Educator Suite',
      sub: 'ACARA v9 Lesson Architecture, Rubrics & Differentiation',
      icon: GraduationCap,
      badgeClass: 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      bannerBg: 'bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white/90 dark:from-blue-950/40 dark:via-zinc-900 dark:to-zinc-900 border-blue-200/80 dark:border-blue-900/60',
      glow: 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.10),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(37,99,235,0.15),rgba(0,0,0,0))]',
      textColor: 'text-blue-800 dark:text-blue-300',
    },
    student: {
      label: 'Student Learning Hub',
      badge: 'Student Portal',
      sub: 'Guided Socratic Inquiry, Text Leveler & Writing Studio',
      icon: Backpack,
      badgeClass: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      bannerBg: 'bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-white/90 dark:from-emerald-950/40 dark:via-zinc-900 dark:to-zinc-900 border-emerald-200/80 dark:border-emerald-900/60',
      glow: 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(16,185,129,0.10),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(5,150,105,0.15),rgba(0,0,0,0))]',
      textColor: 'text-emerald-800 dark:text-emerald-300',
    },
    institute: {
      label: 'Institute Management Console',
      badge: 'Institute Console',
      sub: 'District RAG Ingestion, Teacher & Student Governance',
      icon: Building2,
      badgeClass: 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-pink-300 border-purple-200 dark:border-pink-800',
      bannerBg: 'bg-gradient-to-r from-purple-50/90 via-pink-50/40 to-white/90 dark:from-purple-950/40 dark:via-zinc-900 dark:to-zinc-900 border-purple-200/80 dark:border-pink-900/60',
      glow: 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(168,85,247,0.10),rgba(236,72,153,0.06),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(147,51,234,0.15),rgba(219,39,119,0.08),rgba(0,0,0,0))]',
      textColor: 'text-purple-800 dark:text-pink-300',
    },
    superadmin: {
      label: 'Super Admin Command Deck',
      badge: 'Executive Command Deck',
      sub: 'Microservice Resilience Mesh, Custom RBAC & Multi-Tenant Trials',
      icon: Shield,
      badgeClass: 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      bannerBg: 'bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white/90 dark:from-amber-950/40 dark:via-zinc-900 dark:to-zinc-900 border-amber-200/80 dark:border-amber-900/60',
      glow: 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(245,158,11,0.08),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(217,119,6,0.12),rgba(0,0,0,0))]',
      textColor: 'text-amber-900 dark:text-amber-300',
    },
    all: {
      label: 'Unified Enterprise Workspace',
      badge: 'All Roles Access',
      sub: 'Segregated Access for Teachers, Students & Institute Administration',
      icon: Sparkles,
      badgeClass: 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-700',
      bannerBg: 'bg-white/70 dark:bg-zinc-900/70 border-slate-200/80 dark:border-white/10',
      glow: 'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.05),rgba(16,185,129,0.04),rgba(168,85,247,0.04),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(37,99,235,0.08),rgba(5,150,105,0.06),rgba(147,51,234,0.06),rgba(0,0,0,0))]',
      textColor: 'text-slate-800 dark:text-white',
    },
  }[currentDomain]

  const Icon = domainMeta.icon

  return (
    <div className="relative w-full min-h-screen">
      {/* Dynamic Ambient Background Glow */}
      <div className={`fixed inset-0 pointer-events-none -z-10 transition-all duration-500 ${domainMeta.glow}`} />

      <div className="w-full max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 pb-28 md:pb-12 transition-all">
        <div className="flex flex-col md:flex-row gap-4 lg:gap-6 relative w-full items-start">
          <Sidebar />
          
          <main className="flex-1 min-w-0 w-full space-y-4">
            {/* Role Context Bar for Non-Dashboard views */}
            {!isDashboard && (
              <div className={`p-3 sm:p-3.5 rounded-2xl border backdrop-blur-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${domainMeta.bannerBg}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl ${domainMeta.badgeClass} flex items-center justify-center shrink-0 shadow-sm`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-black tracking-tight ${domainMeta.textColor}`}>
                        {domainMeta.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${domainMeta.badgeClass}`}>
                        {domainMeta.badge}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium leading-tight">
                      {domainMeta.sub}
                    </div>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div className="shrink-0 self-stretch sm:self-auto">
                    <RoleFilterBar compact />
                  </div>
                )}
              </div>
            )}

            {children}
          </main>
        </div>
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

          <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      <Footer />
    </div>
  )
}

export default App
