"use client"

import styles from "./ConfirmModal.module.css"

interface ConfirmModalProps {
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmModal({ isOpen, onCancel, onConfirm }: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Are you sure you want to delete this chat?</h2>
        <p className={styles.subtext}>Once deleted it cannot be retrieved.</p>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel} type="button">Cancel</button>
          <button className={styles.deleteBtn} onClick={onConfirm} type="button">Delete</button>
        </div>
      </div>
    </div>
  )
}
