import { useEffect, useState } from 'react'
import { useAuth } from '../services/authService'
import { apiFetch } from '../services/apiClient'
import { motion } from 'framer-motion'
import { 
  Shield, Building2, KeyRound, Users, GraduationCap, 
  BookOpen, Clock, Calendar, CheckSquare, Sparkles,
  TrendingUp, Award, ClipboardList
} from 'lucide-react'
import { Link } from 'react-router-dom'

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
  // 🍎 2. TEACHER VIEW
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
  // 👤 4. DEFAULT USER VIEW
  // ----------------------------------------------------
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="page">
      <div className="card">
        <div className="cardInner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brandMark" style={{ width: 40, height: 40 }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 className="pageTitle">SafeScholar Portal</h2>
              <div className="pageSub">Logged in under: {me?.email}</div>
            </div>
          </div>

          <div className="divider" />

          <div className="kpiRow">
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <KeyRound size={16} /> Signed in as
              </div>
              <div className="kpiValue">{me?.email || '—'}</div>
            </div>
            <div className="kpi">
              <div className="kpiLabel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Building2 size={16} /> Institution
              </div>
              <div className="kpiValue kpiValueMono mono">{me?.institutionId || '—'}</div>
            </div>
          </div>

          <div className="divider" />

          <div className="grid2">
            <div className="toast">
              <div style={{ fontSize: 12, opacity: 0.75 }}>Roles</div>
              <div className="wrap" style={{ marginTop: 10 }}>
                {(me?.roles || []).length ? (me?.roles || []).map((r) => <span key={r} className="chip">{r}</span>) : <span className="muted">—</span>}
              </div>
            </div>
            <div className="toast">
              <div style={{ fontSize: 12, opacity: 0.75 }}>Permissions</div>
              <div className="wrap" style={{ marginTop: 10 }}>
                {(me?.permissions || []).length ? (me?.permissions || []).map((p) => <span key={p} className="chip">{p}</span>) : <span className="muted">—</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
