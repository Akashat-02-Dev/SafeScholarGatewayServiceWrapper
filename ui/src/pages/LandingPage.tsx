import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, BookOpen, GraduationCap, Shield, Users, CheckCircle2, 
  ArrowRight, Award, FileText, Bot, 
  Layers, ChevronDown, School, Laptop, ShieldCheck, 
  Zap, MessageSquare, Compass, 
  AlertCircle, CheckCircle
} from 'lucide-react';
import { useAuth } from '../services/authService';

export const LandingPage: React.FC = () => {
  const { status, me } = useAuth();

  // Interactive Demo Tab
  const [activeDemoTab, setActiveDemoTab] = useState<'planner' | 'socratic' | 'rubric' | 'governance'>('planner');

  // Tool Catalog Filter
  const [activeCategory, setActiveCategory] = useState<'all' | 'educator' | 'student' | 'admin'>('all');

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const toolCatalog = [
    {
      id: 'lesson-planner',
      category: 'educator',
      title: 'ACARA Lesson Plan Architect',
      desc: 'Build multi-week sequential lesson plans mapped directly to Australian Curriculum V9 syllabus codes, WALT learning intentions, and WILF success criteria.',
      badge: 'ACARA V9 Aligned',
      badgeColor: 'blue',
      icon: BookOpen,
      role: 'Teachers & HODs',
    },
    {
      id: 'rubric-generator',
      category: 'educator',
      title: 'Standards-Based Rubric Matrix',
      desc: 'Generate 4-tier developmental marking guides with specific achievement level descriptors, student-friendly rubrics, and feedback matrices.',
      badge: '4-Point Matrix',
      badgeColor: 'indigo',
      icon: Award,
      role: 'Educators',
    },
    {
      id: 'worksheet-generator',
      category: 'educator',
      title: 'Differentiated Worksheet Studio',
      desc: 'Produce tiered learning activities in seconds with scaffolding for support, core classroom mastery, and high-potential extension learners.',
      badge: '3-Tier Scaffold',
      badgeColor: 'teal',
      icon: FileText,
      role: 'Educators',
    },
    {
      id: 'assessment-generator',
      category: 'educator',
      title: 'Summative & Diagnostic Assessment Studio',
      desc: 'Create standards-linked quizzes, multiple choice questions, short answer reasoning, and exit tickets with matching teacher marking keys.',
      badge: 'Instant Marking Key',
      badgeColor: 'blue',
      icon: Zap,
      role: 'Teachers',
    },
    {
      id: 'text-leveler',
      category: 'educator',
      title: 'Lexile Reading Level Transformer',
      desc: 'Adapt complex primary sources, news stories, and literature to match specific student reading bands without sacrificing core conceptual meaning.',
      badge: 'Prep - Year 12',
      badgeColor: 'purple',
      icon: Compass,
      role: 'Educators & Learning Support',
    },
    {
      id: 'custom-bot',
      category: 'educator',
      title: 'Classroom Persona & Custom Bot Studio',
      desc: 'Deploy custom pedagogical assistants tailored with your bespoke rubrics, historical personas, or novel-study characters with safety guardrails.',
      badge: 'Custom Prompts',
      badgeColor: 'emerald',
      icon: Bot,
      role: 'Teachers',
    },
    {
      id: 'socratic-tutor',
      category: 'student',
      title: 'Socratic Inquiry Sandbox',
      desc: 'Safe, guided student AI chat that uses scaffolded questioning to build independent thinking — strict guardrails prevent giving direct answers or cheating.',
      badge: 'Zero-Cheat Guardrail',
      badgeColor: 'emerald',
      icon: MessageSquare,
      role: 'Students Prep-12',
    },
    {
      id: 'writing-studio',
      category: 'student',
      title: 'Student Writing Studio & NAPLAN Coach',
      desc: 'Step-by-step drafting partner providing formative feedback on narrative voice, persuasive evidence, sentence variation, and spelling.',
      badge: 'Formative Feedback',
      badgeColor: 'emerald',
      icon: Sparkles,
      role: 'Students',
    },
    {
      id: 'student-rooms',
      category: 'student',
      title: 'Classroom PIN Join Rooms',
      desc: 'Students enter secure teacher-hosted AI rooms with a 6-digit access code for controlled, monitored group exploration.',
      badge: 'Teacher Supervised',
      badgeColor: 'teal',
      icon: Users,
      role: 'Classrooms',
    },
    {
      id: 'moderation-panel',
      category: 'admin',
      title: 'Real-Time Content Moderation Engine',
      desc: 'Automated policy filters catch and isolate safety violations, self-harm cues, or inappropriate queries before reaching student screens.',
      badge: 'Real-Time Filter',
      badgeColor: 'rose',
      icon: ShieldCheck,
      role: 'District Admins',
    },
    {
      id: 'tenant-governance',
      category: 'admin',
      title: 'Tenant Isolation & Signup Gatekeeper',
      desc: 'Institute administrators approve or reject educator and student registrations, manage school quotas, and enforce district boundaries.',
      badge: 'Multi-Tenant',
      badgeColor: 'amber',
      icon: School,
      role: 'Principals & IT',
    },
    {
      id: 'rag-curriculum',
      category: 'admin',
      title: 'District Curriculum Knowledge RAG',
      desc: 'Ingest school policies, local curriculum handbooks, and specific regional guidelines into the AI context for localized precision.',
      badge: 'Custom Knowledge',
      badgeColor: 'indigo',
      icon: Layers,
      role: 'System Admins',
    },
  ];

  const filteredTools = toolCatalog.filter((t) => {
    if (activeCategory === 'all') return true;
    return t.category === activeCategory;
  });

  const faqs = [
    {
      q: 'How does SafeScholar prevent students from using AI to cheat or copy homework?',
      a: 'Unlike generic public chatbots that write full essays on demand, SafeScholar’s Student Socratic Sandbox is governed by strict pedagogical guardrails. When a student asks "Write my essay" or "Give me the answer to question 4", the engine refuses direct answers and instead breaks down the concept, asks guiding reflective questions, and prompts the student to formulate their own conclusions.',
    },
    {
      q: 'How does SafeScholar align with the Australian Curriculum (ACARA)?',
      a: 'Our generative models are integrated with official ACARA V9 curriculum frameworks across Learning Areas (Mathematics, English, Science, HASS, Technologies, and The Arts). Lesson plans, rubrics, and activities are tagged with official syllabus codes, content descriptors, learning intentions (WALT), and success criteria (WILF).',
    },
    {
      q: 'How does the teacher and student registration approval process work?',
      a: 'When an educator or student registers for an institution, their account enters a pending state. The designated school or district administrator receives the request in their management portal, where they can verify employee or student IDs, confirm departmental allocations, and approve or reject the request with one click.',
    },
    {
      q: 'Is student data safe and compliant with privacy regulations?',
      a: 'Yes. SafeScholar enforces multi-tenant cryptographic isolation. Student prompts and school documents are NEVER used to retrain foundation AI models. We sanitize student PII in real-time, comply with FERPA/COPPA principles, and adhere to Australian Privacy Principles (APPs).',
    },
    {
      q: 'Can our school or district customize AI tool permissions for different grade levels?',
      a: 'Absolutely. School administrators have granular control. You can enable or disable specific AI tools (such as full chatbots, text levelers, or rubric generators) on a per-grade or per-educator basis, and adjust monthly generation quotas to match your institutional policies.',
    },
  ];

  return (
    <div className="w-full flex-1 flex flex-col overflow-hidden">
      {/* Top Welcome Bar for Logged-In Users */}
      {status === 'authenticated' && (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white text-xs py-2 px-4 shadow-sm">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-300" />
              <span>
                Welcome back, <strong>{me?.firstName || me?.email}</strong>! You have an active {me?.roles?.[0] || 'member'} session.
              </span>
            </div>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white text-blue-900 font-bold hover:bg-blue-50 transition-colors shadow-sm text-xs"
            >
              <span>Go to Dashboard</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-8 pb-16 md:pt-14 md:pb-24 overflow-hidden">
        {/* Ambient Glow Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-1/3 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[40rem] h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            {/* Pill Banner */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-teal-500/10 border border-blue-500/20 dark:border-blue-400/20 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-sm"
            >
              <Shield size={14} className="text-blue-600 dark:text-blue-400" />
              <span>Built Exclusively for Educators, Students & School Districts</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.1]"
            >
              Intelligent AI for Classrooms.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600">
                Safe, Curriculum-Aligned & Built to Teach.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed"
            >
              Empower educators to reclaim 5+ hours every week on lesson planning, tiered rubrics, and differentiated activities — while providing learners with safe, guided Socratic AI that fosters genuine inquiry without cheating.
            </motion.p>

            {/* Primary Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2"
            >
              <Link
                to="/login?mode=register"
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 group"
              >
                <span>Get Started Free</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="#interactive-demo"
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-700 text-slate-800 dark:text-slate-100 font-bold text-sm border border-slate-200/80 dark:border-zinc-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={16} className="text-amber-500" />
                <span>Explore Live Demo</span>
              </a>

              <Link
                to="/login?mode=register&role=institute_management"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-semibold text-sm transition-colors flex items-center justify-center gap-1.5"
              >
                <School size={16} />
                <span>District Leaders →</span>
              </Link>
            </motion.div>

            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="pt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>ACARA V9 Curriculum Mapped</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>Socratic Anti-Cheating Sandbox</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>Zero Model Retraining on Student Data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <span>Multi-Tenant Cryptographic Boundaries</span>
              </div>
            </motion.div>
          </div>

          {/* Interactive Product Preview Showcase */}
          <div id="interactive-demo" className="mt-14 scroll-mt-24">
            <div className="card shadow-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden">
              {/* Tab Selector Header */}
              <div className="bg-slate-100/70 dark:bg-zinc-800/60 p-3 sm:p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveDemoTab('planner')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeDemoTab === 'planner'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-zinc-700/60'
                    }`}
                  >
                    <BookOpen size={14} />
                    <span>ACARA Lesson Sequence</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDemoTab('socratic')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeDemoTab === 'socratic'
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-zinc-700/60'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>Socratic Student Sandbox</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDemoTab('rubric')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeDemoTab === 'rubric'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-zinc-700/60'
                    }`}
                  >
                    <Award size={14} />
                    <span>Standards Rubric Matrix</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDemoTab('governance')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeDemoTab === 'governance'
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-zinc-700/60'
                    }`}
                  >
                    <Shield size={14} />
                    <span>District Governance</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 px-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="hidden sm:inline">Interactive SafeScholar Engine</span>
                </div>
              </div>

              {/* Tab Display Body */}
              <div className="p-5 sm:p-8">
                <AnimatePresence mode="wait">
                  {/* 1. LESSON PLANNER TAB */}
                  {activeDemoTab === 'planner' && (
                    <motion.div
                      key="planner"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-zinc-800">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 uppercase tracking-wide">
                              Syllabus Code: AC9M4N01
                            </span>
                            <span className="text-xs font-bold text-slate-500">Year 4 Mathematics</span>
                          </div>
                          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
                            Unit Sequence: Place Value Multi-Step Reasoning & Regrouping
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            to="/login?mode=register&role=teacher"
                            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                          >
                            <span>Try In Lesson Planner</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                            <Compass size={14} /> Learning Intention (WALT)
                          </h4>
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 font-medium leading-relaxed">
                            We are learning to represent, partition, and solve addition problems using five-digit numbers by applying strategic place value regrouping.
                          </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> Success Criteria (WILF)
                          </h4>
                          <ul className="text-xs text-slate-700 dark:text-slate-300 mt-2 space-y-1 font-medium list-disc list-inside">
                            <li>I can explain the value of digits up to ten thousands.</li>
                            <li>I can model regrouping using concrete manipulatives and number expanders.</li>
                            <li>I can justify which mental strategy is most efficient for given sums.</li>
                          </ul>
                        </div>
                      </div>

                      {/* Tiered Scaffolding */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                          <Layers size={14} /> 3-Tier Differentiated Activities Matrix
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-800/40">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Tier 1: Targeted Support
                            </span>
                            <div className="font-bold text-slate-800 dark:text-white mt-2">MAB Blocks & Expander Cards</div>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-[11px] leading-relaxed">
                              Hands-on tactile modeling with base-10 materials, visual anchor charts, and step-by-step regrouping mats.
                            </p>
                          </div>

                          <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                              Tier 2: Core Classroom Mastery
                            </span>
                            <div className="font-bold text-slate-800 dark:text-white mt-2">Worded Problem Scenarios</div>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-[11px] leading-relaxed">
                              Solving multistep real-world school budget scenarios and recording algorithm reasoning in student journals.
                            </p>
                          </div>

                          <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                              Tier 3: High-Potential Extension
                            </span>
                            <div className="font-bold text-slate-800 dark:text-white mt-2">Cryptarithmetic & Missing Digits</div>
                            <p className="text-slate-500 dark:text-slate-400 mt-1 text-[11px] leading-relaxed">
                              Reverse algebraic logic puzzles where students deduce missing addends and construct proofs of their methods.
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* 2. SOCRATIC TUTOR TAB */}
                  {activeDemoTab === 'socratic' && (
                    <motion.div
                      key="socratic"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4 max-w-3xl mx-auto"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                            <Bot size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">SafeScholar Socratic Tutor</div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <ShieldCheck size={12} /> Guardrail Level: Strict Pedagogical (Anti-Cheating Active)
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400">Year 5 Science • Ecosystems</span>
                      </div>

                      {/* Chat Bubbles */}
                      <div className="space-y-3 pt-2">
                        {/* Student Prompt */}
                        <div className="flex items-start gap-3 justify-end">
                          <div className="bg-blue-600 text-white p-3.5 rounded-2xl rounded-tr-none text-xs max-w-md shadow-sm">
                            <div className="font-bold text-[10px] text-blue-200 mb-1">Student (Oliver, Year 5)</div>
                            "Can you just write my paragraph about why bees are important so I can paste it into my Google Doc?"
                          </div>
                        </div>

                        {/* AI Socratic Response */}
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                            <Sparkles size={16} />
                          </div>
                          <div className="bg-slate-100 dark:bg-zinc-800 p-4 rounded-2xl rounded-tl-none text-xs max-w-lg text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-zinc-700 shadow-sm space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span>SafeScholar Pedagogical Response</span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-[9px]">
                                Guided Inquiry
                              </span>
                            </div>
                            <p>
                              I can't write your paragraph for you, Oliver, but I'm here to help you build great ideas for it! 🐝
                            </p>
                            <p>
                              Think about what you had for breakfast or lunch today. Almost one out of every three bites of food we eat depends on pollinators like bees.
                            </p>
                            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 font-semibold text-emerald-900 dark:text-emerald-200">
                              Question for you: What happens to flowering fruit trees like apples or strawberries if there are no bees to carry pollen between them?
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={14} className="text-emerald-500" />
                          <span>Student Safety Filter: 100% Passed</span>
                          <span>•</span>
                          <span>Zero PII Exposed</span>
                        </div>
                        <Link
                          to="/login?mode=register&role=student"
                          className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <span>Explore Student Experience</span>
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </motion.div>
                  )}

                  {/* 3. STANDARDS RUBRIC MATRIX TAB */}
                  {activeDemoTab === 'rubric' && (
                    <motion.div
                      key="rubric"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            Year 6 Persuasive Essay Assessment Matrix
                          </h3>
                          <p className="text-xs text-slate-500">ACARA English: Creating Texts (AC9E6LY06)</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                          4-Tier Achievement Grid
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-zinc-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-zinc-800 uppercase text-[10px] tracking-wider">
                            <tr>
                              <th className="p-3 w-1/4">Criteria</th>
                              <th className="p-3 text-rose-700 dark:text-rose-400">1: Working Towards</th>
                              <th className="p-3 text-amber-700 dark:text-amber-400">2: Approaching</th>
                              <th className="p-3 text-blue-700 dark:text-blue-400">3: Meeting Standard</th>
                              <th className="p-3 text-emerald-700 dark:text-emerald-400">4: Exceeding Standard</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            <tr>
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-zinc-800/30">
                                Argument & Cohesion
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                States an opinion with disjointed ideas and minimal linking words.
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                Follows basic paragraph structure with simple transitions.
                              </td>
                              <td className="p-3 text-slate-800 dark:text-slate-200 font-medium text-[11px] bg-blue-50/30 dark:bg-blue-950/20">
                                Logical flow of ideas with sophisticated cohesive ties between arguments.
                              </td>
                              <td className="p-3 text-slate-800 dark:text-slate-200 font-semibold text-[11px] bg-emerald-50/30 dark:bg-emerald-950/20">
                                Compelling thesis maintained with seamless counter-argument refutations.
                              </td>
                            </tr>
                            <tr>
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-zinc-800/30">
                                Persuasive Rhetoric
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                Relies solely on personal statements without supporting evidence.
                              </td>
                              <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                Includes rhetorical questions and basic emotive vocabulary.
                              </td>
                              <td className="p-3 text-slate-800 dark:text-slate-200 font-medium text-[11px] bg-blue-50/30 dark:bg-blue-950/20">
                                Purposeful integration of statistics, modality, and expert testimony.
                              </td>
                              <td className="p-3 text-slate-800 dark:text-slate-200 font-semibold text-[11px] bg-emerald-50/30 dark:bg-emerald-950/20">
                                Nuanced voice manipulating tone and pacing to deeply influence audience.
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {/* 4. GOVERNANCE TAB */}
                  {activeDemoTab === 'governance' && (
                    <motion.div
                      key="governance"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
                        <div>
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            School District Multi-Tenant Governance
                          </h3>
                          <p className="text-xs text-slate-500">Autonomous namespace control with instant approval gatekeeping</p>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Live Institutional Roster
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                          <div className="text-[11px] font-bold text-slate-500 uppercase">Pending Approvals</div>
                          <div className="text-2xl font-black text-amber-600 mt-1">3 Faculty • 12 Students</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Awaiting Administrator Review</div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                          <div className="text-[11px] font-bold text-slate-500 uppercase">Content Policy Health</div>
                          <div className="text-2xl font-black text-emerald-600 mt-1">99.98% Safe</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">0 Unhandled PII Leaks</div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/70 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700">
                          <div className="text-[11px] font-bold text-slate-500 uppercase">Monthly Gen Quota</div>
                          <div className="text-2xl font-black text-blue-600 mt-1">2,840 / 5,000</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Fair Usage Allocation</div>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center shrink-0">
                            <Shield size={18} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white">Self-Service Approval Workflow</div>
                            <div className="text-[11px] text-slate-500">Incoming teachers and students cannot access school resources until vetted by local administration.</div>
                          </div>
                        </div>
                        <Link
                          to="/login?mode=register&role=institute_management"
                          className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow shrink-0"
                        >
                          Request District Access
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof & Metrics Strip */}
      <section className="py-12 border-y border-slate-200/80 dark:border-zinc-800/80 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-blue-600 tracking-tight">5+ Hours</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Saved per Teacher Weekly
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-indigo-600 tracking-tight">60+</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Curriculum AI Engines
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">100%</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                ACARA V9 Syllabus Mapped
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-3xl sm:text-4xl font-black text-teal-600 tracking-tight">0%</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Student Data Retention
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Three Pillars Section */}
      <section className="py-20 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900">
            Tailored Experiences
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
            Designed for Every Stakeholder in Modern Education
          </h2>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-2">
            One platform that unifies educator productivity, safe student discovery, and rigorous district compliance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Educators */}
          <div className="card rounded-3xl p-7 border border-slate-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 shadow-lg flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center mb-5">
                <GraduationCap size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                For Teachers & Faculty
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                Say goodbye to late Sunday nights writing unit plans from scratch. SafeScholar generates rich curriculum units, diagnostic rubrics, and tiered worksheets aligned with your syllabus outcomes in minutes.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-600" />
                  <span>Sequential ACARA lesson plans with WALT/WILF</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-600" />
                  <span>3-tier differentiated worksheets & learning tasks</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-600" />
                  <span>Objective report card comment generator</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-blue-600" />
                  <span>Lexile reading level transformer for any passage</span>
                </li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                to="/login?mode=register&role=teacher"
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Educator Onboarding</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 2: Students */}
          <div className="card rounded-3xl p-7 border border-emerald-200/80 dark:border-emerald-900/50 bg-white/70 dark:bg-zinc-900/60 shadow-lg flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-5">
                <Laptop size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                For Students & Learners
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                A supportive AI partner designed to coach, not write essays for you. Socratic guidance breaks down tough concepts, levels complex texts to individual reading ages, and enhances writing step by step.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Socratic tutor that asks guiding questions</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Strict anti-cheating response barriers</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Writing studio for narrative & persuasive drafting</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Safe room join via teacher PIN code</span>
                </li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                to="/login?mode=register&role=student"
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Student Portal</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Card 3: District Leaders */}
          <div className="card rounded-3xl p-7 border border-slate-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 shadow-lg flex flex-col justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center mb-5">
                <School size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                For Schools & District IT
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
                Total institutional governance. Manage student and teacher onboarding with manual approval gates, monitor safety flags with real-time moderation, and enforce multi-tenant isolation across all schools.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-indigo-600" />
                  <span>Self-service signup approval management queue</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-indigo-600" />
                  <span>Zero model training guarantee on school data</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-indigo-600" />
                  <span>Automated content moderation & incident audit log</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-indigo-600" />
                  <span>District curriculum knowledge ingestion (RAG)</span>
                </li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                to="/login?mode=register&role=institute_management"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow flex items-center justify-center gap-1.5 transition-all"
              >
                <span>Institutional License</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Catalog Showcase */}
      <section className="py-16 bg-slate-100/50 dark:bg-zinc-900/30 border-y border-slate-200/80 dark:border-zinc-800">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Product Ecosystem
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tracking-tight">
                Explore the SafeScholar AI Suite
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                A unified ecosystem covering curriculum planning, differentiated instruction, student inquiry, and safety.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'All Solutions' },
                { key: 'educator', label: 'Educators' },
                { key: 'student', label: 'Students' },
                { key: 'admin', label: 'Governance' },
              ].map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setActiveCategory(cat.key as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeCategory === cat.key
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredTools.map((t) => {
              const IconComp = t.icon;
              return (
                <div
                  key={t.id}
                  className="card rounded-2xl p-5 border border-slate-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/70 shadow-sm hover:shadow-md hover:border-blue-400/50 dark:hover:border-blue-500/50 transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <IconComp size={18} />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-zinc-700">
                        {t.badge}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {t.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                      {t.desc}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-semibold text-slate-400">{t.role}</span>
                    <Link
                      to="/login"
                      className="font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1 text-[11px]"
                    >
                      <span>Access</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison: Why SafeScholar vs Consumer AI */}
      <section className="py-20 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-900">
            Institutional Comparison
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
            Why Schools Choose SafeScholar Over Consumer Chatbots
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Generic chatbots present plagiarism risks, hallucinate standards, and expose student data. SafeScholar was purpose-built for education.
          </p>
        </div>

        <div className="card rounded-3xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-800 font-bold uppercase text-[11px] tracking-wider text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="p-4 sm:p-5 w-1/3">Security & Pedagogical Requirement</th>
                  <th className="p-4 sm:p-5 text-slate-400 dark:text-slate-500">Public Consumer AI (e.g. Generic LLMs)</th>
                  <th className="p-4 sm:p-5 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30">
                    SafeScholar Educational Suite
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800 dark:text-white">
                    ACARA Curriculum Alignment
                  </td>
                  <td className="p-4 sm:p-5 text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={15} /> Generic or Hallucinated Syllabus Codes
                  </td>
                  <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-blue-50/30 dark:bg-blue-950/20">
                    <CheckCircle size={15} className="inline mr-1.5" /> 100% Mapped to ACARA V9 Learning Areas
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800 dark:text-white">
                    Student Anti-Cheating Protection
                  </td>
                  <td className="p-4 sm:p-5 text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={15} /> Writes complete essays & solutions on demand
                  </td>
                  <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-blue-50/30 dark:bg-blue-950/20">
                    <CheckCircle size={15} className="inline mr-1.5" /> Socratic scaffolding: guides thought, blocks direct answers
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800 dark:text-white">
                    Student Privacy & Model Retraining
                  </td>
                  <td className="p-4 sm:p-5 text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={15} /> User prompts often retained for public model training
                  </td>
                  <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-blue-50/30 dark:bg-blue-950/20">
                    <CheckCircle size={15} className="inline mr-1.5" /> Zero data retention; complete PII redaction
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800 dark:text-white">
                    District Multi-Tenant Isolation
                  </td>
                  <td className="p-4 sm:p-5 text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={15} /> Public shared space with no school boundary controls
                  </td>
                  <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-blue-50/30 dark:bg-blue-950/20">
                    <CheckCircle size={15} className="inline mr-1.5" /> Cryptographic institution namespace isolation
                  </td>
                </tr>

                <tr>
                  <td className="p-4 sm:p-5 font-bold text-slate-800 dark:text-white">
                    Administrator Gatekeeper Approvals
                  </td>
                  <td className="p-4 sm:p-5 text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={15} /> Anyone with an email can create an uncontrolled login
                  </td>
                  <td className="p-4 sm:p-5 font-bold text-emerald-600 dark:text-emerald-400 bg-blue-50/30 dark:bg-blue-950/20">
                    <CheckCircle size={15} className="inline mr-1.5" /> Mandatory institute approval for teachers & learners
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (Accordion) */}
      <section className="py-16 bg-slate-50 dark:bg-zinc-900/40 border-t border-slate-200/80 dark:border-zinc-800">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Clear Answers
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 overflow-hidden shadow-sm transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 sm:p-5 text-left font-bold text-sm text-slate-900 dark:text-white flex items-center justify-between gap-4"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-600' : ''
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-zinc-700/60 pt-3">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final High-Impact CTA Banner */}
      <section className="py-20 relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-[2.5rem] bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-8 sm:p-14 shadow-2xl overflow-hidden border border-white/10 text-center">
            {/* Ambient Background Accents */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-2xl mx-auto space-y-5">
              <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-white/10 border border-white/20 text-blue-200">
                Ready to Transform Your School?
              </span>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                Bring Safe, Curriculum-Aligned AI to Your School Today.
              </h2>

              <p className="text-xs sm:text-sm text-blue-100 max-w-xl mx-auto leading-relaxed">
                Join forward-thinking educators and district leadership teams. Reclaim planning hours for teachers and safeguard every student learning session.
              </p>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/login?mode=register"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white hover:bg-blue-50 text-blue-950 font-bold text-sm shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                >
                  <span>Start Free Educator Trial</span>
                  <ArrowRight size={15} />
                </Link>

                <Link
                  to="/login"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>Sign In to SafeScholar</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
