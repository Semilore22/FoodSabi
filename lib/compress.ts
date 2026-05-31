
import imageCompression from "browser-image-compression"
import { MAX_IMAGE_SIZE_KB } from "@/lib/constants"

export async function compressImage(file: File): Promise<File> {
  try {
    const compressed = await imageCompression(file, {
      maxSizeMB: MAX_IMAGE_SIZE_KB / 1024,
      maxWidthOrHeight: 2560,
      useWebWorker: true,
    })

    return compressed
  } catch {
    throw new Error("Compression failed")
  }
}
