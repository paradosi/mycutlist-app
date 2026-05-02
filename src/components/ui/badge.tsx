'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export const Badge = ({
  className,
  ...p
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700',
      className,
    )}
    {...p}
  />
)
