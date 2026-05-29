import { validateSessionId } from "@/lib/validators"
import { runGuardrail } from "@/lib/guardrail"
import { mapToErrorResponse, FoodSabiError } from "@/lib/errors"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  SUPPORTED_MIME_TYPES,
  MAX_IMAGE_SIZE_KB,
  OCR_MIN_LENGTH,
  OCR_MAX_LENGTH,
} from "@/lib/constants"
import type { UploadResponse } from "@/types"

const JPEG_MAGIC = Uint8Array.of(0xff, 0xd8, 0xff)
const PNG_MAGIC = Uint8Array.of(0x89, 0x50, 0x4e, 0x47)
const WEBP_MAGIC = Uint8Array.of(0x52, 0x49, 0x46, 0x46) // "RIFF"
const WEBP_SIGNATURE = "WEBP"

function checkMagicBytes(buffer: ArrayBuffer, magic: Uint8Array): boolean {
  if (buffer.byteLength < magic.length) return false
  const view = new Uint8Array(buffer, 0, magic.length)
  return magic.every((byte, i) => view[i] === byte)
}

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData()

    const sessionId = formData.get("sessionId") as string | null
    const extractedText = formData.get("extractedText") as string | null
    const originalFile = formData.get("compressedFile") as File | null
    const mimeType = formData.get("mimeType") as string | null

    validateSessionId(sessionId)
    await checkRateLimit(sessionId!, "image")

    if (!extractedText || extractedText.trim().length < OCR_MIN_LENGTH) {
      throw new FoodSabiError("blurry_image")
    }

    if (extractedText.length > OCR_MAX_LENGTH) {
      throw new FoodSabiError("blurry_image")
    }

    if (!originalFile) {
      throw new FoodSabiError("unsupported_file")
    }

    if (originalFile) {
      const fileMime = mimeType || originalFile.type
      if (!SUPPORTED_MIME_TYPES.includes(fileMime)) {
        throw new FoodSabiError("unsupported_file")
      }

      if (originalFile.size > MAX_IMAGE_SIZE_KB * 1024) {
        throw new FoodSabiError("image_too_large")
      }

      const buffer = await originalFile.arrayBuffer()

      const isJpeg = checkMagicBytes(buffer, JPEG_MAGIC)
      const isPng = checkMagicBytes(buffer, PNG_MAGIC)
      const isWebp = checkMagicBytes(buffer, WEBP_MAGIC) &&
        buffer.byteLength >= 12 &&
        new TextDecoder().decode(new Uint8Array(buffer, 8, 4)) === WEBP_SIGNATURE

      if (!isJpeg && !isPng && !isWebp) {
        throw new FoodSabiError("unsupported_file")
      }
    }

    const guardrailResult = runGuardrail(extractedText)
    if (!guardrailResult.allowed) {
      throw new FoodSabiError("out_of_scope")
    }

    const response: UploadResponse = {
      extractedText: extractedText.trim(),
      success: true,
    }

    return Response.json(response)
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}
