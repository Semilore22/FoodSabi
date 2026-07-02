"use client"

import { Fragment } from "react"
import styles from "./ChatBubble.module.css"
import type { AnalyzeResponse } from "@/types"

interface ChatBubbleProps {
  role: "user" | "assistant"
  content: string
  imageUrl?: string | null
  inputType?: string
  response?: AnalyzeResponse | null
  timestamp?: string
}

export function ChatBubble({
  role,
  content,
  imageUrl,
  inputType,
  response,
  timestamp,
}: ChatBubbleProps) {
  const isUser = role === "user"

  return (
    <div className={`${styles.container} ${isUser ? styles.userAlign : styles.assistantAlign}`}>
      <div className={`${styles.bubble} ${isUser ? styles.user : styles.assistant}`}>
        {imageUrl && (
          <div className={styles.imageWrapper}>
            <img src={imageUrl} alt="Food label" className={styles.image} />
          </div>
        )}
        {isUser && !imageUrl && inputType === "image" && (
          <div className={styles.imagePlaceholder}>
            <span>📷 Food label image</span>
          </div>
        )}

        {content && !response && <p className={styles.content}>{content}</p>}

        {response && "ingredients" in response && (
          <div className={styles.analysis}>
            {response.product_name && (
              <h3 className={styles.productName}>{response.product_name}</h3>
            )}
            {"intro_summary" in response && response.intro_summary && (
              <div className={styles.introSummary}>
                <p>{response.intro_summary}</p>
              </div>
            )}
            {response.ingredients.map((ingredient, idx) => (
              <div key={idx} className={styles.ingredientCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.ingName}>{ingredient.name ?? ""}</span>
                  <span className={styles.ingPurpose}>{ingredient.purpose_in_food ?? ""}</span>
                </div>
                <p className={styles.whatItIs}>
                  <strong>What it is:</strong> {ingredient.what_it_is ?? "Not provided"}
                </p>
                {ingredient.benefits && (
                  <div className={styles.benefitBlock}>
                    <span className={`${styles.badge} ${styles.benefit}`}>Benefits</span>
                    <p>{ingredient.benefits}</p>
                  </div>
                )}
                {ingredient.concerns && (
                  <div className={styles.concernBlock}>
                    <span className={`${styles.badge} ${styles.concern}`}>Concerns</span>
                    <p>{ingredient.concerns}</p>
                  </div>
                )}
              </div>
            ))}
            {response.overall_summary && (
              <div className={styles.summarySection}>
                <h4 className={styles.summaryTitle}>Overall Summary</h4>
                <p>{response.overall_summary}</p>
              </div>
            )}
            {response.storage_guidance && (
              <div className={styles.storageSection}>
                <h4 className={styles.storageTitle}>Storage</h4>
                <p>{response.storage_guidance}</p>
              </div>
            )}
          </div>
        )}

        {response && "nutrients" in response && (
          <div className={styles.nutritionalAnalysis}>
            {response.product_name && (
              <h3 className={styles.productName}>{response.product_name}</h3>
            )}
            <div className={styles.nutrientsGrid}>
              {response.nutrients.map((nutrient, idx) => (
                <Fragment key={idx}>
                  <div className={styles.nutrientRow}>
                    <span className={styles.nutrientName}>{nutrient.name ?? ""}</span>
                    <span className={styles.nutrientValue}>
                      {nutrient.value ?? "—"}
                    </span>
                    <span
                      className={`${styles.levelBadge} ${
                        styles[`level_${nutrient.level}`] || ""
                      }`}
                    >
                      {nutrient.level ?? "—"}
                    </span>
                  </div>
                  {nutrient.level_reasoning && (
                    <div className={styles.levelReasoning}>
                      {nutrient.level_reasoning}
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
            {response.overall_summary && (
              <div className={styles.summarySection}>
                <h4 className={styles.summaryTitle}>Overall Summary</h4>
                <p>{response.overall_summary}</p>
              </div>
            )}
            {response.storage_guidance && (
              <div className={styles.storageSection}>
                <h4 className={styles.storageTitle}>Storage</h4>
                <p>{response.storage_guidance}</p>
              </div>
            )}
          </div>
        )}
        {response && !("ingredients" in response) && !("nutrients" in response) && response.type !== "followup" && !("response" in response) && (
          <p className={styles.content}>Here's what I found. Ask me more about any ingredient.</p>
        )}
      </div>
      {!isUser && (content || response) && (
        <p className={styles.disclaimer}>
          This information is based on food science knowledge and is for informational purposes only.
        </p>
      )}
    </div>
  )
}
