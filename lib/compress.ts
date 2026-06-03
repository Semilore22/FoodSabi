const MAX_IMAGE_SIZE_KB = 500
const MAX_DIM = 2048

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

function readExifOrientation(buffer: ArrayBuffer): number {
  if (buffer.byteLength < 18) return 1
  const view = new DataView(buffer)

  if (view.getUint16(0) !== 0xffd8) return 1

  let offset = 2
  while (offset + 4 < buffer.byteLength) {
    const marker = view.getUint16(offset)
    const segSize = view.getUint16(offset + 2)

    if (marker === 0xffe1 && segSize >= 8) {
      const exifId = new TextDecoder().decode(new Uint8Array(buffer, offset + 4, 4))
      if (exifId !== "Exif") return 1

      const tiffStart = offset + 8
      const littleEndian = view.getUint16(tiffStart) === 0x4949
      const getUint16 = (pos: number) => view.getUint16(pos, littleEndian)
      const getUint32 = (pos: number) => view.getUint32(pos, littleEndian)

      if (getUint16(tiffStart + 2) !== 0x002a) return 1

      const ifd0Offset = tiffStart + getUint32(tiffStart + 4)
      if (ifd0Offset + 2 > buffer.byteLength) return 1

      const numEntries = getUint16(ifd0Offset)

      for (let i = 0; i < numEntries; i++) {
        const entryOffset = ifd0Offset + 2 + i * 12
        if (entryOffset + 12 > buffer.byteLength) return 1

        const tag = getUint16(entryOffset)

        if (tag === 0x0112) {
          const value = getUint16(entryOffset + 8)
          if (value >= 1 && value <= 8) return value
          return 1
        }
      }
      return 1
    }

    offset += 2 + segSize
    if (marker === 0xffda) break
  }

  return 1
}

function getOrientedDimensions(
  width: number,
  height: number,
  orientation: number
): [number, number] {
  return orientation >= 5 && orientation <= 8 ? [height, width] : [width, height]
}

function applyOrientationToCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  orientation: number
): void {
  const { width, height } = canvas

  switch (orientation) {
    case 1:
      break
    case 2:
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
      break
    case 3:
      ctx.translate(width, height)
      ctx.rotate(Math.PI)
      break
    case 4:
      ctx.translate(0, height)
      ctx.scale(1, -1)
      break
    case 5:
      ctx.translate(height, 0)
      ctx.scale(-1, 1)
      ctx.rotate(Math.PI / 2)
      break
    case 6:
      ctx.translate(height, 0)
      ctx.rotate(Math.PI / 2)
      break
    case 7:
      ctx.translate(0, width)
      ctx.scale(1, -1)
      ctx.rotate(-Math.PI / 2)
      break
    case 8:
      ctx.translate(0, width)
      ctx.rotate(-Math.PI / 2)
      break
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

function drawWithOrientation(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  orientation: number
): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.save()
  applyOrientationToCanvas(ctx, canvas, orientation)
  ctx.drawImage(img, 0, 0, img.width, img.height)
  ctx.restore()
}

async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const img = await loadImage(file)
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    drawWithOrientation(canvas, img, 1)
    return canvasToFile(canvas, 0.92, file.name)
  } catch {
    return null
  }
}

async function resizeImage(file: File): Promise<File> {
  try {
    const buf = await file.arrayBuffer()
    const orientation = readExifOrientation(buf)
    const img = await loadImage(file)

    const [origW, origH] = [img.width, img.height]
    const [orientW, orientH] = getOrientedDimensions(origW, origH, orientation)

    let targetW = orientW
    let targetH = orientH

    if (orientW > MAX_DIM || orientH > MAX_DIM) {
      const ratio = Math.min(MAX_DIM / orientW, MAX_DIM / orientH)
      targetW = Math.round(orientW * ratio)
      targetH = Math.round(orientH * ratio)
    }

    const canvas = document.createElement("canvas")
    canvas.width = targetW
    canvas.height = targetH

    const ctx = canvas.getContext("2d")
    if (!ctx) return file

    ctx.save()
    applyOrientationToCanvas(ctx, canvas, orientation)
    ctx.drawImage(img, 0, 0, origW, origH, 0, 0, targetW, targetH)
    ctx.restore()

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

