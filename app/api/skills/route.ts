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
  const forceRefresh = url.searchParams.get("refresh") === "true"

  try {
    const client = await clientPromise
    const db = client.db("careerai")

    const [profile, resume, savedSkillsDoc] = await Promise.all([
      db.collection("profiles").findOne({ userId: session.user.id }),
      db.collection("resumes").findOne({ userId: session.user.id }, { sort: { parsedAt: -1 } }),
      db.collection("user_skills").findOne({ userId: session.user.id }),
    ])

    const candidateSkills: string[] = Array.from(
      new Set([
        ...(resume?.skills || []),
        ...(savedSkillsDoc?.customSkills || []),
      ])
    )
    const effectiveSkills = candidateSkills.length > 0 ? candidateSkills : ["Problem Solving", "Software Engineering", "APIs", "Git"]
    const targetRole = profile?.title || profile?.roles || resume?.title || "Technology Professional"

    // If already generated and not forced refresh, return stored skill analysis
    if (!forceRefresh && savedSkillsDoc?.data && savedSkillsDoc?.targetRole?.toLowerCase() === targetRole.toLowerCase()) {
      return NextResponse.json({ data: savedSkillsDoc.data })
    }

    const prompt = `You are a Principal Technical Recruiter and Career Architect.
Perform a rigorous, bespoke Skill Gap & Taxonomy Matrix analysis for this candidate.

CANDIDATE PROFILE:
- Target Role: ${targetRole}
- Detected Candidate Skills: ${effectiveSkills.join(", ")}
- Profile Summary: ${profile?.bio || resume?.summary || "Driven technical practitioner"}

INSTRUCTIONS:
1. Analyze how well the candidate's detected skills map to competitive industry expectations for "${targetRole}".
2. Identify their 3 biggest Top Strengths and 3 most Critical Gaps specific to "${targetRole}".
3. Group required competencies into 3 distinct categories relevant to "${targetRole}" (e.g. if Frontend: "UI & Component Architecture", "State & Performance", "Tooling & Testing"; if Data: "Data Pipelines & ETL", "Machine Learning & Stats", "Infrastructure & DBs", etc.).
4. In each category, list 3 specific skills with accurate levels (Expert, Advanced, Intermediate, Familiar, Beginner), percentage match (0-100), and status (Strong, In Progress, Gap).
5. Calculate an overall readinessScore (0-100).
6. Return ONLY pure valid JSON without markdown fences.

JSON FORMAT:
{
  "readinessScore": 82,
  "topStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "criticalGaps": ["Critical Gap 1", "Critical Gap 2", "Critical Gap 3"],
  "categories": [
    {
      "name": "Category 1 Name",
      "skills": [
        { "name": "Skill A", "level": "Advanced", "match": 88, "status": "Strong" },
        { "name": "Skill B", "level": "Intermediate", "match": 72, "status": "In Progress" },
        { "name": "Skill C", "level": "Beginner", "match": 45, "status": "Gap" }
      ]
    },
    {
      "name": "Category 2 Name",
      "skills": [
        { "name": "Skill D", "level": "Advanced", "match": 85, "status": "Strong" },
        { "name": "Skill E", "level": "Intermediate", "match": 68, "status": "In Progress" },
        { "name": "Skill F", "level": "Beginner", "match": 50, "status": "Gap" }
      ]
    },
    {
      "name": "Category 3 Name",
      "skills": [
        { "name": "Skill G", "level": "Intermediate", "match": 75, "status": "In Progress" },
        { "name": "Skill H", "level": "Familiar", "match": 55, "status": "Gap" },
        { "name": "Skill I", "level": "Advanced", "match": 80, "status": "Strong" }
      ]
    }
  ],
  "marketDemandInsights": "Current market trend and demand analysis for ${targetRole}."
}`

    let skillsData: any = null
    try {
      const text = await generateGeminiAI(prompt)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        skillsData = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn("Gemini skills analysis failed, using dynamic role builder:", e)
    }

    if (!skillsData) {
      skillsData = generateDynamicSkillsFallback(targetRole, effectiveSkills)
    }

    // Persist to MongoDB
    await db.collection("user_skills").updateOne(
      { userId: session.user.id },
      {
        $set: {
          userId: session.user.id,
          targetRole,
          data: skillsData,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    )

    return NextResponse.json({ data: skillsData })
  } catch (err) {
    console.error("Skills API error:", err)
    return NextResponse.json({ error: "Failed to load skills" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { skillName } = await request.json()
    if (!skillName || typeof skillName !== "string") {
      return NextResponse.json({ error: "Skill name is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("careerai")

    await db.collection("user_skills").updateOne(
      { userId: session.user.id },
      {
        $addToSet: { customSkills: skillName.trim() },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true, skill: skillName.trim() })
  } catch (err) {
    console.error("Add skill error:", err)
    return NextResponse.json({ error: "Failed to save skill" }, { status: 500 })
  }
}

function generateDynamicSkillsFallback(targetRole: string, detected: string[]) {
  const primary = detected.slice(0, 3).join(", ") || "Core Technical Skills"
  const secondary = detected.slice(3, 6).join(", ") || "Data & Tools"

  return {
    readinessScore: Math.min(92, Math.max(65, 50 + detected.length * 4)),
    topStrengths: [
      detected[0] || `${targetRole} Foundations`,
      detected[1] || "Problem Solving",
      detected[2] || "Applied Implementation",
    ],
    criticalGaps: [
      `Advanced Scalability & Architecture for ${targetRole}`,
      `Production CI/CD & Cloud Orchestration`,
      `Enterprise System Design & Observability`,
    ],
    categories: [
      {
        name: `Core ${targetRole} Competencies`,
        skills: [
          { name: detected[0] || "Primary Language / Framework", level: "Advanced", match: 88, status: "Strong" },
          { name: detected[1] || "Design Patterns & Architecture", level: "Advanced", match: 82, status: "Strong" },
          { name: detected[2] || "API & System Integration", level: "Intermediate", match: 70, status: "In Progress" },
        ],
      },
      {
        name: "Cloud, Infrastructure & DevOps",
        skills: [
          { name: detected[3] || "Docker & Containerization", level: "Familiar", match: 60, status: "Gap" },
          { name: "Cloud Platforms (AWS / GCP)", level: "Intermediate", match: 65, status: "In Progress" },
          { name: "Automated CI/CD & Testing", level: "Intermediate", match: 72, status: "In Progress" },
        ],
      },
      {
        name: "Data, Performance & System Design",
        skills: [
          { name: detected[4] || "Database Schema & Query Optimization", level: "Advanced", match: 85, status: "Strong" },
          { name: "Distributed Caching & High Availability", level: "Familiar", match: 52, status: "Gap" },
          { name: "Security & Observability", level: "Intermediate", match: 68, status: "In Progress" },
        ],
      },
    ],
    marketDemandInsights: `High market demand for ${targetRole} professionals with verified strengths in ${primary}.`,
  }
}
