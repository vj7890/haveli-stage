'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="bg-card pointer-events-none block size-3 rounded-full shadow transition-transform data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  )
}
