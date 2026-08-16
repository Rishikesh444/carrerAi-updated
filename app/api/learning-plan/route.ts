import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import clientPromise from "@/lib/mongodb"
import { generateGeminiAI } from "@/lib/gemini"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const forceRegenerate = url.searchParams.get("regenerate") === "true"

  try {
    const client = await clientPromise
    const db = client.db("careerai")

    const [profile, resume, existingPlanDoc] = await Promise.all([
      db.collection("profiles").findOne({ userId: session.user.id }),
      db.collection("resumes").findOne({ userId: session.user.id }, { sort: { parsedAt: -1 } }),
      db.collection("learning_plans").findOne({ userId: session.user.id }),
    ])

    const candidateName = profile?.name || session.user.name || "Candidate"
    const targetRole = profile?.title || profile?.roles || resume?.title || "Full Stack Developer"
    const candidateSkills = (resume?.skills || []).slice(0, 12).join(", ") || profile?.bio || "Software Development"
    const workHistorySummary = resume?.workHistory?.map((w: any) => `${w.role} at ${w.company}`).slice(0, 3).join("; ") || "Practical industry experience"

    // If existing plan exists for the same target role and not forcing regenerate, return it
    if (!forceRegenerate && existingPlanDoc?.plan && existingPlanDoc?.targetRole?.toLowerCase() === targetRole.toLowerCase()) {
      return NextResponse.json({ data: existingPlanDoc.plan })
    }

    // Generate dynamic, candidate-specific syllabus using Gemini AI
    const prompt = `You are a Principal Career Architect and Elite Technical Mentor.
Generate a completely custom, highly personalized 4-Week Career Acceleration Roadmap for this candidate.

CANDIDATE DETAILS:
- Candidate Name: ${candidateName}
- Target Role: ${targetRole}
- Current Verified Skills: ${candidateSkills}
- Background Summary: ${workHistorySummary}

REQUIREMENTS:
1. Every week's theme, goal, 3 tasks, and recommended resource MUST be uniquely tailored to "${targetRole}" and bridge the candidate's background (${candidateSkills}) to industry excellence.
2. Week 1: Core domain foundations, design patterns, and bridging critical skill gaps for ${targetRole}.
3. Week 2: Deep technical implementation, real-world data/architecture/tools for ${targetRole}.
4. Week 3: Production engineering, cloud/tooling deployment, automated testing, or real-world portfolio project for ${targetRole}.
5. Week 4: System design, advanced domain challenge, STAR interview storytelling, and portfolio showcase for ${targetRole}.
6. Tasks must be concrete and actionable (e.g. "Build X using Y", "Benchmark and optimize Z", "Implement A with B").
7. Do NOT return markdown code blocks, backticks, or preamble. Return ONLY pure valid JSON.

JSON SCHEMA:
{
  "title": "4-Week Roadmap to ${targetRole}",
  "estimatedWeeklyHours": "6-8 hrs/week",
  "weeks": [
    {
      "weekNumber": 1,
      "theme": "Theme title specific to ${targetRole}",
      "goal": "Clear 1-sentence goal for week 1 for ${targetRole}",
      "tasks": [
        { "id": "w1-1", "title": "Concrete task 1", "completed": false },
        { "id": "w1-2", "title": "Concrete task 2", "completed": false },
        { "id": "w1-3", "title": "Concrete task 3", "completed": false }
      ],
      "resource": "Curated guide/book/resource name for ${targetRole}"
    },
    {
      "weekNumber": 2,
      "theme": "Theme title specific to ${targetRole}",
      "goal": "Clear 1-sentence goal for week 2 for ${targetRole}",
      "tasks": [
        { "id": "w2-1", "title": "Concrete task 1", "completed": false },
        { "id": "w2-2", "title": "Concrete task 2", "completed": false },
        { "id": "w2-3", "title": "Concrete task 3", "completed": false }
      ],
      "resource": "Curated guide/book/resource name for ${targetRole}"
    },
    {
      "weekNumber": 3,
      "theme": "Theme title specific to ${targetRole}",
      "goal": "Clear 1-sentence goal for week 3 for ${targetRole}",
      "tasks": [
        { "id": "w3-1", "title": "Concrete task 1", "completed": false },
        { "id": "w3-2", "title": "Concrete task 2", "completed": false },
        { "id": "w3-3", "title": "Concrete task 3", "completed": false }
      ],
      "resource": "Curated guide/book/resource name for ${targetRole}"
    },
    {
      "weekNumber": 4,
      "theme": "Theme title specific to ${targetRole}",
      "goal": "Clear 1-sentence goal for week 4 for ${targetRole}",
      "tasks": [
        { "id": "w4-1", "title": "Concrete task 1", "completed": false },
        { "id": "w4-2", "title": "Concrete task 2", "completed": false },
        { "id": "w4-3", "title": "Concrete task 3", "completed": false }
      ],
      "resource": "Curated guide/book/resource name for ${targetRole}"
    }
  ]
}`

    let generatedPlan: any = null
    try {
      const text = await generateGeminiAI(prompt)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        generatedPlan = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn("Gemini dynamic plan generation failed, creating tailored fallback:", e)
    }

    if (!generatedPlan) {
      generatedPlan = createRoleTailoredFallback(targetRole, candidateSkills)
    }

    // Save personalized plan in MongoDB
    await db.collection("learning_plans").updateOne(
      { userId: session.user.id },
      {
        $set: {
          userId: session.user.id,
          targetRole,
          plan: generatedPlan,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    return NextResponse.json({ data: generatedPlan })
  } catch (err) {
    console.error("Learning plan API error:", err)
    return NextResponse.json({ error: "Failed to generate learning plan" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { weekNumber, taskId, completed } = await request.json()
    const client = await clientPromise
    const db = client.db("careerai")

    const existing = await db.collection("learning_plans").findOne({ userId: session.user.id })
    if (existing?.plan?.weeks) {
      const updatedWeeks = existing.plan.weeks.map((w: any) =>
        w.weekNumber === weekNumber
          ? {
              ...w,
              tasks: w.tasks.map((t: any) => (t.id === taskId ? { ...t, completed } : t)),
            }
          : w
      )

      await db.collection("learning_plans").updateOne(
        { userId: session.user.id },
        { $set: { "plan.weeks": updatedWeeks, updatedAt: new Date() } }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Update task status error:", err)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

// ─── Dynamic Fallback Generator ───────────────────────────────────────────────
function createRoleTailoredFallback(targetRole: string, skills: string) {
  const role = targetRole.trim()
  return {
    title: `4-Week Roadmap to ${role}`,
    estimatedWeeklyHours: "6-8 hrs/week",
    weeks: [
      {
        weekNumber: 1,
        theme: `Mastering Core Foundations for ${role}`,
        goal: `Solidify essential tools, patterns, and principles expected of a ${role}.`,
        tasks: [
          { id: "w1-1", title: `Review and refactor core ${role} codebase patterns and architectures`, completed: false },
          { id: "w1-2", title: `Audit existing skill strengths (${skills.slice(0, 30)}...) and target key gaps`, completed: false },
          { id: "w1-3", title: `Set up a standardized production development workflow and tooling`, completed: false },
        ],
        resource: `${role} Industry Standards & Best Practices Guide`,
      },
      {
        weekNumber: 2,
        theme: `Advanced Implementation & Scalability in ${role}`,
        goal: `Build robust, production-grade solutions addressing real-world constraints.`,
        tasks: [
          { id: "w2-1", title: `Design and implement an end-to-end milestone feature for ${role}`, completed: false },
          { id: "w2-2", title: `Implement comprehensive automated testing and performance benchmarks`, completed: false },
          { id: "w2-3", title: `Integrate observability, error handling, and structured data layers`, completed: false },
        ],
        resource: `Advanced ${role} Architecture & System Design Reference`,
      },
      {
        weekNumber: 3,
        theme: `Cloud Deployment, Automation & Production Operations`,
        goal: `Deploy and containerize solutions with continuous integration and real monitoring.`,
        tasks: [
          { id: "w3-1", title: `Configure automated CI/CD deployment pipelines with preview environments`, completed: false },
          { id: "w3-2", title: `Containerize and orchestrate services for reliable cloud execution`, completed: false },
          { id: "w3-3", title: `Conduct security, performance, and code quality audits`, completed: false },
        ],
        resource: `Production CI/CD and Cloud Deployment Playbook for ${role}`,
      },
      {
        weekNumber: 4,
        theme: `Portfolio Centerpiece & Interview Mastery for ${role}`,
        goal: `Synthesize skills into a compelling portfolio project and master technical interviews.`,
        tasks: [
          { id: "w4-1", title: `Polish and document your flagship ${role} project with architecture diagrams`, completed: false },
          { id: "w4-2", title: `Practice 5 behavioral and scenario-based technical interview questions`, completed: false },
          { id: "w4-3", title: `Refine your STAR stories highlighting business impact and leadership`, completed: false },
        ],
        resource: `${role} Senior Interview Guide & STAR Story Framework`,
      },
    ],
  }
}
