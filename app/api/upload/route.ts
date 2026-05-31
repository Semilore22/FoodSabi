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
const WEBP_MAGIC = Uint8Array.of(0x52, 0x49, 0x46, 0x46)
const WEBP_SIGNATURE = "WEBP"
const OCR_SPACE_URL = "https://api.ocr.space/parse/image"
const OCR_SPACE_TIMEOUT_MS = 30000

function checkMagicBytes(buffer: ArrayBuffer, magic: Uint8Array): boolean {
  if (buffer.byteLength < magic.length) return false
  const view = new Uint8Array(buffer, 0, magic.length)
  return magic.every((byte, i) => view[i] === byte)
}

async function extractTextViaOcrSpace(file: File): Promise<string> {
  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) {
    throw new FoodSabiError("network_failure")
  }

  const body = new FormData()
  body.append("apikey", apiKey)
  body.append("file", file, file.name || "image.jpg")
  body.append("language", "eng")
  body.append("isOverlayRequired", "false")
  body.append("OCREngine", "2")

  let ocrRes: Response
  try {
    ocrRes = await fetch(OCR_SPACE_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(OCR_SPACE_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new FoodSabiError("network_failure")
    }
    throw new FoodSabiError("network_failure")
  }

  if (!ocrRes.ok) {
    throw new FoodSabiError("network_failure")
  }

  let data: Record<string, unknown>
  try {
    data = await ocrRes.json()
  } catch {
    throw new FoodSabiError("network_failure")
  }

  if (data.IsErroredOnProcessing === true || (data.OCRExitCode != null && Number(data.OCRExitCode) > 1)) {
    throw new FoodSabiError("blurry_image")
  }

  const parsedResults = data.ParsedResults as Array<{ ParsedText?: string; FileParseExitCode?: unknown }> | undefined
  if (!parsedResults || parsedResults.length === 0) {
    throw new FoodSabiError("blurry_image")
  }

  const firstResult = parsedResults[0]
  if (firstResult.FileParseExitCode != null && Number(firstResult.FileParseExitCode) > 1) {
    throw new FoodSabiError("blurry_image")
  }

  const text = firstResult.ParsedText ?? ""
  if (text.trim().length < OCR_MIN_LENGTH) {
    throw new FoodSabiError("blurry_image")
  }

  return text.trim()
}

export async function POST(req: Request): Promise<Response> {
  try {
    const formData = await req.formData()

    const sessionId = formData.get("sessionId") as string | null
    const file = formData.get("file") as File | null
    const mimeType = formData.get("mimeType") as string | null

    validateSessionId(sessionId)
    await checkRateLimit(sessionId!, "image")

    if (!file) {
      throw new FoodSabiError("unsupported_file")
    }

    const fileMime = mimeType || file.type
    if (!SUPPORTED_MIME_TYPES.includes(fileMime)) {
      throw new FoodSabiError("unsupported_file")
    }

    if (file.size > MAX_IMAGE_SIZE_KB * 1024) {
      throw new FoodSabiError("image_too_large")
    }

    const buffer = await file.arrayBuffer()

    const isJpeg = checkMagicBytes(buffer, JPEG_MAGIC)
    const isPng = checkMagicBytes(buffer, PNG_MAGIC)
    const isWebp = checkMagicBytes(buffer, WEBP_MAGIC) &&
      buffer.byteLength >= 12 &&
      new TextDecoder().decode(new Uint8Array(buffer, 8, 4)) === WEBP_SIGNATURE

    if (!isJpeg && !isPng && !isWebp) {
      throw new FoodSabiError("unsupported_file")
    }

    const extractedText = await extractTextViaOcrSpace(file)

    if (extractedText.length > OCR_MAX_LENGTH) {
      throw new FoodSabiError("blurry_image")
    }

    const guardrailResult = runGuardrail(extractedText)
    if (!guardrailResult.allowed) {
      throw new FoodSabiError("out_of_scope")
    }

    const response: UploadResponse = {
      extractedText,
      success: true,
    }

    return Response.json(response)
  } catch (error) {
    const { errorResponse, status } = mapToErrorResponse(error)
    return Response.json(errorResponse, { status })
  }
}
