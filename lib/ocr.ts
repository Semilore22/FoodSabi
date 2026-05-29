import { createWorker } from "tesseract.js"

function preprocessImage(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("ocr_failed"))
        return
      }
      let { width, height } = img

      const MAX_DIM = 2560
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data

      let min = 255, max = 0
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
        if (gray < min) min = gray
        if (gray > max) max = gray
      }

      const range = max - min
      if (range > 0) {
        for (let i = 0; i < data.length; i += 4) {
          const stretched = Math.min(255, Math.max(0, ((data[i] - min) / range) * 255))
          data[i] = stretched
          data[i + 1] = stretched
          data[i + 2] = stretched
        }
      }

      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL("image/jpeg", 0.92))
    }
    img.onerror = () => reject(new Error("ocr_failed"))
    img.src = imageDataUrl
  })
}

export async function extractTextFromImage(imageFile: File): Promise<string> {
  let imageDataUrl: string

  try {
    imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== "string" || !reader.result) {
          reject(new Error("ocr_failed"))
          return
        }
        resolve(reader.result)
      }
      reader.onerror = () => reject(new Error("ocr_failed"))
      reader.readAsDataURL(imageFile)
    })
  } catch {
    throw new Error("ocr_failed")
  }

  const worker = await createWorker("eng")
  try {
    const processed = await preprocessImage(imageDataUrl)
    const { data } = await worker.recognize(processed)
    return data.text.trim()
  } catch {
    throw new Error("ocr_failed")
  } finally {
    await worker.terminate()
  }
}
