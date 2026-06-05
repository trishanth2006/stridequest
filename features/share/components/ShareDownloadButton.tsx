"use client"

import { useState, useCallback } from 'react'
import * as htmlToImage from 'html-to-image'
import { Button } from '@/components/ui/button'
import { Download, Share } from 'lucide-react'
import type { AnyShareCard } from '../types'

interface ShareDownloadButtonProps {
  cardRef: React.RefObject<HTMLDivElement | null>
  cardData: AnyShareCard
}

export function ShareDownloadButton({ cardRef, cardData }: ShareDownloadButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const getFilename = () => {
    const dateStr = new Date().toISOString().split('T')[0]
    switch (cardData.type) {
      case 'workout':
        return `stridequest-workout-${dateStr}.png`
      case 'level-up':
        return `stridequest-levelup-l${cardData.currentLevel}.png`
      case 'achievement':
        return `stridequest-achievement-${cardData.achievementTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      case 'personal-record':
        return `stridequest-pr-${cardData.recordTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
    }
  }

  const handleExport = async () => {
    if (!cardRef.current) return

    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    setIsExporting(true)
    try {
      const dataUrl = await htmlToImage.toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2, // High DPI
      })

      const filename = getFilename()

      // Convert dataUrl to blob for Web Share API
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], filename, { type: 'image/png' })

      if (typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator && (navigator as any).canShare({ files: [file] })) {
        await navigator.share({
          title: cardRef.current.querySelector('[data-testid="share-headline"]')?.textContent?.trim() || cardData.headline,
          text: 'Check this out on StrideQuest!',
          files: [file],
        })
      } else {
        // Fallback to download
        const link = document.createElement('a')
        link.download = filename
        link.href = dataUrl
        link.click()
      }
    } catch (err) {
      console.error('Failed to export image', err)
      // Provide user feedback (could use a toast here)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button 
      onClick={handleExport} 
      disabled={isExporting}
      className="w-full gap-2"
    >
      {typeof navigator !== 'undefined' && 'share' in navigator ? (
        <Share className="h-4 w-4" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isExporting ? 'Generating...' : 'Share / Download'}
    </Button>
  )
}
