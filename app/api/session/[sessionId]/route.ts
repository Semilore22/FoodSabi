import { prisma } from "@/lib/db"
import { validateSessionId } from "@/lib/validators"
import { mapToErrorResponse, FoodSabiError } from "@/lib/errors"
import type { SessionHistoryResponse, EndSessionResponse } from "@/types"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  try {
    const { sessionId } = await params
    validateSessionId(sessionId)

    const session = await prisma.session.findUnique({
      where: { sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            content: true,
            inputType: true,
            imageUrl: true,
            createdAt: true,
          },
        },
      },
    })

    if (!session) {
      const response: SessionHistoryResponse = {
        sessionId,
        messages: [],
      }
      return Response.json(response)
    }

    const response: SessionHistoryResponse = {
      sessionId: session.sessionId,
      messages: session.messages.map((msg: { role: string; content: string; inputType: string; imageUrl: string | null; createdAt: Date }) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        inputType: msg.inputType,
        imageUrl: msg.imageUrl,
        timestamp: msg.createdAt.toISOString(),
      })),
    }

    return Response.json(response)
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  try {
    const { sessionId } = await params
    validateSessionId(sessionId)
    const url = new URL(req.url)
    const hard = url.searchParams.get("hard") === "true"

    if (hard) {
      await prisma.session.delete({
        where: { sessionId },
      })
    } else {
      const session = await prisma.session.findUnique({
        where: { sessionId },
      })

      if (!session) {
        throw new FoodSabiError("session_not_found")
      }

      await prisma.session.update({
        where: { sessionId },
        data: { status: "ended" },
      })
    }

    const response: EndSessionResponse = { success: true }
    return Response.json(response)
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}
