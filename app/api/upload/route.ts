import sharp from "sharp"
import { validateSessionId } from "@/lib/validators"
import { runGuardrail } from "@/lib/guardrail"
import { mapToErrorResponse, FoodSabiError } from "@/lib/errors"
import { checkRateLimit } from "@/lib/rate-limit"
import {
  SUPPORTED_MIME_TYPES,
  MAX_IMAGE_SIZE_KB,
  OCR_MAX_LENGTH,
} from "@/lib/constants"
import type { UploadResponse } from "@/types"

const JPEG_MAGIC = Uint8Array.of(0xff, 0xd8, 0xff)
const PNG_MAGIC = Uint8Array.of(0x89, 0x50, 0x4e, 0x47)
const WEBP_MAGIC = Uint8Array.of(0x52, 0x49, 0x46, 0x46)
const WEBP_SIGNATURE = "WEBP"
const OCR_SPACE_URL = "https://api.ocr.space/parse/image"
const OCR_SPACE_TIMEOUT_MS = 30000
const OCR_FALLBACK_MIN_LENGTH = 20

function checkMagicBytes(buffer: ArrayBuffer, magic: Uint8Array): boolean {
  if (buffer.byteLength < magic.length) return false
  const view = new Uint8Array(buffer, 0, magic.length)
  return magic.every((byte, i) => view[i] === byte)
}

async function preprocessImage(buffer: ArrayBuffer): Promise<Buffer> {
  return sharp(Buffer.from(buffer))
    .grayscale()
    .normalise()
    .sharpen()
    .jpeg()
    .toBuffer()
}

async function callOcrSpace(
  imageBuffer: Buffer,
  engine: number,
  fileName: string
): Promise<string | null> {
  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) {
    throw new FoodSabiError("network_failure")
  }

  const body = new FormData()
  body.append("apikey", apiKey)
  body.append("file", new Blob([new Uint8Array(imageBuffer)]), fileName || "image.jpg")
  body.append("language", "eng")
  body.append("isOverlayRequired", "false")
  body.append("OCREngine", String(engine))

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
    return null
  }

  const parsedResults = data.ParsedResults as Array<{ ParsedText?: string; FileParseExitCode?: unknown }> | undefined
  if (!parsedResults || parsedResults.length === 0) {
    return null
  }

  const firstResult = parsedResults[0]
  if (firstResult.FileParseExitCode != null && Number(firstResult.FileParseExitCode) > 1) {
    return null
  }

  const text = (firstResult.ParsedText ?? "").trim()
  if (text.length < OCR_FALLBACK_MIN_LENGTH) {
    return null
  }

  return text
}

async function extractTextViaOcrSpace(buffer: ArrayBuffer, fileName: string): Promise<string> {
  const rawBuffer = Buffer.from(buffer)

  let text = await callOcrSpace(rawBuffer, 1, fileName)

  if (!text) {
    const processed = await preprocessImage(buffer)
    text = await callOcrSpace(processed, 1, fileName)
    if (!text) {
      text = await callOcrSpace(processed, 2, fileName)
    }
  }

  if (!text) {
    throw new FoodSabiError("blurry_image")
  }

  return text
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

    const extractedText = await extractTextViaOcrSpace(buffer, file.name)

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
