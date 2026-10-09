import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, Shield, Lock, ShieldAlert, CheckCircle2, Clock, 
  Building2, Mail, 
  KeyRound, Send, AlertTriangle, RefreshCw, XCircle, Info, Check
} from 'lucide-react'
import { useAuth } from '../services/authService'
import { 
  getUserProfile, 
  updateUserProfile, 
  requestProfileChange, 
  changeUserPassword,
  type UserProfileData 
} from '../services/roleService'
import { ApiError } from '../services/apiClient'

export function ProfilePage() {
  const { tokens } = useAuth()
  const accessToken = tokens?.accessToken || null

  const [profile, setProfile] = useState<UserProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'security' | 'history'>('info')

  // Direct edit states
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyGrades, setNotifyGrades] = useState(true)
  const [savingDirect, setSavingDirect] = useState(false)
  const [directSuccess, setDirectSuccess] = useState<string | null>(null)
  const [directError, setDirectError] = useState<string | null>(null)

  // Password states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Approval request modal states
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [reqFirstName, setReqFirstName] = useState('')
  const [reqLastName, setReqLastName] = useState('')
  const [reqAcademicYear, setReqAcademicYear] = useState('')
  const [reqStudentId, setReqStudentId] = useState('')
  const [reqDepartment, setReqDepartment] = useState('')
  const [reqEmployeeId, setReqEmployeeId] = useState('')
  const [reqDesignation, setReqDesignation] = useState('')
  const [reqReason, setReqReason] = useState('')
  const [submittingReq, setSubmittingReq] = useState(false)
  const [reqError, setReqError] = useState<string | null>(null)

  async function loadProfile() {
    if (!accessToken) return
    setLoading(true)
    setDirectError(null)
    try {
      const data = await getUserProfile(accessToken)
      setProfile(data)
      setDisplayName(data.displayName || `${data.firstName} ${data.lastName}`.trim())
      setPhone(data.phone || (data.metadata?.phone as string) || '')
      setBio(data.bio || (data.metadata?.bio as string) || '')
      const notifs = data.metadata?.notifications as Record<string, boolean> | undefined
      if (notifs) {
        setNotifyEmail(notifs.email ?? true)
        setNotifyGrades(notifs.grades ?? true)
      }
    } catch (e) {
      setDirectError(e instanceof Error ? e.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [accessToken])

  async function handleSaveDirect(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setSavingDirect(true)
    setDirectError(null)
    setDirectSuccess(null)
    try {
      await updateUserProfile(accessToken, {
        displayName: displayName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        notificationPreferences: {
          email: notifyEmail,
          grades: notifyGrades,
        }
      })
      setDirectSuccess('Personal profile settings updated successfully!')
      void loadProfile()
    } catch (e) {
      setDirectError(e instanceof ApiError ? e.message : 'Failed to update profile')
    } finally {
      setSavingDirect(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken) return
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long')
      return
    }

    setSavingPassword(true)
    try {
      await changeUserPassword(accessToken, {
        currentPassword,
        newPassword
      })
      setPasswordSuccess('Password changed successfully! Keep your new credentials safe.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      setPasswordError(e instanceof ApiError ? e.message : 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleOpenRequestModal() {
    if (!profile) return
    const meta = profile.metadata || {}
    setReqFirstName(profile.firstName || '')
    setReqLastName(profile.lastName || '')
    setReqAcademicYear((meta.academic_year as string) || '')
    setReqStudentId((meta.student_id as string) || '')
    setReqDepartment((meta.department as string) || '')
    setReqEmployeeId((meta.employee_id as string) || '')
    setReqDesignation((meta.designation as string) || '')
    setReqReason('')
    setReqError(null)
    setShowRequestModal(true)
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!accessToken || !profile) return
    setSubmittingReq(true)
    setReqError(null)

    const changes: Record<string, any> = {}
    const meta = profile.metadata || {}

    if (reqFirstName.trim() && reqFirstName.trim() !== profile.firstName) {
      changes.firstName = reqFirstName.trim()
    }
    if (reqLastName.trim() && reqLastName.trim() !== profile.lastName) {
      changes.lastName = reqLastName.trim()
    }
    if (reqAcademicYear.trim() && reqAcademicYear.trim() !== meta.academic_year) {
      changes.academic_year = reqAcademicYear.trim()
    }
    if (reqStudentId.trim() && reqStudentId.trim() !== meta.student_id) {
      changes.student_id = reqStudentId.trim()
    }
    if (reqDepartment.trim() && reqDepartment.trim() !== meta.department) {
      changes.department = reqDepartment.trim()
    }
    if (reqEmployeeId.trim() && reqEmployeeId.trim() !== meta.employee_id) {
      changes.employee_id = reqEmployeeId.trim()
    }
    if (reqDesignation.trim() && reqDesignation.trim() !== meta.designation) {
      changes.designation = reqDesignation.trim()
    }

    if (Object.keys(changes).length === 0) {
      setReqError('No changed values detected. Modify at least one field to request approval.')
      setSubmittingReq(false)
      return
    }

    try {
      await requestProfileChange(accessToken, {
        requestedChanges: changes,
        reason: reqReason.trim()
      })
      setShowRequestModal(false)
      setDirectSuccess('Profile change request submitted for administrator review!')
      void loadProfile()
    } catch (e) {
      setReqError(e instanceof ApiError ? e.message : 'Failed to submit change request')
    } finally {
      setSubmittingReq(false)
    }
  }

  const role = profile?.isSysAdmin ? 'Super Admin' : (profile?.roles?.[0] || 'User')
  const initials = ((profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '')).toUpperCase() || (profile?.email?.[0] || 'U').toUpperCase()
  const isStudent = profile?.roles?.includes('student')
  const isTeacher = profile?.roles?.includes('teacher')

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw size={28} className="animate-spin text-blue-600 dark:text-blue-400" />
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">Loading profile details...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-red-200 dark:border-red-900/40">
        <XCircle size={36} className="text-red-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Unable to load profile</h3>
        <p className="text-xs text-slate-500 mt-1">{directError || 'Please re-authenticate or refresh.'}</p>
        <button onClick={() => void loadProfile()} className="mt-4 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-xl">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-slate-50/80 to-blue-50/30 dark:from-zinc-900 dark:via-zinc-900/80 dark:to-blue-950/20 border border-slate-200/80 dark:border-zinc-800/80 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-blue-400/10 via-indigo-500/10 to-violet-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-2xl sm:text-3xl shadow-lg shadow-indigo-500/20 ring-4 ring-white dark:ring-zinc-800">
              {initials}
            </div>
            <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
              <CheckCircle2 size={10} /> Active
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                {profile.displayName || `${profile.firstName} ${profile.lastName}`.trim() || profile.email}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                {role}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><Mail size={13} className="text-slate-400" /> {profile.email}</span>
              {profile.institutionName && (
                <>
                  <span className="text-slate-300 dark:text-zinc-700">•</span>
                  <span className="flex items-center gap-1"><Building2 size={13} className="text-indigo-500" /> {profile.institutionName}</span>
                </>
              )}
            </p>

            <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Clock size={12} /> Member since {new Date(profile.createdAt).toLocaleDateString()}
              </span>
              {profile.lastLogin && (
                <>
                  <span>•</span>
                  <span>Last active {new Date(profile.lastLogin).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-6 sm:mt-8 pt-5 border-t border-slate-200/70 dark:border-zinc-800/80 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'info'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <User size={15} /> Profile & Records
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'security'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <KeyRound size={15} /> Security & Password
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 relative ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Clock size={15} /> Approval Audit Trail
            {profile.pendingRequest && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {directSuccess && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            {directSuccess}
          </div>
          <button onClick={() => setDirectSuccess(null)}><XCircle size={14} /></button>
        </motion.div>
      )}

      {directError && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            {directError}
          </div>
          <button onClick={() => setDirectError(null)}><XCircle size={14} /></button>
        </motion.div>
      )}

      {/* Active Pending Request Banner */}
      {profile.pendingRequest && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <Clock size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Pending Administrator Approval
              </div>
              <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                A profile change request was submitted on {new Date(profile.pendingRequest.createdAt).toLocaleDateString()}. Changes will take effect once authorized by your institution management.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('history')}
            className="px-3 py-1.5 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shrink-0"
          >
            Review Request Details
          </button>
        </div>
      )}

      {/* TAB 1: Profile & Records */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          {/* Section 1: Directly Editable Details */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <User size={18} className="text-emerald-500" /> Personal Profile Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  These personal preferences can be updated anytime without institutional review.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                Directly Editable
              </span>
            </div>

            <form onSubmit={handleSaveDirect} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Preferred Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Displayed in chat rooms and greeting banners.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Used strictly for account security and SMS alerts.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  About Me / Bio
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share a short bio, research interests, or academic goals..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 transition-colors"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Email Announcements
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={notifyGrades}
                      onChange={(e) => setNotifyGrades(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    Grade & Assessment Alerts
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={savingDirect}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {savingDirect ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  Save Personal Settings
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Protected Details Requiring Approval */}
          <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-amber-500" /> Protected Academic & Official Records
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Official credentials require verification by your institution administrator before updates are committed.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                Requires Approval
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Legal Full Name</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {profile.firstName} {profile.lastName}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Official identification record</div>
              </div>

              {isStudent && (
                <>
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Academic Year / Grade</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {profile.metadata?.academic_year || 'Not specified'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Enrolled grade level cohort</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Student / Roll ID</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                      {profile.metadata?.student_id || 'Not assigned'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Institutional student identifier</div>
                  </div>
                </>
              )}

              {isTeacher && (
                <>
                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Faculty Employee ID</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
                      {profile.metadata?.employee_id || 'Not specified'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Staff payroll & records ID</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Academic Designation</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                      {profile.metadata?.designation || 'Educator / Faculty'}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Official institutional title</div>
                  </div>
                </>
              )}

              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-800">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Department / Major</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {profile.metadata?.department || 'General Curriculum'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Assigned faculty or school division</div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleOpenRequestModal}
                disabled={!!profile.pendingRequest}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                {profile.pendingRequest ? 'Modification Request Pending' : 'Request Official Modification'}
              </button>
            </div>
          </div>

          {/* Section 3: Non-Editable / Immutable Details */}
          <div className="p-6 sm:p-7 rounded-3xl bg-slate-50/60 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Lock size={18} className="text-slate-400 dark:text-slate-500" /> Immutable Identity Anchors
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Locked by database row-level security to prevent privilege tampering and tenant leakage.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-zinc-700">
                Locked & Immutable
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 relative">
                <Lock size={13} className="absolute top-4 right-4 text-slate-300 dark:text-zinc-700" />
                <div className="text-[11px] font-bold text-slate-400">Registered Email</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 font-mono">
                  {profile.email}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Primary authentication credential</div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 relative">
                <Lock size={13} className="absolute top-4 right-4 text-slate-300 dark:text-zinc-700" />
                <div className="text-[11px] font-bold text-slate-400">Assigned Tenant / Institution</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {profile.institutionName || 'Global Platform'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1 font-mono truncate">
                  ID: {profile.institutionId}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 relative">
                <Lock size={13} className="absolute top-4 right-4 text-slate-300 dark:text-zinc-700" />
                <div className="text-[11px] font-bold text-slate-400">Account UUID</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 font-mono truncate">
                  {profile.userId}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Cryptographic database identity</div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 relative">
                <Lock size={13} className="absolute top-4 right-4 text-slate-300 dark:text-zinc-700" />
                <div className="text-[11px] font-bold text-slate-400">Role Boundary</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 uppercase">
                  {profile.roles?.join(', ') || 'N/A'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Assigned RBAC clearance</div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 relative">
                <Lock size={13} className="absolute top-4 right-4 text-slate-300 dark:text-zinc-700" />
                <div className="text-[11px] font-bold text-slate-400">Onboarding Date</div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                  {new Date(profile.createdAt).toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Account provisioned timestamp</div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 relative">
                <Lock size={13} className="absolute top-4 right-4 text-slate-300 dark:text-zinc-700" />
                <div className="text-[11px] font-bold text-slate-400">Multi-Tenant Isolation</div>
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <Shield size={12} /> RLS Boundary Enforced
                </div>
                <div className="text-[10px] text-slate-400 mt-1">SafeScholar zero-trust mesh</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="pb-4 border-b border-slate-100 dark:border-zinc-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <KeyRound size={18} className="text-blue-600" /> Change Password
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Protect your account using an Argon2id-hashed master password. Minimum 8 characters.
            </p>
          </div>

          {passwordSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={savingPassword}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {savingPassword ? <RefreshCw size={14} className="animate-spin" /> : <KeyRound size={14} />}
              Update Password
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Approval Audit Trail */}
      {activeTab === 'history' && (
        <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-6">
          <div className="pb-4 border-b border-slate-100 dark:border-zinc-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock size={18} className="text-indigo-600" /> Modification & Approval History
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Complete audit log of all registration and profile change requests submitted for this account.
            </p>
          </div>

          {(!profile.requestHistory || profile.requestHistory.length === 0) ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/60 dark:border-zinc-800">
              <Info size={28} className="text-slate-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">No modification requests logged</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Any official changes you request will be tracked here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {profile.requestHistory.map((item) => {
                const reqType = item.requestType || 'USER'
                const isPending = item.status === 'PENDING'
                const isApproved = item.status === 'APPROVED' || item.status === 'active'
                const changes = item.metadata?.requested_changes as Record<string, any> | undefined

                return (
                  <div
                    key={item.requestId}
                    className="p-5 rounded-2xl bg-slate-50/70 dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-800 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                          {reqType === 'profile_edit' ? 'Profile Record Modification' : `Account Onboarding (${reqType})`}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPending ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                          isApproved ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                          'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Submitted {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {changes && (
                      <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800 text-xs">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Requested Modifications:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(changes).map(([k, v]) => (
                            <div key={k} className="flex items-center gap-2">
                              <span className="text-slate-500 capitalize">{k.replace('_', ' ')}:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                        {item.metadata?.reason && (
                          <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 italic">
                            Reason: "{item.metadata.reason}"
                          </div>
                        )}
                      </div>
                    )}

                    {item.rejectionReason && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
                        <span className="font-bold">Rejection Note:</span> {item.rejectionReason}
                      </div>
                    )}

                    {item.reviewedAt && (
                      <div className="text-[10px] text-slate-400">
                        Reviewed on {new Date(item.reviewedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Request Official Profile Modification */}
      <AnimatePresence>
        {showRequestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-amber-500" /> Request Official Record Modification
                </h4>
                <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Modifications to official credentials require verification by your institution administrator before they become active.
              </p>

              {reqError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-300">
                  {reqError}
                </div>
              )}

              <form onSubmit={handleSubmitRequest} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={reqFirstName}
                      onChange={(e) => setReqFirstName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={reqLastName}
                      onChange={(e) => setReqLastName(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {isStudent && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Academic Year / Grade
                      </label>
                      <input
                        type="text"
                        value={reqAcademicYear}
                        onChange={(e) => setReqAcademicYear(e.target.value)}
                        placeholder="e.g. Year 12"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Student ID Number
                      </label>
                      <input
                        type="text"
                        value={reqStudentId}
                        onChange={(e) => setReqStudentId(e.target.value)}
                        placeholder="e.g. STU-4912"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                {isTeacher && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Employee ID
                      </label>
                      <input
                        type="text"
                        value={reqEmployeeId}
                        onChange={(e) => setReqEmployeeId(e.target.value)}
                        placeholder="e.g. FAC-109"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Designation
                      </label>
                      <input
                        type="text"
                        value={reqDesignation}
                        onChange={(e) => setReqDesignation(e.target.value)}
                        placeholder="e.g. Senior Faculty"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department / Major
                  </label>
                  <input
                    type="text"
                    value={reqDepartment}
                    onChange={(e) => setReqDepartment(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Justification / Reason for Modification
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={reqReason}
                    onChange={(e) => setReqReason(e.target.value)}
                    placeholder="e.g. Legal name amendment or department transfer approved by registrar"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReq}
                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-600/20 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submittingReq ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit for Approval
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
