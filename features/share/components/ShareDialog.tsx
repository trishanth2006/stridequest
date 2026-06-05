"use client"

import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ShareCardPreview } from './ShareCardPreview'
import { ShareEditorControls } from './ShareEditorControls'
import { ShareDownloadButton } from './ShareDownloadButton'
import type { AnyShareCard, ShareConfig } from '../types'
import { Button } from '@/components/ui/button'
import { Share } from 'lucide-react'

interface ShareDialogProps {
  cardData: AnyShareCard
  trigger?: React.ReactNode
  defaultConfig?: Partial<ShareConfig>
}

const DEFAULT_CONFIG: ShareConfig = {
  theme: 'midnight',
  layout: 'classic',
  aspectRatio: 'portrait',
  showPreviousRecord: true,
}

export function ShareDialog({ cardData, trigger, defaultConfig }: ShareDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<ShareConfig>({ ...DEFAULT_CONFIG, ...defaultConfig })
  const previewRef = useRef<HTMLDivElement>(null)

  const handleConfigChange = (updates: Partial<ShareConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Share className="h-4 w-4" /> Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 border-b shrink-0 bg-white z-10">
          <DialogTitle>Share Your Achievement</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 overflow-hidden min-h-0 bg-slate-100">
          {/* Preview Area (Top, 75%+) */}
          <div className="flex-1 min-h-[50vh] flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
            <ShareCardPreview
              ref={previewRef}
              cardData={cardData}
              config={config}
              editable
            />
          </div>
          
          {/* Controls Area (Bottom) */}
          <div className="shrink-0 bg-white border-t flex flex-col max-h-[40vh]">
            <div className="overflow-y-auto p-2">
              <ShareEditorControls 
                cardData={cardData}
                config={config} 
                onChange={handleConfigChange} 
              />
            </div>
            <div className="p-4 border-t bg-slate-50 shrink-0">
              <ShareDownloadButton
                cardRef={previewRef}
                cardData={cardData}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
