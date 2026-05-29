"use client"

import styles from "./SuggestionPills.module.css"

const ALL_SUGGESTIONS = [
  "Monosodium Glutamate",
  "High Fructose Corn Syrup",
  "Tartrazine",
  "Soy Lecithin",
  "Palm Oil",
  "Ascorbic Acid",
  "Sunflower Oil",
  "Maltodextrin",
  "Citric Acid",
  "Sodium Benzoate",
  "Guar Gum",
  "Caramel Colour",
  "Xanthan Gum",
  "Sodium Tripolyphosphate",
  "Hydrolyzed Vegetable Protein",
  "Potassium Sorbate",
  "Sodium Metabisulphite",
  "Calcium Propionate",
  "Sodium Saccharin",
  "Yellow 6",
]

function getDailySuggestions(): string[] {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash) + dateStr.charCodeAt(i)
    hash |= 0
  }
  const shuffled = [...ALL_SUGGESTIONS]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.abs((hash + i * 31) % (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, 3)
}

interface SuggestionPillsProps {
  onSelect: (query: string) => void
}

export function SuggestionPills({ onSelect }: SuggestionPillsProps) {
  const chips = getDailySuggestions()
  return (
    <div className={styles.container}>
      <div className={styles.chips}>
        {chips.map((chip) => (
          <button
            key={chip}
            className={styles.chip}
            onClick={() => onSelect(chip)}
            type="button"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}
