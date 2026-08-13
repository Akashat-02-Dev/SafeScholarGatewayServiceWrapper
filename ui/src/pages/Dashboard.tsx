import { useEffect, useState } from 'react'
import { useAuth } from '../services/authService'
import { apiFetch } from '../services/apiClient'
import { motion } from 'framer-motion'
import { 
  Shield, Building2, KeyRound, Users, GraduationCap, 
  BookOpen, Clock, Calendar, CheckSquare, Sparkles,
  TrendingUp, Award, ClipboardList
} from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'

interface AdminMetrics {
  role: 'sysadmin'
  activeUsers: number
  totalInstitutions: number
  totalTeachers: number
  totalStudents: number
}

interface TeacherMetrics {
  role: 'teacher'
  totalStudents: number
  averageAttendance: number
  submittedAssignments: number
  pendingAssignments: number
  academicProgress: number
  progressHistory: number[]
}

interface StudentMetrics {
  role: 'student'
  gpa: number
  attendance: number
  completedAssignments: number
  totalAssignments: number
  pendingAssignments: number
  academicProgress: number
  progressHistory: number[]
}

type DashboardMetrics = AdminMetrics | TeacherMetrics | StudentMetrics | { role: 'user' }

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 100)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const width = 140
  const height = 40
  
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - ((val - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke="var(--c-navy)"
        strokeWidth="2.5"
        points={points}
      />
      {data.map((val, index) => {
        const x = (index / (data.length - 1)) * width
        const y = height - ((val - min) / range) * height
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="3.5"
            fill="var(--c-navy)"
          />
        )
      })}
    </svg>
  )
}

export function Dashboard() {
  const { me, tokens } = useAuth()
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tokens?.accessToken) return
    void (async () => {
      try {
        const res = await apiFetch<DashboardMetrics>('/api/v1/dashboard/metrics', {
          method: 'GET',
          accessToken: tokens.accessToken
        })
        setMetrics(res)
      } catch {
        setMetrics({ role: 'user' })
      } finally {
        setLoading(false)
      }
    })()
  }, [tokens?.accessToken])

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <div style={{ fontWeight: '600', color: 'var(--muted)' }}>Loading workspace dashboard...</div>
      </div>
    )
  }

  // ----------------------------------------------------
  // 🛡️ 1. SUPER ADMIN VIEW
  // ----------------------------------------------------
  if (metrics?.role === 'sysadmin') {
    const admin = metrics as AdminMetrics
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
        <div className="card">
          <div className="cardInner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="brandMark" style={{ width: 44, height: 44 }}>
                <Shield size={22} />
              </div>
              <div>
                <h2 className="pageTitle" style={{ margin: 0 }}>Super Admin Console</h2>
                <div className="pageSub">System-wide resource tracking, active nodes, and district metrics.</div>
              </div>
            </div>

            <div className="divider" />

            {/* KPI metrics row */}
            <div className="kpiRow" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Users size={16} /> Active Accounts
                </div>
                <div className="kpiValue">{admin.activeUsers}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Building2 size={16} /> Institutions
                </div>
                <div className="kpiValue">{admin.totalInstitutions}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <GraduationCap size={16} /> Active Teachers
                </div>
                <div className="kpiValue">{admin.totalTeachers}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Users size={16} /> Enrolled Students
                </div>
                <div className="kpiValue">{admin.totalStudents}</div>
              </div>
            </div>

            <div className="divider" />

            {/* Admin actions grid */}
            <h3 style={{ color: 'var(--c-navy)', fontSize: 15, margin: '0 0 12px 0' }}>Administrative Shortcuts</h3>
            <div className="grid2">
              <Link to="/user-management" style={{ textDecoration: 'none' }}>
                <div className="toast" style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}>
                  <div style={{ fontWeight: '600', color: 'var(--c-navy)', fontSize: 14 }}>User Approval Vetting</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Approve pending educator signups and map initial roles.</div>
                </div>
              </Link>
              <Link to="/role-management" style={{ textDecoration: 'none' }}>
                <div className="toast" style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}>
                  <div style={{ fontWeight: '600', color: 'var(--c-navy)', fontSize: 14 }}>RBAC Role Mapping</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Assign modular permissions to system-wide custom roles.</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ----------------------------------------------------
  // 🏫 2. INSTITUTE ADMIN VIEW
  // ----------------------------------------------------
  if (metrics?.role === 'institute') {
    const inst = metrics as any
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
        <div className="card shadow-lg border border-slate-200/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden">
          <div className="cardInner p-4 sm:p-6 md:p-8">
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800 pb-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg">
                  <Building2 size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">District Metrics Dashboard</h2>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Holistic view of {me?.institutionId}'s district-wide adoption.</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-sm flex items-center gap-2">
                    <GraduationCap size={18} className="text-blue-500" /> Total Teachers
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{inst.totalTeachers}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Active Educators</div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-sm flex items-center gap-2">
                    <Users size={18} className="text-emerald-500" /> Total Students
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{inst.totalStudents}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Enrolled Learners</div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-sm flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-500" /> AI Requests
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{inst.totalRequests || 0}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">In this billing cycle</div>
              </div>

              <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold text-sm flex items-center gap-2">
                    <Clock size={18} className="text-amber-500" /> Pending Users
                  </div>
                </div>
                <div className="text-3xl font-black text-amber-600 tracking-tight">{inst.pendingUsers}</div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2">Awaiting your approval</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/60 dark:border-zinc-700/60">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-500" /> AI Adoption Trend
                  </h3>
                </div>
                <div className="flex justify-center items-center h-40">
                  <Sparkline data={inst.progressHistory || [10, 20, 15, 30, 40, 50, 60]} />
                </div>
              </div>

              <div className="bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/60 dark:border-zinc-700/60 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Shield size={16} className="text-emerald-500" /> Quick Actions
                </h3>
                <Link to="/admin/dashboard" className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border border-slate-200 dark:border-zinc-700/80 group">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <CheckSquare size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Review Pending Users</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Approve or reject waiting candidates</div>
                  </div>
                </Link>
                <Link to="/admin/dashboard" className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors border border-slate-200 dark:border-zinc-700/80 group">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                    <Users size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">Manage Role Matrix</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Delegate AI tools to your local staff</div>
                  </div>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </motion.div>
    )
  }

  // ----------------------------------------------------
  // 🍎 3. TEACHER VIEW
  // ----------------------------------------------------
  if (metrics?.role === 'teacher') {
    const teacher = metrics as TeacherMetrics
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
        <div className="card">
          <div className="cardInner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="brandMark" style={{ width: 44, height: 44 }}>
                <GraduationCap size={22} />
              </div>
              <div>
                <h2 className="pageTitle" style={{ margin: 0 }}>Educator Workspace</h2>
                <div className="pageSub">Welcome back, {me?.firstName || 'Teacher'}. Classroom compliance and academic metrics.</div>
              </div>
            </div>

            <div className="divider" />

            {/* KPI Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Users size={14} /> Enrolled Students
                </div>
                <div className="kpiValue">{teacher.totalStudents}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Clock size={14} /> Avg Attendance
                </div>
                <div className="kpiValue">{teacher.averageAttendance}%</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CheckSquare size={14} /> Submissions
                </div>
                <div className="kpiValue">{teacher.submittedAssignments}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <ClipboardList size={14} /> Pending Tasks
                </div>
                <div className="kpiValue" style={{ color: '#d97706' }}>{teacher.pendingAssignments}</div>
              </div>
            </div>

            <div className="divider" />

            {/* Academic progress / chart */}
            <div className="grid2" style={{ alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: '700', color: 'var(--c-navy)' }}>Class Progress Trend</span>
                  <span className="chip" style={{ fontSize: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
                    <TrendingUp size={12} />
                    Current GPA: {teacher.academicProgress}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                  <Sparkline data={teacher.progressHistory} />
                </div>
              </div>

              {/* Roster overview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, border: '1px solid var(--border)', padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.4)' }}>
                <span style={{ fontSize: 13, fontWeight: '700', color: 'var(--c-navy)' }}>Quick Shortcuts</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, marginTop: 4 }}>
                  <Link to="/ai/lesson-planner" style={{ color: 'var(--c-navy)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BookOpen size={14} /> Launch Standards Lesson Planner
                  </Link>
                  <Link to="/ai/leveler" style={{ color: 'var(--c-navy)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <ClipboardList size={14} /> Differentiate Text Complexity
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ----------------------------------------------------
  // 🎓 3. STUDENT VIEW
  // ----------------------------------------------------
  if (metrics?.role === 'student') {
    const student = metrics as StudentMetrics
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
        <div className="card">
          <div className="cardInner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="brandMark" style={{ width: 44, height: 44 }}>
                <Award size={22} />
              </div>
              <div>
                <h2 className="pageTitle" style={{ margin: 0 }}>Student Dashboard</h2>
                <div className="pageSub">Welcome, {me?.firstName || 'Student'}. View your school progress.</div>
              </div>
            </div>

            <div className="divider" />

            {/* Student KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Award size={14} /> Academic GPA
                </div>
                <div className="kpiValue">{student.gpa}%</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Calendar size={14} /> Attendance
                </div>
                <div className="kpiValue">{student.attendance}%</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <CheckSquare size={14} /> Assignments Completed
                </div>
                <div className="kpiValue">{student.completedAssignments} / {student.totalAssignments}</div>
              </div>
              <div className="kpi">
                <div className="kpiLabel" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Clock size={14} /> Pending Tasks
                </div>
                <div className="kpiValue" style={{ color: '#dc2626' }}>{student.pendingAssignments}</div>
              </div>
            </div>

            <div className="divider" />

            {/* Custom progress bars & sparklines */}
            <div className="grid2" style={{ alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.4)' }}>
                <span style={{ fontSize: 13, fontWeight: '700', color: 'var(--c-navy)' }}>Assignment Progress Bar</span>
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                    <span>Completion Status</span>
                    <span>{Math.round((student.completedAssignments / student.totalAssignments) * 100)}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(student.completedAssignments / student.totalAssignments) * 100}%`, height: '100%', background: '#16a34a' }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  You have <strong>{student.pendingAssignments}</strong> assignments remaining. Complete them to maintain your high GPA!
                </div>
              </div>

              {/* Sparkline & Sandbox access */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, border: '1px solid var(--border)', padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: '700', color: 'var(--c-navy)' }}>Personal Score Trend</span>
                  <Sparkline data={student.progressHistory} />
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <Link to="/socratic-tutor" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--c-navy)', fontWeight: 600, fontSize: 12 }}>
                    <Sparkles size={14} />
                    Need help? Work with Socratic Tutor
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  // ----------------------------------------------------
  // 👤 4. DEFAULT USER VIEW (Security & Profile Dashboard)
  // ----------------------------------------------------
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card shadow-lg border border-slate-200/50 dark:border-white/10 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-3xl rounded-3xl overflow-hidden">
        <div className="cardInner p-4 sm:p-6 md:p-8 relative overflow-hidden">
          {/* Ambient background blur */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

          {/* Header */}
          <div className="flex items-center gap-5 border-b border-slate-200 dark:border-zinc-800 pb-6 mb-8 relative z-10">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
              <Shield size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Personal Workspace</h2>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Logged in under: <span className="text-slate-700 dark:text-slate-300">{me?.email}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
            {/* Identity Card */}
            <div className="bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/60 dark:border-zinc-700/60 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-6 flex items-center gap-2">
                <KeyRound size={16} className="text-indigo-500" /> Identity Overview
              </h3>
              
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email Address</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200">{me?.email || '—'}</div>
                </div>
                
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Institution GUID</div>
                  <div className="font-mono text-sm px-3 py-1.5 bg-slate-100 dark:bg-zinc-900 rounded-lg text-slate-700 dark:text-slate-300 inline-block border border-slate-200 dark:border-zinc-700">
                    {me?.institutionId || '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Access Rights */}
            <div className="bg-white/60 dark:bg-zinc-800/60 backdrop-blur-md rounded-2xl p-6 border border-slate-200/60 dark:border-zinc-700/60 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Award size={16} className="text-amber-500" /> Assigned Roles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(me?.roles || []).length ? (
                    (me?.roles || []).map((r) => (
                      <span key={r} className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 uppercase tracking-wide">
                        {r}
                      </span>
                    ))
                  ) : <span className="text-sm text-slate-400 italic">—</span>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-emerald-500" /> Active Permissions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(me?.permissions || []).length ? (
                    (me?.permissions || []).map((p) => (
                      <span key={p} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                        {p}
                      </span>
                    ))
                  ) : <span className="text-sm text-slate-400 italic">—</span>}
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </motion.div>
  )
}
