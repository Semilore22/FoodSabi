"use client"

import styles from "./Header.module.css"
import { IconButton } from "@/components/ui/IconButton"

interface HeaderProps {
  onMenuClick: () => void
  showBrand?: boolean
}

export function Header({ onMenuClick, showBrand }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.menuBtn}>
        <IconButton icon="menu" onClick={onMenuClick} ariaLabel="Toggle sidebar" />
      </div>
      {showBrand && <span className={styles.brand}>FoodSabi</span>}
    </header>
  )
}
