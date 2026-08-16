import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import clientPromise from "@/lib/mongodb"
import { generateGeminiAI } from "@/lib/gemini"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db("careerai")

  let profile = await db.collection("profiles").findOne({ userId: session.user.id })

  if (!profile) {
    const defaultProfile = {
      userId: session.user.id,
      name: session.user.name ?? "User",
      email: session.user.email ?? "",
      image: session.user.image ?? null,
      title: "",
      location: "",
      bio: "",
      roles: "",
      locations: "",
      readiness: 20,
      resumeScore: 0,
      skillsScore: 0,
      experienceScore: 0,
      applicationsSent: 0,
      profileViews: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await db.collection("profiles").insertOne(defaultProfile)
    profile = defaultProfile
  }

  return NextResponse.json({ data: profile })
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const updates = await request.json()
    const allowed = ["name", "email", "title", "location", "bio", "roles", "locations", "readiness"]
    const sanitized: any = {}

    for (const [key, value] of Object.entries(updates ?? {})) {
      if (allowed.includes(key)) {
        if (key === "readiness" && typeof value === "number") {
          sanitized[key] = Math.min(100, Math.max(0, value))
        } else if (typeof value === "string") {
          sanitized[key] = value
        }
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("careerai")

    const result = await db.collection("profiles").findOneAndUpdate(
      { userId: session.user.id },
      { $set: { ...sanitized, updatedAt: new Date() } },
      { upsert: true, returnDocument: "after" }
    )

    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { action, title, roles, location } = await request.json()

    if (action === "magic-bio") {
      const client = await clientPromise
      const db = client.db("careerai")
      const resume = await db.collection("resumes").findOne({ userId: session.user.id }, { sort: { parsedAt: -1 } })

      const candidateSkills = (resume?.skills || []).slice(0, 8).join(", ") || "Modern Architecture & Development"
      const candidateTitle = title || roles || resume?.title || "Technology Leader"

      const prompt = `You are an elite Apple Executive Career Stylist & Copywriter.
Write a punchy, ultra-compelling, 2-3 sentence professional bio for a candidate aiming to excel as "${candidateTitle}".
Key Technical Competencies: ${candidateSkills}
Location Preference: ${location || "Global / Remote"}

Guidelines:
- Start with a powerful value proposition.
- Emphasize high architectural impact, leadership, and scalable execution.
- Keep it under 65 words.
- Return ONLY the drafted bio text directly, with zero quotes, no intro, no emojis.`

      try {
        const generatedBio = await generateGeminiAI(prompt)
        const cleanBio = generatedBio.replace(/^["']|["']$/g, "").trim()
        return NextResponse.json({ bio: cleanBio })
      } catch (aiErr) {
        console.warn("AI magic bio fallback:", aiErr)
        const fallbackBio = `High-impact ${candidateTitle} specializing in building resilient, scalable systems with modern architectures (${candidateSkills}). Proven track record translating complex domain challenges into performant, user-centric software solutions.`
        return NextResponse.json({ bio: fallbackBio })
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("Profile POST error:", err)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
