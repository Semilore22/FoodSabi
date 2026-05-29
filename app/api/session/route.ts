import { prisma } from "@/lib/db"
import { generateUUID } from "@/lib/utils"
import { mapToErrorResponse } from "@/lib/errors"
import type { NewSessionResponse } from "@/types"

export async function POST(): Promise<Response> {
  try {
    const sessionId = generateUUID()

    await prisma.session.create({
      data: { sessionId },
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
