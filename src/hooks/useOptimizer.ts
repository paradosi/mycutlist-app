'use client'

import * as React from 'react'
import { wrap, proxy, type Remote } from 'comlink'
import { guillotinePack } from '@/lib/optimizer/guillotine'
import type {
  OptimizerInput,
  OptimizerProgress,
  OptimizerResult,
} from '@/types'

type WorkerOptimizer = {
  optimize(
    input: OptimizerInput,
    onProgress: (p: OptimizerProgress) => void,
  ): Promise<OptimizerResult>
  cancel(): void
}

interface UseOptimizerReturn {
  optimize: (input: OptimizerInput) => Promise<OptimizerResult | null>
  cancel: () => void
  isRunning: boolean
  progress: OptimizerProgress | null
  result: OptimizerResult | null
  error: string | null
}

export function useOptimizer(): UseOptimizerReturn {
  const [isRunning, setIsRunning] = React.useState(false)
  const [progress, setProgress] = React.useState<OptimizerProgress | null>(null)
  const [result, setResult] = React.useState<OptimizerResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const workerRef = React.useRef<Worker | null>(null)
  const remoteRef = React.useRef<Remote<WorkerOptimizer> | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const worker = new Worker(
        new URL('@/lib/optimizer/worker.ts', import.meta.url),
        { type: 'module' },
      )
      workerRef.current = worker
      remoteRef.current = wrap<WorkerOptimizer>(worker)
    } catch {
      remoteRef.current = null
    }
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
      remoteRef.current = null
    }
  }, [])

  const optimize = React.useCallback(
    async (input: OptimizerInput): Promise<OptimizerResult | null> => {
      setIsRunning(true)
      setError(null)
      setProgress(null)
      try {
        const remote = remoteRef.current
        let res: OptimizerResult
        if (remote) {
          res = await remote.optimize(input, proxy(setProgress))
        } else {
          // Fallback: run on main thread (e.g. SSR-only environments).
          res = guillotinePack(input)
          setProgress({
            type: 'progress',
            generation: 1,
            bestUtilization: res.averageUtilization,
          })
        }
        setResult(res)
        return res
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
        return null
      } finally {
        setIsRunning(false)
      }
    },
    [],
  )

  const cancel = React.useCallback(() => {
    void remoteRef.current?.cancel()
    setIsRunning(false)
  }, [])

  return { optimize, cancel, isRunning, progress, result, error }
}
