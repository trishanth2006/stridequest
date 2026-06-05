import { Button } from '@/components/ui/button'

type Props = {
  previousLevel: number
  currentLevel: number
  onClose: () => void
}

export function LevelUpModal({ previousLevel, currentLevel, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" data-testid="level-up-modal">
      <div 
        className="w-full max-w-sm bg-card rounded-3xl border border-primary/30 p-8 shadow-[0_0_50px_rgba(16,185,129,0.2)] flex flex-col items-center text-center animate-in zoom-in-95 duration-300"
        role="dialog"
        aria-modal="true"
      >
        <div className="text-5xl mb-6 animate-bounce">🎉</div>
        
        <h2 className="text-3xl font-black text-foreground mb-2 uppercase tracking-tight">
          Level Up!
        </h2>
        
        <div className="flex items-center justify-center gap-4 text-xl font-bold mb-8 w-full bg-black/20 py-4 rounded-xl border border-white/[0.04]">
          <span className="text-muted-foreground" data-testid="previous-level">Level {previousLevel}</span>
          <span className="text-primary">&rarr;</span>
          <span className="text-primary text-2xl" data-testid="current-level">Level {currentLevel}</span>
        </div>
        
        <Button 
          onClick={onClose}
          size="lg"
          className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary hover:scale-105 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
          data-testid="close-modal"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
