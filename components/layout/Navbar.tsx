'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogoutButton } from '@/features/auth/components/LogoutButton'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { Activity } from 'lucide-react'

export function Navbar() {
  const pathname = usePathname()

  const navLink = (href: string, label: string) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={`relative rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-300 ease-out ${
          active
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
        {active && (
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
        )}
      </Link>
    )
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-3 pointer-events-none">
      <header className="mx-auto max-w-5xl pointer-events-auto border border-white/[0.04] bg-background/80 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_20px_rgba(0,0,0,0.4)]">
        <div className="flex h-14 items-center justify-between px-5">
          {/* Logo */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-bold tracking-tight text-foreground group transition-all duration-300 ease-out"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Activity className="h-4 w-4 text-primary" strokeWidth={2.5} />
            </span>
            <span className="text-base">StrideQuest</span>
          </Link>

          {/* Nav links + controls */}
          <nav className="flex items-center gap-1">
            {navLink('/dashboard', 'Dashboard')}
            {navLink('/xp', 'XP')}
            {navLink('/achievements', 'Achievements')}
            {navLink('/run', 'Run')}
            {navLink('/territory', 'Territory')}
            <div className="mx-2 h-5 w-[1px] bg-white/[0.06]" />
            <ThemeToggle />
            <LogoutButton />
          </nav>
        </div>
      </header>
    </div>
  )
}
