import { validateSessionId } from "@/lib/validators"
import { runGuardrail } from "@/lib/guardrail"
import { extractTextFromImage } from "@/lib/ocr"
import { mapToErrorResponse, FoodSabiError } from "@/lib/errors"
import { checkRateLimit } from "@/lib/rate-limit"
import { SUPPORTED_MIME_TYPES, MAX_IMAGE_SIZE_KB, OCR_MAX_LENGTH } from "@/lib/constants"
import type { UploadResponse } from "@/types"

const JPEG_MAGIC = Uint8Array.of(0xff, 0xd8, 0xff)
const PNG_MAGIC = Uint8Array.of(0x89, 0x50, 0x4e, 0x47)
const WEBP_MAGIC = Uint8Array.of(0x52, 0x49, 0x46, 0x46)

function hasMagicBytes(buffer: ArrayBuffer, magic: Uint8Array): boolean {
  if (buffer.byteLength < magic.length) return false
  const view = new Uint8Array(buffer, 0, magic.length)
  return magic.every((byte, i) => view[i] === byte)
}

function isValidWebp(buffer: ArrayBuffer): boolean {
  return (
    buffer.byteLength >= 12 &&
    new TextDecoder().decode(new Uint8Array(buffer, 8, 4)) === "WEBP"
  )
}

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData()
    const sessionId = formData.get("sessionId") as string | null
    const file = formData.get("file") as File | null

    validateSessionId(sessionId)
    await checkRateLimit(sessionId!, "image")

    if (!file || file.size === 0) {
      throw new FoodSabiError("unsupported_file")
    }

    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      throw new FoodSabiError("unsupported_file")
    }

    if (file.size > MAX_IMAGE_SIZE_KB * 1024) {
      throw new FoodSabiError("image_too_large")
    }

    const buffer = await file.arrayBuffer()

    const isJpeg = hasMagicBytes(buffer, JPEG_MAGIC)
    const isPng = hasMagicBytes(buffer, PNG_MAGIC)
    const isWebp = hasMagicBytes(buffer, WEBP_MAGIC) && isValidWebp(buffer)

    if (!isJpeg && !isPng && !isWebp) {
      throw new FoodSabiError("unsupported_file")
    }

    const extractedText = await extractTextFromImage(Buffer.from(buffer), file.name)

    if (extractedText.length > OCR_MAX_LENGTH) {
      throw new FoodSabiError("blurry_image")
    }

    const guardrailResult = runGuardrail(extractedText)

    if (!guardrailResult.allowed) {
      throw new FoodSabiError("out_of_scope")
    }

    return Response.json({
      extractedText,
      success: true,
    } satisfies UploadResponse)
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}
