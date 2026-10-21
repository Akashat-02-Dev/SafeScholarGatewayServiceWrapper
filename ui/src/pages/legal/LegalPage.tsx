import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Lock, Scale, CheckCircle2, Printer, 
  Search, ArrowLeft, Globe, Database, 
  Clock, Building2, ChevronRight,
  ShieldCheck, EyeOff
} from 'lucide-react';

interface LegalPageProps {
  defaultTab?: 'terms' | 'privacy';
}

export const LegalPage: React.FC<LegalPageProps> = ({ defaultTab = 'terms' }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on path or prop
  const initialTab = location.pathname.includes('privacy') 
    ? 'privacy' 
    : (location.pathname.includes('terms') ? 'terms' : defaultTab);

  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (location.pathname.includes('privacy')) {
      setActiveTab('privacy');
    } else if (location.pathname.includes('terms')) {
      setActiveTab('terms');
    }
  }, [location.pathname]);

  const handleTabChange = (tab: 'terms' | 'privacy') => {
    setActiveTab(tab);
    setSearchQuery('');
    navigate(`/${tab}`, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = () => {
    window.print();
  };

  const lastUpdated = "October 21, 2026";
  const effectiveDate = "October 21, 2026";

  return (
    <div className="min-h-screen w-full bg-slate-50/50 dark:bg-zinc-950 text-slate-800 dark:text-slate-100 transition-colors">
      
      {/* Top Breadcrumb & Status Header */}
      <div className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl -webkit-backdrop-filter sticky top-0 z-30 print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <Link 
              to="/" 
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
            >
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
            <div className="h-4 w-px bg-slate-200 dark:border-white/10" />
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <ShieldCheck size={14} className="text-blue-600 dark:text-blue-400" />
              <span>Institutional Legal & Compliance Center</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700/80 shadow-xs transition-all"
            >
              <Printer size={13} />
              <span>Print / Save PDF</span>
            </button>
          </div>

        </div>
      </div>

      {/* Hero Banner with Tab Switcher */}
      <section className="relative pt-10 pb-12 overflow-hidden border-b border-slate-200/80 dark:border-white/[0.08] bg-gradient-to-b from-blue-50/50 via-white to-transparent dark:from-zinc-900/60 dark:via-zinc-950 dark:to-zinc-950 print:pb-4 print:pt-4">
        {/* Ambient Glows */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-1/2 right-1/4 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/70 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-xs font-bold shadow-xs">
              <Scale size={14} className="text-blue-600 dark:text-blue-400" />
              <span>SafeScholar Governance, Compliance & User Data Valuation</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white font-serif">
              {activeTab === 'terms' ? 'Terms of Service' : 'Privacy & Data Protection Policy'}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              {activeTab === 'terms' 
                ? 'Legally binding terms governing institutional subscriptions, educator licensing, copyright allocation, acceptable use, and our non-retraining commitment.'
                : 'Our unwavering commitment to student privacy, Australian data sovereignty, multi-tenant row-level security, and zero model training on institutional records.'}
            </p>

            {/* Metadata Chips */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-slate-400" />
                <span>Effective: {effectiveDate} (Revised: {lastUpdated})</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Building2 size={13} className="text-slate-400" />
                <span>SafeScholar Pty Ltd (ACN / District Registered)</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Globe size={13} className="text-slate-400" />
                <span>Jurisdiction: Commonwealth of Australia & International</span>
              </span>
            </div>

            {/* Interactive Tab Switcher */}
            <div className="pt-6 flex justify-center print:hidden">
              <div className="inline-flex p-1.5 rounded-2xl bg-slate-200/80 dark:bg-zinc-800/90 border border-slate-300/80 dark:border-zinc-700 shadow-inner">
                <button
                  type="button"
                  onClick={() => handleTabChange('terms')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'terms'
                      ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Scale size={15} />
                  <span>Terms of Service</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange('privacy')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'privacy'
                      ? 'bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Lock size={15} />
                  <span>Privacy Policy & Data Security</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Core Institutional Trust Badges Strip */}
      <div className="border-b border-slate-200/80 dark:border-white/[0.08] bg-white/60 dark:bg-zinc-900/40 py-4 print:hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            
            <div className="flex items-center justify-center gap-2.5 p-2 rounded-xl bg-slate-100/60 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-white/5">
              <EyeOff size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Zero AI Training</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Prompts never train foundation models</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 p-2 rounded-xl bg-slate-100/60 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-white/5">
              <Database size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Row-Level Security (RLS)</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Cryptographically isolated tenants</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 p-2 rounded-xl bg-slate-100/60 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-white/5">
              <Globe size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Australian Data Sovereignty</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">APPs, ST4S & regional endpoints</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2.5 p-2 rounded-xl bg-slate-100/60 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-white/5">
              <ShieldCheck size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <div className="text-left leading-tight">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">FERPA & COPPA Guardrails</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Strict child & student privacy</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Main Layout: Sticky Sidebar Navigation + Content Body */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Interactive Table of Contents & Quick Search (4 cols) */}
          <aside className="lg:col-span-4 sticky top-24 space-y-5 print:hidden">
            
            {/* Quick Search Card */}
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-xs">
              <label htmlFor="legal-search" className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Search Legal Clauses
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="legal-search"
                  type="text"
                  placeholder="e.g., Copyright, COPPA, RLS, deletion..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {searchQuery && (
                <div className="mt-2 text-[11px] text-slate-500 flex justify-between items-center">
                  <span>Filtering sections matching "{searchQuery}"</span>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Table of Contents Card */}
            <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center justify-between">
                <span>Table of Contents</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">
                  {activeTab === 'terms' ? '9 Sections' : '9 Sections'}
                </span>
              </h3>

              <nav className="space-y-1 text-xs">
                {activeTab === 'terms' ? (
                  <>
                    <ToCLink id="tos-acceptance" label="1. Acceptance & Institutional Authorization" />
                    <ToCLink id="tos-pedagogy" label="2. Pedagogical Purpose & Human-in-the-Loop" />
                    <ToCLink id="tos-ip-copyright" label="3. Intellectual Property, Copyright & Valuation" />
                    <ToCLink id="tos-nonretraining" label="4. Absolute Non-Retraining Covenant" />
                    <ToCLink id="tos-acceptable-use" label="5. Acceptable Use & Anti-Cheating Mandate" />
                    <ToCLink id="tos-child-safety" label="6. Child Safety, COPPA & FERPA Protection" />
                    <ToCLink id="tos-accounts" label="7. Accounts, RBAC & Soft Account Isolation" />
                    <ToCLink id="tos-liability" label="8. Disclaimers, Warranty & Liability Bounds" />
                    <ToCLink id="tos-governing-law" label="9. Governing Law, Modifications & Notices" />
                  </>
                ) : (
                  <>
                    <ToCLink id="priv-commitment" label="1. Educational Data Valuation & Commitment" />
                    <ToCLink id="priv-regulations" label="2. Legal Frameworks: APPs, ST4S, FERPA, COPPA" />
                    <ToCLink id="priv-data-collected" label="3. Categories of Data Collected & Processed" />
                    <ToCLink id="priv-pii-scrubbing" label="4. Real-Time PII Scrubbing & Sanitization" />
                    <ToCLink id="priv-data-sovereignty" label="5. Australian Data Sovereignty & Multi-Tenancy" />
                    <ToCLink id="priv-subprocessors" label="6. Sub-processors & LLM Provider Agreements" />
                    <ToCLink id="priv-retention-deletion" label="7. Institutional Retention, Export & Hard Purge" />
                    <ToCLink id="priv-security-mesh" label="8. Technical Safeguards & Essential Eight" />
                    <ToCLink id="priv-contact-dpo" label="9. Data Protection Officer (DPO) & Contact" />
                  </>
                )}
              </nav>

              {/* Quick Institutional Support Box */}
              <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-2">
                <div className="font-bold text-slate-700 dark:text-slate-300">Need Custom District DPA?</div>
                <p className="leading-relaxed">
                  We execute bespoke Data Protection Addendums (DPAs) for school boards, Catholic education dioceses, and government departments.
                </p>
                <a 
                  href="mailto:legal@safescholar.com"
                  className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>Contact District Legal Team</span>
                  <ChevronRight size={12} />
                </a>
              </div>
            </div>

          </aside>

          {/* Right Column: Complete Legal Document Body (8 cols) */}
          <main className="lg:col-span-8 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 sm:p-10 shadow-lg space-y-10">
            
            <AnimatePresence mode="wait">
              {activeTab === 'terms' ? (
                <motion.div
                  key="terms-content"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-10 prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed"
                >
                  
                  {/* Intro Callout Box */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 not-prose">
                    <div className="flex items-start gap-3">
                      <Scale className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                      <div>
                        <div className="font-bold text-blue-900 dark:text-blue-200 text-xs sm:text-sm">
                          Institutional Master Agreement Summary
                        </div>
                        <p className="text-[11px] sm:text-xs text-blue-800/80 dark:text-blue-300/80 mt-1 leading-relaxed">
                          SafeScholar is built from the ground up for education. School districts, faculty, and students retain 100% ownership of their uploaded syllabi and generated teaching materials. We provide an absolute covenant that your school's data and student inquiries will <strong>never</strong> be used to train public or commercial AI models.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1 */}
                  <section id="tos-acceptance" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">1.</span>
                      Acceptance of Terms & Institutional Authorization
                    </h2>
                    <p>
                      These Terms of Service ("Terms") constitute a legally binding agreement entered into between <strong>SafeScholar Pty Ltd</strong> ("SafeScholar", "we", "us", or "our") and the educational institution, school district, independent school, academy, or authorized user ("Institution", "Subscriber", "you", or "your") accessing or utilizing the SafeScholar platform, APIs, microservices, and educational user interfaces (collectively, the "Service").
                    </p>
                    <p>
                      By registering an institutional account, approving educator access, or allowing students to access the Service, you represent and warrant that:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li>You possess the legal power and institutional authority to bind your school, district, or educational organization to these Terms.</li>
                      <li>All educators, administrators, and students who access the Service under your institutional domain or tenant account do so in full compliance with your district policies and local legislation.</li>
                      <li>You agree that continued access to the Service constitutes express acceptance of these Terms, as amended from time to time.</li>
                    </ul>
                  </section>

                  {/* Section 2 */}
                  <section id="tos-pedagogy" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">2.</span>
                      Pedagogical Purpose & Human-in-the-Loop Standard
                    </h2>
                    <p>
                      SafeScholar is engineered strictly as an <strong>assistive educational instrument</strong> designed to accelerate instructional preparation, simplify reading passages, and facilitate student-led inquiry. SafeScholar does not replace certified professional educators, school counselors, or curriculum boards.
                    </p>
                    <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 not-prose text-xs text-amber-900 dark:text-amber-200">
                      <strong>Human-in-the-Loop (HITL) Obligation:</strong> Licensed educators maintain final pedagogical authority and professional responsibility for all lesson sequences, grading rubrics, exam papers, and student communications generated through SafeScholar. Educators are required to review, verify, and approve all AI-assisted outputs prior to student distribution or formal academic assessment.
                    </div>
                    <p>
                      Our Student Socratic Inquiry Sandbox operates on deliberate non-completion heuristics: it asks guiding questions and decomposes concepts rather than providing finished essays or direct homework solutions. SafeScholar does not guarantee that usage of the Service will result in specific academic scores, test achievements, or standardized examination outcomes.
                    </p>
                  </section>

                  {/* Section 3 */}
                  <section id="tos-ip-copyright" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">3.</span>
                      Intellectual Property, Copyright & User Data Valuation
                    </h2>
                    <p>
                      We uphold the highest standard of intellectual property respect and recognize that educational content represents valuable institutional assets:
                    </p>
                    <div className="space-y-3 text-slate-700 dark:text-slate-300">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-white/5">
                        <strong className="text-slate-900 dark:text-white block mb-1">A. User Input Content Ownership:</strong>
                        The subscribing Institution and its authorized users retain 100% of all right, title, interest, and copyright in and to all materials uploaded, inputted, or transmitted to the Service, including curriculum PDFs, district policy documents, teaching materials, student written drafts, and customized prompt inputs.
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-white/5">
                        <strong className="text-slate-900 dark:text-white block mb-1">B. Ownership of AI-Generated Outputs:</strong>
                        To the maximum extent permitted by applicable copyright law, SafeScholar assigns, transfers, and conveys to the subscribing Institution all right, title, and ownership in and to the specific output generated by the platform in response to the user's prompts (e.g., tailored lesson plans, rubric matrices, differentiated worksheets, and assessment items). SafeScholar asserts zero intellectual property claims over your generated teaching resources.
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-white/5">
                        <strong className="text-slate-900 dark:text-white block mb-1">C. SafeScholar Platform Intellectual Property:</strong>
                        SafeScholar and its licensors retain all exclusive rights, title, and interest in the platform software, source code, underlying algorithms, microservice architecture, prompt engineering metaprompts, user interface designs, logos, and trademarks ("SafeScholar", SafeScholar shield logo, and "Curriculum Safety Mesh"). You may not decompile, reverse-engineer, or duplicate platform source code.
                      </div>
                    </div>
                  </section>

                  {/* Section 4 */}
                  <section id="tos-nonretraining" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">4.</span>
                      Absolute Non-Retraining Covenant
                    </h2>
                    <p>
                      Unlike commercial public AI services, SafeScholar operates under strict contractual zero-training guarantees:
                    </p>
                    <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 not-prose space-y-2">
                      <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-xs sm:text-sm">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <span>Contractual Non-Retraining Guarantee</span>
                      </div>
                      <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                        SafeScholar covenants and warrants that <strong>no user prompt, student dialogue, uploaded curriculum document, assessment rubric, or institutional data</strong> will ever be utilized to train, retrain, calibrate, evaluate, or fine-tune public, third-party, or proprietary foundation artificial intelligence models.
                      </p>
                      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium">
                        All third-party LLM inference agreements (e.g. Azure OpenAI Service Australia) are executed under enterprise Data Protection Addendums providing Zero Data Retention (ZDR) and total model retraining exclusion.
                      </p>
                    </div>
                  </section>

                  {/* Section 5 */}
                  <section id="tos-acceptable-use" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">5.</span>
                      Acceptable Use & Anti-Cheating Mandate
                    </h2>
                    <p>
                      The Service is provided exclusively for legitimate educational, pedagogical, and instructional administration purposes. Subscribers and authorized users agree never to:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li><strong>Academic Misconduct:</strong> Attempt to circumvent SafeScholar's anti-cheating Socratic guardrails to generate full homework completions, take-home essays, or unauthorized exam solutions.</li>
                      <li><strong>Prompt Injection & Jailbreaks:</strong> Transmit adversarial prompts (e.g., "ignore prior directives", Base64/ROT13 obfuscations, or persona manipulation) designed to extract underlying system metaprompts or disable safety layers.</li>
                      <li><strong>Automated Scraping:</strong> Use bots, spiders, crawlers, or automated scripts to extract platform data, benchmarks, or curriculum indexes.</li>
                      <li><strong>Harmful or Infringing Content:</strong> Upload, transmit, or generate material that is defamatory, sexually explicit, promotes harassment, self-harm, cyberbullying, or infringes third-party patents, copyrights, or trade secrets.</li>
                      <li><strong>Unauthorized Relay:</strong> Resell, sub-license, reverse-proxy, or commercially redistribute SafeScholar API responses to non-enrolled third parties without express written permission.</li>
                    </ul>
                  </section>

                  {/* Section 6 */}
                  <section id="tos-child-safety" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">6.</span>
                      Child Safety, COPPA & FERPA Protection
                    </h2>
                    <p>
                      SafeScholar is engineered to protect young learners in primary and secondary education (Prep to Year 12):
                    </p>
                    <p>
                      <strong>COPPA & Parental Consent:</strong> Where the Service is utilized by children under 13 years of age, the subscribing educational institution consents directly to the collection and processing of student educational data strictly for educational purposes as authorized by the Children’s Online Privacy Protection Act (COPPA).
                    </p>
                    <p>
                      <strong>FERPA Direct Control:</strong> To the extent student education records are processed, SafeScholar acts as a "School Official" with a "legitimate educational interest" under the Family Educational Rights and Privacy Act (FERPA) (34 C.F.R. § 99.31(a)(1)), operating under the direct supervisory control of the subscribing institution.
                    </p>
                    <p>
                      <strong>Automated Safety Escalation Trigger:</strong> If a student dialogue exhibits cues of immediate self-harm, physical distress, or abuse, the platform’s safety moderation pipeline immediately flags the session with the `[SAFETY_ESCALATION_TRIGGER]` token, delivers an age-appropriate supportive safety message, and routes a priority notification to the designated school administrator or pastoral lead.
                    </p>
                  </section>

                  {/* Section 7 */}
                  <section id="tos-accounts" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">7.</span>
                      Accounts, Role Boundaries & Soft Account Isolation
                    </h2>
                    <p>
                      SafeScholar enforces a delegated multi-tenant administration model:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li><strong>Institutional Authority:</strong> District and school administrators are solely responsible for reviewing pending teacher/student registration queues, provisioning tool permissions, and assigning monthly generation quotas.</li>
                      <li><strong>Privilege Escalation Protection:</strong> Local administrators are cryptographically restricted from elevating permissions beyond their assigned tenant namespace or granting super-administrator privileges.</li>
                      <li><strong>Soft Account Isolation Protocol:</strong> If an account is isolated due to student departure, staff offboarding, or safety investigation, the system sets the user status to `ISOLATED`, immediately purges active Redis session tokens, and blacklists active JWTs across all active client devices within milliseconds, while preserving audit logs for compliance review.</li>
                    </ul>
                  </section>

                  {/* Section 8 */}
                  <section id="tos-liability" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">8.</span>
                      Disclaimers, Warranty & Liability Bounds
                    </h2>
                    <p>
                      <strong>Service Availability (99.9% Target SLA):</strong> SafeScholar provides the platform on an "AS IS" and "AS AVAILABLE" commercial educational basis. While our microservice resilience mesh incorporates automated circuit breakers, canary health probes, and offline curriculum fallbacks, we do not warrant uninterrupted or 100% error-free operation.
                    </p>
                    <p>
                      <strong>Limitation of Liability:</strong> To the maximum extent permitted by law, SafeScholar, its directors, employees, and software architects shall not be liable for any indirect, incidental, consequential, special, or punitive damages, including loss of educational records or instructional downtime.
                    </p>
                    <p>
                      <strong>Liability Cap:</strong> In all circumstances, SafeScholar's aggregate monetary liability arising under or relating to these Terms shall be strictly capped at the total amount actually paid by the subscribing Institution to SafeScholar during the twelve (12) months preceding the incident giving rise to liability.
                    </p>
                  </section>

                  {/* Section 9 */}
                  <section id="tos-governing-law" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-blue-600 dark:text-blue-400 font-mono">9.</span>
                      Governing Law, Modifications & Notices
                    </h2>
                    <p>
                      These Terms are governed by and construed in accordance with the laws of the <strong>State of Queensland and the Commonwealth of Australia</strong>, without regard to conflict of law principles. For international school districts subscribing under custom enterprise agreements, local governing jurisdictions will be specified in the applicable Master Services Agreement (MSA).
                    </p>
                    <p>
                      We reserve the right to modify these Terms to reflect legislative changes, technological advancements, or security enhancements. Material updates will be communicated to designated institutional administrators via email and an in-app notice at least thirty (30) days prior to taking effect.
                    </p>
                    <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 text-xs text-slate-500">
                      Formal legal notices should be dispatched in writing to: <strong>legal@safescholar.com</strong>.
                    </div>
                  </section>

                </motion.div>
              ) : (
                <motion.div
                  key="privacy-content"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-10 prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed"
                >
                  
                  {/* Privacy Intro Callout Box */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 not-prose">
                    <div className="flex items-start gap-3">
                      <Lock className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" size={18} />
                      <div>
                        <div className="font-bold text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm">
                          Our Educational Privacy Oath
                        </div>
                        <p className="text-[11px] sm:text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1 leading-relaxed">
                          SafeScholar treats student and educator data with uncompromising confidentiality. <strong>We do not sell, rent, monetize, or broker student, faculty, or institutional data under any circumstance.</strong> All data is safeguarded by cryptographic tenant isolation and sovereign Australian data residency.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 1 */}
                  <section id="priv-commitment" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">1.</span>
                      Educational Data Valuation & Commitment
                    </h2>
                    <p>
                      At SafeScholar, we believe school data belongs solely to the school. Educational institutions, educators, and students entrust us with their intellectual and personal information to advance teaching and learning — not to monetize their behavior.
                    </p>
                    <p>
                      We explicitly declare that:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li>We do not create advertising profiles or serve targeted advertisements to students or educators.</li>
                      <li>We do not sell student or teacher records to commercial brokers, data aggregators, or third parties.</li>
                      <li>We do not feed student questions or teacher-generated lesson units into public foundation LLMs.</li>
                    </ul>
                  </section>

                  {/* Section 2 */}
                  <section id="priv-regulations" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">2.</span>
                      Regulatory Framework Compliance
                    </h2>
                    <p>
                      SafeScholar is engineered and audited in accordance with leading national and international privacy standards:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose">
                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/50">
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                          <CheckCircle2 size={14} className="text-blue-500" />
                          <span>Australian Privacy Principles (APPs)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Strict compliance with the Privacy Act 1988 (Cth) governing collection, use, and cross-border disclosure boundaries.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/50">
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                          <CheckCircle2 size={14} className="text-emerald-500" />
                          <span>ST4S (Safer Technologies 4 Schools)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Adherence to national digital privacy, sovereignty, and data safety criteria established for Australian school authorities.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/50">
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                          <CheckCircle2 size={14} className="text-indigo-500" />
                          <span>FERPA (34 CFR Part 99)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Operates as a School Official with legitimate educational interests under direct institutional oversight.
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-800/50">
                        <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 mb-1">
                          <CheckCircle2 size={14} className="text-teal-500" />
                          <span>COPPA (15 U.S.C. 6501–6506)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Child Online Privacy Protection compliance via verified school authorization for under-13 learners.
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Section 3 */}
                  <section id="priv-data-collected" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">3.</span>
                      Categories of Data We Process
                    </h2>
                    <p>
                      We practice strict data minimization and collect only information strictly necessary to provide educational functionality:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li><strong>Institutional Directory Data:</strong> First name, last name, school-issued institutional email address, designated department, and assigned role (`teacher`, `student`, `institute_management`, `superadmin`).</li>
                      <li><strong>Learner Cohort Metadata:</strong> Pseudonymized student identifier or display handle, enrolled year band (e.g. Prep, Year 1 to Year 5), and classroom assignment IDs.</li>
                      <li><strong>Instructional Content & Ingestion:</strong> Lesson plan prompts, rubric specifications, worksheet parameters, and district curriculum handbook files uploaded for vector RAG embedding.</li>
                      <li><strong>Session & Security Telemetry:</strong> Anonymized request counts, token consumption metrics, IP addresses (hashed for NAT-aware rate limiting), session expiration timestamps, and tamper-evident audit records.</li>
                    </ul>
                  </section>

                  {/* Section 4 */}
                  <section id="priv-pii-scrubbing" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">4.</span>
                      Real-Time PII Scrubbing & Sanitization
                    </h2>
                    <p>
                      SafeScholar incorporates an automated inline PII Scrubbing Engine (`aiModerationMiddleware.go`) that inspects all text payloads before they are routed to downstream inference models:
                    </p>
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700 not-prose space-y-2">
                      <div className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <Shield size={15} className="text-blue-500" />
                        <span>Automated Interceptor Capabilities</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        The gateway automatically identifies, redacts, and masks sensitive identifiers:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-medium text-slate-700 dark:text-slate-300 pt-1">
                        <span className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-white/5">
                          ✓ Australian Medicare Numbers
                        </span>
                        <span className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-white/5">
                          ✓ Tax File Numbers (TFN)
                        </span>
                        <span className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-white/5">
                          ✓ Phone Numbers & Street Addresses
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Section 5 */}
                  <section id="priv-data-sovereignty" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">5.</span>
                      Australian Data Sovereignty & Multi-Tenancy
                    </h2>
                    <p>
                      To satisfy Australian sovereign data storage laws and institutional regulatory requirements:
                    </p>
                    <p>
                      <strong>Domestic Sovereign Inference:</strong> All AI processing requests originating from Australian institutions are bound exclusively to Australian sovereign data centers (e.g. `Australia East` Azure OpenAI instances in Sydney and Melbourne).
                    </p>
                    <p>
                      <strong>PostgreSQL Row-Level Security (RLS):</strong> SafeScholar enforces cryptographic multi-tenant separation at the database engine layer. Every query sets session variables (`app.institution_id`) within PostgreSQL database transactions, physically preventing any user from accessing records outside their school district.
                    </p>
                  </section>

                  {/* Section 6 */}
                  <section id="priv-subprocessors" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">6.</span>
                      Sub-processors & Third-Party Protections
                    </h2>
                    <p>
                      SafeScholar works only with enterprise infrastructure sub-processors that sign formal Data Processing Agreements containing strict confidentiality and zero-retraining obligations:
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-bold">
                          <tr>
                            <th className="p-2.5">Sub-processor</th>
                            <th className="p-2.5">Function</th>
                            <th className="p-2.5">Geographic Location</th>
                            <th className="p-2.5">Data Protection Warranty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-zinc-800 text-slate-600 dark:text-slate-300">
                          <tr>
                            <td className="p-2.5 font-bold">Azure OpenAI Service</td>
                            <td className="p-2.5">Curriculum & Socratic LLM Inference</td>
                            <td className="p-2.5">Australia East (Sydney)</td>
                            <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">Zero Data Retention (ZDR); No Model Training</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Supabase PostgreSQL</td>
                            <td className="p-2.5">Encrypted RLS Database Storage</td>
                            <td className="p-2.5">Australia (ap-southeast-2)</td>
                            <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">AES-256 at Rest; SOC2 Type II Certified</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Hostinger VPS Mesh</td>
                            <td className="p-2.5">Reverse Proxy Gateway & UI Container</td>
                            <td className="p-2.5">Secured Dedicated Tier</td>
                            <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">UFW Hardened; TLS 1.3 Strict Transport</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold">Redis Cluster</td>
                            <td className="p-2.5">Volumetric Token Rate Limiting & Telemetry</td>
                            <td className="p-2.5">Isolated Private Network</td>
                            <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">In-Memory Volatile TTL; Instant Revocation</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Section 7 */}
                  <section id="priv-retention-deletion" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">7.</span>
                      Institutional Retention, Export & Hard Purge
                    </h2>
                    <p>
                      <strong>School Ownership of Lifecycle:</strong> Educational institutions maintain complete control over data retention periods. Administrators may request complete JSON or CSV data exports of classroom activities, rubrics, and lesson architectures at any time.
                    </p>
                    <p>
                      <strong>Soft Account Isolation:</strong> When a student graduates, leaves the district, or a teacher transitions, their account status changes to `ISOLATED`. All associated session tokens are purged immediately from Redis, while audit records are archived for institutional accountability.
                    </p>
                    <p>
                      <strong>The Right to Permanent Deletion:</strong> Upon contract expiration or formal written request from an authorized district representative, SafeScholar executes an irreversible hard purge of all tenant database rows, vector embeddings, and cached files within thirty (30) calendar days, providing a formal Certificate of Destruction upon completion.
                    </p>
                  </section>

                  {/* Section 8 */}
                  <section id="priv-security-mesh" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">8.</span>
                      Technical Safeguards & Essential Eight
                    </h2>
                    <p>
                      SafeScholar incorporates defense-in-depth security aligned with the Australian Cyber Security Centre (ACSC) <strong>Essential Eight</strong> maturity framework:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-300">
                      <li><strong>Encryption in Transit:</strong> TLS 1.3 and HSTS (Strict-Transport-Security) enforced on all external client connections with zero plaintext HTTP fallback.</li>
                      <li><strong>Encryption at Rest:</strong> AES-256 cryptographic volume encryption across all databases, vector knowledge bases, and backups.</li>
                      <li><strong>Multi-Factor Authentication (MFA):</strong> Verification of `amr` (Authentication Method Reference) claims on identity tokens for all institutional and super-administrator access.</li>
                      <li><strong>Distributed Token-Bucket Rate Limiting:</strong> Cryptographically scoped per `InstitutionID` + `UserID` to eliminate DDoS vulnerabilities while avoiding false-positive blocks in single-egress school network topologies.</li>
                      <li><strong>Audit Engine:</strong> Tamper-evident logging of every administrative role change, user isolation event, and document ingestion.</li>
                    </ul>
                  </section>

                  {/* Section 9 */}
                  <section id="priv-contact-dpo" className="scroll-mt-28 space-y-3">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 border-b border-slate-200/80 dark:border-zinc-800 pb-2">
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono">9.</span>
                      Data Protection Officer (DPO) & Contact Information
                    </h2>
                    <p>
                      For privacy inquiries, student record access requests, district DPA execution, or regulatory compliance verification, our dedicated Data Protection Officer may be contacted directly:
                    </p>
                    <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700 not-prose space-y-1.5 text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">SafeScholar Data Protection Officer</div>
                      <div className="text-slate-600 dark:text-slate-300">Email: <a href="mailto:privacy@safescholar.com" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">privacy@safescholar.com</a> / <a href="mailto:dpo@safescholar.com" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">dpo@safescholar.com</a></div>
                      <div className="text-slate-600 dark:text-slate-300">Address: SafeScholar Pty Ltd, Level 14, 175 Eagle Street, Brisbane QLD 4000, Australia</div>
                      <div className="text-slate-500 text-[11px] pt-1">Response Timeline: All institutional data inquiries acknowledged within 24 business hours.</div>
                    </div>
                  </section>

                </motion.div>
              )}
            </AnimatePresence>

          </main>

        </div>
      </div>

    </div>
  );
};

function ToCLink({ id, label }: { id: string; label: string }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const elem = document.getElementById(id);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <a
      href={`#${id}`}
      onClick={handleClick}
      className="flex items-center justify-between py-1.5 px-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100/80 dark:hover:bg-zinc-800/80 transition-colors group"
    >
      <span className="truncate">{label}</span>
      <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 shrink-0" />
    </a>
  );
}

export default LegalPage;
