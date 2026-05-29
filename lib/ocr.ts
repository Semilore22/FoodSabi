import Tesseract from "tesseract.js"

export async function extractTextFromImage(imageFile: File): Promise<string> {
  let imageDataUrl: string

  try {
    imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result !== "string" || !reader.result) {
          reject(new Error("file_read_failed"))
          return
        }
        resolve(reader.result)
      }
      reader.onerror = reject
      reader.readAsDataURL(imageFile)
    })
  } catch {
    throw new Error("ocr_failed")
  }

  try {
    const { data } = await Tesseract.recognize(imageDataUrl, "eng", {
      logger: () => {},
    })

    return data.text.trim()
  } catch {
    throw new Error("ocr_failed")
  }
}
