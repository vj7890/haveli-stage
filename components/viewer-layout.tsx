'use client'

import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import { PanelLeftClose, PanelLeftOpen, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Full-viewport shell: the canvas behind everything, a floating glass panel on
 * the left with one scroll container, a corner slot top-right and a HUD line
 * bottom-right. On phones the panel becomes a bottom drawer.
 */
export function ViewerLayout({ mountRef, title, subtitle, panel, corner, hud, loading }: {
  mountRef: RefObject<HTMLDivElement | null>
  title: string
  subtitle?: string
  panel: ReactNode
  corner?: ReactNode
  hud?: string
  loading?: boolean
}) {
  const [open, setOpen] = useState(true)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('viewer-page')
    return () => document.documentElement.classList.remove('viewer-page')
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" style={{ background: 'var(--scene-bg)' }} />

      {loading && (
        <div className="text-muted-foreground absolute inset-0 grid place-items-center text-sm">
          <div className="flex items-center gap-2">
            <span className="border-primary size-3 animate-spin rounded-full border-2 border-t-transparent" />
            loading the model…
          </div>
        </div>
      )}

      {/* desktop panel */}
      <aside className={cn('card-glass absolute top-3 bottom-3 left-3 z-10 hidden flex-col rounded-2xl shadow-2xl transition-[width] md:flex', open ? 'w-[372px]' : 'w-11')}>
        <div className="flex items-start gap-2 px-3 pt-3 pb-2">
          {open && (
            <div className="min-w-0 flex-1">
              <h1 className="text-[14px] font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">{subtitle}</p>}
            </div>
          )}
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-muted-foreground hover:text-foreground -mr-1 shrink-0 rounded-md p-1" title={open ? 'Collapse' : 'Expand'}>
            {open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>
        </div>
        {open && <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{panel}</div>}
      </aside>

      {/* phone drawer */}
      <button type="button" onClick={() => setDrawer(true)} className="card-glass absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-medium shadow-xl md:hidden">
        <SlidersHorizontal className="size-4" /> Controls
      </button>
      {drawer && (
        <div className="absolute inset-0 z-20 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="card-glass absolute inset-x-0 bottom-0 flex h-[72dvh] flex-col rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-3 pt-3 pb-2">
              <h1 className="text-[14px] font-semibold">{title}</h1>
              <button type="button" onClick={() => setDrawer(false)} className="text-muted-foreground p-1"><X className="size-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">{panel}</div>
          </div>
        </div>
      )}

      {corner && <div className="absolute top-3 right-3 z-10">{corner}</div>}
      {hud && <div className="text-muted-foreground absolute right-3 bottom-3 z-10 hidden text-[10.5px] tracking-wide lg:block">{hud}</div>}
    </div>
  )
}

export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-muted-foreground mt-3 mb-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase', className)}>{children}</div>
}

export function Row({ label, value, children }: { label: string; value?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span>{label}</span>
        {value !== undefined && <span className="tabular text-primary text-[10.5px]">{value}</span>}
      </div>
      {children}
    </div>
  )
}
