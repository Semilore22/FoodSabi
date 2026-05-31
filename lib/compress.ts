
import imageCompression from "browser-image-compression"
import { MAX_IMAGE_SIZE_KB } from "@/lib/constants"

const HEIC_MIMES = new Set(["image/heic", "image/heif"])

async function isHeicFile(file: File): Promise<boolean> {
  if (HEIC_MIMES.has(file.type)) return true
  if (/\.(heic|heif)$/i.test(file.name)) return true
  try {
    const buf = await file.slice(4, 8).arrayBuffer()
    const bytes = new Uint8Array(buf)
    return bytes[0] === 0x66 && bytes[1] === 0x74 && bytes[2] === 0x79 && bytes[3] === 0x70
  } catch {
    return false
  }
}

async function convertHeicToJpeg(file: File): Promise<File | null> {
  let url: string | null = null
  try {
    url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url!
    })
    URL.revokeObjectURL(url)
    url = null

    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    )
    if (!blob) return null

    const name = file.name.replace(/\.(heic|heif)$/i, ".jpg") || "image.jpg"
    return new File([blob], name, { type: "image/jpeg" })
  } catch {
    return null
  } finally {
    if (url) URL.revokeObjectURL(url)
  }
}

export async function compressImage(file: File): Promise<File> {
  let processed = file

  if (await isHeicFile(file)) {
    const converted = await convertHeicToJpeg(file)
    if (converted) processed = converted
  }

  if (processed.size <= MAX_IMAGE_SIZE_KB * 1024) {
    return processed
  }

  try {
    const compressed = await imageCompression(processed, {
      maxSizeMB: MAX_IMAGE_SIZE_KB / 1024,
      maxWidthOrHeight: 2560,
      useWebWorker: false,
    })

    return compressed
  } catch {
    throw new Error("Compression failed")
  }
}
