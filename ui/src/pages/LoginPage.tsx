import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../services/authService'
import { apiFetch } from '../services/apiClient'
import { listPublicInstitutions, registerAccount, type PublicInstitution } from '../services/roleService'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowRight, KeyRound, LockKeyhole, Mail, Shield, User, 
  CheckCircle2, AlertTriangle, GraduationCap, Briefcase, Building2, 
  School, Calendar, Hash, Globe, Phone, MapPin, BadgeCheck, ShieldAlert 
} from 'lucide-react'

export function LoginPage() {
  const { status, login, oauthLogin } = useAuth()
  const navigate = useNavigate()
  const loc = useLocation()
  const from = useMemo(() => (loc.state as { from?: string } | null)?.from || '/dashboard', [loc.state])

  const [isRegister, setIsRegister] = useState(() => {
    const params = new URLSearchParams(loc.search)
    return params.get('mode') === 'register' || Boolean((loc.state as any)?.isRegister)
  })
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  
  // Sign up role selection
  const [signupRole, setSignupRole] = useState<'student' | 'teacher' | 'institute_management'>(() => {
    const params = new URLSearchParams(loc.search)
    const r = params.get('role')
    if (r === 'teacher' || r === 'student' || r === 'institute_management') {
      return r
    }
    return 'student'
  })

  useEffect(() => {
    const params = new URLSearchParams(loc.search)
    if (params.get('mode') === 'register') {
      setIsRegister(true)
    }
    const r = params.get('role')
    if (r === 'teacher' || r === 'student' || r === 'institute_management') {
      setSignupRole(r)
    }
  }, [loc.search])

  // Common credentials
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  // Institutions list for student / teacher
  const [institutions, setInstitutions] = useState<PublicInstitution[]>([])
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')

  // Student specific fields
  const [academicYear, setAcademicYear] = useState('1st Year')
  const [studentIdNumber, setStudentIDNumber] = useState('')
  const [studentDepartment, setStudentDepartment] = useState('')

  // Teacher specific fields
  const [teacherDepartment, setTeacherDepartment] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [designation, setDesignation] = useState('')

  // Institute Management specific fields
  const [instituteName, setInstituteName] = useState('')
  const [instituteType, setInstituteType] = useState('College / University')
  const [instituteDomain, setInstituteDomain] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [oauthBusy, setOauthBusy] = useState<'google' | 'microsoft' | 'apple' | null>(null)

  // Load public institutions when entering register mode
  useEffect(() => {
    if (isRegister) {
      listPublicInstitutions()
        .then((res) => {
          const list = res.institutions || []
          setInstitutions(list)
          if (list.length > 0 && !selectedInstitutionId) {
            setSelectedInstitutionId(list[0].institutionId)
          }
        })
        .catch(() => {
          // Non-blocking fallback
        })
    }
  }, [isRegister])

  const filteredInstitutions = useMemo(() => {
    if (!institutionSearch.trim()) return institutions
    const q = institutionSearch.toLowerCase()
    return institutions.filter(i => i.name.toLowerCase().includes(q) || (i.domain && i.domain.toLowerCase().includes(q)))
  }, [institutions, institutionSearch])

  const selectedInstitutionName = useMemo(() => {
    return institutions.find(i => i.institutionId === selectedInstitutionId)?.name || 'your institution'
  }, [institutions, selectedInstitutionId])

  if (status === 'authenticated') {
    return <Navigate to={from} replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setErr(null)
    setOk(null)

    try {
      if (isForgotPassword) {
        const res = await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          body: { email }
        }) as { message?: string }
        setOk(res.message || 'If an account exists, a reset link has been generated.')
        setIsForgotPassword(false)
      } else if (isRegister) {
        if (signupRole === 'student') {
          if (!selectedInstitutionId) {
            throw new Error('Please select your institution')
          }
          if (!academicYear) {
            throw new Error('Please specify your academic year or grade')
          }
          await registerAccount({
            role: 'student',
            email,
            password,
            firstName,
            lastName,
            institutionId: selectedInstitutionId,
            academicYear,
            studentIdNumber: studentIdNumber.trim() || undefined,
            department: studentDepartment.trim() || undefined,
          })
          setOk(`Student access request submitted! Your request has been forwarded to ${selectedInstitutionName} management for approval.`)
        } else if (signupRole === 'teacher') {
          if (!selectedInstitutionId) {
            throw new Error('Please select your institution')
          }
          if (!teacherDepartment.trim()) {
            throw new Error('Please specify your department or subject area')
          }
          await registerAccount({
            role: 'teacher',
            email,
            password,
            firstName,
            lastName,
            institutionId: selectedInstitutionId,
            department: teacherDepartment.trim(),
            employeeId: employeeId.trim() || undefined,
            designation: designation.trim() || undefined,
          })
          setOk(`Teacher access request submitted! Your request has been forwarded to ${selectedInstitutionName} management for approval.`)
        } else {
          // Institute Management
          if (!instituteName.trim()) {
            throw new Error('Please specify your institution name')
          }
          await registerAccount({
            role: 'institute_management',
            email,
            password,
            firstName,
            lastName,
            instituteName: instituteName.trim(),
            instituteType,
            domain: instituteDomain.trim() || undefined,
            registrationCode: registrationCode.trim() || undefined,
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
          })
          setOk(`Institution registration submitted! The SafeScholar Super Administrator will review and authorize "${instituteName.trim()}" shortly.`)
        }
        setIsRegister(false)
        setPassword('')
      } else {
        await login(email, password)
        navigate(from, { replace: true })
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function startOAuth(provider: 'google' | 'microsoft' | 'apple') {
    if (busy || oauthBusy) return
    setErr(null)
    setOk(null)
    setOauthBusy(provider)
    try {
      await oauthLogin(provider)
      navigate(from, { replace: true })
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'OAuth failed')
    } finally {
      setOauthBusy(null)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-120px)] w-full p-4 sm:p-6 my-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className={`w-full transition-all duration-300 ${isRegister ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl -webkit-backdrop-filter transform-gpu border border-white/50 dark:border-white/10 rounded-[2.5rem] shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgb(0,0,0,0.25)] p-6 sm:p-10">
          
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg border border-white/20 shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-serif m-0">
                {isForgotPassword ? 'Reset Password' : isRegister ? 'Create Account & Request Access' : 'Sign in'}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 m-0">
                {isForgotPassword
                  ? 'Enter your email to receive a password reset link.'
                  : isRegister
                  ? 'Select your role and submit registration details for institutional approval.'
                  : 'Enter your credentials to access SafeScholar Gateway.'}
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-200/60 dark:bg-zinc-700/60 my-6" />

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <AnimatePresence mode="wait">
              {ok && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-3 px-4 py-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 rounded-2xl text-sm font-medium border border-emerald-200 dark:border-emerald-800/60 shadow-sm"
                >
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{ok}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Role Selection Tabs for Sign Up */}
            {!isForgotPassword && isRegister && (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">
                  I am signing up as:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSignupRole('student')}
                    className={`flex flex-col items-center sm:items-start p-3.5 rounded-2xl border-2 transition-all text-left ${
                      signupRole === 'student'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-sm'
                        : 'border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-slate-300 bg-white/40 dark:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GraduationCap size={18} className={signupRole === 'student' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                      <span className="font-bold text-sm">Student</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                      Learning tools, AI tutors & assignments
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupRole('teacher')}
                    className={`flex flex-col items-center sm:items-start p-3.5 rounded-2xl border-2 transition-all text-left ${
                      signupRole === 'teacher'
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-sm'
                        : 'border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-slate-300 bg-white/40 dark:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase size={18} className={signupRole === 'teacher' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                      <span className="font-bold text-sm">Teacher</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                      Lesson planning, rubrics & grading
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupRole('institute_management')}
                    className={`flex flex-col items-center sm:items-start p-3.5 rounded-2xl border-2 transition-all text-left ${
                      signupRole === 'institute_management'
                        ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 shadow-sm'
                        : 'border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-slate-300 bg-white/40 dark:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 size={18} className={signupRole === 'institute_management' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                      <span className="font-bold text-sm">Institute Mgmt</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                      Campus onboarding & district admin
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Role-Specific Fields */}
            {!isForgotPassword && isRegister && (
              <div className="flex flex-col gap-4 p-4 rounded-3xl bg-slate-50/60 dark:bg-zinc-800/40 border border-slate-200/70 dark:border-zinc-700/60">
                
                {/* Name Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                      {signupRole === 'institute_management' ? 'Administrator First Name' : 'First Name'}
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                        placeholder="e.g. Jane"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                      {signupRole === 'institute_management' ? 'Administrator Last Name' : 'Last Name'}
                    </label>
                    <input
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                      placeholder="e.g. Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Institute Selection for Student & Teacher */}
                {(signupRole === 'student' || signupRole === 'teacher') && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <School size={15} className="text-blue-500" />
                        Select Your Institution
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {institutions.length} active registered
                      </span>
                    </div>

                    {institutions.length > 5 && (
                      <input
                        type="text"
                        placeholder="Search institution by name..."
                        value={institutionSearch}
                        onChange={(e) => setInstitutionSearch(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-slate-800 dark:text-slate-200 outline-none mb-1 focus:border-blue-500"
                      />
                    )}

                    <select
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 shadow-sm"
                      value={selectedInstitutionId}
                      onChange={(e) => setSelectedInstitutionId(e.target.value)}
                      required
                    >
                      {filteredInstitutions.length === 0 ? (
                        <option value="" disabled>No institutions found</option>
                      ) : (
                        filteredInstitutions.map((inst) => (
                          <option key={inst.institutionId} value={inst.institutionId}>
                            {inst.name} {inst.domain ? `(${inst.domain})` : ''}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">
                      Don't see your school? Switch to <strong>Institute Management</strong> to onboard your campus.
                    </p>
                  </div>
                )}

                {/* Student-Specific Fields */}
                {signupRole === 'student' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1">
                        <Calendar size={13} className="text-blue-500" />
                        Year / Grade
                      </label>
                      <select
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-sm"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        required
                      >
                        <option value="1st Year">1st Year (Freshman)</option>
                        <option value="2nd Year">2nd Year (Sophomore)</option>
                        <option value="3rd Year">3rd Year (Junior)</option>
                        <option value="4th Year">4th Year (Senior)</option>
                        <option value="Grade 9">Grade 9</option>
                        <option value="Grade 10">Grade 10</option>
                        <option value="Grade 11">Grade 11</option>
                        <option value="Grade 12">Grade 12</option>
                        <option value="Postgraduate">Postgraduate</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1">
                        <Hash size={13} className="text-blue-500" />
                        Student / Roll ID
                      </label>
                      <input
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                        placeholder="e.g. STU-9021"
                        value={studentIdNumber}
                        onChange={(e) => setStudentIDNumber(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                        Major / Branch
                      </label>
                      <input
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                        placeholder="e.g. CS / Biology"
                        value={studentDepartment}
                        onChange={(e) => setStudentDepartment(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Teacher-Specific Fields */}
                {signupRole === 'teacher' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                        Subject / Department *
                      </label>
                      <input
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                        placeholder="e.g. Mathematics"
                        value={teacherDepartment}
                        onChange={(e) => setTeacherDepartment(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1">
                        <Hash size={13} className="text-blue-500" />
                        Staff / Employee ID
                      </label>
                      <input
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                        placeholder="e.g. FAC-4081"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                        Designation / Title
                      </label>
                      <input
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-blue-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                        placeholder="e.g. Senior Lecturer"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Institute Management-Specific Fields */}
                {signupRole === 'institute_management' && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1">
                          <Building2 size={13} className="text-indigo-500" />
                          Institution Name *
                        </label>
                        <input
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-indigo-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                          placeholder="e.g. St. Jude International Academy"
                          value={instituteName}
                          onChange={(e) => setInstituteName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                          Institution Type
                        </label>
                        <select
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-indigo-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-sm"
                          value={instituteType}
                          onChange={(e) => setInstituteType(e.target.value)}
                        >
                          <option value="College / University">College / University</option>
                          <option value="School (K-12)">School (K-12)</option>
                          <option value="High School">High School</option>
                          <option value="Coaching / Academy">Coaching / Academy</option>
                          <option value="Vocational / Training">Vocational / Training</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1">
                          <Globe size={13} className="text-indigo-500" />
                          Domain / Website
                        </label>
                        <input
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-indigo-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                          placeholder="e.g. stjude.edu"
                          value={instituteDomain}
                          onChange={(e) => setInstituteDomain(e.target.value)}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1">
                          <BadgeCheck size={13} className="text-indigo-500" />
                          Registration Code
                        </label>
                        <input
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-indigo-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                          placeholder="e.g. REG-88219"
                          value={registrationCode}
                          onChange={(e) => setRegistrationCode(e.target.value)}
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1">
                          <Phone size={13} className="text-indigo-500" />
                          Official Phone
                        </label>
                        <input
                          className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-indigo-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                          placeholder="e.g. +1 555-0199"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1 flex items-center gap-1">
                        <MapPin size={13} className="text-indigo-500" />
                        Campus Address
                      </label>
                      <input
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 focus:border-indigo-500 transition-colors outline-none rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                        placeholder="e.g. 100 University Avenue, Cambridge, MA"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Workflow Governance Badge */}
                <div className={`p-3 rounded-2xl flex items-start gap-2.5 text-xs ${
                  signupRole === 'institute_management'
                    ? 'bg-indigo-100/60 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-800/60'
                    : 'bg-blue-100/60 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border border-blue-200/80 dark:border-blue-800/60'
                }`}>
                  {signupRole === 'institute_management' ? (
                    <ShieldAlert size={16} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <BadgeCheck size={16} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  )}
                  <div>
                    <span className="font-bold">
                      {signupRole === 'institute_management' 
                        ? 'Super Admin Accreditation Review' 
                        : 'Institutional Management Approval'}
                    </span>
                    <p className="mt-0.5 m-0 text-[11px] opacity-90 leading-relaxed">
                      {signupRole === 'institute_management'
                        ? 'New campus onboarding requests are reviewed directly by the platform Super Administrator for security compliance.'
                        : `Your access request will be routed directly to the Management of "${selectedInstitutionName}" to authorize or reject.`}
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* Email Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">
                {signupRole === 'institute_management' && isRegister ? 'Official Administrator Email *' : 'Email Address *'}
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full bg-white/80 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 focus:border-blue-500 transition-colors outline-none rounded-2xl pl-11 pr-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                  value={email}
                  placeholder="name@example.com"
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            {!isForgotPassword && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Password *
                  </label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setErr(null)
                        setOk(null)
                      }}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <LockKeyhole size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full bg-white/80 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 focus:border-blue-500 transition-colors outline-none rounded-2xl pl-11 pr-4 py-3.5 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm"
                    value={password}
                    placeholder="••••••••••••"
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    required={!isForgotPassword}
                  />
                </div>
                {isRegister && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1">
                    Must be at least 8 characters with upper, lower, digit and special character.
                  </span>
                )}
              </div>
            )}

            <AnimatePresence mode="wait">
              {err && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-start gap-2.5 px-4 py-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-2xl text-xs sm:text-sm font-semibold border border-red-200 dark:border-red-800/50 shadow-sm"
                  role="alert"
                >
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500" />
                  <span>{err}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button 
              type="submit" 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={busy}
              className={`mt-2 flex items-center justify-center gap-2 w-full py-4 rounded-full text-white font-bold shadow-md hover:shadow-lg disabled:opacity-70 transition-all ${
                isRegister && signupRole === 'institute_management'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              }`}
            >
              <KeyRound size={18} />
              {isForgotPassword 
                ? (busy ? 'Sending link...' : 'Send Reset Link') 
                : isRegister 
                  ? (busy ? 'Submitting request…' : `Submit ${signupRole === 'institute_management' ? 'Campus Registration' : 'Access Request'}`) 
                  : (busy ? 'Signing in…' : 'Sign in')}
              <ArrowRight size={18} />
            </motion.button>
          </form>

          <div className="text-center mt-6">
            {isForgotPassword ? (
              <button
                type="button"
                className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                onClick={() => {
                  setIsForgotPassword(false)
                  setErr(null)
                  setOk(null)
                }}
              >
                Back to Sign in
              </button>
            ) : (
              <button
                type="button"
                className="text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                onClick={() => {
                  setIsRegister(!isRegister)
                  setErr(null)
                  setOk(null)
                }}
              >
                {isRegister ? 'Already registered? Sign in here' : 'Don\'t have an account? Request Access / Sign up'}
              </button>
            )}
          </div>

          {!isRegister && !isForgotPassword && (
            <>
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700/50" />
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Or continue with</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-zinc-700/50" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <motion.button
                  type="button"
                  disabled={busy || !!oauthBusy}
                  onClick={() => void startOAuth('google')}
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/80 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all"
                >
                  <Globe size={18} className="text-slate-700 dark:text-slate-300" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {oauthBusy === 'google' ? 'Wait…' : 'Google'}
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  disabled={busy || !!oauthBusy}
                  onClick={() => void startOAuth('microsoft')}
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/80 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all"
                >
                  <Building2 size={18} className="text-slate-700 dark:text-slate-300" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {oauthBusy === 'microsoft' ? 'Wait…' : 'Microsoft'}
                  </span>
                </motion.button>

                <motion.button
                  type="button"
                  disabled={busy || !!oauthBusy}
                  onClick={() => void startOAuth('apple')}
                  whileHover={{ y: -2 }}
                  whileTap={{ y: 0 }}
                  className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-white/80 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm hover:shadow-md transition-all"
                >
                  <Shield size={18} className="text-slate-700 dark:text-slate-300" />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    {oauthBusy === 'apple' ? 'Wait…' : 'Apple'}
                  </span>
                </motion.button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
