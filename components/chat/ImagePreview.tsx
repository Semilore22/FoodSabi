"use client"

import { useState, useEffect } from "react"
import styles from "./ImagePreview.module.css"
import { IconButton } from "@/components/ui/IconButton"
import { SUPPORTED_MIME_TYPES } from "@/lib/constants"

interface ImagePreviewProps {
  file: File
  onRemove: () => void
}

export function ImagePreview({ file, onRemove }: ImagePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      setError("I can only read image files. Try uploading a JPG or PNG of your food label.")
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <p className={styles.errorText}>{error}</p>
          <IconButton icon="close" onClick={onRemove} ariaLabel="Remove image" />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.preview}>
        {previewUrl && (
          <img src={previewUrl} alt="Selected food label" className={styles.thumbnail} />
        )}
        <div className={styles.info}>
          <span className={styles.filename}>{file.name}</span>
          <span className={styles.size}>{(file.size / 1024).toFixed(0)} KB</span>
        </div>
        <IconButton icon="close" onClick={onRemove} ariaLabel="Remove image" />
      </div>
    </div>
  )
}
