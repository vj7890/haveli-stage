'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type Variant = 'default' | 'outline' | 'secondary' | 'ghost'
type Size = 'xs' | 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent',
  outline: 'border border-border bg-transparent text-foreground hover:bg-accent',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-accent border border-transparent',
  ghost: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent',
}
const SIZE: Record<Size, string> = {
  xs: 'h-6 px-2 text-[11px] rounded-md gap-1',
  sm: 'h-7 px-2.5 text-[12px] rounded-md gap-1.5',
  md: 'h-9 px-4 text-[13px] rounded-lg gap-2',
}

export function Button({ className, variant = 'default', size = 'sm', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        VARIANT[variant], SIZE[size], className,
      )}
      {...props}
    />
  )
}
