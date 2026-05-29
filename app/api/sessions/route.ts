import { prisma } from "@/lib/db"
import { mapToErrorResponse } from "@/lib/errors"
import type { SessionListItem } from "@/types"

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const idsParam = url.searchParams.get("ids")
    const sessionIds = idsParam ? idsParam.split(",").filter(Boolean) : []

    if (sessionIds.length === 0) {
      return Response.json({ sessions: [] })
    }

    const sessions = await prisma.session.findMany({
      where: { sessionId: { in: sessionIds } },
      orderBy: { lastActiveAt: "desc" },
      take: 20,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
        _count: {
          select: { messages: true },
        },
      },
    })

    const filtered = sessions.filter((s) => s._count.messages > 0)

    const list: SessionListItem[] = filtered.map((s) => {
      const preview = s.messages[0]?.content || ""
      return {
        sessionId: s.sessionId,
        preview: preview.length > 35 ? preview.slice(0, 35) + "..." : preview,
        messageCount: s._count.messages,
        lastActiveAt: s.lastActiveAt.toISOString(),
      }
    })

    return Response.json({ sessions: list })
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}
