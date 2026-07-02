"use client"

import { useEffect, useRef } from "react"
import styles from "./OnboardingBackground.module.css"

const ICONS: Record<string, string[]> = {
  apple: [
    "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z",
    "M12 5V2",
    "M14 4c1 0 2 1 2 2",
  ],
  banana: [
    "M8 5c-3 5-4 12 0 16s9 0 12-6",
    "M8 5l2-2",
  ],
  leaf: [
    "M12 4C6 8 4 14 4 20h16c0-6-2-12-8-16z",
    "M12 4v16",
  ],
  grain: [
    "M12 22V8",
    "M9 11l3-3 3 3",
    "M7 15l5-5 5 5",
  ],
  bottle: [
    "M9 14v7a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-7",
    "M9 14h6",
    "M10 10V8M14 10V8M10 8h4",
    "M11 5V4M13 5V4M10 4h4",
  ],
  jar: [
    "M8 8v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8",
    "M8 8h8",
    "M8 8a4 4 0 0 1 8 0",
  ],
  utensils: [
    "M4 4v14M4 4h8M6 4v8M8 4v8M12 4v14",
    "M16 4v18M20 4v14c0 1-.5 2-2 2",
  ],
  chili: [
    "M12 8c-3 2-5 5-5 8 0 2 1 4 2 4s2-2 2-4c0-2 1-5 4-7",
    "M14 6c-1 2-1 3 0 4",
  ],
  egg: [
    "M12 3c-4 0-6 4-6 8s1 8 6 8 6-4 6-8-2-8-6-8z",
  ],
  fish: [
    "M6 12c0-4 4-6 8-6s8 2 8 6-4 6-8 6-8-2-8-6z",
    "M6 12l-4 3M6 12l-4-3",
  ],
  bread: [
    "M8 6v11c0 2 1 3 6 3s6-1 6-3V6",
    "M8 6c0-2 2-3 6-3s6 1 6 3",
  ],
  carrot: [
    "M12 4c-3 3-5 8-5 13 0 1 1 2 2 2h6c1 0 2-1 2-2 0-5-2-10-5-13z",
    "M10 5l-2-3M12 5l-1-4M14 5l1-3",
  ],
  orange: [
    "M12 3c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9z",
    "M12 3v18",
    "M7 8l10 8",
    "M17 8l-10 8",
  ],
  coffee: [
    "M6 6v9a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4V6",
    "M6 6h14",
    "M18 8l3 1a2 2 0 0 1 0 4l-3 1",
  ],
}

interface Position {
  x: number
  y: number
  icon: string
  rotate: number
  size: number
}

const POSITIONS: Position[] = [
  { x: 7, y: 2, icon: "apple", rotate: -3, size: 20 },
  { x: 45, y: 4, icon: "leaf", rotate: 2, size: 18 },
  { x: 65, y: 3, icon: "egg", rotate: -4, size: 16 },
  { x: 88, y: 1, icon: "coffee", rotate: -1, size: 22 },
  { x: 22, y: 7, icon: "banana", rotate: 4, size: 22 },
  { x: 68, y: 8, icon: "grain", rotate: -2, size: 18 },
  { x: 5, y: 12, icon: "bottle", rotate: 1, size: 20 },
  { x: 38, y: 13, icon: "carrot", rotate: -3, size: 22 },
  { x: 55, y: 11, icon: "orange", rotate: 3, size: 24 },
  { x: 92, y: 13, icon: "egg", rotate: -1, size: 18 },
  { x: 15, y: 17, icon: "utensils", rotate: -2, size: 20 },
  { x: 48, y: 18, icon: "chili", rotate: 4, size: 18 },
  { x: 75, y: 16, icon: "fish", rotate: 1, size: 22 },
  { x: 90, y: 18, icon: "jar", rotate: -3, size: 24 },
  { x: 28, y: 22, icon: "bread", rotate: -4, size: 24 },
  { x: 62, y: 23, icon: "apple", rotate: 2, size: 20 },
  { x: 90, y: 21, icon: "jar", rotate: -1, size: 18 },
  { x: 5, y: 27, icon: "leaf", rotate: 3, size: 18 },
  { x: 35, y: 28, icon: "coffee", rotate: -2, size: 22 },
  { x: 52, y: 26, icon: "banana", rotate: 1, size: 20 },
  { x: 80, y: 28, icon: "egg", rotate: -4, size: 16 },
  { x: 18, y: 32, icon: "grain", rotate: 0, size: 18 },
  { x: 42, y: 33, icon: "orange", rotate: -3, size: 22 },
  { x: 70, y: 31, icon: "carrot", rotate: 2, size: 20 },
  { x: 95, y: 33, icon: "utensils", rotate: -2, size: 20 },
  { x: 8, y: 38, icon: "chili", rotate: 4, size: 18 },
  { x: 22, y: 37, icon: "coffee", rotate: -1, size: 22 },
  { x: 55, y: 37, icon: "bottle", rotate: -1, size: 22 },
  { x: 85, y: 39, icon: "fish", rotate: 3, size: 20 },
  { x: 25, y: 42, icon: "bread", rotate: -3, size: 22 },
  { x: 48, y: 43, icon: "apple", rotate: 2, size: 20 },
  { x: 72, y: 41, icon: "jar", rotate: -4, size: 24 },
  { x: 92, y: 43, icon: "coffee", rotate: 1, size: 18 },
  { x: 5, y: 47, icon: "egg", rotate: -1, size: 18 },
  { x: 32, y: 48, icon: "leaf", rotate: 3, size: 20 },
  { x: 50, y: 46, icon: "orange", rotate: -2, size: 22 },
  { x: 62, y: 48, icon: "orange", rotate: -2, size: 22 },
  { x: 88, y: 48, icon: "banana", rotate: 4, size: 24 },
  { x: 15, y: 52, icon: "carrot", rotate: 1, size: 22 },
  { x: 42, y: 53, icon: "grain", rotate: -3, size: 18 },
  { x: 78, y: 51, icon: "chili", rotate: 2, size: 20 },
  { x: 95, y: 53, icon: "fish", rotate: -4, size: 18 },
  { x: 10, y: 57, icon: "bottle", rotate: 0, size: 20 },
  { x: 35, y: 57, icon: "fish", rotate: -2, size: 20 },
  { x: 55, y: 58, icon: "bottle", rotate: 4, size: 18 },
  { x: 85, y: 56, icon: "utensils", rotate: -1, size: 22 },
  { x: 10, y: 62, icon: "bread", rotate: 3, size: 22 },
  { x: 90, y: 63, icon: "coffee", rotate: -3, size: 20 },
  { x: 8, y: 67, icon: "orange", rotate: 1, size: 24 },
  { x: 70, y: 68, icon: "apple", rotate: -2, size: 18 },
  { x: 95, y: 66, icon: "banana", rotate: 4, size: 22 },
  { x: 25, y: 72, icon: "egg", rotate: -4, size: 18 },
  { x: 48, y: 74, icon: "leaf", rotate: 2, size: 20 },
  { x: 52, y: 72, icon: "leaf", rotate: 2, size: 20 },
  { x: 80, y: 71, icon: "jar", rotate: -1, size: 22 },
  { x: 5, y: 77, icon: "grain", rotate: 3, size: 18 },
  { x: 38, y: 78, icon: "carrot", rotate: -2, size: 22 },
  { x: 65, y: 76, icon: "chili", rotate: 1, size: 20 },
  { x: 90, y: 78, icon: "banana", rotate: -3, size: 22 },
  { x: 20, y: 83, icon: "bottle", rotate: -3, size: 20 },
  { x: 85, y: 82, icon: "fish", rotate: 2, size: 18 },
  { x: 45, y: 87, icon: "utensils", rotate: -1, size: 22 },
  { x: 12, y: 92, icon: "orange", rotate: 4, size: 22 },
  { x: 72, y: 93, icon: "bread", rotate: -2, size: 24 },
  { x: 30, y: 96, icon: "banana", rotate: 1, size: 20 },
  { x: 58, y: 97, icon: "coffee", rotate: -3, size: 18 },
  { x: 88, y: 95, icon: "egg", rotate: 2, size: 16 },
]

export function OnboardingBackground() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const icons = container.querySelectorAll<SVGSVGElement>("svg")
    if (!icons.length) return

    icons.forEach((icon) => {
      icon.dataset.floatPeriod = String(3 + Math.random() * 3)
      icon.dataset.floatPhase = String(Math.random())
    })

    let start = performance.now()
    let rafId: number

    function tick(now: number) {
      const elapsed = (now - start) / 1000

      icons.forEach((icon) => {
        const period = Number(icon.dataset.floatPeriod) || 4
        const phase = Number(icon.dataset.floatPhase) || 0
        const r = icon.getAttribute("data-r") || "0deg"
        const t = ((elapsed / period) + phase) % 1
        const floatY = Math.sin(t * Math.PI * 2) * 4
        icon.style.transform = `translateY(${floatY}px) rotate(${r})`
      })

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div ref={ref} className={styles.container}>
      {POSITIONS.map((pos, i) => {
        const paths = ICONS[pos.icon]
        if (!paths) return null
        return (
          <svg
            key={i}
            className={styles.icon}
            data-r={`${pos.rotate}deg`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: pos.size,
              height: pos.size,
            }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {paths.map((d, j) => (
              <path key={j} d={d} />
            ))}
          </svg>
        )
      })}
    </div>
  )
}
