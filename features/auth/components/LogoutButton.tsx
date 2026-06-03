'use client'

import { Button } from '@/components/ui/button'
import { logoutAction } from '@/features/auth/actions'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] rounded-lg transition-colors"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </form>
  )
}
