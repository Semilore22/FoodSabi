import { prisma } from "@/lib/db"

export async function getFromCache(cacheKey: string): Promise<string | null> {
  try {
    const entry = await prisma.ingredientCache.findUnique({
      where: { cacheKey },
    })

    if (!entry) return null

    await prisma.ingredientCache.update({
      where: { id: entry.id },
      data: { hitCount: { increment: 1 } },
    })

    return entry.responseText
  } catch {
    return null
  }
}

export async function setCache(cacheKey: string, responseText: string): Promise<void> {
  try {
    await prisma.ingredientCache.upsert({
      where: { cacheKey },
      update: { responseText },
      create: { cacheKey, responseText },
    })
  } catch {
    // cache write failure is non-critical
  }
}
