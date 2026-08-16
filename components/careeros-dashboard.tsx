"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { signOut, useSession } from "next-auth/react"
import {
  AlertCircle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Command,
  Database,
  ExternalLink,
  FileText,
  Flame,
  GraduationCap,
  HelpCircle,
  Key,
  LayoutDashboard,
  Layers,
  Lightbulb,
  Loader2,
  LogOut,
  Menu,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  User,
  X,
  Zap,
} from "lucide-react"
import Image from "next/image"
import { AppleProfileEditor } from "./apple-profile"

// ─── Types ───────────────────────────────────────────────────────────────────
type Tab = "Overview" | "Profile" | "Resume" | "Job Matches" | "Interview Prep" | "Skills" | "Learning Plan" | "Settings"

type Job = {
  id: string
  company: string
  role: string
  match: number
  salary: string
  location: string
  skills: string[]
  applyUrl?: string
  source?: string
  description?: string
  logoUrl?: string
  color?: string
  projectsRecommended?: { name: string; tech: string; description: string; githubQuery: string }[]
}

function CompanyLogo({ logoUrl, company, className = "size-10" }: { logoUrl?: string; company: string; className?: string }) {
  const [error, setError] = useState(false)

  if (logoUrl && !error) {
    return (
      <div className={`relative flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-sm border border-white/20 overflow-hidden ${className}`}>
        <img
          src={logoUrl}
          alt={company}
          className="max-h-full max-w-full object-contain"
          onError={() => setError(true)}
          loading="lazy"
        />
      </div>
    )
  }

  const initial = company ? company[0].toUpperCase() : "J"
  return (
    <div className={`grid shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 font-bold text-white shadow-sm ${className}`}>
      {initial}
    </div>
  )
}

type Profile = {
  name: string; email: string; title: string; location: string;
  bio: string; roles: string; locations: string; readiness: number;
  resumeScore: number; skillsScore: number; experienceScore: number;
  applicationsSent: number; profileViews: number; image?: string | null
}

type ParsedResume = {
  name: string | null; email: string | null; phone: string | null;
  title: string | null; skills: string[];
  workHistory: { company: string; role: string; duration: string; highlights: string[] }[];
  education: { institution: string; degree: string; year: string }[];
  rolesExtracted: number; skillsFound: number; atsScore: number; fileName: string
}

type ChatMessage = { role: "user" | "ai"; content: string }

type InterviewQuestion = {
  id: string; category: string; question: string; difficulty: string;
  keyFocus: string; tip: string
}

type StarEvaluation = {
  score: number;
  starBreakdown: { situation: string; task: string; action: string; result: string };
  strengths: string[];
  improvements: string[];
  improvedSample: string;
}

type SkillCategory = {
  name: string;
  skills: { name: string; level: string; match: number; status: string }[];
}

type SkillsData = {
  readinessScore: number;
  topStrengths: string[];
  criticalGaps: string[];
  categories: SkillCategory[];
  marketDemandInsights: string;
}

type LearningTask = { id: string; title: string; completed: boolean }
type LearningWeek = { weekNumber: number; theme: string; goal: string; tasks: LearningTask[]; resource: string }
type LearningPlanData = { title: string; estimatedWeeklyHours: string; weeks: LearningWeek[] }

// ─── Nav ─────────────────────────────────────────────────────────────────────
const nav: { label: Tab; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Profile", icon: User },
  { label: "Resume", icon: FileText },
  { label: "Job Matches", icon: BriefcaseBusiness },
  { label: "Interview Prep", icon: Target },
  { label: "Skills", icon: GraduationCap },
  { label: "Learning Plan", icon: BarChart3 },
  { label: "Settings", icon: Settings },
]

const JOB_COLORS = ["bg-foreground", "bg-indigo-600", "bg-violet-600", "bg-emerald-700", "bg-rose-700"]

// ─── Root Dashboard ───────────────────────────────────────────────────────────
export function CareerOSDashboard() {
  const { data: session } = useSession()
  const [active, setActive] = useState<Tab>("Overview")
  const [mobileNav, setMobileNav] = useState(false)
  const [overlay, setOverlay] = useState<"search" | "notifications" | "ai" | "job" | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [jobs, setJobs] = useState<Job[]>([])
  const [profile, setProfile] = useState<Profile>({
    name: session?.user?.name ?? "User",
    email: session?.user?.email ?? "",
    title: "", location: "", bio: "", roles: "", locations: "",
    readiness: 20, resumeScore: 0, skillsScore: 0, experienceScore: 0,
    applicationsSent: 0, profileViews: 0,
    image: session?.user?.image,
  })
  const [uploadOpen, setUploadOpen] = useState(false)
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Job[]>([])

  const go = (tab: Tab) => { setActive(tab); setMobileNav(false); setOverlay(null) }

  // Load profile + jobs + latest resume from MongoDB on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, jobsRes, resumeRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/jobs"),
          fetch("/api/resume"),
        ])
        if (profileRes.ok) {
          const { data } = await profileRes.json()
          setProfile((prev) => ({ ...prev, ...data, image: data.image ?? session?.user?.image }))
        }
        if (jobsRes.ok) {
          const { data } = await jobsRes.json()
          setJobs(data.map((j: Job, i: number) => ({ ...j, color: JOB_COLORS[i % JOB_COLORS.length] })))
        }
        if (resumeRes.ok) {
          const { data } = await resumeRes.json()
          if (data && data.length > 0) {
            setParsedResume(data[0])
          }
        }
      } catch (e) {
        console.error("Failed to load initial data:", e)
      } finally {
        setProfileLoading(false)
      }
    }
    loadData()
  }, [session])

  // Search jobs
  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/jobs?q=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        const { data } = await res.json()
        setSearchResults(data.map((j: Job, i: number) => ({ ...j, color: JOB_COLORS[i % JOB_COLORS.length] })))
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery])

  const filteredJobs = useMemo(() =>
    jobs.filter((j) => `${j.company} ${j.role}`.toLowerCase().includes(query.toLowerCase())),
    [jobs, query]
  )

  const handleSendChat = async (message: string) => {
    if (!message.trim()) return
    const userMsg: ChatMessage = { role: "user", content: message }
    const nextMessages = [...chatMessages, userMsg]
    setChatMessages(nextMessages)
    setChatLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: chatMessages,
          context: {
            name: profile.name,
            title: profile.title,
            location: profile.location,
            skills: parsedResume?.skills || [],
            atsScore: parsedResume?.atsScore || profile.resumeScore,
            targetRoles: profile.roles,
          },
        }),
      })
      if (res.ok) {
        const { reply } = await res.json()
        setChatMessages((prev) => [...prev, { role: "ai", content: reply }])
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "ai", content: "Sorry, I couldn't connect. Please try again." }])
    } finally {
      setChatLoading(false)
    }
  }

  const userName = profile.name || session?.user?.name || "User"
  const userInitials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
  const userImage = profile.image ?? session?.user?.image

  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-indigo-950/40 text-foreground">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-slate-950/85 px-4 py-5 backdrop-blur-xl transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-8 flex items-center justify-between px-2">
          <button onClick={() => go("Overview")} className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="size-4" />
            </span>
            <span>Career<span className="text-indigo-300">OS</span></span>
          </button>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setMobileNav(false)} aria-label="Close navigation">
            <X className="size-5" />
          </button>
        </div>

        <p className="px-3 pb-3 text-xs font-medium uppercase tracking-widest text-slate-500">Navigation</p>
        <nav className="flex flex-col gap-1">
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} onClick={() => go(label)} className={`flex items-center gap-3 rounded-xl border-l-2 px-3 py-2.5 text-left text-sm transition-all ${active === label ? "border-indigo-500 bg-white/10 text-white font-medium shadow-sm" : "border-transparent text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="size-4" />{label}
            </button>
          ))}
        </nav>

        {/* Gemini Active Badge */}
        <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-200 flex items-center gap-2">
          <Zap className="size-4 text-indigo-400 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium truncate">Gemini 3 AI Active</p>
            <p className="text-[10px] text-slate-400">MongoDB Atlas Connected</p>
          </div>
        </div>

        <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-2">
            {userImage ? (
              <Image src={userImage} alt={userName} width={36} height={36} className="size-9 rounded-full object-cover ring-2 ring-indigo-500/30" />
            ) : (
              <div className="grid size-9 place-items-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">{userInitials}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-xs text-slate-500">{profile.email || session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {mobileNav && (
        <button className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close menu" />
      )}

      {/* Main Container */}
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-slate-950/60 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setMobileNav(true)} aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-xs text-slate-500">{dateStr}</p>
              <h1 className="font-semibold tracking-tight">{greeting}, {userName.split(" ")[0]}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setOverlay("search")} className="hidden rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white sm:block transition-colors" aria-label="Search">
              <Search className="size-4" />
            </button>
            <button onClick={() => setOverlay("notifications")} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-white transition-colors" aria-label="Notifications">
              <Bell className="size-4" />
            </button>
            <button onClick={() => setOverlay("ai")} className="flex items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/25 transition-colors">
              <Sparkles className="size-3.5 text-indigo-400" />
              <span>AI Coach</span>
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-4 md:p-8">
          {active === "Overview" && (
            <Overview go={go} completed={completed} setCompleted={setCompleted} setOverlay={setOverlay} setSelectedJob={setSelectedJob} jobs={jobs} profile={profile} />
          )}
          {active === "Profile" && (
            <AppleProfileEditor profile={profile} setProfile={setProfile} setUploadOpen={setUploadOpen} loading={profileLoading} />
          )}
          {active === "Resume" && (
            <ResumePage setUploadOpen={setUploadOpen} parsedResume={parsedResume} profile={profile} />
          )}
          {active === "Job Matches" && (
            <JobMatchesPage jobs={filteredJobs} query={query} setQuery={setQuery} setSelectedJob={setSelectedJob} setOverlay={setOverlay} />
          )}
          {active === "Interview Prep" && (
            <InterviewPrepPage profile={profile} parsedResume={parsedResume} setOverlay={setOverlay} />
          )}
          {active === "Skills" && (
            <SkillsPage profile={profile} parsedResume={parsedResume} setOverlay={setOverlay} />
          )}
          {active === "Learning Plan" && (
            <LearningPlanPage profile={profile} setOverlay={setOverlay} />
          )}
          {active === "Settings" && (
            <SettingsPage profile={profile} session={session} />
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {uploadOpen && (
        <UploadModal
          onClose={() => setUploadOpen(false)}
          onParsed={(data) => {
            setParsedResume(data)
            setProfile((prev) => ({
              ...prev,
              ...(data.name ? { name: data.name } : {}),
              ...(data.email ? { email: data.email } : {}),
              ...(data.title ? { title: data.title } : {}),
              resumeScore: data.atsScore,
              skillsScore: data.skillsFound > 10 ? 85 : data.skillsFound * 7,
              readiness: Math.min(100, prev.readiness + 15),
            }))
          }}
        />
      )}

      {/* Overlay: AI / Search / Notifications / Job Detail */}
      {overlay && (
        <Overlay
          kind={overlay} setOverlay={setOverlay} job={selectedJob}
          chatMessages={chatMessages} chatLoading={chatLoading}
          onSendChat={handleSendChat}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          onSelectJob={(job) => { setSelectedJob(job); setOverlay("job") }}
        />
      )}
    </div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-900/40 p-5 backdrop-blur-xl transition-all duration-300 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10 md:p-6 ${className}`}>
      {children}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function Overview({ go, completed, setCompleted, setOverlay, setSelectedJob, jobs, profile }: {
  go: (tab: Tab) => void; completed: string[]; setCompleted: (items: string[]) => void;
  setOverlay: (v: "ai" | "job") => void; setSelectedJob: (job: Job) => void;
  jobs: Job[]; profile: Profile
}) {
  const displayJobs = jobs.slice(0, 3)

  return (
    <>
      <section className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-indigo-300">Your career command center</p>
          <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-5xl">
            Make your next move<br className="hidden md:block" /> your best one yet.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            You&apos;re making measurable career progress. Keep building momentum with AI insights.
          </p>
        </div>
        <button onClick={() => setOverlay("ai")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors">
          <Sparkles className="size-4" />Ask CareerOS AI
        </button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Career readiness" value={`${profile.readiness}%`} detail="+6% this month" progress={String(profile.readiness)} />
        <Stat label="Applications sent" value={String(profile.applicationsSent || 0)} detail="Track your activity" />
        <Stat label="Profile views" value={String(profile.profileViews || 0)} detail="Updated in MongoDB" />
        <Stat label="Resume score" value={profile.resumeScore ? `${profile.resumeScore}` : "—"} detail={profile.resumeScore ? "ATS evaluated" : "Upload your resume"} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold tracking-tight">Recommended next steps</h3>
              <p className="mt-1 text-sm text-slate-400">Small actions, meaningful progress.</p>
            </div>
            <button onClick={() => go("Resume")} className="text-sm font-medium text-indigo-300 hover:text-indigo-200">View all</button>
          </div>
          <div className="flex flex-col gap-3">
            {[
              [FileText, "Upload and analyze your resume", "Get your ATS score and skill map", "High impact", "Resume"],
              [Target, "Practice STAR interview questions", "Build confidence with AI evaluation", "Interactive", "Interview Prep"],
              [GraduationCap, "Explore your skill gap matrix", "Compare skills against target roles", "Analysis", "Skills"],
              [BarChart3, "Follow your 4-week learning plan", "Complete weekly actionable milestones", "Roadmap", "Learning Plan"],
            ].map(([Icon, title, detail, tag, tab]) => (
              <Action
                key={title as string}
                icon={Icon as typeof FileText}
                title={title as string}
                detail={detail as string}
                tag={tag as string}
                done={completed.includes(title as string)}
                onToggle={() => setCompleted(completed.includes(title as string) ? completed.filter((x) => x !== title) : [...completed, title as string])}
                onOpen={() => go(tab as Tab)}
              />
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-5">
            <h3 className="font-semibold tracking-tight">Career readiness</h3>
            <p className="mt-1 text-sm text-slate-400">Your profile at a glance</p>
          </div>
          <div className="flex items-center gap-6">
            <div
              className="grid size-32 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(#818cf8 ${profile.readiness}%, #ffffff12 0)` }}
            >
              <div className="grid size-24 place-items-center rounded-full bg-slate-900">
                <span className="text-3xl font-semibold">{profile.readiness}</span>
                <span className="-ml-1 text-xs text-slate-500">/ 100</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 text-sm">
              <Score label="Resume" value={String(profile.resumeScore || 0)} />
              <Score label="Skills" value={String(profile.skillsScore || 0)} />
              <Score label="Experience" value={String(profile.experienceScore || 0)} />
            </div>
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold tracking-tight">Top job matches</h3>
              <p className="mt-1 text-sm text-slate-400">Curated with real company salaries in INR (₹)</p>
            </div>
            <button onClick={() => go("Job Matches")} className="text-sm font-medium text-indigo-300 hover:text-indigo-200">See all jobs</button>
          </div>
          <div className="flex flex-col gap-3">
            {displayJobs.length === 0 && (
              <p className="text-sm text-slate-500 py-4 text-center">Loading job matches...</p>
            )}
            {displayJobs.map((job) => (
              <button key={job.id} onClick={() => { setSelectedJob(job); setOverlay("job") }} className="flex items-center gap-3.5 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5 border border-transparent hover:border-white/5">
                <CompanyLogo logoUrl={job.logoUrl} company={job.company} className="size-10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{job.role}</p>
                  <p className="text-xs text-slate-400 truncate">{job.company} · {job.location}</p>
                  <p className="text-[11px] font-medium text-violet-300 mt-0.5">{job.salary}</p>
                </div>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-300">{job.match}%</span>
                <ChevronRight className="size-4 text-slate-500" />
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold tracking-tight">Weekly learning focus</h3>
              <p className="mt-1 text-sm text-slate-400">Your roadmap progress</p>
            </div>
            <button onClick={() => go("Learning Plan")} className="text-sm font-medium text-indigo-300 hover:text-indigo-200">Full plan</button>
          </div>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <span className="text-3xl font-semibold">6.5</span>
              <span className="ml-1 text-sm text-slate-500">hours completed</span>
            </div>
            <span className="text-sm font-medium text-indigo-300">72% complete</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" />
          </div>
          <button onClick={() => go("Learning Plan")} className="mt-5 flex w-full items-center gap-3 rounded-xl bg-white/5 p-3 text-left hover:bg-white/10 transition-colors">
            <div className="grid size-9 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300">
              <GraduationCap className="size-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Core Architecture &amp; System Design</p>
              <p className="text-xs text-slate-500">Week 1 of your 4-week roadmap</p>
            </div>
            <ChevronRight className="size-4 text-slate-500" />
          </button>
        </Card>
      </section>
    </>
  )
}

function Stat({ label, value, detail, progress }: { label: string; value: string; detail: string; progress?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-3xl font-semibold tracking-tight">{value}</span>
        <span className="text-xs font-medium text-indigo-300">{detail}</span>
      </div>
      {progress && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" style={{ width: `${progress}%` }} />
        </div>
      )}
    </Card>
  )
}

function Action({ icon: Icon, title, detail, tag, done, onToggle, onOpen }: {
  icon: typeof FileText; title: string; detail: string; tag: string;
  done: boolean; onToggle: () => void; onOpen: () => void
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl border border-white/10 p-3 transition-colors hover:bg-white/5 ${done ? "opacity-60" : ""}`}>
      <button onClick={onToggle} className={`grid size-9 shrink-0 place-items-center rounded-lg ${done ? "bg-emerald-500/20 text-emerald-300" : "bg-indigo-500/15 text-indigo-300"}`} aria-label={`Mark ${title} ${done ? "incomplete" : "complete"}`}>
        {done ? <Check className="size-4" /> : <Icon className="size-4" />}
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className={`truncate text-sm font-medium ${done ? "line-through" : ""}`}>{title}</p>
        <p className="truncate text-xs text-slate-500">{detail}</p>
      </button>
      <span className="hidden rounded-full bg-white/10 px-2 py-1 text-[11px] font-medium text-slate-400 sm:block">{tag}</span>
      <button onClick={onOpen} aria-label={`Open ${title}`}><ChevronRight className="size-4 text-slate-500" /></button>
    </div>
  )
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-slate-400">{label}</span>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-indigo-400" style={{ width: `${value}%` }} />
      </div>
      <span className="font-medium">{value}</span>
    </div>
  )
}

// ─── Job Matches Page ─────────────────────────────────────────────────────────
function JobMatchesPage({ jobs, query, setQuery, setSelectedJob, setOverlay }: {
  jobs: any[]; query: string; setQuery: (q: string) => void;
  setSelectedJob: (job: any) => void; setOverlay: (v: "job") => void;
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [appliedJobs, setAppliedJobs] = useState<string[]>([])
  const [applyingId, setApplyingId] = useState<string | null>(null)

  const handleMarkApplied = async (job: any) => {
    setApplyingId(job.id)
    try {
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          company: job.company,
          role: job.role,
          applyUrl: job.applyUrl,
        }),
      })
      setAppliedJobs((prev) => [...prev, job.id])
    } catch (e) {
      console.error("Failed to mark applied:", e)
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <section>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-indigo-300">Live LinkedIn &amp; Company Portals</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Real Job Matches &amp; Projects</h2>
          <p className="mt-2 text-sm text-slate-400">Verified active openings with direct apply links and recommended portfolio projects to stand out.</p>
        </div>
      </div>

      {/* LinkedIn / Role Search Bar */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-1.5">
            <Search className="size-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search target role (e.g. Next.js Developer, Full Stack, AI Engineer)..."
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="flex-1 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-1.5">
            <ExternalLink className="size-4 text-indigo-400" />
            <input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="Paste LinkedIn Job or Profile URL (optional)..."
              className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-500"
            />
          </div>
          <button
            onClick={() => { if (linkedinUrl && !query) setQuery("Software Engineer") }}
            className="rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 transition-colors shadow-md flex items-center justify-center gap-2"
          >
            Find Real Jobs
          </button>
        </div>
      </Card>

      {/* Job Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {jobs.map((job) => {
          const isApplied = appliedJobs.includes(job.id)
          const isApplying = applyingId === job.id

          return (
            <Card key={job.id} className="flex flex-col justify-between p-6">
              <div>
                <div className="flex items-center gap-3.5">
                  <CompanyLogo logoUrl={job.logoUrl} company={job.company} className="size-12 p-2" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white truncate text-base">{job.role}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{job.company} · {job.location}</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                    {job.match}% match
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-bold text-white text-base">{job.salary}</span>
                  <span className="text-xs text-indigo-300 font-medium bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                    Verified: {job.source || "Company Portal"}
                  </span>
                </div>

                <p className="mt-3 text-xs text-slate-400 leading-relaxed">
                  {job.description || "Active engineering role matching your core technology profile."}
                </p>

                {/* Skills */}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {job.skills?.map((skill: string) => (
                    <span key={skill} className="rounded-md bg-white/10 px-2.5 py-1 text-xs text-slate-300">
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Recommended Real Projects */}
                {job.projectsRecommended && job.projectsRecommended.length > 0 && (
                  <div className="mt-5 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-3.5">
                    <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="size-3 text-indigo-400" /> Recommended Standout Project:
                    </p>
                    {job.projectsRecommended.map((proj: any, pIdx: number) => (
                      <div key={pIdx} className="mt-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">{proj.name}</span>
                          <a
                            href={proj.githubQuery}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
                          >
                            GitHub Examples <ExternalLink className="size-2.5" />
                          </a>
                        </div>
                        <p className="text-slate-400 text-[11px] mt-1">{proj.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-3">
                <a
                  href={job.applyUrl || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(job.role)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-500 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-400 transition-colors"
                >
                  Apply on {job.source || "LinkedIn"} <ExternalLink className="size-3.5" />
                </a>
                <button
                  onClick={() => handleMarkApplied(job)}
                  disabled={isApplied || isApplying}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-medium transition-colors ${isApplied ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-white/15 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                >
                  {isApplied ? "✓ Saved as Applied" : isApplying ? "Saving..." : "Mark Applied"}
                </button>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

// ─── Interview Prep Page (Gemini Powered) ─────────────────────────────────────
function InterviewPrepPage({ profile, parsedResume, setOverlay }: {
  profile: Profile; parsedResume: ParsedResume | null; setOverlay: (v: "ai") => void
}) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null)
  const [userAnswer, setUserAnswer] = useState("")
  const [evaluating, setEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<StarEvaluation | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("All")

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: profile.title || parsedResume?.title || "Full Stack Engineer" }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setQuestions(data.questions || [])
        if (data.questions?.[0]) setSelectedQuestion(data.questions[0])
      }
    } catch (e) {
      console.error("Failed to load interview questions:", e)
    } finally {
      setLoading(false)
    }
  }, [profile.title, parsedResume?.title])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const handleEvaluate = async () => {
    if (!userAnswer.trim() || !selectedQuestion) return
    setEvaluating(true)
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate",
          role: profile.title || "Full Stack Engineer",
          question: selectedQuestion.question,
          answer: userAnswer,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        setEvaluation(data)
      }
    } finally {
      setEvaluating(false)
    }
  }

  const categories = ["All", "Behavioral", "Technical Architecture", "Problem Solving", "Leadership & Impact"]
  const filteredQuestions = filterCategory === "All"
    ? questions
    : questions.filter((q) => q.category.toLowerCase().includes(filterCategory.toLowerCase()))

  return (
    <section>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-indigo-300">STAR Method &amp; Mock Simulations</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Interview Prep Studio</h2>
          <p className="mt-2 text-sm text-slate-400">Practice questions crafted by Gemini AI based on your background and get instant STAR scoring.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchQuestions} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Regenerate Questions
          </button>
          <button onClick={() => setOverlay("ai")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-400 transition-colors">
            <Sparkles className="size-4" />Ask Coach
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`rounded-xl px-3.5 py-2 text-xs font-medium transition-colors ${filterCategory === cat ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1.3fr]">
        {/* Question List */}
        <Card className="flex flex-col gap-3">
          <h3 className="font-semibold tracking-tight mb-2">Targeted Questions</h3>
          {loading ? (
            <div className="flex py-20 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="size-5 animate-spin text-indigo-400" /> Generating tailored questions with Gemini...
            </div>
          ) : (
            filteredQuestions.map((q) => (
              <div
                key={q.id}
                onClick={() => { setSelectedQuestion(q); setEvaluation(null) }}
                className={`p-4 rounded-xl border cursor-pointer transition-all text-left ${selectedQuestion?.id === q.id ? "border-indigo-500 bg-indigo-500/10 shadow-md" : "border-white/10 bg-white/[0.02] hover:bg-white/5"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">{q.category}</span>
                  <span className={`text-[11px] font-medium ${q.difficulty === "Hard" ? "text-rose-400" : q.difficulty === "Medium" ? "text-amber-300" : "text-emerald-300"}`}>{q.difficulty}</span>
                </div>
                <p className="mt-2 text-sm font-medium leading-snug">{q.question}</p>
                <p className="mt-2 text-xs text-slate-400 flex items-center gap-1"><Lightbulb className="size-3 text-amber-400 shrink-0" /> {q.keyFocus}</p>
              </div>
            ))
          )}
        </Card>

        {/* Practice & Evaluation Area */}
        <div className="space-y-6">
          {selectedQuestion ? (
            <Card>
              <div className="border-b border-white/10 pb-4">
                <span className="rounded-md bg-indigo-500/20 px-2.5 py-1 text-xs font-semibold text-indigo-300">{selectedQuestion.category}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{selectedQuestion.question}</h3>
                <div className="mt-2 rounded-lg bg-white/5 p-3 text-xs text-slate-300 border border-white/5">
                  <span className="font-semibold text-indigo-300">Coach Tip:</span> {selectedQuestion.tip}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <label className="text-xs font-medium uppercase tracking-wider text-slate-400 block">Your Answer (STAR Framework)</label>
                <textarea
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  placeholder="Structure your answer using Situation, Task, Action, and Result..."
                  className="w-full min-h-36 rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm outline-none focus:border-indigo-400 transition-colors"
                />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-slate-500">{userAnswer.length} characters</span>
                  <button
                    onClick={handleEvaluate}
                    disabled={evaluating || !userAnswer.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-400 disabled:opacity-40 transition-all"
                  >
                    {evaluating ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Evaluate with Gemini AI
                  </button>
                </div>
              </div>

              {/* Evaluation Results */}
              {evaluation && (
                <div className="mt-6 border-t border-white/10 pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-indigo-300">AI STAR Assessment</span>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
                      Score: {evaluation.score} / 100
                    </span>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 text-xs">
                    {Object.entries(evaluation.starBreakdown).map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-white/5 p-3 border border-white/5">
                        <p className="font-semibold uppercase text-indigo-300">{k}</p>
                        <p className="mt-1 text-slate-300">{v}</p>
                      </div>
                    ))}
                  </div>

                  {evaluation.improvedSample && (
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-xs">
                      <p className="font-semibold text-indigo-300 mb-1">Rewritten High-Impact Version:</p>
                      <p className="text-slate-200 leading-relaxed italic">{evaluation.improvedSample}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card className="text-center py-20">
              <HelpCircle className="size-10 mx-auto text-slate-500 mb-3" />
              <p className="font-medium">Select a question to practice</p>
              <p className="text-xs text-slate-400 mt-1">Get AI evaluation and instant STAR scoring</p>
            </Card>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Skills Matrix Page (Gemini Powered) ──────────────────────────────────────
function SkillsPage({ profile, parsedResume, setOverlay }: {
  profile: Profile; parsedResume: ParsedResume | null; setOverlay: (v: "ai") => void
}) {
  const [data, setData] = useState<SkillsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [customSkill, setCustomSkill] = useState("")

  const loadSkills = useCallback(async (refresh = false) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/skills${refresh ? "?refresh=true" : ""}`)
      if (res.ok) {
        const json = await res.json()
        setData(json.data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSkills(false)
  }, [loadSkills])

  const handleAddSkill = async () => {
    if (!customSkill.trim() || !data) return
    const skillName = customSkill.trim()
    const newSkill = { name: skillName, level: "Proficient", match: 80, status: "Strong" }
    setData({
      ...data,
      categories: data.categories.map((cat, i) => i === 0 ? { ...cat, skills: [...cat.skills, newSkill] } : cat),
    })
    setCustomSkill("")

    try {
      await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName }),
      })
    } catch (e) {
      console.warn("Failed to persist custom skill:", e)
    }
  }

  return (
    <section>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-indigo-300">Skill Taxonomy &amp; Market Alignment</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Skills &amp; Gap Matrix</h2>
          <p className="mt-2 text-sm text-slate-400">Gemini AI analyzes your detected skills against the top requirements for {profile.title || "your target role"}.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadSkills(true)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Refresh Analysis
          </button>
          <button onClick={() => setOverlay("ai")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-400 transition-colors">
            <Sparkles className="size-4" />Skill Coaching
          </button>
        </div>
      </div>

      {loading || !data ? (
        <div className="flex py-32 items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="size-6 animate-spin text-indigo-400" /> Analyzing skill taxonomy with Gemini...
        </div>
      ) : (
        <>
          {/* Top Insights */}
          <div className="grid gap-6 md:grid-cols-3 mb-6">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-slate-400">Market Readiness</span>
                <Award className="size-5 text-indigo-400" />
              </div>
              <div className="text-3xl font-bold text-white">{data.readinessScore}%</div>
              <p className="text-xs text-slate-400 mt-2">Calculated against modern industry standards</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-emerald-400">Top Strengths</span>
                <CheckCircle2 className="size-5 text-emerald-400" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.topStrengths.map((s) => (
                  <span key={s} className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs text-emerald-300 font-medium">{s}</span>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-amber-400">Priority Gaps</span>
                <Flame className="size-5 text-amber-400" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.criticalGaps.map((g) => (
                  <span key={g} className="rounded-md bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300 font-medium">{g}</span>
                ))}
              </div>
            </Card>
          </div>

          {/* Quick Add Custom Skill */}
          <div className="mb-6 flex gap-2">
            <input
              value={customSkill}
              onChange={(e) => setCustomSkill(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddSkill() }}
              placeholder="Add a verified skill (e.g. GraphQL, AWS Lambda, System Design)..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 transition-colors"
            />
            <button
              onClick={handleAddSkill}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 transition-colors"
            >
              <Plus className="size-4" /> Add Skill
            </button>
          </div>

          {/* Categories */}
          <div className="grid gap-6 md:grid-cols-3">
            {data.categories.map((cat) => (
              <Card key={cat.name}>
                <h3 className="font-semibold text-white mb-4 flex items-center justify-between">
                  <span>{cat.name}</span>
                  <span className="text-xs text-slate-400 font-normal">{cat.skills.length} skills</span>
                </h3>
                <div className="space-y-3.5">
                  {cat.skills.map((s) => (
                    <div key={s.name} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-200">{s.name}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${s.status === "Strong" ? "bg-emerald-500/15 text-emerald-300" : s.status === "Gap" ? "bg-rose-500/15 text-rose-300" : "bg-indigo-500/15 text-indigo-300"}`}>
                          {s.level}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.status === "Strong" ? "bg-emerald-400" : s.status === "Gap" ? "bg-rose-400" : "bg-indigo-400"}`}
                          style={{ width: `${s.match}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// ─── Learning Plan Page (Gemini Powered) ──────────────────────────────────────
function LearningPlanPage({ profile, setOverlay }: {
  profile: Profile; setOverlay: (v: "ai") => void
}) {
  const [plan, setPlan] = useState<LearningPlanData | null>(null)
  const [loading, setLoading] = useState(true)

  const loadPlan = useCallback(async (regenerate = false) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/learning-plan${regenerate ? "?regenerate=true" : ""}`)
      if (res.ok) {
        const { data } = await res.json()
        setPlan(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPlan(false)
  }, [loadPlan])

  const toggleTask = async (weekNumber: number, taskId: string) => {
    if (!plan) return
    const week = plan.weeks.find((w) => w.weekNumber === weekNumber)
    const task = week?.tasks.find((t) => t.id === taskId)
    const newCompleted = !task?.completed

    setPlan({
      ...plan,
      weeks: plan.weeks.map((w) =>
        w.weekNumber === weekNumber
          ? {
            ...w,
            tasks: w.tasks.map((t) => (t.id === taskId ? { ...t, completed: newCompleted } : t)),
          }
          : w
      ),
    })

    try {
      await fetch("/api/learning-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekNumber, taskId, completed: newCompleted }),
      })
    } catch (e) {
      console.warn("Failed to persist task status:", e)
    }
  }

  const allTasks = plan?.weeks.flatMap((w) => w.tasks) || []
  const completedTasks = allTasks.filter((t) => t.completed).length
  const progressPercent = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0

  return (
    <section>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-indigo-300">Structured Skill Acceleration</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">4-Week Learning Roadmap</h2>
          <p className="mt-2 text-sm text-slate-400">Curated weekly syllabus by Gemini AI to rapidly prepare you for {profile.title || "your target role"}.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadPlan(true)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Regenerate Roadmap
          </button>
          <button onClick={() => setOverlay("ai")} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-400 transition-colors">
            <Sparkles className="size-4" />Ask Coach
          </button>
        </div>
      </div>

      {loading || !plan ? (
        <div className="flex py-32 items-center justify-center gap-2 text-sm text-slate-400">
          <Loader2 className="size-6 animate-spin text-indigo-400" /> Building personalized 4-week roadmap with Gemini...
        </div>
      ) : (
        <>
          {/* Progress Header Card */}
          <Card className="mb-8 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase text-indigo-300 tracking-wider">{plan.title}</span>
                <h3 className="text-xl font-bold text-white mt-1">{progressPercent}% Completed</h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-indigo-400" /> {plan.estimatedWeeklyHours} recommended pace · {completedTasks}/{allTasks.length} milestones checked
                </p>
              </div>
              <div className="w-full md:w-64">
                <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </div>
          </Card>

          {/* 4 Weeks Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {plan.weeks.map((week) => (
              <Card key={week.weekNumber} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                    <span className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
                      WEEK {week.weekNumber}
                    </span>
                    <span className="text-xs text-slate-400">
                      {week.tasks.filter((t) => t.completed).length}/{week.tasks.length} tasks
                    </span>
                  </div>

                  <h4 className="font-semibold text-white text-base">{week.theme}</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{week.goal}</p>

                  <div className="mt-4 space-y-2.5">
                    {week.tasks.map((task) => (
                      <label
                        key={task.id}
                        onClick={() => toggleTask(week.weekNumber, task.id)}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors ${task.completed ? "bg-emerald-500/10 border-emerald-500/20 text-slate-300 line-through opacity-75" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                      >
                        <div className={`mt-0.5 size-4 rounded flex items-center justify-center border ${task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-white/30"}`}>
                          {task.completed && <Check className="size-3" />}
                        </div>
                        <span className="text-xs leading-snug flex-1">{task.title}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-indigo-300">
                  <span className="flex items-center gap-1.5 truncate">
                    <BookOpen className="size-3.5 shrink-0" /> {week.resource}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────
function SettingsPage({ profile, session }: { profile: Profile; session: any }) {
  const [digest, setDigest] = useState(true)
  const [jobAlerts, setJobAlerts] = useState(true)
  const [aiTips, setAiTips] = useState(true)
  const [syncStatus, setSyncStatus] = useState("Connected")

  return (
    <section>
      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-indigo-300">System Preferences &amp; Integration</p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Settings &amp; Integrations</h2>
        <p className="mt-2 text-sm text-slate-400">Manage your connected database, AI engine, and notification channels.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Connected Services */}
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-400" /> Connected Services Status
            </h3>
            <div className="space-y-3">
              {[
                ["MongoDB Atlas Database", "Connected to cluster0 (careerai)", "Live", Database],
                ["Google Cloud OAuth 2.0", session?.user?.email || "Connected", "Active", Key],
                ["Google Gemini 3 Flash", "API active (gemini-3-flash-preview)", "Live", Zap],
              ].map(([name, desc, status, Icon]) => (
                <div key={name as string} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{name as string}</p>
                      <p className="text-xs text-slate-400">{desc as string}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                    {status as string}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-white mb-4">Notification Channels</h3>
            <div className="space-y-4">
              {[
                ["Weekly Career Digest", "Receive a weekly summary of your readiness score and milestones", digest, setDigest],
                ["New Job Match Alerts", "Instant alerts when a job matches >85% of your skill matrix", jobAlerts, setJobAlerts],
                ["AI Coaching Tips", "Personalized prompts and interview reminders", aiTips, setAiTips],
              ].map(([title, desc, val, setVal]) => (
                <div key={title as string} className="flex items-center justify-between">
                  <div className="pr-4">
                    <p className="text-sm font-medium text-slate-200">{title as string}</p>
                    <p className="text-xs text-slate-500">{desc as string}</p>
                  </div>
                  <button
                    onClick={() => (setVal as any)(!val)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${val ? "bg-indigo-500" : "bg-white/15"}`}
                  >
                    <span className={`inline-block size-5 transform rounded-full bg-white transition duration-200 ease-in-out ${val ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Account & Actions */}
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-white mb-4">Account Profile</h3>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-slate-500">Name</p>
                <p className="font-medium text-white mt-0.5">{profile.name}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium text-white mt-0.5">{profile.email}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <p className="text-xs text-slate-500">Authentication Provider</p>
                <p className="font-medium text-indigo-300 mt-0.5">Google OAuth 2.0</p>
              </div>
            </div>
          </Card>

          <Card className="border-rose-500/20 bg-rose-500/[0.02]">
            <h3 className="font-semibold text-rose-300 mb-2">Account Session</h3>
            <p className="text-xs text-slate-400 mb-4">Sign out of your active CareerOS session across this device.</p>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/30 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-500 hover:text-white transition-colors"
            >
              <LogOut className="size-4" /> Sign Out
            </button>
          </Card>
        </div>
      </div>
    </section>
  )
}

// ─── Resume Page ──────────────────────────────────────────────────────────────
function ResumePage({ setUploadOpen, parsedResume, profile }: {
  setUploadOpen: (v: boolean) => void; parsedResume: ParsedResume | null; profile: Profile
}) {
  const [copiedTemplate, setCopiedTemplate] = useState(false)

  const outreachTemplate = `Hi [Hiring Manager / Recruiter Name],

I noticed your open [Target Role] position at [Company Name] and recently submitted my application. With my background in ${parsedResume?.skills?.slice(0, 3).join(", ") || "Full Stack & Modern Web Development"} and proven impact delivering scalable systems, I'm eager to contribute to your team.

I'd love to connect and share how my experience aligns with your current roadmap!

Best regards,
${profile.name || "Candidate"}`

  const handleCopy = () => {
    navigator.clipboard.writeText(outreachTemplate)
    setCopiedTemplate(true)
    setTimeout(() => setCopiedTemplate(false), 2500)
  }

  const atsScore = parsedResume?.atsScore || profile.resumeScore || 50

  return (
    <section>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-indigo-300">Resume Intelligence &amp; ATS Optimization</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Resume Analysis &amp; ATS 100 Blueprint</h2>
          <p className="mt-2 text-sm text-slate-400">Upload your PDF resume to extract skills, calculate ATS score, and receive step-by-step improvements.</p>
        </div>
        <button onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 transition-colors">
          <Upload className="size-4" />Upload Resume (PDF)
        </button>
      </div>

      {parsedResume ? (
        <div className="space-y-6">
          {/* Main Score Header */}
          <Card>
            <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Analyzed Resume</span>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 border border-emerald-500/30">
                    ATS Score: {atsScore}/100
                  </span>
                </div>
                <h3 className="mt-2 text-xl font-bold text-white">{parsedResume.fileName}</h3>
                <p className="mt-1 text-xs text-slate-400">Processed by Gemini AI · Extracted {parsedResume.skillsFound} verified skills &amp; {parsedResume.rolesExtracted} roles</p>
                <div className="mt-4 h-2.5 max-w-md overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-500" style={{ width: `${atsScore}%` }} />
                </div>
              </div>
              <button onClick={() => setUploadOpen(true)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors">
                Replace PDF
              </button>
            </div>
          </Card>

          {/* Quick Metrics Bar */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[
              ["Candidate Name", parsedResume.name ?? profile.name ?? "—"],
              ["Email Address", parsedResume.email ?? profile.email ?? "—"],
              ["Roles Extracted", String(parsedResume.rolesExtracted)],
              ["Skills Detected", String(parsedResume.skillsFound)],
              ["ATS Readiness", `${atsScore} / 100`],
            ].map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="mt-1.5 text-sm font-semibold text-white truncate">{value}</p>
              </Card>
            ))}
          </div>

          {/* ATS 100/100 Score Blueprint: What To Improve */}
          <div className="grid gap-6 lg:grid-cols-[1.3fr_1.1fr]">
            <Card>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="size-5 text-indigo-400" />
                  <h3 className="font-semibold text-white">How to Achieve a Perfect 100/100 ATS Score</h3>
                </div>
                <span className="text-xs text-indigo-300 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                  Actionable Checklist
                </span>
              </div>

              <div className="space-y-3.5 text-xs text-slate-300">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="grid size-6 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold shrink-0">1</span>
                  <div>
                    <p className="font-semibold text-white">Quantify Every Bullet Point (Metrics)</p>
                    <p className="text-slate-400 mt-0.5">Instead of *"Built web app"*, write: *"Engineered high-throughput Next.js application, reducing page load times by 42% and serving 150k monthly active users."*</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="grid size-6 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold shrink-0">2</span>
                  <div>
                    <p className="font-semibold text-white">Embed High-Frequency Job Keywords</p>
                    <p className="text-slate-400 mt-0.5">Ensure target keywords (*TypeScript, React, Next.js, CI/CD, SQL, System Architecture*) appear in both your Skills section and Work History bullets.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="grid size-6 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold shrink-0">3</span>
                  <div>
                    <p className="font-semibold text-white">Clean Single-Column ATS Layout</p>
                    <p className="text-slate-400 mt-0.5">Avoid tables, text boxes, and complex multi-column sidebars which cause ATS parsing dropped characters.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="grid size-6 place-items-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold shrink-0">4</span>
                  <div>
                    <p className="font-semibold text-white">Include 2 Live Project Repositories</p>
                    <p className="text-slate-400 mt-0.5">Add clickable links to GitHub repositories and live deployments to convert ATS passes into direct interview offers.</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Post-Application Action Plan */}
            <Card>
              <div className="flex items-center gap-2.5 border-b border-white/10 pb-4 mb-4">
                <Target className="size-5 text-emerald-400" />
                <h3 className="font-semibold text-white">Post-Application Game Plan</h3>
              </div>

              <div className="space-y-4 text-xs">
                <div className="rounded-xl bg-white/5 p-3.5 border border-white/5">
                  <p className="font-semibold text-indigo-300">Step 1: LinkedIn Hiring Manager Outreach</p>
                  <p className="text-slate-400 mt-1">Send a warm, personalized connection request within 24 hours of applying.</p>
                  <div className="mt-2.5 rounded-lg bg-black/40 p-2.5 text-slate-300 font-mono text-[11px] leading-relaxed border border-white/10">
                    {outreachTemplate}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="mt-2 text-xs font-semibold text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
                  >
                    {copiedTemplate ? "✓ Copied Outreach Message!" : "Copy LinkedIn Outreach Template →"}
                  </button>
                </div>

                <div className="rounded-xl bg-white/5 p-3.5 border border-white/5">
                  <p className="font-semibold text-emerald-300">Step 2: Practice Role STAR Questions</p>
                  <p className="text-slate-400 mt-1">Head to the **Interview Prep** tab in CareerOS to simulate questions tailored to this role.</p>
                </div>

                <div className="rounded-xl bg-white/5 p-3.5 border border-white/5">
                  <p className="font-semibold text-amber-300">Step 3: 5-Day Follow-Up Protocol</p>
                  <p className="text-slate-400 mt-1">If no response in 5 business days, send a polite check-in referencing your application ID.</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Detected Skills */}
          {parsedResume.skills.length > 0 && (
            <Card>
              <h3 className="font-semibold text-white mb-3">Extracted Skills Matrix ({parsedResume.skills.length})</h3>
              <div className="flex flex-wrap gap-2">
                {parsedResume.skills.map((skill) => (
                  <span key={skill} className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 text-xs text-indigo-200 font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Work History */}
          {parsedResume.workHistory.length > 0 && (
            <Card>
              <h3 className="font-semibold text-white mb-4">Extracted Work History</h3>
              <div className="flex flex-col gap-4">
                {parsedResume.workHistory.map((job, i) => (
                  <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="font-semibold text-white text-sm">{job.role}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{job.company} · {job.duration}</p>
                    {job.highlights.length > 0 && (
                      <ul className="mt-2.5 space-y-1.5">
                        {job.highlights.map((h, j) => (
                          <li key={j} className="text-xs text-slate-300 before:content-['•'] before:mr-2 before:text-indigo-400">
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <button onClick={() => setUploadOpen(true)} className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] py-20 text-center transition-colors hover:border-indigo-500/40 hover:bg-white/5">
          <div className="grid size-16 place-items-center rounded-2xl bg-indigo-500/15 text-indigo-300">
            <Upload className="size-8" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">Upload your resume PDF</p>
            <p className="mt-1 text-sm text-slate-400">Click to select a PDF file · Evaluated by Gemini AI · Saved directly to MongoDB</p>
          </div>
        </button>
      )}
    </section>
  )
}

// ─── Profile Editor ───────────────────────────────────────────────────────────
function ProfileEditor({ profile, setProfile, setUploadOpen, loading }: {
  profile: Profile; setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  setUploadOpen: (v: boolean) => void; loading: boolean
}) {
  const [tab, setTab] = useState("Personal Info")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const update = useCallback((key: keyof Profile, value: string) => {
    setProfile((p) => ({ ...p, [key]: value }))
    setSaved(false)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        })
        setSaved(true)
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [setProfile])

  const fields: [keyof Profile, string][] = tab === "Personal Info"
    ? [["name", "Full name"], ["email", "Email"], ["title", "Professional title"], ["location", "Location"]]
    : [["roles", "Target roles"], ["locations", "Preferred locations"]]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  return (
    <section>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-medium text-indigo-300">Your professional profile</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Profile that gets noticed.</h2>
          <p className="mt-2 text-sm text-slate-400">Edit your story. Changes are saved automatically to MongoDB.</p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-slate-400 flex items-center gap-1"><Loader2 className="size-3 animate-spin" />Saving...</span>}
          {saved && !saving && <span className="text-xs text-emerald-400">✓ Saved to MongoDB</span>}
          <button onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 transition-colors shadow-md">
            <Upload className="size-4" />Upload Resume (PDF)
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {["Personal Info", "Target Roles", "Export Profile"].map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${tab === item ? "bg-indigo-500 text-white shadow-sm" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "Export Profile" ? (
        <Card>
          <h3 className="font-semibold">Export your CareerOS profile</h3>
          <p className="mt-2 text-sm text-slate-400">Download a polished profile summary and your latest analysis.</p>
          <button onClick={() => window.print()} className="mt-5 rounded-xl bg-white/10 px-4 py-2.5 text-sm hover:bg-white/15">Print / Download PDF</button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <h3 className="font-semibold">{tab}</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {fields.map(([key, label]) => (
                <label key={key} className="flex flex-col gap-2 text-sm text-slate-400">
                  {label}
                  <input
                    value={profile[key] as string ?? ""}
                    onChange={(e) => update(key, e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-foreground outline-none focus:border-indigo-400 transition-colors"
                  />
                </label>
              ))}
            </div>
            {tab === "Personal Info" && (
              <label className="mt-4 flex flex-col gap-2 text-sm text-slate-400">
                Bio
                <textarea
                  value={profile.bio ?? ""}
                  onChange={(e) => update("bio", e.target.value)}
                  className="min-h-28 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-foreground outline-none focus:border-indigo-400 transition-colors"
                />
              </label>
            )}
          </Card>
          <Card>
            <p className="text-sm text-slate-400">Career readiness</p>
            <div className="mt-3 text-5xl font-semibold text-indigo-300">{profile.readiness}</div>
            <p className="mt-1 text-sm text-slate-500">Live score based on completeness</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all" style={{ width: `${profile.readiness}%` }} />
            </div>
          </Card>
        </div>
      )}
    </section>
  )
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ onClose, onParsed }: {
  onClose: () => void; onParsed: (data: ParsedResume) => void
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle")
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState("")
  const [result, setResult] = useState<ParsedResume | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErrorMsg("Please select a PDF file.")
      setStatus("error")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File too large. Maximum size is 10MB.")
      setStatus("error")
      return
    }

    setStatus("uploading")
    setProgress(15)

    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 10, 85))
    }, 350)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/resume", { method: "POST", body: formData })
      clearInterval(progressInterval)

      if (!res.ok) {
        const { error } = await res.json()
        setErrorMsg(error ?? "Failed to process PDF.")
        setStatus("error")
        return
      }

      setProgress(100)
      const { data } = await res.json()
      setResult(data)
      setStatus("done")
    } catch {
      clearInterval(progressInterval)
      setErrorMsg("Network error. Please check your connection.")
      setStatus("error")
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-indigo-300">Gemini AI Resume Intelligence</p>
            <h2 className="mt-1 text-xl font-semibold">Upload Resume (PDF)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close upload modal"><X className="size-5" /></button>
        </div>

        {status === "idle" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="mt-6 flex min-h-48 w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-400/50 bg-indigo-500/10 text-center hover:bg-indigo-500/15 transition-colors"
          >
            <Upload className="size-8 text-indigo-300" />
            <div>
              <span className="font-medium">Drop your PDF here</span>
              <p className="mt-1 text-sm text-slate-400">or click to browse · PDF up to 10MB · Saved directly to MongoDB</p>
            </div>
          </div>
        )}

        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

        {status === "uploading" && (
          <div className="mt-8">
            <div className="flex items-center justify-between text-sm">
              <span>Analyzing resume with Gemini AI...</span>
              <span className="text-indigo-300 font-semibold">{progress}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {["Reading document structure", "Extracting work history", "Mapping core skills", "Checking ATS compatibility"].map((item, i) => (
                <div key={item} className="rounded-xl bg-white/5 p-3 text-sm text-slate-300">
                  {progress > i * 22 ? <Check className="mr-2 inline size-4 text-emerald-300" /> : <Loader2 className="mr-2 inline size-4 animate-spin text-slate-500" />}
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{errorMsg}</div>
            <button onClick={() => { setStatus("idle"); setErrorMsg("") }} className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Try again</button>
          </div>
        )}

        {status === "done" && result && (
          <div className="mt-6">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              ✓ Resume parsed and analyzed by Gemini AI. Synced to MongoDB.
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Name", result.name ?? "—"],
                ["Email", result.email ?? "—"],
                ["Roles Found", String(result.rolesExtracted)],
                ["Skills Detected", String(result.skillsFound)],
                ["ATS Score", `${result.atsScore} / 100`],
              ].map(([a, b]) => (
                <div key={a} className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs text-slate-500">{a}</p>
                  <p className="mt-1 font-medium truncate">{b}</p>
                </div>
              ))}
            </div>
            <button onClick={() => { onParsed(result); onClose() }} className="mt-5 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 transition-colors">
              Review updated profile →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
function Overlay({ kind, setOverlay, job, chatMessages, chatLoading, onSendChat, searchQuery, setSearchQuery, searchResults, onSelectJob }: {
  kind: "search" | "notifications" | "ai" | "job"
  setOverlay: (v: null) => void
  job: Job | null
  chatMessages: ChatMessage[]
  chatLoading: boolean
  onSendChat: (msg: string) => void
  searchQuery: string
  setSearchQuery: (v: string) => void
  searchResults: Job[]
  onSelectJob: (job: Job) => void
}) {
  const [chatInput, setChatInput] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages, chatLoading])

  if (kind === "search") {
    return (
      <div className="fixed inset-0 z-50 grid place-items-start bg-black/60 p-4 pt-[15vh] backdrop-blur-sm" onClick={() => setOverlay(null)}>
        <div onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <Search className="size-5 text-slate-500" />
            <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search jobs, skills, or companies..." className="flex-1 bg-transparent text-sm outline-none" />
            <kbd className="rounded bg-white/10 px-2 py-1 text-xs text-slate-400">ESC</kbd>
          </div>
          {searchResults.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              {searchResults.map((j) => (
                <button key={j.id} onClick={() => { onSelectJob(j); setOverlay(null) }} className="flex items-center gap-3 rounded-lg p-2 text-left hover:bg-white/5">
                  <div className={`grid size-8 place-items-center rounded-lg text-xs font-bold text-white ${j.color}`}>{j.company[0]}</div>
                  <div>
                    <p className="text-sm font-medium">{j.role}</p>
                    <p className="text-xs text-slate-500">{j.company} · {j.match}% match</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
              <Command className="size-4" />Try searching for "engineer" or "designer"
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOverlay(null)}>
      <aside onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <h2 className="font-semibold tracking-tight text-white flex items-center gap-2">
            {kind === "ai" && <Sparkles className="size-4 text-indigo-400" />}
            {kind === "notifications" ? "Recent activity" : kind === "ai" ? "Ask CareerOS AI" : job ? `${job.company} — ${job.role}` : "Job Details"}
          </h2>
          <button onClick={() => setOverlay(null)} className="text-slate-400 hover:text-white" aria-label="Close panel"><X className="size-5" /></button>
        </div>

        {kind === "notifications" && (
          <div className="flex flex-col gap-3 overflow-y-auto p-5">
            {[
              "MongoDB Atlas connection verified and active",
              "Gemini 3 Flash model linked to interview & chat engine",
              "Your resume was analyzed and ATS score updated",
            ].map((note) => (
              <div key={note} className="rounded-xl bg-white/5 p-4 text-sm border border-white/5">
                {note}
                <p className="mt-1 text-xs text-slate-500">Just now</p>
              </div>
            ))}
          </div>
        )}

        {kind === "job" && job && (
          <div className="overflow-y-auto p-6 space-y-6">
            <div className="flex items-center gap-4">
              <CompanyLogo logoUrl={job.logoUrl} company={job.company} className="size-14 p-2 text-xl" />
              <div>
                <h3 className="font-bold text-white text-lg">{job.role}</h3>
                <p className="text-sm text-slate-400 mt-0.5">{job.company} · {job.location}</p>
                <span className="inline-block mt-2 rounded-md bg-indigo-500/15 border border-indigo-500/25 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                  Source: {job.source || "Company Portal"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 border border-white/5 p-3.5">
                <p className="text-xs text-slate-400 font-medium">Match Score</p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">{job.match}%</p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/5 p-3.5">
                <p className="text-xs text-slate-400 font-medium">Salary in Rupees</p>
                <p className="mt-1 text-base font-bold text-white">{job.salary}</p>
              </div>
            </div>
            {job.description && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Role Overview</h4>
                <p className="text-sm text-slate-300 leading-relaxed bg-white/5 p-3.5 rounded-2xl border border-white/5">
                  {job.description}
                </p>
              </div>
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Required Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {job.skills.map((skill) => (
                  <span key={skill} className="rounded-lg bg-indigo-500/15 border border-indigo-500/20 px-3 py-1 text-xs font-medium text-indigo-200">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
            {job.applyUrl && (
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-3.5 text-sm font-semibold text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/25"
              >
                Apply on {job.source || "Company Portal"} <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        )}

        {kind === "ai" && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Suggestion chips */}
            {chatMessages.length === 0 && (
              <div className="flex flex-wrap gap-2 p-5 pb-0">
                {["Improve my resume", "Find my skill gaps", "Prep me for interviews", "Salary negotiation tips"].map((prompt) => (
                  <button key={prompt} onClick={() => { onSendChat(prompt) }} className="rounded-full border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 transition-colors">
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[90%] rounded-2xl p-4 text-sm shadow-sm ${msg.role === "user" ? "bg-indigo-600 text-white" : "border border-white/10 bg-slate-900/90 text-slate-200"}`}>
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <FormattedChatMessage content={msg.content} />
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 flex items-center gap-2 text-xs text-indigo-300">
                    <Loader2 className="size-4 animate-spin text-indigo-400" />
                    <span>CareerOS AI is analyzing with Gemini...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/10 p-4 bg-slate-950/80">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-2 focus-within:border-indigo-500/50 transition-colors">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSendChat(chatInput); setChatInput("") } }}
                  placeholder="Ask anything about your career..."
                  className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-slate-500"
                />
                <button
                  onClick={() => { onSendChat(chatInput); setChatInput("") }}
                  disabled={!chatInput.trim() || chatLoading}
                  className="grid size-9 place-items-center rounded-lg bg-indigo-500 text-white disabled:opacity-40 hover:bg-indigo-400 transition-colors"
                  aria-label="Send message"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

// ─── Markdown Chat Formatter ───────────────────────────────────────────────────
function FormattedChatMessage({ content }: { content: string }) {
  const sections = content.split(/\n\s*\n/).filter(Boolean)

  return (
    <div className="space-y-3.5 text-sm leading-relaxed">
      {sections.map((sec, sIdx) => {
        const lines = sec.split("\n").filter(Boolean)
        const isBulletList = lines.every((l) => /^\s*([*•\->]|\d+[.)])\s+/.test(l))

        if (isBulletList) {
          return (
            <ul key={sIdx} className="space-y-2.5 my-2 pl-0.5">
              {lines.map((line, lIdx) => {
                const isQuote = /^\s*>\s*/.test(line)
                const cleanLine = line.replace(/^\s*([*•\->]|\d+[.)])\s+/, "")

                if (isQuote) {
                  return (
                    <li key={lIdx} className="border-l-2 border-indigo-500/60 bg-indigo-500/10 px-3 py-2 rounded-r-lg my-1.5 text-indigo-100 text-xs">
                      <FormatInline text={cleanLine} />
                    </li>
                  )
                }

                return (
                  <li key={lIdx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-400 ring-4 ring-indigo-500/10" />
                    <span className="flex-1 text-slate-200">
                      <FormatInline text={cleanLine} />
                    </span>
                  </li>
                )
              })}
            </ul>
          )
        }

        return (
          <div key={sIdx} className="space-y-2">
            {lines.map((line, lIdx) => {
              if (line.startsWith("###") || line.startsWith("##")) {
                const headingText = line.replace(/^#{2,3}\s*/, "")
                return (
                  <h4 key={lIdx} className="font-semibold text-indigo-300 pt-2 pb-0.5 text-xs uppercase tracking-wider">
                    <FormatInline text={headingText} />
                  </h4>
                )
              }
              if (/^\s*>\s*/.test(line)) {
                const quoteText = line.replace(/^\s*>\s*/, "")
                return (
                  <div key={lIdx} className="border-l-2 border-indigo-500/60 bg-indigo-500/10 px-3 py-2 rounded-r-lg my-1.5 text-indigo-100 text-xs">
                    <FormatInline text={quoteText} />
                  </div>
                )
              }
              if (/^\s*([*•\-]|\d+[.)])\s+/.test(line)) {
                const cleanLine = line.replace(/^\s*([*•\-]|\d+[.)])\s+/, "")
                return (
                  <div key={lIdx} className="flex items-start gap-2.5 my-1.5 pl-0.5">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-indigo-400 ring-4 ring-indigo-500/10" />
                    <span className="flex-1 text-slate-200">
                      <FormatInline text={cleanLine} />
                    </span>
                  </div>
                )
              }
              return (
                <p key={lIdx} className="text-slate-200">
                  <FormatInline text={line} />
                </p>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function FormatInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={i} className="italic text-indigo-200">{part.slice(1, -1)}</em>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default CareerOSDashboard
