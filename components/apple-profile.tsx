"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  User,
  Mail,
  Briefcase,
  MapPin,
  Sparkles,
  CheckCircle2,
  Upload,
  Globe,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
  Zap,
  Award,
  Loader2,
  Flame,
  FileText,
  Printer,
  ChevronRight,
  RefreshCw,
  Compass,
} from "lucide-react"
import Image from "next/image"

export type ProfileData = {
  name: string
  email: string
  title: string
  location: string
  bio: string
  roles: string
  locations: string
  readiness: number
  resumeScore: number
  skillsScore: number
  experienceScore: number
  applicationsSent: number
  profileViews: number
  image?: string | null
}

interface AppleProfileProps {
  profile: ProfileData
  setProfile: React.Dispatch<React.SetStateAction<ProfileData>>
  setUploadOpen: (v: boolean) => void
  loading: boolean
}

export function AppleProfileEditor({ profile, setProfile, setUploadOpen, loading }: AppleProfileProps) {
  const [activeTab, setActiveTab] = useState<"Personal Info" | "Target Roles" | "Apple Intelligence">("Personal Info")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isGeneratingBio, setIsGeneratingBio] = useState(false)
  const [typewriterIndex, setTypewriterIndex] = useState<number | null>(null)
  const [targetBioText, setTargetBioText] = useState("")
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Mouse coordinates for interactive spotlight glow & 3D tilt
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 })
  const [isHovered, setIsHovered] = useState(false)

  // Animated counter for Apple Watch ring
  const [displayScore, setDisplayScore] = useState(profile.readiness || 78)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync display score with profile readiness smoothly
  useEffect(() => {
    const target = profile.readiness || 78
    let current = displayScore
    if (current === target) return
    const step = target > current ? 1 : -1
    const interval = setInterval(() => {
      current += step
      setDisplayScore(current)
      if (current === target) clearInterval(interval)
    }, 18)
    return () => clearInterval(interval)
  }, [profile.readiness, displayScore])

  // Typewriter effect when Magic Auto-Draft is clicked
  useEffect(() => {
    if (typewriterIndex === null || !targetBioText) return

    if (typewriterIndex < targetBioText.length) {
      const timeout = setTimeout(() => {
        const nextChar = targetBioText.slice(0, typewriterIndex + 1)
        setProfile((prev) => ({ ...prev, bio: nextChar }))
        setTypewriterIndex((prev) => (prev !== null ? prev + 1 : null))
      }, 16)
      return () => clearTimeout(timeout)
    } else {
      setTypewriterIndex(null)
      // Auto save the generated bio to MongoDB
      handleUpdateField("bio", targetBioText)
    }
  }, [typewriterIndex, targetBioText, setProfile])

  // Auto-save changes to MongoDB
  const handleUpdateField = useCallback(
    (key: keyof ProfileData, value: string | number) => {
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
        } catch (err) {
          console.warn("Failed to auto-save field to MongoDB:", err)
        } finally {
          setSaving(false)
        }
      }, 700)
    },
    [setProfile]
  )

  // Magic Bio Generator with Gemini AI
  const handleMagicDraftBio = async () => {
    setIsGeneratingBio(true)
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "magic-bio",
          title: profile.title || "Full Stack Architect",
          roles: profile.roles || "Engineering Leadership & Modern Systems",
          location: profile.location || "Remote",
        }),
      })

      if (res.ok) {
        const { bio } = await res.json()
        if (bio) {
          setTargetBioText(bio)
          setTypewriterIndex(0)
        }
      }
    } catch (e) {
      console.warn("Magic bio drafting failed:", e)
    } finally {
      setIsGeneratingBio(false)
    }
  }

  // Mouse tracking for physics spotlight and 3D card tilt
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setMousePos({ x, y })

    // Calculate subtle 3D tilt (max ±3.5 degrees)
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -3.5
    const rotateY = ((x - centerX) / centerX) * 3.5
    const glareX = (x / rect.width) * 100
    const glareY = (y / rect.height) * 100

    setCardTilt({ rotateX, rotateY, glareX, glareY })
  }

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    setIsHovered(false)
    setCardTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 })
  }

  // Interactive Checklist for Readiness Boost
  const checklistItems = [
    { id: "bio", label: "Executive Summary Bio", pts: 10, completed: Boolean(profile.bio && profile.bio.length > 25) },
    { id: "title", label: "Professional Title & Specialty", pts: 8, completed: Boolean(profile.title && profile.title.length > 3) },
    { id: "roles", label: "Target Roles & Focus", pts: 8, completed: Boolean(profile.roles && profile.roles.length > 3) },
    { id: "location", label: "Preferred Work Locations", pts: 6, completed: Boolean(profile.location || profile.locations) },
    { id: "resume", label: "ATS-Optimized PDF Resume", pts: 15, completed: Boolean(profile.resumeScore > 0) },
  ]

  const handleToggleChecklist = (item: (typeof checklistItems)[0]) => {
    const newScore = item.completed
      ? Math.max(20, (profile.readiness || 50) - item.pts)
      : Math.min(100, (profile.readiness || 50) + item.pts)
    handleUpdateField("readiness", newScore)
  }

  // Live extracted bio keywords
  const bioKeywords = (profile.bio || "")
    .split(/[\s,.;]+/)
    .filter((w) => w.length > 4)
    .slice(0, 6)

  if (loading) {
    return (
      <div className="flex min-h-[480px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-zinc-900/40 p-8 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          <div className="relative">
            <div className="size-12 rounded-full border-2 border-violet-500/20 border-t-violet-400 animate-spin" />
            <Sparkles className="size-5 text-violet-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <p className="text-sm font-medium text-zinc-300">Synchronizing Apple Pro Canvas with MongoDB...</p>
        </div>
      </div>
    )
  }

  // Calculate SVG circular path parameters
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (displayScore / 100) * circumference

  return (
    <div className="relative min-h-screen text-zinc-100 antialiased select-none">
      {/* ─── Apple Dynamic Wallpaper Background (Obsidian & Fluid Aura Orbs) ───── */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#0a0a0c]">
        {/* Soft radial base */}
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 size-[900px] rounded-full bg-gradient-to-b from-violet-600/15 via-indigo-700/10 to-transparent blur-[120px] mix-blend-screen" />
        <div className="absolute top-[35%] -left-[10%] size-[600px] rounded-full bg-gradient-to-tr from-fuchsia-600/10 via-purple-600/5 to-transparent blur-[140px] mix-blend-screen animate-pulse" style={{ animationDuration: "9s" }} />
        <div className="absolute bottom-[10%] right-[5%] size-[550px] rounded-full bg-gradient-to-tl from-cyan-600/10 via-blue-600/5 to-transparent blur-[130px] mix-blend-screen" />
        {/* Fine specular noise layer */}
        <div className="absolute inset-0 opacity-[0.025] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      {/* ─── macOS Sequoia Header & Dynamic Island Status ──────────────────────── */}
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 backdrop-blur-md mb-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
            <Sparkles className="size-3.5 text-violet-400" />
            <span>macOS Sequoia Profile Canvas</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            Command Your Presence.
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-xl">
            Live professional identity system designed with Apple Pro glassmorphism, instant AI intelligence, and MongoDB persistence.
          </p>
        </div>

        {/* Dynamic Island Status Pill & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Dynamic Island Status */}
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/60 px-3.5 py-1.5 text-xs text-zinc-300 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-medium text-zinc-200">MongoDB Atlas</span>
            <span className="text-zinc-600">·</span>
            <span className="text-violet-300 font-medium flex items-center gap-1">
              <Zap className="size-3 text-violet-400" /> Gemini AI
            </span>
          </div>

          {/* Auto-Save State */}
          <div className="flex items-center gap-2 px-2 text-xs">
            {saving && (
              <span className="flex items-center gap-1.5 text-zinc-400">
                <Loader2 className="size-3.5 animate-spin text-violet-400" />
                <span>Saving...</span>
              </span>
            )}
            {saved && !saving && (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check className="size-3.5 text-emerald-400" />
                <span>Synced</span>
              </span>
            )}
          </div>

          {/* Apple-grade Haptic Upload Button */}
          <button
            onClick={() => setUploadOpen(true)}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-white/15 to-white/5 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-xl shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-[1.02] hover:border-white/30 active:scale-[0.97]"
          >
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            <Upload className="size-4 text-violet-300 transition-transform duration-300 group-hover:-translate-y-0.5" />
            <span>Upload Resume (PDF)</span>
          </button>
        </div>
      </div>

      {/* ─── Apple Segmented Mode Switcher ────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-2xl max-w-fit shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
        {(["Personal Info", "Target Roles", "Apple Intelligence"] as const).map((tab) => {
          const isActive = activeTab === tab
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                isActive
                  ? "bg-gradient-to-b from-zinc-700/80 to-zinc-800/90 text-white shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] border border-white/15"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
              }`}
            >
              {tab}
            </button>
          )
        })}
      </div>

      {/* ─── Main Pro Grid Layout ─────────────────────────────────────────────── */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* ── Left Canvas: Frosted Glass Form Card with Dynamic Tilt & Spotlight ─ */}
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            transform: isHovered
              ? `perspective(1000px) rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg)`
              : "perspective(1000px) rotateX(0deg) rotateY(0deg)",
            transition: isHovered ? "transform 0.1s ease-out" : "transform 0.5s ease-out",
          }}
          className="relative rounded-3xl border border-white/10 bg-zinc-900/40 p-6 md:p-8 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.15)] overflow-hidden"
        >
          {/* Spotlight Cursor Follower */}
          <div
            className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300"
            style={{
              opacity: isHovered ? 1 : 0,
              background: `radial-gradient(circle 320px at ${mousePos.x}px ${mousePos.y}px, rgba(168, 85, 247, 0.15), transparent 80%)`,
            }}
          />

          {/* Card Top Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-5 mb-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                {activeTab === "Personal Info" ? (
                  <User className="size-5" />
                ) : activeTab === "Target Roles" ? (
                  <Compass className="size-5" />
                ) : (
                  <Sparkles className="size-5" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg tracking-tight">{activeTab}</h3>
                <p className="text-xs text-zinc-400">
                  {activeTab === "Personal Info"
                    ? "Your core public presence and executive narrative"
                    : activeTab === "Target Roles"
                    ? "Target industry positions, seniority, and location preferences"
                    : "Export and distribute your Apple-verified career dossier"}
                </p>
              </div>
            </div>

            <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1 text-[11px] font-medium text-zinc-400">
              Live Auto-Save
            </span>
          </div>

          {/* TAB 1: Personal Info */}
          {activeTab === "Personal Info" && (
            <div className="space-y-6">
              <div className="grid gap-5 md:grid-cols-2">
                {/* Full Name */}
                <div
                  className={`group relative flex flex-col gap-2 rounded-2xl border bg-black/40 p-3.5 transition-all duration-300 ${
                    focusedField === "name"
                      ? "border-violet-500/60 ring-4 ring-violet-500/10 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <User
                      className={`size-3.5 transition-all duration-300 ${
                        focusedField === "name" ? "text-violet-400 scale-110" : "text-zinc-500"
                      }`}
                    />
                    <span>Full Name</span>
                  </label>
                  <input
                    value={profile.name ?? ""}
                    onFocus={() => setFocusedField("name")}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => handleUpdateField("name", e.target.value)}
                    placeholder="e.g. Rishi Kesh"
                    className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600"
                  />
                </div>

                {/* Email Address */}
                <div
                  className={`group relative flex flex-col gap-2 rounded-2xl border bg-black/40 p-3.5 transition-all duration-300 ${
                    focusedField === "email"
                      ? "border-violet-500/60 ring-4 ring-violet-500/10 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <Mail
                      className={`size-3.5 transition-all duration-300 ${
                        focusedField === "email" ? "text-violet-400 scale-110" : "text-zinc-500"
                      }`}
                    />
                    <span>Email Address</span>
                  </label>
                  <input
                    value={profile.email ?? ""}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => handleUpdateField("email", e.target.value)}
                    placeholder="e.g. rishi@domain.com"
                    className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600"
                  />
                </div>

                {/* Professional Title */}
                <div
                  className={`group relative flex flex-col gap-2 rounded-2xl border bg-black/40 p-3.5 transition-all duration-300 ${
                    focusedField === "title"
                      ? "border-violet-500/60 ring-4 ring-violet-500/10 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <Briefcase
                      className={`size-3.5 transition-all duration-300 ${
                        focusedField === "title" ? "text-violet-400 scale-110" : "text-zinc-500"
                      }`}
                    />
                    <span>Professional Title</span>
                  </label>
                  <input
                    value={profile.title ?? ""}
                    onFocus={() => setFocusedField("title")}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => handleUpdateField("title", e.target.value)}
                    placeholder="e.g. Senior Software Architect"
                    className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600"
                  />
                </div>

                {/* Location */}
                <div
                  className={`group relative flex flex-col gap-2 rounded-2xl border bg-black/40 p-3.5 transition-all duration-300 ${
                    focusedField === "location"
                      ? "border-violet-500/60 ring-4 ring-violet-500/10 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <MapPin
                      className={`size-3.5 transition-all duration-300 ${
                        focusedField === "location" ? "text-violet-400 scale-110" : "text-zinc-500"
                      }`}
                    />
                    <span>Current Location</span>
                  </label>
                  <input
                    value={profile.location ?? ""}
                    onFocus={() => setFocusedField("location")}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => handleUpdateField("location", e.target.value)}
                    placeholder="e.g. San Francisco, CA (or Remote)"
                    className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Bio & Smart AI Bio Copilot */}
              <div
                className={`group relative flex flex-col gap-3 rounded-2xl border bg-black/40 p-4 transition-all duration-300 ${
                  focusedField === "bio"
                    ? "border-violet-500/60 ring-4 ring-violet-500/10 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
                    : "border-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <FileText
                      className={`size-3.5 transition-all duration-300 ${
                        focusedField === "bio" ? "text-violet-400 scale-110" : "text-zinc-500"
                      }`}
                    />
                    <span>Executive Summary Narrative</span>
                  </label>

                  {/* Glowing "✨ Magic Auto-Draft" Apple Intelligence Pill Button */}
                  <button
                    onClick={handleMagicDraftBio}
                    disabled={isGeneratingBio}
                    className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_4px_16px_rgba(168,85,247,0.4)] transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50"
                  >
                    {isGeneratingBio ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        <span>Composing with Gemini...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3 text-amber-200 animate-spin" style={{ animationDuration: "6s" }} />
                        <span>✨ Magic Auto-Draft</span>
                      </>
                    )}
                  </button>
                </div>

                <textarea
                  value={profile.bio ?? ""}
                  onFocus={() => setFocusedField("bio")}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => handleUpdateField("bio", e.target.value)}
                  placeholder="Craft your executive narrative or tap 'Magic Auto-Draft' to generate a tailored value proposition using Gemini AI..."
                  rows={4}
                  className="w-full bg-transparent text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 resize-none font-sans"
                />

                {/* Live Keyword Badge Pills */}
                {bioKeywords.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mr-1">
                      Detected Focus:
                    </span>
                    {bioKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-[11px] font-medium text-violet-300"
                      >
                        #{kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Target Roles & Preferences */}
          {activeTab === "Target Roles" && (
            <div className="space-y-6">
              <div className="grid gap-5">
                {/* Target Roles */}
                <div
                  className={`group relative flex flex-col gap-2 rounded-2xl border bg-black/40 p-4 transition-all duration-300 ${
                    focusedField === "roles"
                      ? "border-violet-500/60 ring-4 ring-violet-500/10 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <Layers
                      className={`size-3.5 transition-all duration-300 ${
                        focusedField === "roles" ? "text-violet-400 scale-110" : "text-zinc-500"
                      }`}
                    />
                    <span>Target Roles & Seniority</span>
                  </label>
                  <input
                    value={profile.roles ?? ""}
                    onFocus={() => setFocusedField("roles")}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => handleUpdateField("roles", e.target.value)}
                    placeholder="e.g. Principal Engineer, Staff Frontend Architect, AI Engineering Lead"
                    className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Used by Gemini to tailor your 4-Week Learning Roadmap, Interview Simulations, and Live Job Matches.
                  </p>
                </div>

                {/* Preferred Locations */}
                <div
                  className={`group relative flex flex-col gap-2 rounded-2xl border bg-black/40 p-4 transition-all duration-300 ${
                    focusedField === "locations"
                      ? "border-violet-500/60 ring-4 ring-violet-500/10 shadow-[0_0_24px_rgba(168,85,247,0.15)]"
                      : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    <Globe
                      className={`size-3.5 transition-all duration-300 ${
                        focusedField === "locations" ? "text-violet-400 scale-110" : "text-zinc-500"
                      }`}
                    />
                    <span>Target Locations & Work Mode</span>
                  </label>
                  <input
                    value={profile.locations ?? ""}
                    onFocus={() => setFocusedField("locations")}
                    onBlur={() => setFocusedField(null)}
                    onChange={(e) => handleUpdateField("locations", e.target.value)}
                    placeholder="e.g. Remote (US / EU / Global), San Francisco, New York, London"
                    className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-600"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Live LinkedIn search URLs automatically include your location preferences.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Apple Intelligence & Export */}
          {activeTab === "Apple Intelligence" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-zinc-900/40 to-black/40 p-6 backdrop-blur-xl">
                <div className="flex items-start gap-4">
                  <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 text-white shadow-[0_0_24px_rgba(168,85,247,0.4)] shrink-0">
                    <Award className="size-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-white">Apple-Verified Career Dossier</h4>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      Generate a formatted executive summary packet including your ATS Readiness index ({displayScore}%), verified skill matrix, and Gemini strategic recommendations.
                    </p>
                    <button
                      onClick={() => window.print()}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-white/15 transition-all"
                    >
                      <Printer className="size-3.5" />
                      <span>Print / Save PDF Dossier</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Canvas: Apple Watch-Style Animated Circular Readiness Ring ─ */}
        <div className="space-y-6">
          {/* Circular SVG Gauge Card */}
          <div className="relative rounded-3xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.15)] flex flex-col items-center text-center">
            {/* SVG Definitions for Apple Watch Gradient Stroke */}
            <svg className="size-0 absolute">
              <defs>
                <linearGradient id="appleVioletGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" />
                  <stop offset="50%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>

            <span className="text-[11px] font-bold uppercase tracking-widest text-violet-300 mb-4">
              Career Readiness Ring
            </span>

            {/* Circular Gauge */}
            <div className="relative my-2">
              <svg className="size-40 -rotate-90">
                {/* Background Ring Track */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  className="stroke-white/10"
                  strokeWidth="12"
                  fill="transparent"
                />
                {/* Animated Glowing Progress Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="url(#appleVioletGradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  fill="transparent"
                  strokeDasharray={circumference}
                  style={{
                    strokeDashoffset,
                    transition: "stroke-dashoffset 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    filter: "drop-shadow(0 0 10px rgba(168, 85, 247, 0.6))",
                  }}
                />
              </svg>

              {/* Center Counter */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold tracking-tight text-white">{displayScore}</span>
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">/ 100 PTS</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 mt-2">
              {displayScore >= 85
                ? "🌟 Top Tier Competitive Ready"
                : displayScore >= 70
                ? "⚡ High Market Alignment"
                : "🚀 Build momentum with checklist below"}
            </p>

            {/* Micro Breakdown Metrics */}
            <div className="mt-5 grid grid-cols-3 gap-2 w-full pt-4 border-t border-white/10">
              <div className="rounded-xl bg-black/30 p-2.5 text-center border border-white/5">
                <p className="text-[10px] uppercase font-semibold text-zinc-500">ATS Score</p>
                <p className="text-sm font-bold text-violet-300 mt-0.5">{profile.resumeScore || "—"}</p>
              </div>
              <div className="rounded-xl bg-black/30 p-2.5 text-center border border-white/5">
                <p className="text-[10px] uppercase font-semibold text-zinc-500">Skills</p>
                <p className="text-sm font-bold text-emerald-300 mt-0.5">{profile.skillsScore || 80}%</p>
              </div>
              <div className="rounded-xl bg-black/30 p-2.5 text-center border border-white/5">
                <p className="text-[10px] uppercase font-semibold text-zinc-500">Applied</p>
                <p className="text-sm font-bold text-indigo-300 mt-0.5">{profile.applicationsSent || 0}</p>
              </div>
            </div>
          </div>

          {/* ── Interactive Haptic Checklist ────────────────────────────────── */}
          <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_1px_0_rgba(255,255,255,0.15)]">
            <div className="flex items-center justify-between mb-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Flame className="size-3.5 text-amber-400" />
                <span>Readiness Boosters</span>
              </h4>
              <span className="text-[10px] text-zinc-500 font-medium">Tap to toggle</span>
            </div>

            <div className="space-y-2">
              {checklistItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleToggleChecklist(item)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all duration-200 ${
                    item.completed
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : "border-white/5 bg-black/30 text-zinc-400 hover:bg-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`grid size-4 place-items-center rounded border transition-colors ${
                        item.completed
                          ? "border-emerald-400 bg-emerald-500 text-black"
                          : "border-zinc-600 bg-black/40"
                      }`}
                    >
                      {item.completed && <Check className="size-3 stroke-[3]" />}
                    </div>
                    <span className={`truncate font-medium ${item.completed ? "text-zinc-200" : ""}`}>
                      {item.label}
                    </span>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      item.completed
                        ? "bg-emerald-400/20 text-emerald-300"
                        : "bg-violet-500/15 text-violet-300 border border-violet-500/20"
                    }`}
                  >
                    +{item.pts} pts
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AppleProfileEditor
