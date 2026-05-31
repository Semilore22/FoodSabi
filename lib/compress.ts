const MAX_IMAGE_SIZE_KB = 500
const MAX_DIM = 1920

async function isHeicFile(file: File): Promise<boolean> {
  if (file.type === "image/heic" || file.type === "image/heif") return true
  if (/\.(heic|heif)$/i.test(file.name)) return true
  try {
    const buf = await file.slice(4, 8).arrayBuffer()
    const view = new Uint8Array(buf)
    return view[0] === 0x66 && view[1] === 0x74 && view[2] === 0x79 && view[3] === 0x70
  } catch {
    return false
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Image load failed"))
    }
    img.src = url
  })
}

function canvasToFile(
  canvas: HTMLCanvasElement,
  quality: number,
  originalName: string
): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }
        const name = originalName.replace(/\.[^.]+$/, ".jpg") || "image.jpg"
        resolve(new File([blob], name, { type: "image/jpeg" }))
      },
      "image/jpeg",
      quality
    )
  })
}

async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const img = await loadImage(file)
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    return canvasToFile(canvas, 0.92, file.name)
  } catch {
    return null
  }
}

async function resizeImage(file: File): Promise<File> {
  try {
    const img = await loadImage(file)

    let { width, height } = img
    if (width > MAX_DIM || height > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
      width = Math.round(width * ratio)
      height = Math.round(height * ratio)
    }

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file

    ctx.drawImage(img, 0, 0, width, height)

    for (let q = 0.85; q >= 0.3; q -= 0.1) {
      const result = await canvasToFile(canvas, q, file.name)
      if (result && result.size <= MAX_IMAGE_SIZE_KB * 1024) {
        return result
      }
    }

    const fallback = await canvasToFile(canvas, 0.2, file.name)
    return fallback ?? file
  } catch {
    return file
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

  return resizeImage(processed)
}
