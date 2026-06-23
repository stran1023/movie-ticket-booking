'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'

import { cn } from '@/lib/utils'

export interface LabelProps
  extends React.ComponentProps<typeof LabelPrimitive.Root> {
  mandatory?: boolean
}

function Label({
  className,
  mandatory = false,
  children,
  ...props
}: LabelProps) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-1.5 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      {mandatory && (
        <span className="text-destructive" aria-hidden="true">
          *
        </span>
      )}
    </LabelPrimitive.Root>
  )
}

export { Label }
