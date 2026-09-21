'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

export function Slider({ className, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root className={cn('relative flex h-4 w-full touch-none items-center select-none', className)} {...props}>
      <SliderPrimitive.Track className="bg-muted relative h-1 w-full grow overflow-hidden rounded-full">
        <SliderPrimitive.Range className="bg-primary absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="bg-card border-primary block size-3.5 rounded-full border-2 shadow transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" />
    </SliderPrimitive.Root>
  )
}
