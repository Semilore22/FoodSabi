"use client"

import styles from "./Sidebar.module.css"
import { Toggle } from "@/components/ui/Toggle"
import type { SessionListItem } from "@/types"

interface SidebarProps {
  onNewChat: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  sessions: SessionListItem[]
  currentSessionId: string
  theme: "dark" | "light"
  onToggleTheme: () => void
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({
  onNewChat,
  onSelectSession,
  onDeleteSession,
  sessions,
  currentSessionId,
  theme,
  onToggleTheme,
  isOpen,
  onClose,
}: SidebarProps) {
  return (
    <>
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayVisible : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ""}`}>
        <div className={styles.top}>
          <div className={styles.brandRow}>
            <span className={styles.brand}>FoodSabi</span>
            <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Close sidebar">☰</button>
          </div>
          <button className={styles.newChat} onClick={() => { onNewChat(); onClose() }} type="button">
            <span className={styles.plusIcon}>+</span>
            New Chat
          </button>
          {sessions.length > 0 && (
            <div className={styles.sessionList}>
              <span className={styles.sessionListLabel}>Recent Chats</span>
              {sessions.map((s) => (
                <div
                  key={s.sessionId}
                  className={`${styles.sessionItem} ${s.sessionId === currentSessionId ? styles.sessionItemActive : ""}`}
                >
                  <button
                    className={styles.sessionButton}
                    onClick={() => {
                      onSelectSession(s.sessionId)
                      onClose()
                    }}
                    type="button"
                  >
                    <span className={styles.sessionPreview}>
                      {s.preview || "Chat session"}
                    </span>
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteSession(s.sessionId)
                    }}
                    type="button"
                    aria-label={`Delete session ${s.preview || "Chat session"}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.bottom}>
          <Toggle value={theme} onChange={onToggleTheme} />
        </div>
      </aside>
    </>
  )
}
