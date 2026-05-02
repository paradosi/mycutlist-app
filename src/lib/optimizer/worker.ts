/// <reference lib="webworker" />
import { expose } from 'comlink'
import { guillotinePack } from './guillotine'
import type { OptimizerInput, OptimizerProgress, OptimizerResult } from '@/types'

let cancelled = false

const optimizer = {
  async optimize(
    input: OptimizerInput,
    onProgress: (p: OptimizerProgress) => void,
  ): Promise<OptimizerResult> {
    cancelled = false
    const result = guillotinePack(input)
    onProgress({
      type: 'progress',
      generation: 1,
      bestUtilization: result.averageUtilization,
    })
    if (cancelled) {
      return {
        ...result,
        durationMs: result.durationMs,
      }
    }
    return result
  },
  cancel(): void {
    cancelled = true
  },
}

export type Optimizer = typeof optimizer

expose(optimizer)
