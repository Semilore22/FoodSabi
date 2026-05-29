import { prisma } from "@/lib/db"
import { generateUUID } from "@/lib/utils"
import { mapToErrorResponse } from "@/lib/errors"
import { SESSION_EXPIRY_DAYS } from "@/lib/constants"
import type { NewSessionResponse } from "@/types"

export async function POST(): Promise<Response> {
  try {
    const sessionId = generateUUID()
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    await prisma.session.create({
      data: { sessionId, expiresAt },
    })

    const response: NewSessionResponse = {
      sessionId,
      createdAt: new Date().toISOString(),
    }

    return Response.json(response)
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}
