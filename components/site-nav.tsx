'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FEATURES } from '@/lib/features'
import { cn } from '@/lib/utils'

/**
 * The site menu: "Haveli" (home) and one tab per feature, the current one
 * lit. It sits in a corner of every page so you can always get to the other
 * tool without leaving the one you're in.
 */
export function SiteNav({ className }: { className?: string }) {
  const path = usePathname()
  return (
    <nav aria-label="Site" className={cn('card-glass flex items-center gap-0.5 rounded-full p-1 text-[11.5px] font-medium whitespace-nowrap shadow-lg', className)}>
      <Link href="/" className="text-muted-foreground hover:text-foreground rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] uppercase" title="Home">
        Haveli
      </Link>
      <span aria-hidden className="bg-border mx-0.5 h-3.5 w-px" />
      {FEATURES.map(({ href, label, Icon }) => {
        const on = path === href || path.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? 'page' : undefined}
            className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors', on ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent')}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
